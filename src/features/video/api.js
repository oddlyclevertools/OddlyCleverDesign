// The video editor's actions, used by the timeline UI and offered to the AI as tools. Each one
// is a single undo step and returns plain data.
import { newId } from "../../core/editor.js";
import { downloadBlob, sanitizeFilename } from "../files/util.js";
import { exportVideo as renderVideo } from "./export.js";
import { beatsOf, importMedia, infoOf } from "./media.js";
import { listMedia } from "./media-db.js";
import * as M from "./model.js";
import { VdVideo, pipObjects } from "./pip.js";
import { readTimeline, scenesOf, writeTimeline } from "./store.js";
import * as Q from "./cues.js";

const r3 = (v) => Math.round(v * 1000) / 1000;

/** Change the timeline with a pure edit and record one undo step. */
export function edit(app, fn, label, opts) {
  const next = fn(readTimeline(app));
  writeTimeline(app, next, label, opts);
  return next;
}

async function mediaFor(app, { mediaId, file, name }) {
  if (file) return importMedia(file, { name });
  if (!mediaId) throw new Error("Give a mediaId (from listTimeline().media) or a file.");
  const info = await infoOf(mediaId);
  if (!info) throw new Error("That file isn't in the media library.");
  return info;
}

/** A clip as plain data for the AI and tests. */
export function describeClip(c) {
  return {
    id: c.id, track: c.track, kind: c.kind, name: c.name, mediaId: c.mediaId,
    start: r3(c.start), end: r3(M.clipEnd(c)), length: r3(M.clipLength(c)), in: c.in, out: c.out,
    speed: c.speed, volume: c.volume, muted: c.muted, fadeIn: c.fadeIn, fadeOut: c.fadeOut,
    fit: c.fit, overlay: c.overlay, transition: c.transition,
    reverse: c.reverse, keepPitch: c.keepPitch, ...(c.freeze ? { freeze: true, hold: c.hold } : {}),
    ...(c.fit === "color" ? { fill: c.fill } : {}), ...(c.fit === "free" ? { reframe: c.reframe } : {}),
  };
}

/**
 * Add a video or sound clip (from the media library or a File) to a track.
 * @param {{ mediaId?: string, file?: File, track?: string, start?: number, in?: number, out?: number, speed?: number, volume?: number }} opts
 */
export async function addClip(app, opts = {}) {
  const media = await mediaFor(app, opts);
  let clip;
  edit(app, (tl) => {
    const res = M.addClip(tl, media, opts);
    clip = res.clip;
    return res.tl;
  }, "Add clip");
  return describeClip(clip);
}

/** Add a music track (ducked under the voice by default). */
export async function addMusic(app, { mediaId, file, start = 0, volume = 0.8, duck = true, fadeIn = 1, fadeOut = 2 } = {}) {
  const media = await mediaFor(app, { mediaId, file });
  let clip;
  edit(app, (tl) => {
    const res = M.addClip(tl, { ...media, kind: "audio" }, { track: "music", start, volume });
    clip = res.clip;
    const t2 = M.updateClip(res.tl, clip.id, { fadeIn, fadeOut });
    clip = M.findClip(t2, clip.id);
    return M.setDuck(t2, { on: Boolean(duck) });
  }, "Add music");
  return describeClip(clip);
}

/** Trim a clip: in/out in the file's seconds, or startAt/endAt on the timeline. */
export async function trimClip(app, { id, in: inS, out, startAt, endAt } = {}) {
  const c = M.findClip(readTimeline(app), id);
  if (!c) throw new Error("That clip isn't on the timeline.");
  const info = await infoOf(c.mediaId);
  const next = edit(app, (tl) => M.trimClip(tl, id, { in: inS, out, startAt, endAt }, info?.duration ?? Infinity), "Trim clip");
  return describeClip(M.findClip(next, id));
}

/** Split a clip at a timeline time (default: the playhead). Returns both halves. */
export function splitClip(app, { id, at } = {}) {
  const when = at ?? app.video?.preview?.time ?? 0;
  let res;
  edit(app, (tl) => { res = M.splitClip(tl, id, when); return res.tl; }, "Split clip");
  return { left: describeClip(res.left), right: describeClip(res.right) };
}

/** Move a clip to a start time (and optionally another track of the same kind). */
export function moveClip(app, { id, start, track } = {}) {
  const next = edit(app, (tl) => M.moveClip(tl, id, Number(start), track), "Move clip");
  return describeClip(M.findClip(next, id));
}

