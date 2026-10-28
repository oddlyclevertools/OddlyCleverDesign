// The compositor: draws any moment of the video onto a 2D canvas. Bottom to top:
//   1. the scene (a design page with its animations, on an offscreen Fabric StaticCanvas;
//      picture-in-picture clips are objects on it),
//   2. full-frame video clips in their fit (fill, fit, blurred fill, colour, free reframe), with
//      transitions between them (transitions.js),
//   3. the design again over a clip whose "Show the design on top" is on (page background hidden),
//   4. dip-to-black, 5. captions.
// The preview and the MP4 export both draw through here.
import { StaticCanvas } from "fabric";
import { ensureFontsFor } from "../../core/fonts.js";
import { sanitizeCanvas } from "../../core/sanitize.js";
import { applyState, captureBase, installRenderHook } from "../motion/render.js";
import { animOf, stateAt } from "../motion/timeline.js";
import { drawCaptions, prepareCaptionFont } from "./captions.js";
import { BLENDS, clipEnd, clipsOn, dipAlpha, reframeAt, sourceTime } from "./model.js";
import { drawFitted, pipIdsInDoc } from "./pip.js";
import { sceneDoc } from "./store.js";
import { transitionFx, withFx } from "./transitions.js";

const HOLD = 1e-3;

/** A design page on an offscreen canvas, ready to draw at any local time. */
async function buildSceneStage(doc, width, height, designW, provider) {
  const { canvas: json } = sanitizeCanvas(doc.canvas);
  await ensureFontsFor(json.objects);
  const node = document.createElement("canvas");
  const sc = new StaticCanvas(node, {
    width, height, enableRetinaScaling: false, renderOnAddRemove: false, skipOffscreen: false, backgroundColor: "",
  });
  await sc.loadFromJSON(json);
  sc.backgroundColor = "";
  sc.__vdPip = provider;
  const s = width / designW;
  sc.setViewportTransform([s, 0, 0, s, 0, 0]);
  const pw = Number(doc.width) || designW, ph = Number(doc.height) || designW * (height / width);
  const backdrop = [];
  for (const o of sc.getObjects()) {
    if (o.isPage) { o.set({ strokeWidth: 0 }); backdrop.push(o); }
    if (o.isBg) backdrop.push(o);
    if (o.data?.guide) o.visible = false;
  }
  const entries = sc.getObjects().filter((o) => !o.isPage && animOf(o)).map((o) => ({ o, base: captureBase(o, pw, ph) }));
  return {
    node,
    /** Draw the page at local time t of a scene lasting `duration` s. */
    draw(t, duration, { transparent = false } = {}) {
      for (const e of entries) applyState(e.o, e.base, stateAt(e.o, t, { duration, pw, ph, geo: e.base.geo }));
      if (transparent) for (const o of backdrop) o.visible = false;
      sc.renderAll();
      if (transparent) for (const o of backdrop) o.visible = true;
    },
    dispose() { sc.dispose(); },
  };
}

/** Progress (0..1) of a blending transition that starts at `start`, or null when none is running. */
function blendAt(tr, start, t) {
  if (!tr || !BLENDS.has(tr.type) || t < start || t >= start + tr.dur) return null;
  return (t - start) / tr.dur;
}

/**
 * What is visible at time t, as data: { scene layers, video layers, pip clips, dip }. A layer
 * in a transition carries `fx: { type, p, role: "in"|"out" }`. Pure (no drawing), so the frame
 * pool can seek exactly the frames needed first.
 */
export function layersAt(tl, scenes, pipIds, t) {
  const out = { scenes: [], videos: [], pips: [], dip: 0 };
  if (scenes.length) {
    let i = scenes.findIndex((s) => t < s.start + s.duration);
    if (i < 0) i = scenes.length - 1;
    const s = scenes[i];
    const local = Math.min(Math.max(0, t - s.start), s.duration - HOLD);
    const p = i > 0 ? blendAt(s.transition, s.start, t) : null;
    if (p != null) {
      const prev = scenes[i - 1];
      const fx = { type: s.transition.type, p };
      out.scenes.push({ scene: prev, local: prev.duration - HOLD, alpha: 1, fx: { ...fx, role: "out" } });
      out.scenes.push({ scene: s, local, alpha: s.transition.type === "crossfade" ? p : 1, fx: { ...fx, role: "in" } });
    } else out.scenes.push({ scene: s, local, alpha: 1, fx: null });
  }
  const vids = clipsOn(tl, "video");
  for (let k = 0; k < vids.length; k++) {
    const c = vids[k];
    if (pipIds.has(c.id)) {
      if (t >= c.start && t < clipEnd(c)) out.pips.push({ clip: c, src: sourceTime(c, t) });
      continue;
    }
    // The clip that ends where a blending clip starts stays up (on its last frame) under it.
    const next = vids.slice(k + 1).find((n) => !pipIds.has(n.id) && Math.abs(n.start - clipEnd(c)) < 0.05);
    const np = next ? blendAt(next.transition, next.start, t) : null;
    const held = np != null && t >= clipEnd(c);
    if ((t >= c.start && t < clipEnd(c)) || held) {
      const src = held ? sourceTime(c, clipEnd(c) - 1e-3) : sourceTime(c, t);
      const p = blendAt(c.transition, c.start, t);
      let fx = null;
      if (np != null) fx = { type: next.transition.type, p: np, role: "out" };
      else if (p != null) fx = { type: c.transition.type, p, role: "in" };
      out.videos.push({ clip: c, src, alpha: p != null && c.transition.type === "crossfade" ? p : 1, fx });
    }
  }
  const cuts = [
    ...scenes.slice(1).map((s) => ({ at: s.start, tr: s.transition })),
    ...vids.filter((c) => !pipIds.has(c.id)).map((c) => ({ at: c.start, tr: c.transition })),
  ];
  out.dip = dipAlpha(cuts, t);
  return out;
}

