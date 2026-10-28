// The timeline data and its pure edits. Every function here returns a NEW timeline and never
// changes the one it was given, so undo (whole-design snapshots) and the UI stay simple.
//
// Stored in the design as page.data.video (media files are NOT here: only their ids; the files
// live in IndexedDB, see media-db.js):
//   {
//     v: 1,
//     scenes:   { [sceneId]: { duration?, transition? } },     // the design's pages
//     clips:    [ Clip ],
//     captions: { cues: [Cue], style: { position, size } } | null,
//     duck:     { on: boolean, amount: 0..1 },                  // music level under the voice
//   }
//   Clip = { id, track, mediaId, name, kind: "video"|"audio", start, in, out, speed, volume,
//            muted, fadeIn, fadeOut, overlay: boolean,
//            reverse: boolean, keepPitch: boolean, freeze: boolean, hold (s, a freeze frame's length),
//            fit: "cover"|"contain"|"blur"|"color"|"free", fill (colour behind "color"),
//            reframe: { x, y, zoom, keys: [{ t, x, y, zoom }] } (the "free" fit; t = source s),
//            transition: { type: TRANSITIONS id, dur } }
//   Cue  = { start, end, text, words?: [{ text, start, end }] }
//   captions.style = { preset, font?, color?, highlight?, size, position, y? } (caption-styles.js)

export const TRACKS = [
  { id: "scenes", label: "Design", kind: "scene", icon: "LayoutTemplate" },
  { id: "video", label: "Video", kind: "video", icon: "Film" },
  { id: "voice", label: "Voice", kind: "audio", icon: "Mic" },
  { id: "music", label: "Music", kind: "audio", icon: "Music" },
  { id: "sfx", label: "Sound effects", kind: "audio", icon: "AudioLines" },
];
export const AUDIO_TRACKS = ["voice", "music", "sfx"];
export const TRANSITIONS = [
  { id: "cut", label: "Cut" },
  { id: "crossfade", label: "Crossfade" },
  { id: "dip", label: "Dip to black" },
  { id: "slide", label: "Slide" },
  { id: "wipe", label: "Wipe" },
  { id: "zoom", label: "Zoom" },
  { id: "whip", label: "Whip pan" },
  { id: "spin", label: "Spin" },
];
/** Transitions where the new picture comes in over the old one (the old one stays up under it). */
export const BLENDS = new Set(["crossfade", "slide", "wipe", "zoom", "whip", "spin"]);
export const FITS = ["cover", "contain", "blur", "color", "free"];
export const MIN_SPEED = 0.1;
export const MAX_SPEED = 10;
export const MAX_HOLD = 60;         // longest freeze frame (s)
export const MAX_ZOOM = 4;          // free reframe
export const MIN_CLIP = 0.1;        // shortest clip (s)
export const MIN_SCENE = 0.5;       // shortest scene (s)
export const MAX_SCENE = 3600;
export const MAX_VOLUME = 2;        // 200 %
export const DEFAULT_SCENE = 5;

const round = (v, k = 1000) => Math.round(v * k) / k;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let seq = 0;
export const clipId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** An empty timeline. */
export function emptyTimeline() {
  return { v: 1, scenes: {}, clips: [], captions: null, duck: { on: true, amount: 0.3 } };
}

/** A clean timeline from stored data (anything missing or broken is filled in or dropped). */
export function normalize(raw) {
  const tl = emptyTimeline();
  if (!raw || typeof raw !== "object") return tl;
  if (raw.scenes && typeof raw.scenes === "object") {
    for (const [id, s] of Object.entries(raw.scenes)) {
      if (!s || typeof s !== "object") continue;
      const out = {};
      if (Number.isFinite(s.duration)) out.duration = clamp(s.duration, MIN_SCENE, MAX_SCENE);
      if (s.transition) out.transition = cleanTransition(s.transition);
      tl.scenes[id] = out;
    }
  }
  if (Array.isArray(raw.clips)) tl.clips = raw.clips.map(cleanClip).filter(Boolean);
  if (raw.captions && Array.isArray(raw.captions.cues)) tl.captions = cleanCaptions(raw.captions);
  if (raw.duck && typeof raw.duck === "object") {
    tl.duck = { on: raw.duck.on !== false, amount: clamp(Number(raw.duck.amount) || 0.3, 0.05, 1) };
  }
  return tl;
}

