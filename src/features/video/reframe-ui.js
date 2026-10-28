// Free reframe: a small picture of the clip with a frame showing the part the page shows. Drag
// the frame to choose what's in shot and zoom with the slider. Key points make the frame move
// over time (a pan that follows the action): set the playhead, frame it, "Add a key point".
import { el, icon, slider, toast } from "../../ui/kit.js";
import * as api from "./api.js";
import { infoOf } from "./media.js";
import { clipEnd, findClip, reframeAt, sourceTime } from "./model.js";
import { readTimeline } from "./store.js";

const PAD_W = 260, PAD_H = 150;

/** The reframe controls for clip `id` (re-reads the clip on every change). */
export function reframePad(app, id, preview) {
  const box = el("div.vd-reframe", { "aria-label": "Choose what's in shot" });
  const pad = el("div.vd-reframe-pad");
  const win = el("div.vd-reframe-win", { tabindex: "0", role: "slider", "aria-label": "Visible part: drag, or use the arrow keys" });
  pad.append(win);
  const keysLine = el("p.vd-note");
  let size = { w: PAD_W, h: PAD_H, sw: 16, sh: 9 };
  let zoomSlider = null;

  const clip = () => findClip(readTimeline(app), id);
  // The view at the playhead (or the clip's start when the playhead is outside it).
  const srcNow = (c) => sourceTime(c, Math.max(c.start, Math.min(preview.time, clipEnd(c))));
  const view = () => { const c = clip(); return c ? reframeAt(c, srcNow(c)) : { x: 0, y: 0, zoom: 1 }; };

  function geometry(zoom) {
    const W = app.editor.width, H = app.editor.height;
    const k0 = Math.max(W / size.sw, H / size.sh);
    return { ww: Math.min(size.w, (W / (k0 * zoom)) * (size.w / size.sw)), wh: Math.min(size.h, (H / (k0 * zoom)) * (size.h / size.sh)) };
  }
  function place(v = view()) {
    const { ww, wh } = geometry(v.zoom);
    Object.assign(win.style, {
      width: `${ww}px`, height: `${wh}px`,
      left: `${((size.w - ww) * (1 + v.x)) / 2}px`, top: `${((size.h - wh) * (1 + v.y)) / 2}px`,
    });
    win.setAttribute("aria-valuetext", `x ${v.x.toFixed(2)}, y ${v.y.toFixed(2)}, zoom ${v.zoom.toFixed(2)}×`);
    const c = clip();
    const n = c?.reframe.keys.length || 0;
    keysLine.textContent = n ? `${n} key point${n === 1 ? "" : "s"}: the frame moves between them. Changes go into the point at the playhead.` : "One frame for the whole clip. Add key points to make it move.";
  }

  /** Save a new view: into the key point at the playhead when the clip has key points. */
  function commit(v, merge) {
    const c = clip();
    if (!c) return;
    try {
      if (c.reframe.keys.length) api.addReframeKey(app, { id, at: preview.time, ...v });
      else api.setFit(app, { id, fit: "free", reframe: v }, { merge });
    } catch (e) { toast(e.message, { error: true }); }
  }

  win.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const v0 = view();
    const { ww, wh } = geometry(v0.zoom);
    const x0 = e.clientX, y0 = e.clientY;
    const l0 = ((size.w - ww) * (1 + v0.x)) / 2, t0 = ((size.h - wh) * (1 + v0.y)) / 2;
    let v = v0;
    const toView = (l, t) => ({
      ...v0,
      x: size.w > ww + 0.5 ? Math.max(-1, Math.min(1, (2 * l) / (size.w - ww) - 1)) : 0,
      y: size.h > wh + 0.5 ? Math.max(-1, Math.min(1, (2 * t) / (size.h - wh) - 1)) : 0,
    });
    const mv = (ev) => { v = toView(l0 + ev.clientX - x0, t0 + ev.clientY - y0); place(v); };
    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      if (v !== v0) commit({ x: v.x, y: v.y, zoom: v.zoom }, false);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  });
  win.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    const v = view(), k = e.shiftKey ? 0.25 : 0.05;
    commit({ x: Math.max(-1, Math.min(1, v.x + d[0] * k)), y: Math.max(-1, Math.min(1, v.y + d[1] * k)), zoom: v.zoom }, false);
    place();
  });

  zoomSlider = slider({ label: "Zoom", unit: "×", min: 1, max: 4, step: 0.05, value: Number(view().zoom.toFixed(2)),
    onInput: (z) => { const v = view(); place({ ...v, zoom: z }); },
    onChange: (z) => { const v = view(); commit({ x: v.x, y: v.y, zoom: z }, false); place(); } });

  const addKey = el("button.btn.small", { type: "button", title: "Remember this framing at the playhead; the frame glides between key points",
    on: { click: () => { try { api.addReframeKey(app, { id, at: preview.time, ...view() }); place(); } catch (e) { toast(e.message, { error: true }); } } } },
  icon("Diamond", 13), "Add a key point here");
  const clearKeys = el("button.btn.small", { type: "button", title: "Keep one framing for the whole clip",
    on: { click: () => { try { api.setFit(app, { id, fit: "free", reframe: { ...view(), keys: [] } }); place(); } catch (e) { toast(e.message, { error: true }); } } } },
  icon("X", 13), "Clear key points");

  box.append(pad, zoomSlider, el("div.vd-row-btns", {}, addKey, clearKeys), keysLine);

  // Fit the pad to the clip's shape and show its poster frame.
  (async () => {
    const c = clip();
    const info = c ? await infoOf(c.mediaId).catch(() => null) : null;
    const sw = info?.width || 16, sh = info?.height || 9;
    const k = Math.min(PAD_W / sw, PAD_H / sh);
    size = { w: Math.round(sw * k), h: Math.round(sh * k), sw, sh };
    Object.assign(pad.style, { width: `${size.w}px`, height: `${size.h}px`, backgroundImage: info?.thumb ? `url("${info.thumb}")` : "" });
    place();
  })();
  place();
  return box;
}
