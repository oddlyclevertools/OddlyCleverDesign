// Images, frames and the background image.
// OcImage is a FabricImage that can also draw a border that follows its mask shape, a
// sticker-style outline around transparent cutouts, and a straightened (turned) picture inside
// its crop window (data.straighten, degrees). Frames are OcImages with data.frame set:
// an image clipped to a shape (data.mask), with a placeholder picture while empty.
import { FabricImage, Path, classRegistry } from "fabric";
import { maskPath, defaultSize } from "./geometry.js";

const escapeXml = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const MAX_SIDE = 4096;
export const KEEP = ["id", "name", "locked", "isPage", "isBg", "data"];

export class OcImage extends FabricImage {
  static type = "OcImage";

  shouldCache() {
    // The outline draws outside the image box, so an outlined image skips the object cache.
    if (this._hasOutline()) return false;
    return super.shouldCache();
  }

  _hasOutline() {
    return Boolean(this.data?.outline?.width) && !this.clipPath;
  }

  _renderFill(ctx) {
    if (this.data?.straighten && this._element) return this._renderStraight(ctx);
    if (!this._hasOutline()) return super._renderFill(ctx);
    const comp = this._outlineCanvas();
    if (!comp) return super._renderFill(ctx);
    ctx.save();
    ctx.scale(1 / this.scaleX, 1 / this.scaleY);
    ctx.drawImage(comp.canvas, -comp.W / 2 - comp.pad, -comp.H / 2 - comp.pad);
    ctx.restore();
  }

  /** The picture turned by data.straighten about the crop window's centre, clipped to the window. */
  _renderStraight(ctx) {
    const el = this._element;
    const fs = this._filterScalingX || 1, fsy = this._filterScalingY || 1;
    const w = this.width, h = this.height;
    const ew = el.naturalWidth || el.width, eh = el.naturalHeight || el.height;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
    ctx.rotate((this.data.straighten * Math.PI) / 180);
    ctx.drawImage(el, 0, 0, ew, eh, -(this.cropX + w / 2), -(this.cropY + h / 2), ew / fs, eh / fsy);
    ctx.restore();
  }

  /** SVG for a straightened picture: the same turn and crop window as _renderStraight. */
  _toSVG() {
    const el = this._element;
    if (!this.data?.straighten || !el) return super._toSVG();
    const w = this.width, h = this.height, x = -w / 2, y = -h / 2;
    const fs = this._filterScalingX || 1, fsy = this._filterScalingY || 1;
    const ew = (el.naturalWidth || el.width) / fs, eh = (el.naturalHeight || el.height) / fsy;
    const id = `imageStraight_${Math.random().toString(36).slice(2, 10)}`;
    const smooth = this.imageSmoothing ? "" : ' image-rendering="optimizeSpeed"';
    return [
      `<clipPath id="${id}">\n\t<rect x="${x}" y="${y}" width="${w}" height="${h}" />\n</clipPath>\n`,
      `<g clip-path="url(#${id})">\n<g transform="rotate(${Number(this.data.straighten)})">\n`,
      "\t<image ", "COMMON_PARTS",
      `xlink:href="${escapeXml(this.getSrc(true))}" x="${-(this.cropX + w / 2)}" y="${-(this.cropY + h / 2)}" width="${ew}" height="${eh}"${smooth}></image>\n`,
      "</g>\n</g>\n",
    ];
  }

  _render(ctx) {
    super._render(ctx);
    const b = this.data?.border;
    if (b?.width > 0 && b.color) this._drawBorder(ctx, b);
  }

  _drawBorder(ctx, b) {
    const sx = Math.abs(this.scaleX) || 1, sy = Math.abs(this.scaleY) || 1;
    const W = this.width * sx, H = this.height * sy;
    const B = Math.min(b.width, W / 2, H / 2);
    const mask = this.data?.mask ? { ...this.data.mask, radius: Math.max(0, (this.data.mask.radius || 0) - B / 2) } : null;
    const path = new Path2D(maskPath(mask, W - B, H - B, -W / 2 + B / 2, -H / 2 + B / 2));
    ctx.save();
    ctx.scale(1 / sx, 1 / sy);
    ctx.lineWidth = B;
    ctx.strokeStyle = b.color;
    ctx.lineJoin = "round";
    if (b.style === "dashed") ctx.setLineDash([B * 3, B * 2]);
    else if (b.style === "dotted") { ctx.setLineDash([0.001, B * 2]); ctx.lineCap = "round"; }
    ctx.stroke(path);
    ctx.restore();
  }

