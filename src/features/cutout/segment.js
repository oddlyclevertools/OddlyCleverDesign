// Cut the subject out of a picture: the model gives a 1024x1024 "how much is subject" map,
// which is scaled back to the picture's own size and used as its transparency.
import { MODEL, getSession, ort } from "./model.js";

const S = MODEL.size;

/** float32 -> IEEE half (as uint16 bits). */
function toHalf(v) {
  const f = new Float32Array([v]);
  const x = new Uint32Array(f.buffer)[0];
  const sign = (x >>> 16) & 0x8000;
  let exp = ((x >>> 23) & 0xff) - 127 + 15;
  const mant = x & 0x7fffff;
  if (exp <= 0) return sign;
  if (exp >= 31) return sign | 0x7c00;
  return sign | (exp << 10) | (mant >>> 13);
}

/** IEEE half bits -> float. */
function fromHalf(h) {
  const s = h & 0x8000 ? -1 : 1, e = (h >>> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

function pixelsOf(el, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(el, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

/** The model input: 1x3x1024x1024, normalised. */
function inputTensor(el, half) {
  const px = pixelsOf(el, S, S);
  const n = S * S;
  const out = half ? new Uint16Array(3 * n) : new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const v = (px[i * 4 + c] / 255 - MODEL.mean[c]) / MODEL.std[c];
      out[c * n + i] = half ? toHalf(v) : v;
    }
  }
  return new ort.Tensor(half ? "float16" : "float32", out, [1, 3, S, S]);
}

/**
 * The subject mask of a picture, at the picture's own size.
 * @param {HTMLImageElement|HTMLCanvasElement} el
 * @returns {Promise<{ mask: HTMLCanvasElement, ms: number, onGPU: boolean, gpuName: string }>}
 *   mask: white = subject, transparent = background (soft edges kept)
 */
export async function subjectMask(el) {
  const t0 = performance.now();
  const { session, onGPU, gpuName } = await getSession();
  const meta = session.inputMetadata?.[0];
  const half = meta?.type === "float16";
  const feeds = { [session.inputNames[0]]: inputTensor(el, half) };
  const results = await session.run(feeds);
  const out = results[session.outputNames[0]]; // IS-Net: the first output is the finished mask (the rest are coarser side outputs)
  const d = out.data;
  // float16 results come as raw bits (Uint16Array), or as real numbers where Float16Array exists.
  const isHalf = out.type === "float16" && d instanceof Uint16Array;
  const small = document.createElement("canvas");
  small.width = S;
  small.height = S;
  const sctx = small.getContext("2d");
  const img = sctx.createImageData(S, S);
  // IS-Net gives 0..1 already; stretch it to the full range, as rembg does.
  const val = (i) => (isHalf ? fromHalf(d[i]) : d[i]);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < S * S; i++) { const v = val(i); if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo || 1;
  for (let i = 0; i < S * S; i++) {
    const a = (val(i) - lo) / span;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = Math.round(a * 255);
  }
  sctx.putImageData(img, 0, 0);
  for (const t of Object.values(results)) t.dispose?.();
  const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const mctx = mask.getContext("2d");
  mctx.imageSmoothingQuality = "high";
  mctx.drawImage(small, 0, 0, w, h);
  return { mask, ms: Math.round(performance.now() - t0), onGPU, gpuName };
}

/** The picture with everything but the subject made transparent (a PNG-ready canvas). */
export async function cutOut(el) {
  const { mask, ...info } = await subjectMask(el);
  const c = document.createElement("canvas");
  c.width = mask.width;
  c.height = mask.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(el, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return { canvas: c, mask, ...info };
}