export function cleanTransition(t) {
  const type = TRANSITIONS.some((x) => x.id === t?.type) ? t.type : "cut";
  return { type, dur: clamp(Number(t?.dur) || 0.5, 0.1, 3) };
}

function cleanClip(c) {
  if (!c || typeof c !== "object" || typeof c.mediaId !== "string") return null;
  const track = TRACKS.some((t) => t.id === c.track && t.id !== "scenes") ? c.track : null;
  if (!track) return null;
  const inS = Math.max(0, Number(c.in) || 0);
  const out = Math.max(inS + MIN_CLIP, Number(c.out) || inS + 1);
  return {
    id: typeof c.id === "string" ? c.id : clipId(),
    track, mediaId: c.mediaId,
    name: typeof c.name === "string" ? c.name.slice(0, 120) : "Clip",
    kind: c.kind === "video" ? "video" : "audio",
    start: Math.max(0, Number(c.start) || 0),
    in: inS, out,
    speed: clamp(Number(c.speed) || 1, MIN_SPEED, MAX_SPEED),
    volume: clamp(Number.isFinite(c.volume) ? c.volume : 1, 0, MAX_VOLUME),
    muted: Boolean(c.muted),
    fadeIn: Math.max(0, Number(c.fadeIn) || 0),
    fadeOut: Math.max(0, Number(c.fadeOut) || 0),
    overlay: Boolean(c.overlay),
    reverse: Boolean(c.reverse),
    keepPitch: c.keepPitch !== false,
    freeze: Boolean(c.freeze),
    hold: clamp(Number(c.hold) || 2, MIN_CLIP, MAX_HOLD),
    fit: FITS.includes(c.fit) ? c.fit : "cover",
    fill: typeof c.fill === "string" && c.fill.length < 40 ? c.fill : "#101014",
    reframe: cleanReframe(c.reframe),
    transition: cleanTransition(c.transition),
  };
}

const cleanView = (v) => ({
  x: clamp(Number(v?.x) || 0, -1, 1), y: clamp(Number(v?.y) || 0, -1, 1), zoom: clamp(Number(v?.zoom) || 1, 1, MAX_ZOOM),
});
function cleanReframe(r) {
  const keys = Array.isArray(r?.keys) ? r.keys.filter((k) => Number.isFinite(Number(k?.t)))
    .map((k) => ({ t: round(Number(k.t)), ...cleanView(k) })).sort((a, b) => a.t - b.t).slice(0, 50) : [];
  return { ...cleanView(r), keys };
}

function cleanCaptions(c) {
  const cues = c.cues.map((q) => {
    const start = Number(q?.start), end = Number(q?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const words = Array.isArray(q.words) ? q.words.map((w) => ({
      text: String(w?.text ?? "").slice(0, 60), start: Number(w?.start) || start, end: Number(w?.end) || end,
    })).filter((w) => w.text) : undefined;
    return { start, end, text: String(q.text ?? words?.map((w) => w.text).join(" ") ?? "").slice(0, 400), ...(words?.length ? { words } : {}) };
  }).filter(Boolean).sort((a, b) => a.start - b.start);
  const st = c.style || {};
  return {
    cues,
    style: {
      preset: typeof st.preset === "string" && /^[a-z]{2,16}$/.test(st.preset) ? st.preset : "highlight",
      position: ["bottom", "middle", "top"].includes(st.position) ? st.position : "bottom",
      size: clamp(Number(st.size) || 1, 0.5, 2),
      ...(Number.isFinite(Number(st.y)) && st.y != null ? { y: clamp(Number(st.y), 0.06, 0.94) } : {}),
      ...(typeof st.font === "string" && st.font.length < 40 ? { font: st.font } : {}),
      ...(typeof st.color === "string" && st.color.length < 40 ? { color: st.color } : {}),
      ...(typeof st.highlight === "string" && st.highlight.length < 40 ? { highlight: st.highlight } : {}),
    },
  };
}

// ---- measuring --------------------------------------------------------------------------

/** How long a clip lasts on the timeline (s). A freeze frame lasts `hold`. */
export const clipLength = (c) => (c.freeze ? c.hold : (c.out - c.in) / c.speed);
export const clipEnd = (c) => c.start + clipLength(c);
/** The source time (s into the file) that plays at timeline time t (backwards when reversed). */
export const sourceTime = (c, t) => {
  if (c.freeze) return c.in;
  return c.reverse ? c.out - (t - c.start) * c.speed : c.in + (t - c.start) * c.speed;
};
/** The timeline time at which source time s plays. */
export const timelineTime = (c, s) => {
  if (c.freeze) return c.start;
  return c.reverse ? c.start + (c.out - s) / c.speed : c.start + (s - c.in) / c.speed;
};

/** The free-reframe view { x, y, zoom } of a clip at source time s (between its key points). */
export function reframeAt(c, s) {
  const r = c.reframe || { x: 0, y: 0, zoom: 1, keys: [] };
  const k = r.keys || [];
  if (!k.length) return { x: r.x, y: r.y, zoom: r.zoom };
  if (s <= k[0].t) return { x: k[0].x, y: k[0].y, zoom: k[0].zoom };
  for (let i = 1; i < k.length; i++) {
    if (s <= k[i].t) {
      const a = k[i - 1], b = k[i];
      const f = b.t === a.t ? 1 : (s - a.t) / (b.t - a.t);
      const e = f * f * (3 - 2 * f); // ease in and out between points
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, zoom: a.zoom + (b.zoom - a.zoom) * e };
    }
  }
  const z = k[k.length - 1];
  return { x: z.x, y: z.y, zoom: z.zoom };
}

