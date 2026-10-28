// The live preview: a canvas laid exactly over the page that shows the composed video (scenes,
// clips, transitions, captions) while it plays or while the playhead is scrubbed, with the mix
// playing through an AudioContext. Clicking it goes back to editing the design.
import { el, icon, toast } from "../../ui/kit.js";
import { scheduleMix } from "./audio.js";
import { createCompositor } from "./compose.js";
import { createFramePool } from "./frames.js";
import { soundsFor } from "./media.js";
import { findClip, sourceTime, totalDuration } from "./model.js";
import { pipObjects, setEditProvider } from "./pip.js";
import { readTimeline, scenesOf } from "./store.js";
import { createZoneLayer } from "./zones-layer.js";

const MAX_PREVIEW = 1280; // longest side of the preview canvas (px)
const RESYNC = 0.25;      // re-seek a playing clip that drifts this far (s)

export function createPreview(app) {
  const ed = app.editor;
  const listeners = { time: new Set(), state: new Set() };
  const emit = (k, v) => listeners[k].forEach((fn) => { try { fn(v); } catch (e) { console.error(e); } });

  const canvas = el("canvas.vd-preview-canvas");
  const badge = el("div.vd-preview-badge", {}, icon("MousePointerClick", 14), "Preview · click to edit the design");
  const zones = createZoneLayer(app);
  const overlay = el("div.vd-preview", { hidden: true, title: "Click to go back to editing" }, canvas, zones.canvas, badge, zones.button);
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".vd-zones-btn")) return;
    e.preventDefault();
    hide();
  });
  ed.host.append(overlay);
  const ctx = canvas.getContext("2d", { alpha: false });

  const frames = createFramePool();       // the preview's clips
  const editFrames = createFramePool();   // poster frames for picture-in-picture objects while editing
  setEditProvider((clipId) => editFrames.get(clipId) || undefined);

  let t = 0, playing = false, visible = false;
  let comp = null, compKey = "", building = null;
  let audioCtx = null, mix = null, clock = null, raf = 0, seekSeq = 0;

  // ---- geometry ----
  function place() {
    if (!visible) return;
    const v = ed.canvas.viewportTransform;
    const w = ed.width * v[0], h = ed.height * v[0];
    Object.assign(overlay.style, { left: `${v[4]}px`, top: `${v[5]}px`, width: `${w}px`, height: `${h}px` });
    zones.paint(w, h);
  }
  ed.canvas.on("after:render", place);

  function size() {
    const k = Math.min(1, MAX_PREVIEW / Math.max(ed.width, ed.height));
    const even = (x) => Math.max(2, Math.round((x * k) / 2) * 2);
    return { width: even(ed.width), height: even(ed.height) };
  }

  // ---- compositor (rebuilt when the design or the timeline changes) ----
  function invalidate() { compKey = ""; }
  async function ensureComp() {
    const tl = readTimeline(app);
    const key = `${JSON.stringify(tl)}|${ed.width}x${ed.height}`;
    if (comp && compKey === key && !building) return comp;
    if (building) return building;
    building = (async () => {
      const scenes = scenesOf(app, tl);
      const { width, height } = size();
      const next = await createCompositor(app, { width, height, tl, scenes, frames });
      next.tl = tl;
      next.duration = totalDuration(tl, scenes);
      comp?.dispose();
      comp = next;
      compKey = key;
      canvas.width = width;
      canvas.height = height;
      frames.keepOnly(new Set(tl.clips.map((c) => c.id)));
      return comp;
    })();
    try { return await building; } finally { building = null; }
  }

  function show() {
    if (visible) return;
    app.motion?.stop?.();
    ed.canvas.discardActiveObject();
    ed.canvas.requestRenderAll();
    visible = true;
    overlay.hidden = false;
    place();
  }

  function hide() {
    pause();
    visible = false;
    overlay.hidden = true;
    emit("state", false);
  }

  // ---- seeking ----
  async function drawExact(at) {
    const my = ++seekSeq;
    const c = await ensureComp();
    if (my !== seekSeq) return;
    await frames.prepare(c.needed(at));
    if (my !== seekSeq || playing) return;
    c.draw(ctx, at);
  }

  /** Move the playhead to `at` seconds (shows the preview when `showIt`). */
  async function seek(at, { showIt = true } = {}) {
    const dur = await duration();
    t = Math.max(0, Math.min(at, dur));
    emit("time", t);
    if (playing) { restart(); return; }
    refreshPip();
    if (showIt) show();
    if (visible) await drawExact(t).catch((e) => toast(e.message, { error: true }));
  }

  async function duration() {
    const tl = readTimeline(app);
    return totalDuration(tl, scenesOf(app, tl));
  }

  // ---- playing ----
  async function play() {
    if (playing) return;
    if (app.view !== "editor") return;
    const c = await ensureComp();
    if (t >= c.duration - 0.05) t = 0;
    show();
    playing = true;
    emit("state", true);
    try {
      audioCtx = audioCtx || new AudioContext({ latencyHint: "interactive" });
      if (audioCtx.state === "suspended") await audioCtx.resume();
      const sounds = await soundsFor(c.tl);
      if (!playing) return;
      const when = audioCtx.currentTime + 0.06;
      mix = scheduleMix(audioCtx, c.tl, sounds, { from: t, when });
      clock = { from: t, when };
    } catch (e) {
      clock = { from: t, perf: performance.now() };
      toast(`The sound couldn't play: ${e.message}`, { error: true });
    }
    raf = requestAnimationFrame(tick);
  }

  function now() {
    if (!clock) return t;
    if (clock.perf != null) return clock.from + (performance.now() - clock.perf) / 1000;
    return clock.from + Math.max(0, audioCtx.currentTime - clock.when);
  }

  function tick() {
    if (!playing || !comp) return;
    t = now();
    if (t >= comp.duration) {
      t = comp.duration;
      pause();
      emit("time", t);
      return;
    }
    syncVideos(t);
    comp.draw(ctx, t);
    emit("time", t);
    raf = requestAnimationFrame(tick);
  }

  function syncVideos(at) {
    const need = comp.needed(at);
    const live = new Set();
    for (const it of need) {
      live.add(it.clip.id);
      const v = frames.element(it.clip.id);
      if (!v) { frames.ensure(it.clip).catch(() => {}); continue; }
      if (v.readyState < 1) continue;
      if (it.clip.freeze || it.clip.reverse) {
        // A still or a backwards clip can't play forwards: show the right frame by seeking
        // (at most one seek at a time, so it keeps up as well as the file allows).
        if (!v.paused) v.pause();
        if (!v.seeking && Math.abs(v.currentTime - it.src) > 1 / 40) v.currentTime = it.src;
        continue;
      }
      // Very slow or very fast clips are kept in step by seeking when the browser can't play
      // at that rate (it allows about 1/16x to 16x).
      const rate = Math.max(0.0625, Math.min(16, it.clip.speed));
      if (v.playbackRate !== rate) v.playbackRate = rate;
      if (it.src >= it.clip.out - 0.02) { if (!v.paused) v.pause(); continue; }
      if (Math.abs(v.currentTime - it.src) > RESYNC) v.currentTime = it.src;
      if (v.paused) v.play().catch(() => {});
    }
    for (const c of comp.tl.clips) {
      if (live.has(c.id)) continue;
      const v = frames.element(c.id);
      if (v && !v.paused) v.pause();
    }
  }

  function pause() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(raf);
    mix?.stop();
    mix = null;
    clock = null;
    for (const c of comp?.tl.clips || []) frames.element(c.id)?.pause();
    emit("state", false);
    if (visible) drawExact(t).catch(() => {});
    refreshPip();
  }

  function restart() {
    pause();
    play();
  }

  // ---- picture-in-picture poster frames in the editor ----
  async function refreshPip() {
    const tl = readTimeline(app);
    const items = [];
    for (const o of pipObjects(ed.canvas.getObjects())) {
      const c = findClip(tl, o.data?.vdClip);
      if (!c) continue;
      items.push({ clip: c, src: Math.max(c.in, Math.min(c.out - 0.02, sourceTime(c, t))) });
    }
    if (!items.length) return;
    try {
      await editFrames.prepare(items);
      ed.canvas.requestRenderAll();
    } catch { /* the placeholder stays */ }
  }

  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && visible && !playing) hide(); });
  app.bus.on("doc", () => { invalidate(); if (visible) hide(); refreshPip(); });
  app.bus.on("change", (label) => { invalidate(); if (label === "History") refreshPip(); });
  app.bus.on("video:changed", () => { invalidate(); refreshPip(); });
  app.bus.on("view", (v) => { if (v !== "editor") hide(); });
  app.bus.on("selection", (sel) => { if (sel?.length && visible && !playing) hide(); });

  return {
    play, pause, seek, hide, refreshPip, invalidate,
    toggle: () => (playing ? pause() : play()),
    get time() { return t; },
    get playing() { return playing; },
    get visible() { return visible; },
    onTime: (fn) => { listeners.time.add(fn); return () => listeners.time.delete(fn); },
    onState: (fn) => { listeners.state.add(fn); return () => listeners.state.delete(fn); },
    /** The picture now on the preview (for tests and thumbnails). */
    snapshot: () => canvas.toDataURL("image/jpeg", 0.8),
  };
}