// A small scratch canvas for the blurred fill (blurring a small copy and scaling it up is soft
// and cheap at any output size).
let scratch = null;
function blurredCopy(src, w, h) {
  const sw = Math.max(8, Math.round(w / 10)), sh = Math.max(8, Math.round(h / 10));
  if (!scratch) scratch = document.createElement("canvas");
  if (scratch.width !== sw || scratch.height !== sh) { scratch.width = sw; scratch.height = sh; }
  const g = scratch.getContext("2d");
  g.filter = "blur(2px) brightness(0.72) saturate(1.15)";
  drawFitted(g, src, -sw * 0.08, -sh * 0.08, sw * 1.16, sh * 1.16, "cover");
  g.filter = "none";
  return scratch;
}

/** Draw a full-frame clip's picture in its fit: fill, fit, blurred fill, colour fill or free. */
export function drawClipFrame(ctx, src, clip, srcTime, w, h) {
  const fit = clip.fit || "cover";
  if (fit === "cover") { drawFitted(ctx, src, 0, 0, w, h, "cover"); return; }
  if (fit === "free") {
    const sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
    if (!sw || !sh) return;
    const v = reframeAt(clip, srcTime);
    const k = Math.max(w / sw, h / sh) * v.zoom;
    const dw = sw * k, dh = sh * k;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, (w - dw) / 2 - (v.x * (dw - w)) / 2, (h - dh) / 2 - (v.y * (dh - h)) / 2, dw, dh);
    return;
  }
  if (fit === "blur") {
    const b = blurredCopy(src, w, h);
    const q = ctx.imageSmoothingQuality;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(b, 0, 0, w, h);
    ctx.imageSmoothingQuality = q;
  } else {
    ctx.fillStyle = fit === "color" ? clip.fill || "#000" : "#000";
    ctx.fillRect(0, 0, w, h);
  }
  drawFitted(ctx, src, 0, 0, w, h, "contain");
}

/**
 * A compositor for the open design's timeline at width x height.
 * @param {object} app
 * @param {{ width: number, height: number, tl: object, scenes: object[], frames: object }} opts
 *   `frames` is a frame pool (frames.js); the compositor draws whatever frames it holds.
 */
export async function createCompositor(app, { width, height, tl, scenes, frames }) {
  installRenderHook();
  await prepareCaptionFont(tl.captions);
  const designW = app.editor.width;
  let now = 0;
  let pipNow = new Map(); // clipId -> visible right now
  const provider = (clipId) => (pipNow.has(clipId) ? frames.get(clipId) || undefined : null);
  const stages = new Map(); // scene id -> stage
  const pipIds = new Set();
  for (const s of scenes) {
    const doc = sceneDoc(app, s);
    for (const id of pipIdsInDoc(doc)) pipIds.add(id);
    stages.set(s.id, await buildSceneStage(doc, width, height, designW, provider));
  }
  return {
    width, height, pipIds,
    get time() { return now; },
    layersAt: (t) => layersAt(tl, scenes, pipIds, t),
    /** The clips whose frames are needed at t: [{ clip, src }]. */
    needed(t) {
      const L = layersAt(tl, scenes, pipIds, t);
      return [...L.videos, ...L.pips];
    },
    /** Draw time t onto ctx (a 2D context of a width x height canvas). */
    draw(ctx, t) {
      now = t;
      const L = layersAt(tl, scenes, pipIds, t);
      pipNow = new Map(L.pips.map((p) => [p.clip.id, p]));
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      const top = L.scenes[L.scenes.length - 1];
      const fxOf = (layer) => (layer.fx ? transitionFx(layer.fx.type, layer.fx.p, layer.fx.role, width, height) : null);
      for (const sl of L.scenes) {
        const st = stages.get(sl.scene.id);
        if (!st) continue;
        st.draw(sl.local, sl.scene.duration);
        withFx(ctx, fxOf(sl), width, height, () => ctx.drawImage(st.node, 0, 0, width, height));
      }
      for (const v of L.videos) {
        const src = frames.get(v.clip.id);
        if (!src) continue;
        withFx(ctx, fxOf(v), width, height, () => {
          drawClipFrame(ctx, src, v.clip, v.src, width, height);
          if (v.clip.overlay && top) {
            const st = stages.get(top.scene.id);
            st.draw(top.local, top.scene.duration, { transparent: true });
            ctx.drawImage(st.node, 0, 0, width, height);
          }
        });
      }
      if (L.dip > 0) {
        ctx.globalAlpha = L.dip;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.globalAlpha = 1;
      if (tl.captions) drawCaptions(ctx, tl.captions, t, width, height);
      ctx.restore();
    },
    dispose() { for (const s of stages.values()) s.dispose(); },
  };
}