export const findClip = (tl, id) => tl.clips.find((c) => c.id === id) || null;
export const clipsOn = (tl, track) => tl.clips.filter((c) => c.track === track).sort((a, b) => a.start - b.start);

/**
 * The scenes in order with their start times.
 * @param {{ id: string, label?: string, defaultDuration?: number }[]} pages the design's pages
 */
export function sceneList(tl, pages) {
  let at = 0;
  return pages.map((p, index) => {
    const s = tl.scenes[p.id] || {};
    const duration = s.duration ?? p.defaultDuration ?? DEFAULT_SCENE;
    const out = {
      id: p.id, index, label: p.label || `Scene ${index + 1}`, start: at, duration,
      transition: index === 0 ? { type: "cut", dur: 0.5 } : (s.transition || { type: "cut", dur: 0.5 }),
    };
    at += duration;
    return out;
  });
}

/** The whole video's length: the scenes, every clip and the captions. */
export function totalDuration(tl, scenes) {
  let end = scenes.reduce((m, s) => Math.max(m, s.start + s.duration), 0);
  for (const c of tl.clips) end = Math.max(end, clipEnd(c));
  for (const q of tl.captions?.cues || []) end = Math.max(end, q.end);
  return round(end);
}

/** Where a new clip goes on a track: right after the last clip there. */
export function trackEnd(tl, track) {
  return clipsOn(tl, track).reduce((m, c) => Math.max(m, clipEnd(c)), 0);
}

// ---- edits (each returns a new timeline) -------------------------------------------------

const withClips = (tl, clips) => ({ ...tl, clips });
const mapClip = (tl, id, fn) => {
  if (!findClip(tl, id)) throw new Error("That clip isn't on the timeline any more.");
  return withClips(tl, tl.clips.map((c) => (c.id === id ? cleanClip(fn(c)) : c)));
};

/** Add a clip. `media` = { id, name, kind, duration }. Returns { tl, clip }. */
export function addClip(tl, media, { track, start, in: inS = 0, out, speed = 1, volume = 1 } = {}) {
  if (!media?.id) throw new Error("Pick a video or sound file first.");
  const kind = media.kind === "video" ? "video" : "audio";
  const tr = track || (kind === "video" ? "video" : (media.duration && media.duration < 8 ? "sfx" : "music"));
  if (kind === "audio" && tr === "video") throw new Error("Sound files go on the voice, music or sound effects track.");
  if (!TRACKS.some((t) => t.id === tr && t.id !== "scenes")) throw new Error(`There's no "${tr}" track.`);
  const dur = Number(media.duration) || 1;
  const i0 = clamp(Number(inS) || 0, 0, Math.max(0, dur - MIN_CLIP));
  const o0 = clamp(out == null ? dur : Number(out), i0 + MIN_CLIP, dur);
  const clip = cleanClip({
    id: clipId(), track: tr, mediaId: media.id, name: media.name || (kind === "video" ? "Video" : "Sound"), kind,
    start: start == null ? trackEnd(tl, tr) : Math.max(0, Number(start)), in: i0, out: o0, speed, volume,
    transition: { type: "cut", dur: 0.5 },
  });
  return { tl: withClips(tl, [...tl.clips, clip]), clip };
}