  /** The image region with a solid outline around its opaque pixels, at design scale. */
  _outlineCanvas() {
    const el = this._element;
    if (!el) return null;
    const o = this.data.outline;
    const sx = Math.abs(this.scaleX) || 1, sy = Math.abs(this.scaleY) || 1;
    const W = Math.max(1, Math.round(this.width * sx)), H = Math.max(1, Math.round(this.height * sy));
    const pad = Math.ceil(o.width) + 2;
    const key = [el.width, el.height, this._filteredEl ? 1 : 0, this.cropX, this.cropY, this.width, this.height, W, H, o.width, o.color, this._filterTick].join("|");
    if (this._outline?.key === key) return this._outline;
    const fs = this._filterScalingX || 1, fsy = this._filterScalingY || 1;
    const region = document.createElement("canvas");
    region.width = W;
    region.height = H;
    const rc = region.getContext("2d");
    rc.drawImage(el, this.cropX * fs, this.cropY * fsy, this.width * fs, this.height * fsy, 0, 0, W, H);
    const tint = document.createElement("canvas");
    tint.width = W;
    tint.height = H;
    const tc = tint.getContext("2d");
    tc.drawImage(region, 0, 0);
    tc.globalCompositeOperation = "source-in";
    tc.fillStyle = o.color;
    tc.fillRect(0, 0, W, H);
    const out = document.createElement("canvas");
    out.width = W + pad * 2;
    out.height = H + pad * 2;
    const oc = out.getContext("2d");
    for (const [r, n] of [[o.width, 36], [o.width * 0.5, 18]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        oc.drawImage(tint, pad + Math.cos(a) * r, pad + Math.sin(a) * r);
      }
    }
    oc.drawImage(region, pad, pad);
    this._outline = { key, canvas: out, W, H, pad };
    return this._outline;
  }

  applyFilters(filters) {
    this._filterTick = (this._filterTick || 0) + 1;
    return super.applyFilters(filters);
  }
}
classRegistry.setClass(OcImage);

export const isImage = (o) => o instanceof FabricImage;
export const isFrame = (o) => isImage(o) && Boolean(o.data?.frame);
export const isEmptyFrame = (o) => isFrame(o) && Boolean(o.data?.empty);

// ---- loading and downscaling ------------------------------------------------------------

export function loadElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image couldn't be opened."));
    img.src = src;
  });
}

const readAsDataURL = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error("That file couldn't be read."));
  r.readAsDataURL(blob);
});

/**
 * Read an image file, shrink it to MAX_SIDE on the long side if needed, and make a thumbnail.
 * @returns {Promise<{src: string, width: number, height: number, thumb: string, name: string, type: string}>}
 */
export async function prepareImageFile(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error(`${file?.name || "That file"} isn't an image.`);
  const original = await readAsDataURL(file);
  const el = await loadElement(original);
  const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
  if (!w || !h) throw new Error(`${file.name} has no size.`);
  let src = original, width = w, height = h;
  const isVector = file.type === "image/svg+xml";
  if (!isVector && Math.max(w, h) > MAX_SIDE) {
    const k = MAX_SIDE / Math.max(w, h);
    width = Math.round(w * k);
    height = Math.round(h * k);
    const c = drawScaled(el, width, height);
    src = file.type === "image/jpeg" ? c.toDataURL("image/jpeg", 0.92) : c.toDataURL("image/png");
  } else if (isVector) {
    // Rasterise SVG so filters and crops work; keep it crisp at a decent size.
    const k = Math.min(MAX_SIDE, Math.max(1200, Math.max(w, h))) / Math.max(w, h);
    width = Math.round(w * k);
    height = Math.round(h * k);
    src = drawScaled(el, width, height).toDataURL("image/png");
  }
  return { src, width, height, thumb: makeThumb(el, 280), name: file.name || "Image", type: file.type };
}

function drawScaled(el, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(el, 0, 0, w, h);
  return c;
}

