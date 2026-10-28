// The magic photo edits as plain functions (for the toolbar and for the AI):
// magicErase, magicEdit, magicExpand, magicGrab and restoreOriginal. Every result is one undo
// step, and the very first picture is kept in data.magic so "Restore original" can bring it back.
import { FabricImage, util } from "fabric";
import { applyMask, isEmptyFrame, loadElement } from "../elements/images.js";
import { removeBackground } from "../cutout/index.js";
import { inpaintLocal } from "./inpaint.js";
import { aiEdit, aiStatus, ensureEraser } from "./engines.js";
import { blendInto, boxMask, canvasOf, dilate, maskBounds, naturalSize, pixelToScene, resized, softFor } from "./mask.js";
import { eraserReady } from "./model.js";
import { confirmDialog } from "../../ui/kit.js";

export const isPhoto = (o) => o instanceof FabricImage && !o.isBg && !o.data?.cropUI && !isEmptyFrame(o);
export const SHAPES = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1, "4:5": 4 / 5 };
const MAX_SIDE = 4096;
const ERASE_PROMPT = "Remove the object in the masked area completely and fill the area in naturally so it matches the surrounding background: same light, texture, perspective and grain. Change nothing outside the mask.";

let busy = false;
/** The last edit, for the before/after slider: { id, before (src), rect (where it sits now) }. */
let last = null;
export const lastEdit = (img) => (last && last.id === img.id ? last : null);

function guard(img) {
  if (!isPhoto(img)) throw new Error("Pick a photo first (an empty frame or the page background can't be edited).");
  if (busy) throw new Error("A magic edit is still working. One at a time.");
}

async function exclusive(fn) {
  busy = true;
  try { return await fn(); } finally { busy = false; }
}

/** A hole mask at the picture's own size from a mask canvas or a page box {x, y, w, h}. */
export function holeOf(img, maskOrBox) {
  const { w, h } = naturalSize(img);
  if (!maskOrBox) return null;
  if (typeof maskOrBox.getContext === "function") {
    return maskOrBox.width === w && maskOrBox.height === h ? maskOrBox : resized(maskOrBox, w, h);
  }
  const b = maskOrBox;
  if (![b.x, b.y, b.w, b.h].every(Number.isFinite) || b.w <= 0 || b.h <= 0) throw new Error("The box needs x, y, w and h in page pixels.");
  return boxMask(img, b);
}

const hasAlpha = (src) => /^data:image\/(png|webp|gif)/.test(src);

/**
 * Put a new picture into the object as one undo step, keeping the first original.
 * @param {{ label: string, geom?: object, rectMap?: (r) => object }} opts
 *   geom: new { width, height, cropX, cropY, scaleX, scaleY, center } (Magic Expand)
 *   rectMap: how the old picture's pixels map into the new one (Magic Expand)
 */
async function applyResult(app, img, canvas, { label, geom = null, rectMap = (r) => r }) {
  const ed = app.editor;
  const prevSrc = img.getSrc();
  const nat = naturalSize(img);
  const magic = img.data?.magic;
  const original = magic?.original || { src: prevSrc, w: nat.w, h: nat.h, cropX: img.cropX || 0, cropY: img.cropY || 0, width: img.width, height: img.height };
  const originRect = rectMap(magic?.originRect || { x: 0, y: 0, w: nat.w, h: nat.h });
  // lossless WebP (half the size of PNG): every pixel outside the edit stays exactly as it was
  let src = canvas.toDataURL("image/webp", 1);
  if (!src.startsWith("data:image/webp")) src = canvas.toDataURL("image/png");
  const el = await loadElement(src);
  if (geom) {
    await img.setElement(el, { width: geom.width, height: geom.height });
    img.set({ cropX: geom.cropX, cropY: geom.cropY, scaleX: geom.scaleX, scaleY: geom.scaleY });
    img.setPositionByOrigin(geom.center, "center", "center");
  } else {
    await img.setElement(el, { width: img.width, height: img.height });
  }
  img.set({ data: { ...(img.data || {}), magic: { original, originRect, edits: (magic?.edits || 0) + 1 } }, dirty: true });
  if (img.data?.mask) applyMask(img);
  img.setCoords();
  last = { id: img.id, before: prevSrc, rect: rectMap({ x: 0, y: 0, w: nat.w, h: nat.h }) };
  ed.canvas.requestRenderAll();
  ed.commit(label);
  app.refreshToolbar?.();
}

