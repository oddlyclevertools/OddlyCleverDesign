// Crop and reposition, done on the canvas.
// Crop: the whole picture shows dimmed behind a crop window with handles; resize or move the
// window. Reposition (frames and the background photo): the window stays put and you move or
// zoom the picture under it. Both can straighten the picture (-45° to 45°): it zooms in just
// enough that the window stays covered. A rule-of-thirds grid shows inside the window.
// Enter or Done applies, Esc or Cancel restores, clicking elsewhere applies.
// While this runs, history is paused and the helper objects are excluded from saving.
import { FabricImage, Point, Rect, controlsUtils, util } from "fabric";
import { KEEP, OcImage, applyMask } from "./images.js";

let state = null;
export const cropState = () => state;

const HELPER = { selectable: false, evented: false, excludeFromExport: true, objectCaching: false, hasControls: false };
const rad = util.degreesToRadians;

/** Crop shapes: [label, ratio (w/h), or "original", or null for free]. */
export const CROP_RATIOS = [
  ["Original", "original"], ["Free", null], ["1:1", 1], ["4:5", 4 / 5], ["16:9", 16 / 9], ["9:16", 9 / 16], ["3:2", 3 / 2], ["2:3", 2 / 3],
];
export const MAX_STRAIGHTEN = 45;

// ---- crop handles drawn like brackets and bars ------------------------------------------

function cropHandleRender(ctx, left, top, _style, obj) {
  const x = this.x, y = this.y;
  ctx.save();
  ctx.translate(left, top);
  ctx.rotate(rad(obj.angle || 0));
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = 4;
  ctx.beginPath();
  const L = 16;
  if (x && y) {
    ctx.moveTo(0, -Math.sign(y) * L);
    ctx.lineTo(0, 0);
    ctx.lineTo(-Math.sign(x) * L, 0);
  } else if (x) {
    ctx.moveTo(0, -L * 0.8);
    ctx.lineTo(0, L * 0.8);
  } else {
    ctx.moveTo(-L * 0.8, 0);
    ctx.lineTo(L * 0.8, 0);
  }
  ctx.stroke();
  ctx.restore();
}

function cropControls(withEdges = true) {
  const all = controlsUtils.createObjectDefaultControls();
  delete all.mtr;
  if (!withEdges) for (const k of ["ml", "mr", "mt", "mb"]) delete all[k];
  for (const c of Object.values(all)) {
    c.render = cropHandleRender;
    c.sizeX = 28;
    c.sizeY = 28;
  }
  return all;
}

// ---- geometry helpers ---------------------------------------------------------------------

/** A point in design space to the ghost's local (element pixel) space. */
const toLocal = (ghost, p) => util.transformPoint(p, util.invertTransform(ghost.calcTransformMatrix()));
const toDesign = (ghost, p) => util.transformPoint(p, ghost.calcTransformMatrix());

/** The window (box) measured in ghost space: centre and size. */
function boxInGhost(box, ghost) {
  const c = toLocal(ghost, box.getCenterPoint());
  return {
    cx: c.x, cy: c.y,
    w: (box.width * box.scaleX) / Math.abs(ghost.scaleX),
    h: (box.height * box.scaleY) / Math.abs(ghost.scaleY),
  };
}

/** Half the size, along the picture's own axes, of a w×h window turned by the straighten angle. */
function extents(w, h) {
  const a = rad((state.box.angle || 0) - (state.ghost.angle || 0));
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return { ex: (w * c + h * s) / 2, ey: (w * s + h * c) / 2, c, s };
}

/** The ratio as w/h in ghost units (a picture stretched on the page has different x and y scales). */
function ghostRatio(ratio) {
  const { ghost } = state;
  return ratio * (Math.abs(ghost.scaleY) / Math.abs(ghost.scaleX));
}

function syncDim() {
  if (!state) return;
  const { box, dim, ghost } = state;
  const clip = dim.clipPath;
  clip.set({ width: box.width, height: box.height, scaleX: box.scaleX, scaleY: box.scaleY, angle: box.angle });
  clip.setPositionByOrigin(box.getCenterPoint(), "center", "center");
  dim.set({ width: ghost.width, height: ghost.height, scaleX: ghost.scaleX, scaleY: ghost.scaleY, angle: ghost.angle });
  dim.setPositionByOrigin(ghost.getCenterPoint(), "center", "center");
  dim.set("dirty", true);
}