/** Change a clip's settings (volume, fades, speed, fit, mute, overlay, name). */
export function updateClip(tl, id, patch) {
  return mapClip(tl, id, (c) => {
    const next = { ...c, ...patch };
    if (patch.speed != null) {
      // Changing speed keeps the start and the source range: the clip gets longer or shorter.
      next.speed = clamp(Number(patch.speed) || 1, MIN_SPEED, MAX_SPEED);
    }
    if (patch.transition) next.transition = cleanTransition({ ...c.transition, ...patch.transition });
    if (patch.reframe) next.reframe = cleanReframe({ ...c.reframe, ...patch.reframe });
    return next;
  });
}

export function removeClip(tl, id) {
  if (!findClip(tl, id)) throw new Error("That clip isn't on the timeline any more.");
  return withClips(tl, tl.clips.filter((c) => c.id !== id));
}

/** Move a clip to a new start (and optionally another track of the same kind). */
export function moveClip(tl, id, start, track) {
  return mapClip(tl, id, (c) => {
    let tr = c.track;
    if (track && track !== c.track) {
      const ok = c.kind === "audio" ? AUDIO_TRACKS.includes(track) : track === "video";
      if (ok) tr = track;
    }
    return { ...c, start: round(Math.max(0, start)), track: tr };
  });
}

/**
 * Trim a clip. Any of: `in`/`out` (source seconds), or `startAt`/`endAt` (timeline seconds of the
 * left/right edge, as when dragging the ends). `mediaDuration` limits how far it can grow.
 */
export function trimClip(tl, id, { in: inS, out, startAt, endAt } = {}, mediaDuration = Infinity) {
  return mapClip(tl, id, (c) => {
    if (c.freeze) return trimFreeze(c, startAt, endAt);
    let { start, in: i, out: o } = c;
    const sp = c.speed;
    if (startAt != null) {
      // Dragging the left edge: the source moves with it, the right edge stays put. A reversed clip
      // starts at its source end, so the left edge changes `out` instead of `in`.
      const room = c.reverse ? (mediaDuration - c.out) / sp : c.in / sp;
      const wanted = clamp(Number(startAt), c.start - room, clipEnd(c) - MIN_CLIP / sp);
      if (c.reverse) o = c.out + (c.start - wanted) * sp;
      else i = c.in + (wanted - c.start) * sp;
      start = Math.max(0, wanted);
    }
    if (endAt != null) {
      if (c.reverse) i = c.out - (Number(endAt) - c.start) * sp;
      else o = c.in + (Number(endAt) - c.start) * sp;
    }
    if (inS != null) {
      const ni = Number(inS);
      if (!c.reverse) start = Math.max(0, c.start + (ni - c.in) / sp);
      i = ni;
    }
    if (out != null) {
      if (c.reverse) start = Math.max(0, c.start + (c.out - Number(out)) / sp);
      o = Number(out);
    }
    i = clamp(i, 0, Math.max(0, mediaDuration - MIN_CLIP));
    o = clamp(o, i + MIN_CLIP, mediaDuration);
    return { ...c, start: round(start), in: round(i), out: round(o) };
  });
}

function trimFreeze(c, startAt, endAt) {
  let { start, hold } = c;
  const end = clipEnd(c);
  if (startAt != null) {
    start = clamp(Number(startAt), 0, end - MIN_CLIP);
    hold = end - start;
  }
  if (endAt != null) hold = Number(endAt) - start;
  return { ...c, start: round(start), hold: round(clamp(hold, MIN_CLIP, MAX_HOLD)) };
}