/** Remove a clip from the timeline (its file stays in the library; undo brings it back). */
export function deleteClip(app, { id } = {}) {
  const ed = app.editor;
  const pips = pipObjects(ed.canvas.getObjects()).filter((o) => o.data?.vdClip === id);
  const tl = M.removeClip(readTimeline(app), id);
  if (pips.length) {
    ed.canvas.discardActiveObject();
    ed.canvas.remove(...pips);
  }
  writeTimeline(app, tl, "Delete clip");
  return { removed: id };
}

/** Volume (0..2), fades (s), mute and speed (0.1..10) of a clip. */
export function setVolume(app, { id, volume, fadeIn, fadeOut, muted, speed } = {}) {
  const patch = {};
  if (volume != null) patch.volume = Number(volume);
  if (fadeIn != null) patch.fadeIn = Number(fadeIn);
  if (fadeOut != null) patch.fadeOut = Number(fadeOut);
  if (muted != null) patch.muted = Boolean(muted);
  if (speed != null) patch.speed = Number(speed);
  const next = edit(app, (tl) => M.updateClip(tl, id, patch), "Clip sound");
  return describeClip(M.findClip(next, id));
}

/** Any other clip setting: { name, fit, overlay, ... }. `merge` folds a slider drag into one step. */
export function updateClip(app, id, patch, { label = "Clip settings", merge = false } = {}) {
  const next = edit(app, (tl) => M.updateClip(tl, id, patch), label, { merge });
  return describeClip(M.findClip(next, id));
}

/**
 * Set the transition into a video clip or a scene: type "cut" | "crossfade" | "dip" | "slide" |
 * "wipe" | "zoom" | "whip" | "spin", dur in s.
 * `id` is a clip id or a scene id.
 */
export function addTransition(app, { id, type = "crossfade", dur = 0.6 } = {}) {
  const tl = readTimeline(app);
  const transition = M.cleanTransition({ type, dur });
  if (M.findClip(tl, id)) {
    edit(app, (t) => M.updateClip(t, id, { transition }), "Transition");
  } else if (scenesOf(app, tl).some((s) => s.id === id)) {
    edit(app, (t) => M.updateScene(t, id, { transition }), "Transition");
  } else throw new Error("No clip or scene has that id.");
  return { id, transition };
}

/** Change a scene's length (s). */
export function setSceneDuration(app, { id = "page", duration } = {}) {
  edit(app, (tl) => M.updateScene(tl, id, { duration }), "Scene length");
  return scenesOf(app).find((s) => s.id === id) || null;
}

/** Music ducking under the voice: { on, amount (0.05..1, the music level while someone talks) }. */
export function setDucking(app, { on, amount } = {}) {
  const next = edit(app, (tl) => M.setDuck(tl, { ...(on != null ? { on: Boolean(on) } : {}), ...(amount != null ? { amount } : {}) }), "Music ducking");
  return next.duck;
}

/** Show a video clip as a movable, resizable picture on the design (or back to full frame). */
export async function setPictureInPicture(app, { id, on = true, left, top, width } = {}) {
  const ed = app.editor;
  const tl = readTimeline(app);
  const c = M.findClip(tl, id);
  if (!c || c.kind !== "video") throw new Error("Pick a video clip first.");
  const existing = pipObjects(ed.canvas.getObjects()).filter((o) => o.data?.vdClip === id);
  if (!on) {
    if (!existing.length) return { id, pip: false };
    ed.canvas.discardActiveObject();
    ed.canvas.remove(...existing);
    ed.canvas.requestRenderAll();
    ed.commit("Full-frame video");
    app.bus.emit("video:changed", tl);
    return { id, pip: false };
  }
  if (existing.length) return { id, pip: true, objectId: existing[0].id };
  const info = await infoOf(c.mediaId);
  const aspect = info?.width && info?.height ? info.height / info.width : 9 / 16;
  const w = Math.round(width ?? ed.width * (ed.width > ed.height ? 0.36 : 0.6));
  const h = Math.round(w * aspect);
  const margin = Math.round(Math.min(ed.width, ed.height) * 0.05);
  const obj = new VdVideo({
    left: left ?? ed.width - w - margin, top: top ?? ed.height - h - margin, width: w, height: h,
    originX: "left", originY: "top", rx: Math.round(Math.min(w, h) * 0.06), ry: Math.round(Math.min(w, h) * 0.06),
    id: newId(), name: c.name, data: { vdClip: id },
  });
  ed.canvas.add(obj);
  ed.canvas.setActiveObject(obj);
  ed.canvas.requestRenderAll();
  ed.commit("Picture in picture");
  app.bus.emit("video:changed", tl);
  return { id, pip: true, objectId: obj.id };
}

/**
 * Captions: word-timed text drawn on top of the video. Replaces any caption track.
 * cues = [{ start, end, text, words?: [{ text, start, end }] }] in timeline seconds; null removes them.
 */