/**
 * Crop mode: keep the window inside the (maybe turned) picture, and keep the chosen ratio,
 * whichever handle is dragged. `corner` is the handle being dragged ("ml", "mt", "tl"...).
 */
function clampBox(corner = "") {
  const { box, ghost } = state;
  const gw = ghost.width, gh = ghost.height;
  let { cx, cy, w, h } = boxInGhost(box, ghost);
  const ratio = state.ratio ? ghostRatio(state.ratio) : 0;
  if (ratio) {
    if (corner === "mt" || corner === "mb") w = h * ratio;
    else h = w / ratio;
  }
  let { ex, ey } = extents(w, h);
  const k = Math.min(1, gw / 2 / ex, gh / 2 / ey);
  if (k < 1) {
    if (ratio || state.straighten) { w *= k; h *= k; } else { w = Math.min(w, gw); h = Math.min(h, gh); }
  }
  const min = 8;
  if (w < min || h < min) {
    const g = Math.max(min / w, min / h);
    w *= g;
    h *= g;
  }
  ({ ex, ey } = extents(w, h));
  cx = Math.max(-gw / 2 + ex, Math.min(gw / 2 - ex, cx));
  cy = Math.max(-gh / 2 + ey, Math.min(gh / 2 - ey, cy));
  box.set({ scaleX: (w * Math.abs(ghost.scaleX)) / box.width, scaleY: (h * Math.abs(ghost.scaleY)) / box.height });
  box.setPositionByOrigin(toDesign(ghost, new Point(cx, cy)), "center", "center");
  box.setCoords();
  syncDim();
}

/** Scale the picture by `k` about a design point. */
function scaleGhost(k, about) {
  const { ghost } = state;
  const g = ghost.getCenterPoint();
  ghost.set({ scaleX: ghost.scaleX * k, scaleY: ghost.scaleY * k });
  ghost.setPositionByOrigin(new Point(about.x + (g.x - about.x) * k, about.y + (g.y - about.y) * k), "center", "center");
}

/** How much bigger the picture must be to cover the window (< 1 when it's zoomed in). */
function coverNeed() {
  const { box, ghost } = state;
  const { w, h } = boxInGhost(box, ghost);
  const { ex, ey } = extents(w, h);
  return Math.max((2 * ex) / ghost.width, (2 * ey) / ghost.height);
}

/** Keep the (maybe turned) picture covering the window: zoom in if it must, then slide it. */
function coverBox() {
  const { box, ghost } = state;
  const P = box.getCenterPoint();
  const need = coverNeed();
  if (need > 1) scaleGhost(need * 1.0005, P);
  const gw = ghost.width, gh = ghost.height;
  const { cx, cy, w, h } = boxInGhost(box, ghost);
  const { ex, ey } = extents(w, h);
  const ccx = Math.max(-gw / 2 + ex, Math.min(gw / 2 - ex, cx));
  const ccy = Math.max(-gh / 2 + ey, Math.min(gh / 2 - ey, cy));
  if (ccx !== cx || ccy !== cy) {
    const want = toDesign(ghost, new Point(ccx, ccy));
    ghost.set({ left: ghost.left + (P.x - want.x), top: ghost.top + (P.y - want.y) });
  }
  ghost.setCoords();
  syncDim();
  return need;
}

// ---- the rule-of-thirds grid --------------------------------------------------------------

function drawThirds({ ctx }) {
  if (!state || !ctx) return;
  const c = state.app.editor.canvas, v = c.viewportTransform;
  const [tl, tr, br, bl] = state.box.getCoords();
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  ctx.save();
  ctx.setTransform(v[0], v[1], v[2], v[3], v[4], v[5]);
  ctx.beginPath();
  for (const t of [1 / 3, 2 / 3]) {
    const a = lerp(tl, tr, t), b = lerp(bl, br, t), p = lerp(tl, bl, t), q = lerp(tr, br, t);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
  }
  const z = c.getZoom();
  ctx.lineWidth = 3 / z;
  ctx.strokeStyle = "rgba(0,0,0,.25)";
  ctx.stroke();
  ctx.lineWidth = 1 / z;
  ctx.strokeStyle = state.dragging ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.55)";
  ctx.stroke();
  ctx.restore();
}

