// Masks for the magic photo edits. A "hole mask" is a canvas the size of the picture's own pixels
// (its natural size): opaque where the picture should change, transparent where it stays.
// Plus the maths that maps page and screen points onto those pixels, for any zoom, pan,
// rotation, flip or crop.
import { util } from "fabric";

/** A canvas of the given size. */
export function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** The picture's own pixel size (before crop, filters or scaling). */
export function naturalSize(img) {
  const s = img.getOriginalSize?.() || {};
  const el = img._originalElement || img.getElement?.();
  return { w: s.width || el?.naturalWidth || el?.width || img.width, h: s.height || el?.naturalHeight || el?.height || img.height };
}

/**
 * The matrix from the picture's own pixels to page (scene) coordinates.
 * Fabric draws the visible part (cropX, cropY, width, height) centred on the object's origin.
 */
export function pixelToScene(img) {
  const shift = [1, 0, 0, 1, -img.width / 2 - (img.cropX || 0), -img.height / 2 - (img.cropY || 0)];
  return util.multiplyTransformMatrices(img.calcTransformMatrix(), shift);
}

/** The matrix from the picture's own pixels to screen (canvas element) pixels. */
export function pixelToScreen(img, canvas) {
  return util.multiplyTransformMatrices(canvas.viewportTransform, pixelToScene(img));
}

/** A page point to the picture's own pixels. */
export function sceneToPixel(img, pt) {
  return util.transformPoint(pt, util.invertTransform(pixelToScene(img)));
}

/** A hole mask with a box (in page pixels) painted in: follows rotation and crop. */
export function boxMask(img, box) {
  const { w, h } = naturalSize(img);
  const c = canvasOf(w, h);
  const ctx = c.getContext("2d");
  const pts = [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h]]
    .map(([x, y]) => sceneToPixel(img, { x, y }));
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
  return c;
}

/** The painted area's bounds {x, y, w, h} in the mask's pixels, or null when nothing is painted. */
export function maskBounds(mask, threshold = 8) {
  const { width: W, height: H } = mask;
  const d = mask.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (d[row + x * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** How much of the mask is painted (0..1). */
export function maskCoverage(mask, threshold = 127) {
  const { width: W, height: H } = mask;
  const d = mask.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > threshold) n++;
  return n / (W * H);
}

/** The mask grown by `px` pixels on every side (a hard edge). */
export function dilate(mask, px) {
  const out = canvasOf(mask.width, mask.height);
  const ctx = out.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(mask, 0, 0);
  const r = Math.max(0, px);
  if (r < 0.5) return out;
  for (const rr of [r, r * 0.66, r * 0.33]) {
    const n = Math.max(8, Math.ceil(rr * 1.5));
    for (let i = 0; i < Math.min(n, 48); i++) {
      const a = (i / Math.min(n, 48)) * Math.PI * 2;
      ctx.drawImage(mask, Math.cos(a) * rr, Math.sin(a) * rr);
    }
  }
  // make the grown edge solid again
  const d = ctx.getImageData(0, 0, out.width, out.height);
  for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 20 ? 255 : 0;
  ctx.putImageData(d, 0, 0);
  return out;
}

/** The mask with a soft edge of `px` pixels (for blending a result in without a seam). */
export function feather(mask, px) {
  const out = canvasOf(mask.width, mask.height);
  const ctx = out.getContext("2d");
  if (px > 0.5) ctx.filter = `blur(${px}px)`;
  ctx.drawImage(mask, 0, 0);
  return out;
}

/** The mask resized (a new canvas). */
export function resized(src, w, h) {
  const out = canvasOf(w, h);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

/** An OpenAI-style edit mask PNG: transparent where the AI may change, opaque black where it keeps. */
export function aiMaskPng(mask, w = mask.width, h = mask.height) {
  const out = canvasOf(w, h);
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(mask, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

/**
 * `base` with `result` laid over it only where the mask is painted (soft edge `soft` px).
 * Everything outside the mask stays exactly as it was.
 */
export function blendInto(base, result, mask, soft = 0) {
  const W = base.width || base.naturalWidth, H = base.height || base.naturalHeight;
  const patch = canvasOf(W, H);
  const pctx = patch.getContext("2d");
  pctx.imageSmoothingQuality = "high";
  pctx.drawImage(result, 0, 0, W, H);
  pctx.globalCompositeOperation = "destination-in";
  pctx.drawImage(soft > 0 ? feather(mask, soft) : mask, 0, 0, W, H);
  if (soft > 0) pctx.drawImage(mask, 0, 0, W, H); // soft only inwards: nothing outside the mask changes
  const out = canvasOf(W, H);
  const ctx = out.getContext("2d");
  ctx.drawImage(base, 0, 0, W, H);
  ctx.drawImage(patch, 0, 0);
  return out;
}

/** A soft-edge size that suits a picture: about 0.4% of its long side, at least 2 px. */
export const softFor = (w, h) => Math.max(2, Math.round(Math.max(w, h) * 0.004));
