// The Video panel: the media library (add, re-use, remove files), voice-over recording, music
// ducking and the caption track, with friendly hints for YouTube videos and Shorts.
import { confirmDialog, el, icon, slider, toast, toggle } from "../../ui/kit.js";
import { stagger } from "../../ui/motion.js";
import * as api from "./api.js";
import { openAutoCaptions } from "./captions-ui.js";
import { fmtTime } from "./timeline-ui.js";
import { ACCEPT, forget } from "./media.js";
import { deleteMedia, listMedia, onMediaChanged } from "./media-db.js";
import { readTimeline } from "./store.js";

const fmtSize = (b) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

/** Render the panel into `box`; returns a cleanup function. */
export function renderPanel(box, app) {
  const dock = app.video.dock;
  dock.setOpen(true); // opening the Video panel shows the timeline
  const list = el("div.vd-lib", { role: "list", "aria-label": "Your video and sound files" });
  const fileInput = el("input", { type: "file", accept: ACCEPT, multiple: true, hidden: true, on: { change: () => {
    const files = [...fileInput.files];
    fileInput.value = "";
    if (files.length) { dock.setOpen(true); dock.addFiles(files); }
  } } });
  const vertical = app.editor.height > app.editor.width;

  const intro = el("p.vd-note", {}, vertical
    ? "This is a vertical design, so the video exports as a Short (9:16)."
    : "Your design is the first scene. Add clips, music and your voice, then export an MP4 for YouTube.");
  const actions = el("div.vd-panel-actions", {},
    el("button.btn.primary", { type: "button", on: { click: () => fileInput.click() } }, icon("Upload", 16), "Add video or sound"),
    el("button.btn", { type: "button", on: { click: () => { dock.setOpen(true); app.video.record(); } } }, icon("Mic", 16), "Record a voice-over"),
    fileInput);

  const tl = readTimeline(app);
  const duck = el("section.sec", {}, el("h4.sec-title", {}, "Music under the voice"),
    toggle({ label: "Lower the music while someone talks", value: tl.duck.on, onChange: (v) => guard(() => api.setDucking(app, { on: v })) }),
    slider({ label: "Music level while talking", unit: "%", min: 5, max: 100, step: 5, value: Math.round(tl.duck.amount * 100),
      onChange: (v) => guard(() => api.setDucking(app, { amount: v / 100 })) }));

  const caps = tl.captions?.cues.length || 0;
  const capsBtn = el("button.btn.small.primary", { type: "button", on: { click: () => openAutoCaptions(app, capsBtn) } }, icon("Sparkles", 14), caps ? "Auto captions again" : "Auto captions");
  const captions = el("section.sec", {}, el("h4.sec-title", {}, "Captions"),
    el("p.vd-note", {}, caps ? `${caps} caption${caps === 1 ? "" : "s"} on the video. Click one on the timeline to edit it.` : "Captions from your voice, word by word, made on this PC."),
    el("div.vd-row-btns", {}, capsBtn),
    caps ? el("button.btn.small", { type: "button", on: { click: async () => {
      if (await confirmDialog("Remove the captions?", "The caption track goes away. You can undo this.", "Remove")) guard(() => api.addCaptionTrack(app, null));
    } } }, icon("Trash2", 14), "Remove captions") : null);

  let firstDraw = true;
  async function draw() {
    // Shimmer rows while the library loads from the browser's storage.
    const first = firstDraw;
    firstDraw = false;
    if (first) list.replaceChildren(...[0, 1].map(() => el("div.vd-lib-skel.oc-skeleton", { "aria-hidden": "true" })));
    let items = [];
    try { items = await listMedia(); } catch (e) { list.replaceChildren(el("p.vd-note", {}, e.message)); return; }
    if (!items.length) {
      list.replaceChildren(el("div.vd-lib-empty", {}, icon("Film", 22), el("span", {}, "Your videos and sounds appear here. They stay in this browser.")));
      return;
    }
    list.replaceChildren(...items.map((m) => {
      const add = (track) => guard(async () => {
        dock.setOpen(true);
        await api.addClip(app, { mediaId: m.id, track });
        toast(`Added "${m.name}".`);
      });
      const addBtns = m.kind === "video"
        ? [el("button.btn.small", { type: "button", title: "Add to the video track", on: { click: () => add("video") } }, icon("Plus", 13), "Add")]
        : [["voice", "Voice"], ["music", "Music"], ["sfx", "Effect"]].map(([tr, label]) => el("button.btn.small", {
          type: "button", title: `Add to the ${label.toLowerCase()} track`, on: { click: () => add(tr) } }, icon("Plus", 13), label));
      const del = el("button.ibtn.vd-lib-del", { type: "button", title: "Remove from this browser", "aria-label": `Remove ${m.name}`, on: { click: async () => {
        const used = readTimeline(app).clips.some((c) => c.mediaId === m.id);
        const ok = await confirmDialog(`Remove "${m.name}"?`, used
          ? "This design uses it. Its clips will be empty until you add the file again. This can't be undone."
          : "The file is removed from this browser, so any other design that uses it will show an empty clip. This can't be undone.", "Remove");
        if (!ok) return;
        await guard(async () => { await deleteMedia(m.id); forget(m.id); app.video.dock.render(); });
      } } }, icon("Trash2", 15));
      return el("div.vd-lib-item", { role: "listitem" },
        m.thumb ? el("img.vd-lib-thumb", { src: m.thumb, alt: "" }) : el("span.vd-lib-thumb.audio", {}, icon("Music", 18)),
        el("div.vd-lib-info", {}, el("b", { title: m.name }, m.name), el("small", {}, `${fmtTime(m.duration)} · ${fmtSize(m.size)}${m.kind === "video" && !m.hasAudio ? " · no sound" : ""}`),
          el("div.vd-lib-btns", {}, addBtns)), del);
    }));
    if (first) stagger(list);
  }
  draw();
  const off = onMediaChanged(draw);

  box.append(intro, actions, el("section.sec", {}, el("h4.sec-title", {}, "Your files"), list), duck, captions,
    el("p.vd-note.vd-tips", {}, icon("Lightbulb", 14), " Space plays and pauses, J K L run backwards and forwards, Q and W trim to the playhead. Drag clip ends to trim, S splits, double-click a clip for volume, speed, fit and transitions."));
  return () => off();
}

async function guard(fn) {
  try { return await fn(); } catch (e) { toast(e.message, { error: true }); return null; }
}