// ---- enter / leave ------------------------------------------------------------------------

const flipSign = (img) => (Boolean(img.flipX) !== Boolean(img.flipY) ? -1 : 1);

/**
 * Start cropping `img`. mode "crop" moves the window, "frame" moves the picture (frames and the
 * background photo always reposition).
 * @param {*} app
 * @param {FabricImage} img
 * @returns {boolean} whether crop mode started
 */
export function startCrop(app, img, mode = img.data?.frame || img.isBg ? "frame" : "crop") {
  if (!(img instanceof FabricImage) || (img.locked && !img.isBg)) return false;
  if (img.data?.frame && img.data?.empty) return false;
  if (img.isBg) mode = "frame";
  if (state) finishCrop(true);
  const ed = app.editor, c = ed.canvas;
  const el = img._element || img.getElement();
  const fs = img._filterScalingX || 1, fsy = img._filterScalingY || 1;
  const sx = img.scaleX, sy = img.scaleY;
  const gw = el.naturalWidth || el.width, gh = el.naturalHeight || el.height;
  const straighten = (img.data?.straighten || 0) * flipSign(img);
  const gAngle = (img.angle || 0) + straighten;
  // Where the picture's centre sits relative to the visible area's centre (element px).
  let dx = (img.cropX + img.width / 2) * fs - gw / 2, dy = (img.cropY + img.height / 2) * fsy - gh / 2;
  const ghost = new FabricImage(el, {
    ...HELPER, scaleX: sx / fs, scaleY: sy / fsy, angle: gAngle, flipX: img.flipX, flipY: img.flipY,
    name: "crop-ghost", data: { guide: true, cropUI: true },
  });
  if (img.flipX) dx = -dx;
  if (img.flipY) dy = -dy;
  const off = util.rotateVector(new Point(dx * (sx / fs), dy * (sy / fsy)), rad(gAngle));
  const center = img.getCenterPoint();
  ghost.setPositionByOrigin(center.subtract(off), "center", "center");

  const box = new Rect({
    width: img.width, height: img.height, scaleX: sx, scaleY: sy, angle: img.angle,
    fill: "transparent", stroke: "#ffffff", strokeWidth: 1.5, strokeUniform: true,
    excludeFromExport: true, objectCaching: false, lockRotation: true, lockScalingFlip: true,
    hasBorders: false, locked: true, name: "crop-box", data: { guide: true, cropUI: true },
  });
  box.setPositionByOrigin(center, "center", "center");

  const dim = new Rect({
    ...HELPER, width: gw, height: gh, scaleX: ghost.scaleX, scaleY: ghost.scaleY, angle: gAngle,
    fill: "rgba(8, 8, 14, 0.62)", name: "crop-dim", data: { guide: true, cropUI: true },
    clipPath: new Rect({ width: 1, height: 1, inverted: true, absolutePositioned: true }),
  });
  dim.setPositionByOrigin(ghost.getCenterPoint(), "center", "center");

  if (mode === "frame") {
    box.set({ selectable: false, evented: false, hasControls: false });
    ghost.set({ selectable: true, evented: true, hasControls: true, hasBorders: true, lockRotation: true,
      lockScalingFlip: true, hoverCursor: "move", objectCaching: false });
    ghost.controls = cropControls(false);
  } else {
    box.controls = cropControls(true);
  }

  ed.history.pause();
  state = { app, img, ghost, box, dim, mode, uniform: c.uniformScaling, ratio: null, ratioKey: "Free", straighten, autoZoom: 1, dragging: false, handlers: [] };
  c.uniformScaling = mode === "frame";
  const i = c.getObjects().indexOf(img);
  c.insertAt(i + 1, ghost, dim, box);
  syncDim();

  const on = (name, fn) => { c.on(name, fn); state.handlers.push([name, fn]); };
  const follow = (e) => {
    if (!state) return;
    state.dragging = true;
    if (e.target === box) clampBox(e.transform?.corner || "");
    else if (e.target === ghost) coverBox();
    syncDim();
  };
  on("object:moving", follow);
  on("object:scaling", follow);
  on("mouse:up", () => { if (state && state.dragging) { state.dragging = false; c.requestRenderAll(); } });
  on("after:render", drawThirds);
  on("selection:cleared", () => { if (state) finishCrop(true); });
  on("selection:created", (e) => { if (state && !isHelper(e.selected?.[0])) finishCrop(true); });
  on("selection:updated", (e) => { if (state && !isHelper(e.selected?.[0])) finishCrop(true); });
  const key = (e) => {
    if (!state || app.isTyping(e)) return;
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      finishCrop(e.key === "Enter");
    }
  };
  window.addEventListener("keydown", key, true);
  state.key = key;
  state.offDoc = app.bus.on?.("doc", () => { if (state && !c.getObjects().includes(state.box)) abort(); });

  c.setActiveObject(mode === "frame" ? ghost : box);
  c.requestRenderAll();
  app.bus.emit("selection", ed.selection(), ed.active());
  return true;
}