async function eraseCanvas(img, hole, { engine = "auto", ask = true } = {}) {
  if (!maskBounds(hole)) throw new Error("Nothing to erase: paint over (or give a box around) what to remove.");
  const src = await loadElement(img.getSrc());
  let useLocal = engine === "local";
  if (engine === "auto") {
    useLocal = (await eraserReady()) || (ask && (await ensureEraser({ ask })));
    if (!useLocal && ask && aiStatus().ready
      && !(await confirmDialog("Use the image AI instead?", "Without the free eraser model, this erase goes to your image AI and spends 1 AI picture.", "Use 1 AI picture"))) {
      throw new Error("Nothing was erased.");
    }
  } else if (engine === "local" && !(await ensureEraser({ ask }))) {
    throw new Error("The Magic Eraser model isn't downloaded yet. Say yes to the download to erase for free.");
  }
  if (useLocal) {
    const r = await inpaintLocal(src, hole);
    return { canvas: r.canvas, engine: "local", ms: r.ms, onGPU: r.onGPU, gpuName: r.gpuName };
  }
  const a = aiStatus();
  if (!a.ready) throw new Error(`The free eraser isn't downloaded, and ${a.reason.charAt(0).toLowerCase()}${a.reason.slice(1)}`);
  const t0 = performance.now();
  const W = src.naturalWidth, H = src.naturalHeight;
  const grown = dilate(hole, Math.max(3, Math.round(Math.max(W, H) * 0.006)));
  const r = await aiEdit(src, grown, ERASE_PROMPT);
  return { canvas: blendInto(src, r.canvas, grown, softFor(W, H)), engine: "ai", ms: Math.round(performance.now() - t0), model: r.model };
}

/**
 * Magic Eraser: remove what's painted (or inside a page box) and fill it in naturally.
 * Free on this PC's GPU when the model is here; otherwise the image AI (one AI picture).
 * @param {object} app
 * @param {object} img a photo on the page
 * @param {HTMLCanvasElement|{x:number,y:number,w:number,h:number}} maskOrBox hole mask at natural size, or a box in page pixels
 * @param {{ engine?: "auto"|"local"|"ai", ask?: boolean }} [opts]
 * @returns {Promise<{ id: string, engine: "local"|"ai", ms: number, onGPU?: boolean, gpuName?: string }>}
 */
export async function magicErase(app, img, maskOrBox, opts = {}) {
  guard(img);
  return exclusive(async () => {
    const hole = holeOf(img, maskOrBox);
    if (!hole) throw new Error("Nothing to erase: paint over (or give a box around) what to remove.");
    const r = await eraseCanvas(img, hole, opts);
    await applyResult(app, img, r.canvas, { label: "Magic eraser" });
    const { canvas: _c, ...info } = r;
    return { id: img.id, ...info };
  });
}

/**
 * Magic Edit: change the painted area (or a page box, or the whole picture) as the words say,
 * with the image AI. Outside the painted area nothing changes. Spends one AI picture.
 * @param {object} app
 * @param {object} img a photo on the page
 * @param {string} prompt what it should become, e.g. "make the jacket red"
 * @param {HTMLCanvasElement|{x:number,y:number,w:number,h:number}} [maskOrBox] leave out to edit the whole picture
 * @returns {Promise<{ id: string, engine: "ai", whole: boolean, model: string, ms: number }>}
 */
export async function magicEdit(app, img, prompt, maskOrBox = null) {
  guard(img);
  const text = String(prompt || "").trim();
  if (!text) throw new Error("Say what it should become, e.g. \"make the jacket red\".");
  return exclusive(async () => {
    const t0 = performance.now();
    let hole = holeOf(img, maskOrBox);
    if (hole && !maskBounds(hole)) hole = null;
    const srcUrl = img.getSrc();
    const src = await loadElement(srcUrl);
    const W = src.naturalWidth, H = src.naturalHeight;
    const words = hole
      ? `${text}. Change only the masked area and blend it in naturally; keep everything outside it exactly the same.`
      : `${text}. Keep the rest of the photo the same: same people, framing, composition and style.`;
    const grown = hole ? dilate(hole, Math.max(2, Math.round(Math.max(W, H) * 0.003))) : null;
    const r = await aiEdit(src, grown, words);
    let out = grown ? blendInto(src, r.canvas, grown, softFor(W, H)) : r.canvas;
    if (!grown && hasAlpha(srcUrl)) { // a cut-out stays a cut-out
      const keep = canvasOf(W, H);
      const k = keep.getContext("2d");
      k.drawImage(out, 0, 0);
      k.globalCompositeOperation = "destination-in";
      k.drawImage(src, 0, 0);
      out = keep;
    }
    await applyResult(app, img, out, { label: "Magic edit" });
    return { id: img.id, engine: "ai", whole: !grown, model: r.model, ms: Math.round(performance.now() - t0) };
  });
}

/**
 * The new shape for Magic Expand, in the picture's own pixels.
 * @returns {{ W: number, H: number, ox: number, oy: number, w0: number, h0: number, page: boolean }}
 */