export function addCaptionTrack(app, cues, style) {
  const next = edit(app, (tl) => M.setCaptions(tl, cues, style), cues ? "Captions" : "Remove captions");
  return { cues: next.captions?.cues.length || 0 };
}

/** Find the beats of a music clip; returns { bpm, beats (timeline s) }. */
export async function findBeats(app, { id } = {}) {
  const tl = readTimeline(app);
  const c = id ? M.findClip(tl, id) : M.clipsOn(tl, "music")[0];
  if (!c) throw new Error("Add a music clip first.");
  const b = await beatsOf(c.mediaId);
  app.bus.emit("video:beats", c.id);
  return { clip: c.id, bpm: b.bpm, beats: M.clipBeats(c, b.beats) };
}

/** Move scene changes (and video clip starts) onto the nearest beats of the music. */
export async function snapToBeats(app, { id } = {}) {
  const { beats } = await findBeats(app, { id });
  if (!beats.length) throw new Error("No clear beat was found in this music.");
  const tl = readTimeline(app);
  const scenes = scenesOf(app, tl);
  const durations = M.snapScenesToBeats(scenes, beats);
  let next = tl;
  for (const [sid, d] of Object.entries(durations)) next = M.updateScene(next, sid, { duration: d });
  next = M.snapClipsToBeats(next, beats, "video");
  writeTimeline(app, next, "Snap to the beat");
  return { scenes: Object.keys(durations).length, clips: M.clipsOn(next, "video").length, beats: beats.length };
}

/** The whole timeline as plain data: length, scenes, clips, captions, and the media library. */
export async function listTimeline(app) {
  const tl = readTimeline(app);
  const scenes = scenesOf(app, tl);
  const media = await listMedia().catch(() => []);
  return {
    duration: M.totalDuration(tl, scenes),
    size: { width: app.editor.width, height: app.editor.height, vertical: app.editor.height > app.editor.width },
    scenes: scenes.map((s) => ({ id: s.id, label: s.label, start: r3(s.start), duration: s.duration, transition: s.transition })),
    clips: tl.clips.map(describeClip).sort((a, b) => a.start - b.start),
    pictureInPicture: pipObjects(app.editor.canvas.getObjects()).map((o) => o.data?.vdClip),
    captions: tl.captions ? tl.captions.cues.length : 0,
    ducking: tl.duck,
    media: media.map((m) => ({ id: m.id, name: m.name, kind: m.kind, duration: m.duration, width: m.width, height: m.height, hasAudio: m.hasAudio })),
  };
}

/**
 * Export the timeline as an MP4 (H.264 + AAC). quality "1080p" | "4k"; fps 30 | 60.
 * Downloads it unless download is false; returns the details (and the blob when not downloaded).
 */
export async function exportVideo(app, { quality = "1080p", fps = 30, download = true, onProgress } = {}) {
  const res = await renderVideo(app, { quality, fps, onProgress });
  if (download) {
    const filename = `${sanitizeFilename(app.project?.name || "video")}.mp4`;
    downloadBlob(res.blob, filename);
    const { blob, ...rest } = res;
    return { ...rest, filename, bytes: blob.size };
  }
  return res;
}

// ---- speed, freeze, ripple, fit -------------------------------------------------------------

/** Speed (0.1..10), playing backwards, and keeping the voice's pitch when sped up or slowed. */
export function setSpeed(app, { id, speed, reverse, keepPitch } = {}) {
  const patch = {};
  if (speed != null) patch.speed = Number(speed);
  if (reverse != null) patch.reverse = Boolean(reverse);
  if (keepPitch != null) patch.keepPitch = Boolean(keepPitch);
  const next = edit(app, (tl) => M.updateClip(tl, id, patch), reverse != null ? "Reverse clip" : "Clip speed");
  return describeClip(M.findClip(next, id));
}

/** Hold the frame at timeline time `at` (default: the playhead) for `hold` seconds; the rest of the track moves right. */
export function freezeFrame(app, { id, at, hold = 2 } = {}) {
  const when = at ?? app.video?.preview?.time ?? 0;
  let res;
  edit(app, (tl) => { res = M.freezeFrame(tl, id, when, hold); return res.tl; }, "Freeze frame");
  return describeClip(res.freeze);
}

/** Remove a clip and close the gap it leaves on its track (one undo step). */
export function rippleDelete(app, { id } = {}) {
  const ed = app.editor;
  const pips = pipObjects(ed.canvas.getObjects()).filter((o) => o.data?.vdClip === id);
  const tl = M.rippleDelete(readTimeline(app), id);
  if (pips.length) {
    ed.canvas.discardActiveObject();
    ed.canvas.remove(...pips);
  }
  writeTimeline(app, tl, "Ripple delete");
  return { removed: id };
}