/** Split a clip in two at timeline time `at`. Returns { tl, left, right }. */
export function splitClip(tl, id, at) {
  const c = findClip(tl, id);
  if (!c) throw new Error("That clip isn't on the timeline any more.");
  const t = Number(at);
  if (!(t > c.start + MIN_CLIP / 2 && t < clipEnd(c) - MIN_CLIP / 2)) {
    throw new Error("Put the playhead inside the clip to split it.");
  }
  const cut = round(sourceTime(c, t));
  const base = { id: clipId(), start: round(t), fadeIn: 0, transition: { type: "cut", dur: c.transition.dur } };
  let left, right;
  if (c.freeze) {
    left = { ...c, hold: round(t - c.start), fadeOut: 0 };
    right = { ...c, ...base, hold: round(clipEnd(c) - t) };
  } else if (c.reverse) {
    // Backwards: the left half plays the end of the source.
    left = { ...c, in: cut, fadeOut: 0 };
    right = { ...c, ...base, out: cut };
  } else {
    left = { ...c, out: cut, fadeOut: 0 };
    right = { ...c, ...base, in: cut };
  }
  const clips = tl.clips.flatMap((x) => (x.id === id ? [left, right] : [x]));
  return { tl: withClips(tl, clips), left, right };
}

/**
 * Remove a clip and close the gap: the later clips on its track move left by its length.
 * Returns a new timeline.
 */
export function rippleDelete(tl, id) {
  const c = findClip(tl, id);
  if (!c) throw new Error("That clip isn't on the timeline any more.");
  const len = clipLength(c), end = clipEnd(c);
  const clips = tl.clips.filter((x) => x.id !== id)
    .map((x) => (x.track === c.track && x.start >= end - 1e-3 ? { ...x, start: round(Math.max(0, x.start - len)) } : x));
  return withClips(tl, clips);
}

/**
 * Freeze frame: hold the picture at timeline time `at` for `hold` seconds. The clip is split
 * there, the still goes in between, and the rest of the track moves right to make room.
 * Returns { tl, freeze }.
 */
export function freezeFrame(tl, id, at, hold = 2) {
  const c = findClip(tl, id);
  if (!c || c.kind !== "video") throw new Error("Pick a video clip to freeze a frame of.");
  const t = clamp(Number(at), c.start, clipEnd(c));
  const h = clamp(Number(hold) || 2, MIN_CLIP, MAX_HOLD);
  let next = tl;
  if (t > c.start + MIN_CLIP / 2 && t < clipEnd(c) - MIN_CLIP / 2) next = splitClip(tl, id, t).tl;
  const src = round(clamp(sourceTime(c, t), c.in, c.out - 0.02));
  const freeze = cleanClip({
    ...c, id: clipId(), start: round(t), freeze: true, hold: h, in: src, out: src + MIN_CLIP, reverse: false,
    speed: 1, fadeIn: 0, fadeOut: 0, muted: true, transition: { type: "cut", dur: 0.5 },
  });
  const moved = next.clips.map((x) => (x.track === c.track && x.start >= t - 1e-3 ? { ...x, start: round(x.start + h) } : x));
  return { tl: withClips(next, [...moved, freeze]), freeze };
}

/** Change a scene's length or its transition in. */
export function updateScene(tl, sceneId, { duration, transition } = {}) {
  const prev = tl.scenes[sceneId] || {};
  const next = { ...prev };
  if (duration != null) next.duration = clamp(round(Number(duration), 100), MIN_SCENE, MAX_SCENE);
  if (transition) next.transition = cleanTransition({ ...(prev.transition || {}), ...transition });
  return { ...tl, scenes: { ...tl.scenes, [sceneId]: next } };
}

export function setDuck(tl, patch) {
  return { ...tl, duck: { ...tl.duck, ...patch, amount: clamp(Number(patch.amount ?? tl.duck.amount), 0.05, 1) } };
}

export function setCaptions(tl, cues, style) {
  if (!cues) return { ...tl, captions: null };
  return { ...tl, captions: cleanCaptions({ cues, style: style || tl.captions?.style }) };
}

// ---- beats ------------------------------------------------------------------------------

/**
 * Move every scene change onto the nearest beat. `scenes` comes from sceneList(); `beats` are
 * timeline times. Each scene keeps at least MIN_SCENE seconds. Returns the new durations by id.
 */