export function makeThumb(el, side = 280) {
  const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
  const k = Math.min(1, side / Math.max(w, h));
  return drawScaled(el, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))).toDataURL("image/webp", 0.82);
}

// ---- adding images ------------------------------------------------------------------------

/** Add an image (data URL) to the design, fitted to the page, at `at` (page point) or centred. */
export async function addImage(app, src, { at = null, name = "Image" } = {}) {
  const ed = app.editor;
  const el = await loadElement(src);
  const img = new OcImage(el, { name, data: { kind: "image" } });
  const k = Math.min(1, (ed.width * 0.62) / img.width, (ed.height * 0.62) / img.height);
  img.scale(k);
  ed.add(img, { center: !at });
  if (at) {
    img.setPositionByOrigin(at, "center", "center");
    img.setCoords();
    ed.canvas.requestRenderAll();
    ed.commit("Add image", { merge: true });
  }
  return img;
}

// ---- masks and frames -------------------------------------------------------------------

/** Build (or clear) the clip path from data.mask for the image's current size. */
export function applyMask(img) {
  const mask = img.data?.mask;
  if (!mask || ((mask.shape === "roundRect" || mask.shape === "rect") && !mask.radius)) {
    img.clipPath = undefined;
  } else {
    const sx = Math.abs(img.scaleX) || 1, sy = Math.abs(img.scaleY) || 1;
    const W = img.width * sx, H = img.height * sy;
    const clip = new Path(maskPath(mask, W, H), {
      originX: "center", originY: "center", left: 0, top: 0, scaleX: 1 / sx, scaleY: 1 / sy,
      fill: "#000", strokeWidth: 0,
    });
    img.clipPath = clip;
  }
  img._outline = null;
  img.set("dirty", true);
}

/** A soft placeholder picture for an empty frame. */
export function framePlaceholder(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#e4e0ef");
  g.addColorStop(1, "#c3bbd9");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const s = Math.min(w, h) * 0.32, cx = w / 2, cy = h / 2;
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath();
  ctx.arc(cx + s * 0.3, cy - s * 0.32, s * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.62, cy + s * 0.42);
  ctx.lineTo(cx - s * 0.16, cy - s * 0.18);
  ctx.lineTo(cx + s * 0.12, cy + s * 0.14);
  ctx.lineTo(cx + s * 0.3, cy - s * 0.02);
  ctx.lineTo(cx + s * 0.62, cy + s * 0.42);
  ctx.closePath();
  ctx.fill();
  return c;
}

export const FRAMES = [
  { key: "circle", label: "Circle frame" },
  { key: "roundRect", label: "Rounded frame", radius: 48 },
  { key: "rect", label: "Square frame" },
  { key: "star5", label: "Star frame" },
  { key: "heart", label: "Heart frame" },
  { key: "blob", label: "Blob frame" },
  { key: "arch", label: "Arch frame" },
  { key: "hexagon", label: "Hexagon frame" },
  { key: "diamond", label: "Diamond frame" },
  { key: "cloud", label: "Cloud frame" },
];

/** A new empty frame of an outline shape. */
export function createFrame(key, size = null) {
  const def = FRAMES.find((f) => f.key === key) || { key, label: "Frame" };
  const { w, h } = size || (key === "roundRect" || key === "rect" ? { w: 400, h: 400 } : defaultSize(key, 400));
  const ph = framePlaceholder(Math.round(w), Math.round(h));
  const img = new OcImage(ph, {
    name: def.label,
    data: { kind: "frame", frame: true, empty: true, mask: { shape: key === "rect" ? "rect" : key, radius: def.radius || 0 } },
  });
  applyMask(img);
  return img;
}

/** Fit a source into an image's current box (cover), keeping position, mask and filters. */
export async function fillWithSource(img, src) {
  const el = await loadElement(src);
  const center = img.getCenterPoint();
  const dispW = img.width * Math.abs(img.scaleX), dispH = img.height * Math.abs(img.scaleY);
  await img.setElement(el);
  const nw = el.naturalWidth || el.width, nh = el.naturalHeight || el.height;
  // A straightened photo keeps its turn: the new picture must cover the turned window.
  const t = ((img.data?.straighten || 0) * Math.PI) / 180, co = Math.abs(Math.cos(t)), si = Math.abs(Math.sin(t));
  const s = Math.max((dispW * co + dispH * si) / nw, (dispW * si + dispH * co) / nh);
  const w = dispW / s, h = dispH / s;
  img.set({
    width: w, height: h, cropX: (nw - w) / 2, cropY: (nh - h) / 2,
    scaleX: s * Math.sign(img.scaleX || 1), scaleY: s * Math.sign(img.scaleY || 1),
  });
  if (img.data?.frame) img.set("data", { ...img.data, empty: false });
  applyMask(img);
  img.setPositionByOrigin(center, "center", "center");
  img.setCoords();
  return img;
}