/** Move a clip by `by` seconds (a frame is 1/30). */
export function nudgeClip(app, { id, by = 1 / 30 } = {}) {
  const c = M.findClip(readTimeline(app), id);
  if (!c) throw new Error("That clip isn't on the timeline.");
  const next = edit(app, (tl) => M.moveClip(tl, id, c.start + Number(by)), "Nudge clip");
  return describeClip(M.findClip(next, id));
}

/**
 * How a full-frame video fills a page of another shape: fit "cover" (crop the edges),
 * "contain" (black bars), "blur" (a blurred copy behind), "color" (a colour behind: `fill`)
 * or "free" (move and zoom it yourself: `reframe` { x, y: -1..1, zoom: 1..4 }).
 */
export function setFit(app, { id, fit, fill, reframe } = {}, { merge = false } = {}) {
  const patch = {};
  if (fit) patch.fit = M.FITS.includes(fit) ? fit : "cover";
  if (fill) patch.fill = String(fill);
  if (reframe) patch.reframe = reframe;
  const next = edit(app, (tl) => M.updateClip(tl, id, patch), "Video fit", { merge });
  return describeClip(M.findClip(next, id));
}

/** Add (or replace) a reframe key point at timeline time `at` with the clip's view there. */
export function addReframeKey(app, { id, at, x, y, zoom } = {}) {
  const tl = readTimeline(app);
  const c = M.findClip(tl, id);
  if (!c) throw new Error("That clip isn't on the timeline.");
  const when = at ?? app.video?.preview?.time ?? c.start;
  const s = Math.round(M.sourceTime(c, Math.max(c.start, Math.min(M.clipEnd(c), when))) * 1000) / 1000;
  const cur = M.reframeAt(c, s);
  const key = { t: s, x: x ?? cur.x, y: y ?? cur.y, zoom: zoom ?? cur.zoom };
  const keys = [...(c.reframe.keys || []).filter((k) => Math.abs(k.t - s) > 0.02), key];
  return setFit(app, { id, fit: "free", reframe: { keys } });
}

// ---- captions -------------------------------------------------------------------------------

/** Change the caption look: { preset, font, color, highlight, size (0.5..2), y (0.06..0.94) }. */
export function setCaptionStyle(app, patch = {}, { merge = false } = {}) {
  const tl = readTimeline(app);
  if (!tl.captions) throw new Error("Add captions first.");
  const style = { ...tl.captions.style, ...patch };
  if (patch.preset && patch.preset !== tl.captions.style.preset) {
    // A new preset brings its own font and colours unless they're set in the same call.
    for (const k of ["font", "color", "highlight"]) if (!(k in patch)) delete style[k];
  }
  const next = edit(app, (t) => M.setCaptions(t, t.captions.cues, style), "Caption style", { merge });
  return next.captions.style;
}

function editCues(app, fn, label) {
  const tl = readTimeline(app);
  if (!tl.captions) throw new Error("Add captions first.");
  const next = edit(app, (t) => M.setCaptions(t, fn(t.captions.cues), t.captions.style), label);
  return { cues: next.captions?.cues.length || 0 };
}

/** Change caption number `index` (0 = first): { text?, start?, end? } in timeline seconds. */
export const editCaption = (app, { index, text, start, end } = {}) => editCues(app, (q) => Q.editCue(q, index, { text, start, end }), "Edit caption");
/** Split a caption at time `at` (default: between its middle words). */
export const splitCaption = (app, { index, at } = {}) => editCues(app, (q) => Q.splitCue(q, index, at), "Split caption");
/** Join a caption with the next one. */
export const mergeCaptions = (app, { index } = {}) => editCues(app, (q) => Q.mergeCues(q, index), "Join captions");
/** Remove one caption (undo brings it back). */
export const removeCaption = (app, { index } = {}) => editCues(app, (q) => Q.removeCue(q, index), "Remove caption");
/** Move a caption by `by` seconds. */
export const moveCaption = (app, { index, by } = {}) => editCues(app, (q) => Q.shiftCue(q, index, by), "Move caption");
/** Add a caption at time `at` (default: the playhead). */
export function addCaption(app, { at, text } = {}) {
  const when = at ?? app.video?.preview?.time ?? 0;
  const tl = readTimeline(app);
  const next = edit(app, (t) => M.setCaptions(t, Q.addCue(t.captions?.cues || [], when, text || "New caption"), tl.captions?.style || { preset: "highlight" }), "Add caption");
  return { cues: next.captions.cues.length };
}