export function expandPlan(app, img, opts = {}) {
  const w0 = img.width, h0 = img.height;
  const sx = Math.abs(img.scaleX) || 1, sy = Math.abs(img.scaleY) || 1;
  let W = w0, H = h0;
  const page = opts.aspect === "page";
  const ratio = page ? app.editor.width / app.editor.height
    : typeof opts.aspect === "number" ? opts.aspect
      : SHAPES[opts.aspect] ?? (/^\d+(\.\d+)?:\d+(\.\d+)?$/.test(String(opts.aspect || "")) ? (([a, b]) => a / b)(String(opts.aspect).split(":").map(Number)) : null);
  if (ratio) {
    if (ratio > w0 / h0) W = h0 * ratio; else H = w0 / ratio;
  } else if (Number.isFinite(opts.percent)) {
    const f = 1 + Math.max(0, Math.min(200, opts.percent)) / 100;
    W = w0 * f;
    H = h0 * f;
  } else if (Number.isFinite(opts.w) || Number.isFinite(opts.h)) {
    W = Math.max(w0, (opts.w || w0 * sx) / sx);
    H = Math.max(h0, (opts.h || h0 * sy) / sy);
  } else {
    throw new Error("Say how to expand: aspect (16:9, 9:16, 1:1, 4:5 or page), percent, or w and h in page pixels.");
  }
  W = Math.round(W);
  H = Math.round(H);
  return { W, H, ox: (W - w0) / 2, oy: (H - h0) / 2, w0, h0, page };
}

/**
 * Magic Expand: grow the photo to a new shape; the image AI paints the new area and the original
 * stays exactly as it was in the middle. The object grows on the page to match. One AI picture.
 * @param {object} app
 * @param {object} img a photo on the page
 * @param {{ aspect?: "16:9"|"9:16"|"1:1"|"4:5"|"page"|number, percent?: number, w?: number, h?: number, prompt?: string }} opts
 * @returns {Promise<{ id: string, engine: "ai", width: number, height: number, ms: number }>}
 */
export async function magicExpand(app, img, opts = {}) {
  guard(img);
  if (img.data?.frame) throw new Error("Magic Expand works on photos, not frames. Take the photo out of the frame first.");
  const plan = expandPlan(app, img, opts);
  if (plan.W - plan.w0 < 2 && plan.H - plan.h0 < 2) throw new Error("The photo already has that shape. Pick another shape or a percentage.");
  return exclusive(async () => {
    const t0 = performance.now();
    const k = Math.min(1, MAX_SIDE / Math.max(plan.W, plan.H));
    const W = Math.round(plan.W * k), H = Math.round(plan.H * k);
    const rect = { x: plan.ox * k, y: plan.oy * k, w: plan.w0 * k, h: plan.h0 * k };
    const src = await loadElement(img.getSrc());
    const cx = img.cropX || 0, cy = img.cropY || 0;
    // the original, crisp, in its place (and a blurred stretch around it as a colour hint)
    const crisp = canvasOf(W, H);
    crisp.getContext("2d").drawImage(src, cx, cy, plan.w0, plan.h0, rect.x, rect.y, rect.w, rect.h);
    const hint = canvasOf(W, H);
    const hctx = hint.getContext("2d");
    hctx.filter = `blur(${Math.round(Math.max(W, H) / 40)}px)`;
    hctx.drawImage(src, cx, cy, plan.w0, plan.h0, 0, 0, W, H);
    hctx.filter = "none";
    hctx.drawImage(crisp, 0, 0);
    const keep = canvasOf(W, H);
    const kctx = keep.getContext("2d");
    kctx.fillStyle = "#fff";
    kctx.fillRect(Math.ceil(rect.x), Math.ceil(rect.y), Math.floor(rect.w), Math.floor(rect.h));
    const hole = canvasOf(W, H);
    const hctx2 = hole.getContext("2d");
    hctx2.fillStyle = "#fff";
    hctx2.fillRect(0, 0, W, H);
    hctx2.globalCompositeOperation = "destination-out";
    // let the AI repaint a thin band inside the old edge too, so the seam disappears
    const band = Math.max(2, Math.round(Math.max(W, H) * 0.006));
    hctx2.fillRect(rect.x + band, rect.y + band, rect.w - band * 2, rect.h - band * 2);
    const extra = String(opts.prompt || "").trim();
    const words = `Extend this photo outward to fill the empty border: continue the scene naturally beyond the frame with the same lighting, perspective, colours and style${extra ? `, showing ${extra}` : ""}. Keep the middle of the photo exactly as it is. No frames, borders or text.`;
    const r = await aiEdit(hint, hole, words);
    const out = blendInto(r.canvas, crisp, keep, Math.max(2, band));
    // the object grows around the same spot on the page
    const m = img.calcTransformMatrix();
    const d = util.transformPoint({ x: plan.W / 2 - plan.ox - plan.w0 / 2, y: plan.H / 2 - plan.oy - plan.h0 / 2 }, [m[0], m[1], m[2], m[3], 0, 0]);
    const c = img.getCenterPoint();
    let geom = { width: W, height: H, cropX: 0, cropY: 0, scaleX: img.scaleX / k, scaleY: img.scaleY / k, center: { x: c.x + d.x, y: c.y + d.y } };
    if (plan.page && !img.angle) { // "fill the page": cover the page exactly
      const s = app.editor.width / W;
      geom = { ...geom, scaleX: s * Math.sign(img.scaleX || 1), scaleY: s * Math.sign(img.scaleY || 1), center: { x: app.editor.width / 2, y: app.editor.height / 2 } };
    }
    const rectMap = (o) => ({ x: (o.x - cx + plan.ox) * k, y: (o.y - cy + plan.oy) * k, w: o.w * k, h: o.h * k });
    await applyResult(app, img, out, { label: "Magic expand", geom, rectMap });
    return { id: img.id, engine: "ai", width: Math.round(img.getScaledWidth()), height: Math.round(img.getScaledHeight()), ms: Math.round(performance.now() - t0) };
  });
}