const isHelper = (o) => Boolean(o?.data?.cropUI);

function teardown() {
  const s = state;
  state = null;
  const c = s.app.editor.canvas;
  for (const [n, fn] of s.handlers) c.off(n, fn);
  window.removeEventListener("keydown", s.key, true);
  if (typeof s.offDoc === "function") s.offDoc();
  c.uniformScaling = s.uniform;
  c.remove(s.ghost, s.dim, s.box);
  s.app.editor.history.resume();
  return s;
}

/** The doc was replaced under us (undo, load): drop the helpers without applying. */
function abort() {
  if (!state) return;
  teardown();
  state = null;
}

/** A straightened picture needs our own image class (it draws the turn); swap a plain one in place. */
async function upgraded(app, img) {
  if (img instanceof OcImage) return img;
  const c = app.editor.canvas;
  const next = await OcImage.fromObject(img.toObject(KEEP));
  const i = c.getObjects().indexOf(img);
  c.remove(img);
  c.insertAt(i, next);
  return next;
}

/** Leave crop mode, applying the new crop (or restoring the old one). */
export function finishCrop(apply = true) {
  if (!state) return;
  const s = state;
  const { ghost, box, mode, app } = s;
  const geo = boxInGhost(box, ghost);
  const center = box.getCenterPoint();
  const gScale = Math.abs(ghost.scaleX), gScaleY = Math.abs(ghost.scaleY);
  const turn = Math.round(((ghost.angle || 0) - (box.angle || 0)) * 100) / 100;
  teardown();
  const ed = app.editor, c = ed.canvas;
  const done = (img) => {
    c.setActiveObject(img);
    c.requestRenderAll();
    app.refreshToolbar?.();
  };
  if (!apply) { done(s.img); return; }
  const before = (o) => JSON.stringify([o.cropX, o.cropY, o.width, o.height, o.scaleX, o.scaleY, o.left, o.top, o.data?.straighten || 0]);
  const was = before(s.img);
  const run = (img) => {
    const fs = img._filterScalingX || 1, fsy = img._filterScalingY || 1;
    // Element px back to source px; un-mirror for flipped images.
    let cx = geo.cx, cy = geo.cy;
    if (img.flipX) cx = -cx;
    if (img.flipY) cy = -cy;
    const gw = ghost.width, gh = ghost.height;
    // A turned window may reach past the picture's straight edges (its corners still sit inside).
    const floor = turn ? -Infinity : 0;
    img.set({
      cropX: Math.max(floor, (cx + gw / 2 - geo.w / 2) / fs),
      cropY: Math.max(floor, (cy + gh / 2 - geo.h / 2) / fsy),
      width: geo.w / fs, height: geo.h / fsy,
      scaleX: gScale * fs * Math.sign(img.scaleX || 1),
      scaleY: gScaleY * fsy * Math.sign(img.scaleY || 1),
    });
    const local = turn * flipSign(img);
    if (local || img.data?.straighten) img.set("data", { ...(img.data || {}), straighten: local || 0 });
    img.setPositionByOrigin(center, "center", "center");
    img.setCoords();
    applyMask(img);
    img.set("dirty", true);
    if (before(img) !== was) ed.commit(mode === "frame" ? "Reposition" : "Crop");
    done(img);
  };
  if (turn && !(s.img instanceof OcImage)) {
    upgraded(app, s.img).then(run).catch(() => done(s.img));
    return;
  }
  run(s.img);
}