/** The topmost frame (or photo-grid cell) under a page point. */
export function frameAt(app, pt) {
  const list = app.editor.objects().filter((o) => o.visible !== false && !o.locked && (isFrame(o) || o.data?.kind === "grid"));
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    if (o.data?.kind === "grid") {
      const cells = o.getObjects();
      for (let j = cells.length - 1; j >= 0; j--) {
        cells[j].setCoords();
        if (cells[j].containsPoint(pt)) return cells[j];
      }
    } else if (o.containsPoint(pt)) return o;
  }
  return null;
}

// ---- background image --------------------------------------------------------------------

// Only images can be re-covered; other isBg objects (a template's backdrop shape) are left alone.
export const backgroundImage = (app) => app.editor.objects().find((o) => o.isBg && typeof o.getOriginalSize === "function");

/** Crop an image so it exactly covers the page, at the bottom of the stack. */
export function coverPage(app, img) {
  const ed = app.editor;
  const { width: nw, height: nh } = img.getOriginalSize();
  const s = Math.max(ed.width / nw, ed.height / nh);
  const w = ed.width / s, h = ed.height / s;
  img.set({ width: w, height: h, cropX: (nw - w) / 2, cropY: (nh - h) / 2, scaleX: s, scaleY: s, angle: 0, flipX: false, flipY: false });
  if (img.data?.straighten) img.set("data", { ...img.data, straighten: 0 });
  img.setPositionByOrigin({ x: ed.width / 2, y: ed.height / 2 }, "center", "center");
  img.setCoords();
}

function lockAsBackground(img) {
  img.set({
    isBg: true, locked: true, name: "Background image",
    selectable: false, evented: false, hasControls: false, hoverCursor: "default",
    lockMovementX: true, lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true,
    clipPath: undefined, shadow: null,
    data: { ...(img.data || {}), kind: "image", mask: null, border: null, outline: null, frame: false, empty: false },
  });
}

/** Put an image (an existing object or a data URL) behind everything as the page background. */
export async function setBackgroundImage(app, source, extraData = null) {
  const ed = app.editor, c = ed.canvas;
  let img;
  if (typeof source === "string") {
    img = new OcImage(await loadElement(source), { data: { kind: "image" } });
  } else {
    img = await OcImage.fromObject(source.toObject(KEEP));
    c.remove(source);
  }
  for (const old of ed.objects().filter((o) => o.isBg)) c.remove(old);
  lockAsBackground(img);
  img.set("data", { ...img.data, scene: null, ...(extraData || {}) });
  coverPage(app, img);
  img.set("id", `bg${Date.now().toString(36)}`);
  c.discardActiveObject();
  c.insertAt(1, img);
  c.requestRenderAll();
  ed.commit("Background image");
  return img;
}

/** The page background is a photo the user can edit (not a drawn scene or a template shape). */
export const isBgPhoto = (o) => Boolean(o?.isBg) && isImage(o) && !o.data?.scene;

/** Turn the background photo back into a normal photo on the page (selected, one undo step). */
export function detachBackground(app, img = backgroundImage(app)) {
  if (!img || !img.isBg) return null;
  const ed = app.editor;
  img.set({ isBg: false, locked: false, name: "Image", hasControls: true, hasBorders: true, hoverCursor: null });
  ed._applyLock(img);
  ed.canvas.setActiveObject(img);
  ed.canvas.requestRenderAll();
  ed.commit("Detach background photo");
  return img;
}

export function removeBackgroundImage(app) {
  const ed = app.editor;
  const list = ed.objects().filter((o) => o.isBg);
  if (!list.length) return false;
  ed.canvas.remove(...list);
  ed.canvas.requestRenderAll();
  ed.commit("Remove background image");
  return true;
}