/**
 * Magic Grab: the subject becomes its own movable layer (background remover, free on the GPU)
 * and the hole it leaves in the photo is filled (Magic Eraser). One undo step.
 * @param {object} app
 * @param {object} img a photo on the page
 * @param {{ ask?: boolean }} [opts]
 * @returns {Promise<{ id: string, layerId: string, engine: "local"|"ai" }>}
 */
export async function magicGrab(app, img, { ask = true } = {}) {
  guard(img);
  if (img.data?.cutout) throw new Error("This photo is already cut out. Use Magic Grab on a full photo.");
  const ed = app.editor;
  return exclusive(async () => {
    ed.history.pause();
    let layer;
    try {
      const r = await removeBackground(app, img, { layer: true, ask });
      layer = ed.objects().find((o) => o.id === r.id);
      if (layer?.data?.magic) { const { magic: _m, ...rest } = layer.data; layer.set("data", rest); }
    } finally {
      ed.history.resume();
    }
    if (!layer) throw new Error("The subject couldn't be cut out.");
    try {
      const { w, h } = naturalSize(img);
      const hole = canvasOf(w, h);
      const hc = hole.getContext("2d", { willReadFrequently: true });
      hc.drawImage(layer.getElement(), 0, 0, w, h);
      const d = hc.getImageData(0, 0, w, h);
      for (let i = 0; i < d.data.length; i += 4) {
        const on = d.data[i + 3] > 40;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
        d.data[i + 3] = on ? 255 : 0;
      }
      hc.putImageData(d, 0, 0);
      const grown = dilate(hole, Math.max(4, Math.round(Math.max(w, h) * 0.012)));
      const r = await eraseCanvas(img, grown, { ask });
      await applyResult(app, img, r.canvas, { label: "Magic grab" });
      ed.canvas.setActiveObject(layer);
      ed.canvas.requestRenderAll();
      app.refreshToolbar?.();
      return { id: img.id, layerId: layer.id, engine: r.engine };
    } catch (e) {
      ed.commit("Subject on its own layer"); // keep the layer even if the fill failed
      throw e;
    }
  });
}

/**
 * Restore original: bring back the picture from before the first magic edit, in the same spot.
 * @returns {Promise<{ id: string }>}
 */
export async function restoreOriginal(app, img) {
  const m = img.data?.magic;
  if (!m?.original?.src) throw new Error("This photo has no magic edits to undo.");
  if (busy) throw new Error("A magic edit is still working.");
  const o = m.original, rect = m.originRect || { x: 0, y: 0, w: o.w, h: o.h };
  const s = rect.w / o.w;
  const center = util.transformPoint({ x: rect.x + (o.cropX + o.width / 2) * s, y: rect.y + (o.cropY + o.height / 2) * s }, pixelToScene(img));
  const el = await loadElement(o.src);
  await img.setElement(el, { width: o.width, height: o.height });
  img.set({ cropX: o.cropX, cropY: o.cropY, scaleX: img.scaleX * s, scaleY: img.scaleY * s });
  img.setPositionByOrigin(center, "center", "center");
  const { magic: _m, ...rest } = img.data;
  img.set({ data: rest, dirty: true });
  if (img.data?.mask) applyMask(img);
  img.setCoords();
  last = null;
  app.editor.canvas.requestRenderAll();
  app.editor.commit("Restore original");
  app.refreshToolbar?.();
  return { id: img.id };
}