// ---- crop toolbar actions -------------------------------------------------------------------

/** Back to the whole picture, straight, with no fixed shape. */
export function resetCrop() {
  if (!state) return;
  setStraighten(0);
  if (state.mode !== "crop") { setZoom(1); return; }
  const { box, ghost } = state;
  scaleGhost(1 / state.autoZoom, box.getCenterPoint());
  state.autoZoom = 1;
  box.set({ scaleX: (ghost.width * Math.abs(ghost.scaleX)) / box.width, scaleY: (ghost.height * Math.abs(ghost.scaleY)) / box.height });
  box.setPositionByOrigin(ghost.getCenterPoint(), "center", "center");
  box.setCoords();
  state.ratio = null;
  state.ratioKey = "Free";
  state.app.editor.canvas.uniformScaling = false;
  syncDim();
  state.app.editor.canvas.requestRenderAll();
}

/**
 * Set the window to the largest centred area of a shape: a ratio (w/h), "original" (the
 * picture's own shape) or null (free). `key` is the label shown in the bar.
 */
export function setCropRatio(ratio, key = null) {
  if (!state || state.mode !== "crop") return;
  const { box, ghost } = state;
  const r = ratio === "original" ? (ghost.width * Math.abs(ghost.scaleX)) / (ghost.height * Math.abs(ghost.scaleY)) : ratio;
  state.ratio = r || null;
  state.ratioKey = key || (r ? String(ratio) : "Free");
  state.app.editor.canvas.uniformScaling = Boolean(r);
  if (r) {
    const rg = ghostRatio(r);
    const { c, s } = extents(1, 1);
    const w = Math.min(ghost.width / (c + s / rg), ghost.height / (s + c / rg)), h = w / rg;
    box.set({ scaleX: (w * Math.abs(ghost.scaleX)) / box.width, scaleY: (h * Math.abs(ghost.scaleY)) / box.height });
    box.setPositionByOrigin(ghost.getCenterPoint(), "center", "center");
    box.setCoords();
    clampBox();
  }
  state.app.editor.canvas.requestRenderAll();
}

/**
 * Turn the picture under the window by `deg` (-45..45). It zooms in only as much as needed to
 * keep the window covered (and back out when turned back).
 */
export function setStraighten(deg) {
  if (!state) return;
  const d = Math.max(-MAX_STRAIGHTEN, Math.min(MAX_STRAIGHTEN, Number(deg) || 0));
  const { box, ghost } = state;
  const P = box.getCenterPoint();
  // undo the zoom the last turn needed, turn about the window's centre, then zoom as needed
  scaleGhost(1 / state.autoZoom, P);
  const step = d - state.straighten;
  const g = ghost.getCenterPoint();
  const v = util.rotateVector(new Point(g.x - P.x, g.y - P.y), rad(step));
  ghost.set({ angle: (ghost.angle || 0) + step });
  ghost.setPositionByOrigin(new Point(P.x + v.x, P.y + v.y), "center", "center");
  state.straighten = d;
  const need = coverNeed();
  state.autoZoom = Math.max(1, need * 1.0005);
  coverBox();
  if (state.mode === "crop" && state.ratio) clampBox();
  ghost.setCoords();
  state.app.editor.canvas.requestRenderAll();
}

/** Reposition mode: how far the picture is zoomed in past "just covers the window" (1 = not at all). */
export function cropZoom() {
  return state ? 1 / Math.max(1e-6, coverNeed()) : 1;
}

/** Reposition mode: zoom the picture to `z` times "just covers the window" (1..4), about the window's centre. */
export function setZoom(z) {
  if (!state) return;
  const want = Math.max(1, Math.min(4, Number(z) || 1));
  scaleGhost(want * coverNeed(), state.box.getCenterPoint());
  state.autoZoom = 1;
  coverBox();
  state.app.editor.canvas.requestRenderAll();
}
