// Video editor (v0.4): a timeline under the canvas for YouTube videos and Shorts.
//   model.js       the timeline data and its pure edits (clips, trims, splits, scenes, beats, ducking)
//   store.js       where the timeline lives (page.data.video) and which pages are scenes
//   media-db.js    the media library in IndexedDB (files never go in the design JSON)
//   media.js       importing files, poster frames, decoded sound, beats
//   audio.js       waveforms, the beat detector and the one mixing graph (preview + export)
//   frames.js      video frames from the files (hidden <video> elements, seek-exact)
//   compose.js     draws any moment: scene, clips, transitions, picture-in-picture, captions
//   pip.js         the picture-in-picture object (VdVideo)
//   captions.js    word-timed captions on top, in Shorts presets (preview and export)
//   cues.js        caption cues as pure data: grouping words, edits, split, join
//   whisper.js     speech to text with word times (Whisper on WebGPU, via transformers.js)
//   autocaption.js auto captions: the timeline's speech -> caption cues
//   captions-ui.js the Captions popovers and the caption lane editing
//   transitions.js how pictures move in slide, wipe, zoom, whip and spin transitions
//   stretch.js     pitch-kept speed changes and backwards sound (WSOLA)
//   reframe-ui.js  free reframe of a clip on a page of another shape (with key points)
//   keys.js        the CapCut-style timeline keys (J K L, Q W, frame steps, nudges)
//   zones-layer.js the safe zones over the playing preview
//   player.js      the live preview over the page
//   timeline-ui.js the dock: tracks, clips, trimming, playhead
//   inspector.js   clip and scene settings
//   record.js      voice-over recording with a level meter
//   panel.js       the Video panel (media library)
//   export.js      MP4: H.264 on the GPU encoder + AAC, via WebCodecs and mp4-muxer
//   api.js         the actions (also the AI tools)
import "./video.css";
import { el, icon, popover, toast } from "../../ui/kit.js";
import { registerPanel, registerShortcut } from "../../ui/shell.js";
import * as api from "./api.js";
import { exportBusy, FPS, QUALITIES, stopExport } from "./export.js";
import { fitSize } from "../motion/export.js";
import { kindOf } from "./media.js";
import { renderPanel } from "./panel.js";
import { createPreview } from "./player.js";
import { openRecorder } from "./record.js";
import { createDock } from "./timeline-ui.js";
import { autoCaptions } from "./captions-ui.js";

const PREFS = "vd-export";
const loadPrefs = () => { try { return { quality: "1080p", fps: 30, ...JSON.parse(localStorage.getItem(PREFS) || "{}") }; } catch { return { quality: "1080p", fps: 30 }; } };
const savePrefs = (p) => { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* private mode */ } };

