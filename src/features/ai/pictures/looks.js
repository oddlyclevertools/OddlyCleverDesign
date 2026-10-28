// Photo looks for real pictures, baked into the bitmap so they export exactly as seen:
//   polaroid     white instant-photo paper with a handwritten caption on the wide bottom edge
//   split_light  black and white with cyan light from the left and red from the right
//                (the "real / fake" two-sided look), with an optional dashed split line
//   bw_grain     punchy black and white with film grain and a soft vignette
//   noir         like bw_grain but darker and harder
// Everything runs on this PC with a 2D canvas.
import { ensureFont } from "../../../core/fonts.js";

export const LOOKS = ["polaroid", "split_light", "bw_grain", "noir"];
const MAX_SIDE = 2048;

function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** The source drawn at most MAX_SIDE on the long side. */
function base(src) {
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = canvasOf(w * k, h * k);
  const ctx = c.getContext("2d", { willReadFrequently: true }); // mono() and grain() read it back
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Grey with contrast (amount 0..1), in place. */
function mono(c, contrast = 0.25, lift = 0) {
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data, k = 1 + contrast;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const v = Math.max(0, Math.min(255, (y - 128) * k + 128 + lift));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

/** Film grain (repeatable: a fixed seed), in place. */
function grain(c, amount = 18) {
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let s = 1234567;
  for (let i = 0; i < d.length; i += 4) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const n = ((s / 0x7fffffff) - 0.5) * amount * 2;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function vignette(c, strength = 0.55) {
  const ctx = c.getContext("2d");
  const r = Math.hypot(c.width, c.height) / 2;
  const g = ctx.createRadialGradient(c.width / 2, c.height / 2, r * 0.35, c.width / 2, c.height / 2, r);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
}

function splitLight(src, { left = "#2ad1ff", right = "#ff2a2a", line = true } = {}) {
  const c = base(src);
  mono(c, 0.35, -8);
  const ctx = c.getContext("2d");
  const w = c.width, h = c.height;
  // Colour light: multiply keeps the shadows black, screen adds the glow on the lit side.
  for (const [mode, alpha] of [["multiply", 1], ["screen", 0.35]]) {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, left);
    g.addColorStop(0.48, left);
    g.addColorStop(0.52, right);
    g.addColorStop(1, right);
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  vignette(c, 0.6);
  if (line) {
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.setLineDash([h * 0.02, h * 0.014]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
  }
  grain(c, 10);
  return c;
}

async function polaroid(src, { caption = "" } = {}) {
  const photo = base(src);
  const side = Math.round(Math.max(photo.width, photo.height) * 0.06);
  const bottom = Math.round(side * 3.4);
  const c = canvasOf(photo.width + side * 2, photo.height + side + bottom);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f6f3ea";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(photo, side, side);
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(side, side, photo.width, photo.height);
  const words = String(caption || "").trim().slice(0, 60);
  if (words) {
    await ensureFont("Permanent Marker");
    let size = bottom * 0.42;
    ctx.font = `${size}px "Permanent Marker", "Caveat", cursive`;
    while (ctx.measureText(words).width > c.width - side * 2 && size > 10) {
      size *= 0.9;
      ctx.font = `${size}px "Permanent Marker", "Caveat", cursive`;
    }
    ctx.fillStyle = "#1d1b18";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(words, c.width / 2, photo.height + side + bottom * 0.52);
  }
  c.photoWidth = photo.width; // the photo's width inside the paper, for keeping its size on the page
  return c;
}

function bwGrain(src, { dark = false } = {}) {
  const c = base(src);
  mono(c, dark ? 0.55 : 0.3, dark ? -18 : 0);
  vignette(c, dark ? 0.7 : 0.45);
  grain(c, dark ? 22 : 16);
  return c;
}

/**
 * Bake a look into a picture.
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} src
 * @param {string} look one of LOOKS
 * @param {{ caption?: string, line?: boolean }} [opts]
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function bakeLook(src, look, opts = {}) {
  if (look === "polaroid") return polaroid(src, opts);
  if (look === "split_light") return splitLight(src, opts);
  if (look === "bw_grain") return bwGrain(src);
  if (look === "noir") return bwGrain(src, { dark: true });
  throw new Error(`Unknown look "${look}". Use ${LOOKS.join(", ")}.`);
}
