// Picture values in a Bulk Create table: a data URL, or a file name / "folder/path" from the
// user's picture folders (read-only, through the AI feature's folder access).
import { findPictures, pictureFile } from "../ai/pictures/folders.js";
import { prepareImageFile } from "../elements/images.js";

const DATA_IMAGE = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[a-z0-9+/=\s]+$/i;
const cache = new Map(); // value -> Promise<data URL>

/** True when a cell looks like a picture (data URL or an image file name). */
export const looksLikePicture = (v) => DATA_IMAGE.test(String(v || "").trim()) || /\.(png|jpe?g|webp|gif)$/i.test(String(v || "").trim());

async function findFile(ref) {
  try {
    return await pictureFile(ref);
  } catch (e) {
    if (/folders|permission/i.test(e.message) && !/No picture "/.test(e.message)) {
      throw new Error("Allow your picture folders first (Ask AI panel, My folders).");
    }
  }
  const name = ref.split(/[\\/]/).pop();
  const stem = name.replace(/\.[a-z0-9]+$/i, "");
  const { results } = await findPictures(stem, { limit: 60 });
  const lower = name.toLowerCase();
  const hit = results.find((f) => f.name.toLowerCase() === lower)
    || (stem === name ? results.find((f) => f.name.toLowerCase().replace(/\.[a-z0-9]+$/, "") === lower) : null);
  if (!hit) throw new Error(`No picture called "${ref}" in your folders.`);
  return hit.handle.getFile();
}

/**
 * The data URL for a picture cell. Web links are refused: the app works offline.
 * @param {string} value
 * @returns {Promise<string|null>} null for an empty cell
 */
export function resolvePicture(value) {
  const v = String(value ?? "").trim();
  if (!v) return Promise.resolve(null);
  if (/^data:/i.test(v)) {
    if (!DATA_IMAGE.test(v)) return Promise.reject(new Error("That data URL isn't a PNG, JPG, WebP, GIF or SVG picture."));
    return Promise.resolve(v.replace(/\s+/g, ""));
  }
  if (/^(https?:|blob:|file:|ftp:)/i.test(v) || /^www\./i.test(v)) {
    return Promise.reject(new Error("Web links aren't loaded (the app works offline). Use a file name from your picture folders."));
  }
  if (!cache.has(v)) {
    const job = findFile(v).then((file) => prepareImageFile(file)).then((p) => p.src);
    job.catch(() => cache.delete(v));
    cache.set(v, job);
  }
  return cache.get(v);
}