export function install(app) {
  const preview = createPreview(app);
  const dock = createDock(app, preview, { onExport: (anchor) => exportMenu(app, anchor) });

  /** The video editor's API (the AI tools are the async functions taking an options object). */
  app.video = {
    preview, dock,
    play: () => preview.play(),
    pause: () => preview.pause(),
    seek: (t) => preview.seek(t),
    record: () => openRecorder(app, { at: preview.time }),
    listTimeline: () => api.listTimeline(app),
    addClip: (o) => api.addClip(app, o),
    addMusic: (o) => api.addMusic(app, o),
    trimClip: (o) => api.trimClip(app, o),
    splitClip: (o) => api.splitClip(app, o),
    moveClip: (o) => api.moveClip(app, o),
    deleteClip: (o) => api.deleteClip(app, o),
    setVolume: (o) => api.setVolume(app, o),
    addTransition: (o) => api.addTransition(app, o),
    setSceneDuration: (o) => api.setSceneDuration(app, o),
    setDucking: (o) => api.setDucking(app, o),
    setPictureInPicture: (o) => api.setPictureInPicture(app, o),
    findBeats: (o) => api.findBeats(app, o),
    snapToBeats: (o) => api.snapToBeats(app, o),
    addCaptionTrack: (cues, style) => api.addCaptionTrack(app, cues, style),
    autoCaptions: (o) => autoCaptions(app, o),
    setCaptionStyle: (o) => api.setCaptionStyle(app, o),
    editCaption: (o) => api.editCaption(app, o),
    splitCaption: (o) => api.splitCaption(app, o),
    mergeCaptions: (o) => api.mergeCaptions(app, o),
    removeCaption: (o) => api.removeCaption(app, o),
    addCaption: (o) => api.addCaption(app, o),
    moveCaption: (o) => api.moveCaption(app, o),
    setSpeed: (o) => api.setSpeed(app, o),
    freezeFrame: (o) => api.freezeFrame(app, o),
    rippleDelete: (o) => api.rippleDelete(app, o),
    nudgeClip: (o) => api.nudgeClip(app, o),
    setFit: (o) => api.setFit(app, o),
    addReframeKey: (o) => api.addReframeKey(app, o),
    exportVideo: (o) => api.exportVideo(app, o),
    stopExport,
  };

  registerPanel({ id: "video", icon: "Film", label: "Video", order: 57, render: renderPanel });
  registerShortcut({
    keys: "space", label: "Play or pause the video", group: "Video",
    when: () => app.view === "editor" && !app.editor.active()?.isEditing,
    run: () => preview.toggle(),
  });

  // Video and sound files dropped anywhere on the editor go on the timeline.
  const mediaDrag = (dt) => [...(dt?.items || [])].some((i) => i.kind === "file" && /^(video|audio)\//.test(i.type));
  window.addEventListener("dragover", (e) => {
    if (app.view !== "editor" || !mediaDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  window.addEventListener("drop", (e) => {
    if (app.view !== "editor") return;
    const files = [...(e.dataTransfer?.files || [])].filter((f) => kindOf(f));
    if (!files.length || files.some((f) => f.type.startsWith("image/"))) return;
    e.preventDefault();
    dock.setOpen(true);
    dock.addFiles(files);
  });

  // The Download popover gets "Video with sound" too.
  app.files?.registerExportType?.({
    id: "video-timeline", label: "Video (timeline)", icon: "Film", tag: "Sound",
    help: "Your whole timeline as an MP4 with sound: scenes, clips, music, voice and captions.",
    options: (prefs, persist) => [el("div.fl-sec.vd-opts", {},
      pick("Quality", prefs.vdQuality ?? "1080p", QUALITIES, (v) => { prefs.vdQuality = v; persist(); }),
      pick("Smoothness", String(prefs.vdFps ?? 30), FPS.map((f) => ({ value: String(f), label: `${f} fps` })), (v) => { prefs.vdFps = Number(v); persist(); }),
      el("p.fl-note", {}, "Made on your graphics card when the browser allows it."))],
    run: async (a, prefs, onProgress) => {
      const res = await api.exportVideo(a, { quality: prefs.vdQuality ?? "1080p", fps: prefs.vdFps ?? 30, onProgress });
      return { filename: res.filename, bytes: res.bytes, type: "mp4", notes: res.notes };
    },
  });
}

function pick(label, value, options, onChange) {
  const s = el("select.sel", { "aria-label": label, on: { change: () => onChange(s.value) } },
    options.map((o) => el("option", { value: o.value, selected: String(o.value) === String(value) }, o.label)));
  return el("label.vd-field", {}, el("span", {}, label), s);
}

/** The Export popover on the timeline bar. */
function exportMenu(app, anchor) {
  const prefs = loadPrefs();
  const ed = app.editor;
  const sizeLine = el("p.vd-note");
  const showSize = () => {
    const q = QUALITIES.find((x) => x.value === prefs.quality) || QUALITIES[0];
    const s = fitSize(ed.width, ed.height, q.long);
    sizeLine.textContent = `${s.width} × ${s.height} px${ed.height > ed.width ? " · vertical, ready for Shorts" : ""} · H.264 + AAC`;
  };
  showSize();
  const go = el("button.btn.primary", { type: "button" }, icon("Download", 16), "Export MP4");
  go.addEventListener("click", async () => {
    if (exportBusy()) { toast("A video is already being made."); return; }
    popover(anchor, el("div.vd-insp", {}, el("p.vd-note", {}, "Making your video… You can keep the tab open and wait, or press Stop.")), { cls: "vd-pop" });
    try {
      const res = await api.exportVideo(app, { quality: prefs.quality, fps: prefs.fps });
      toast(`Saved ${res.filename} (${res.width} × ${res.height}, ${Math.round(res.duration)} s).`, { ms: 5000 });
      for (const n of res.notes) toast(n, { ms: 6000 });
    } catch (e) {
      toast(e.message, { error: true, ms: 6000 });
    }
  });
  popover(anchor, el("div.vd-insp", {},
    el("h4.vd-insp-title", {}, icon("Film", 15), "Export video"),
    pick("Quality", prefs.quality, QUALITIES, (v) => { prefs.quality = v; savePrefs(prefs); showSize(); }),
    pick("Smoothness", String(prefs.fps), FPS.map((f) => ({ value: String(f), label: `${f} fps` })), (v) => { prefs.fps = Number(v); savePrefs(prefs); }),
    sizeLine, go), { cls: "vd-pop", align: "end" });
}
