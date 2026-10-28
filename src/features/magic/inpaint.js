// The free Magic Eraser engine: MI-GAN on this PC's GPU. The model's pipeline takes the whole
// picture and a keep-mask (255 = keep, 0 = fill), crops around the hole, fills it at 512 px and
// pastes it back. We grow the hole a little first (so no outline of the old thing is left) and
// blend the filled part in with a soft edge; the rest of the picture is untouched.
import { eraserSession, ort } from "./model.js";
import { blendInto, canvasOf, dilate, softFor } from "./mask.js";

const MAX_PIXELS = 4096 * 4096;

/**
 * Fill the painted area of a picture on this PC.
 * @param {HTMLImageElement|HTMLCanvasElement} el the picture (its own pixel size)
 * @param {HTMLCanvasElement} hole the hole mask, the same size (opaque = remove)
 * @returns {Promise<{ canvas: HTMLCanvasElement, ms: number, onGPU: boolean, gpuName: string }>}
 */
export async function inpaintLocal(el, hole) {
  const t0 = performance.now();
  const { session, onGPU, gpuName } = await eraserSession();
  const W = el.naturalWidth || el.width, H = el.naturalHeight || el.height;
  if (W * H > MAX_PIXELS) throw new Error("This picture is too big for the eraser (over 16 megapixels).");
  const grown = dilate(hole, Math.max(3, Math.round(Math.max(W, H) * 0.006)));
  const src = canvasOf(W, H);
  const sctx = src.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(el, 0, 0, W, H);
  const px = sctx.getImageData(0, 0, W, H).data;
  const mk = grown.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const n = W * H;
  const rgb = new Uint8Array(3 * n);
  const keep = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    rgb[i] = px[i * 4];
    rgb[n + i] = px[i * 4 + 1];
    rgb[2 * n + i] = px[i * 4 + 2];
    keep[i] = mk[i * 4 + 3] > 127 ? 0 : 255;
  }
  const results = await session.run({
    [session.inputNames[0]]: new ort.Tensor("uint8", rgb, [1, 3, H, W]),
    [session.inputNames[1]]: new ort.Tensor("uint8", keep, [1, 1, H, W]),
  });
  const out = results[session.outputNames[0]];
  const [, , oh, ow] = out.dims;
  const filled = canvasOf(ow, oh);
  const fctx = filled.getContext("2d");
  const img = fctx.createImageData(ow, oh);
  const d = out.data, m = ow * oh;
  for (let i = 0; i < m; i++) {
    img.data[i * 4] = d[i];
    img.data[i * 4 + 1] = d[m + i];
    img.data[i * 4 + 2] = d[2 * m + i];
    img.data[i * 4 + 3] = 255;
  }
  fctx.putImageData(img, 0, 0);
  for (const t of Object.values(results)) t.dispose?.();
  // keep the picture's own transparency (a cut-out stays a cut-out), fill only the hole
  const canvas = blendInto(src, filled, grown, softFor(W, H));
  return { canvas, ms: Math.round(performance.now() - t0), onGPU, gpuName };
}