export function snapScenesToBeats(scenes, beats, { maxShift = 1 } = {}) {
  const sorted = [...beats].filter(Number.isFinite).sort((a, b) => a - b);
  const out = {};
  if (!sorted.length || scenes.length < 2) return out;
  let prevEdge = 0;
  for (let i = 0; i < scenes.length - 1; i++) {
    const s = scenes[i];
    const edge = s.start + s.duration;
    let best = edge, bestD = Infinity;
    for (const b of sorted) {
      const d = Math.abs(b - edge);
      if (d < bestD && b - prevEdge >= MIN_SCENE) { best = b; bestD = d; }
    }
    if (bestD > maxShift) best = Math.max(edge, prevEdge + MIN_SCENE);
    out[s.id] = round(best - prevEdge, 100);
    prevEdge = prevEdge + out[s.id];
  }
  return out;
}

/**
 * Move the start of each clip on a track onto the nearest beat (within maxShift s), keeping
 * their order and never overlapping the clip before. Returns a new timeline.
 */
export function snapClipsToBeats(tl, beats, track = "video", { maxShift = 1 } = {}) {
  const sorted = [...beats].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return tl;
  const moved = new Map();
  let prevEnd = 0;
  for (const c of clipsOn(tl, track)) {
    let best = c.start, bestD = Infinity;
    for (const b of sorted) {
      const d = Math.abs(b - c.start);
      if (d < bestD && b >= prevEnd - 1e-6) { best = b; bestD = d; }
    }
    const start = bestD <= maxShift ? round(best) : Math.max(c.start, prevEnd);
    moved.set(c.id, start);
    prevEnd = start + clipLength(c);
  }
  return withClips(tl, tl.clips.map((c) => (moved.has(c.id) ? { ...c, start: moved.get(c.id) } : c)));
}

/** The beats of an audio clip on the timeline, from the beat times of its file. */
export function clipBeats(c, fileBeats) {
  return (fileBeats || []).filter((b) => b >= c.in && b <= c.out).map((b) => round(timelineTime(c, b)));
}

// ---- ducking ----------------------------------------------------------------------------

/** The time ranges where someone is speaking (voice clips, merged). */
export function voiceRanges(tl, gap = 0.3) {
  const r = clipsOn(tl, "voice").filter((c) => !c.muted && c.volume > 0).map((c) => [c.start, clipEnd(c)]);
  const out = [];
  for (const [a, b] of r.sort((x, y) => x[0] - y[0])) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + gap) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/**
 * The music level over time as [time, gain] points: 1 normally, `amount` under the voice,
 * with short ramps (attack before the voice starts, release after it stops).
 */
export function duckPoints(tl, { attack = 0.25, release = 0.45 } = {}) {
  if (!tl.duck?.on) return [];
  const g = tl.duck.amount;
  const pts = [];
  for (const [a, b] of voiceRanges(tl)) {
    pts.push([Math.max(0, a - attack), 1], [a, g], [b, g], [b + release, 1]);
  }
  return pts;
}

/**
 * The gain envelope of a clip (volume, fades, mute) as [time, gain] points on the timeline.
 */
export function clipGainPoints(c) {
  const v = c.muted ? 0 : c.volume;
  const s = c.start, e = clipEnd(c), len = e - s;
  const fi = Math.min(c.fadeIn, len / 2), fo = Math.min(c.fadeOut, len / 2);
  const pts = [[s, fi > 0 ? 0 : v]];
  if (fi > 0) pts.push([s + fi, v]);
  if (fo > 0) pts.push([e - fo, v], [e, 0]);
  else pts.push([e, v]);
  return pts;
}

/** Linear interpolation of [time, value] points at t (holds the ends). */
export function valueAt(points, t, fallback = 1) {
  if (!points.length) return fallback;
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      const [t0, v0] = points[i - 1];
      return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return points[points.length - 1][1];
}

// ---- what shows at time t ---------------------------------------------------------------

/** How strongly an item that starts at `start` with transition `tr` shows at t (0..1). */
export function transitionAlpha(tr, start, t) {
  if (!tr || tr.type !== "crossfade") return t >= start ? 1 : 0;
  return clamp((t - start) / tr.dur, 0, 1);
}

/** How black the frame is at t from dip-to-black transitions at the given cut times (0..1). */
export function dipAlpha(cuts, t) {
  let a = 0;
  for (const { at, tr } of cuts) {
    if (tr?.type !== "dip") continue;
    const half = tr.dur / 2;
    const d = Math.abs(t - at);
    if (d < half) a = Math.max(a, 1 - d / half);
  }
  return a;
}
