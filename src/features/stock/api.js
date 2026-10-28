// Talking to the stock services: searches (cached for 24 hours, as Pixabay asks), downloading a
// picture into a data URL (the app never hotlinks), and fetching a video file. Runs only after
// the user searches or picks a result.
import { SOURCES, SOURCE_IDS, buildRequest, interleave, parseResponse, supports } from "./sources.js";
import { getStockKey } from "./keys.js";

const DAY = 24 * 60 * 60 * 1000;
const MAX_SIDE = 4096;
const cache = new Map(); // cacheKey (no key inside) -> { at, data }
const CACHE_MAX = 200;

export class StockError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/** Sources that can search this kind right now (have a key, or need none). */
export function readySources(kind = "photo", wanted = "all") {
  const ids = wanted === "all" ? SOURCE_IDS : [wanted];
  return ids.filter((s) => supports(s, kind) && (!SOURCES[s].needsKey || getStockKey(s)));
}

/** Which sites get the search words for this choice (for the panel's privacy line). */
export function whoGetsWords(kind = "photo", wanted = "all") {
  return readySources(kind, wanted).map((s) => SOURCES[s].name);
}

/**
 * One page from one source.
 * @returns {Promise<{items: object[], hasMore: boolean}>}
 */
export async function searchSource(source, opts, { signal } = {}) {
  const name = SOURCES[source]?.name || source;
  const key = getStockKey(source);
  if (SOURCES[source]?.needsKey && !key) throw new StockError("needs-key", `Add your free ${name} key to search ${name}.`);
  const req = buildRequest(source, opts, key);
  const hit = cache.get(req.cacheKey);
  let json;
  if (hit && Date.now() - hit.at < DAY) json = hit.data;
  else {
    let res;
    try {
      res = await fetch(req.url, { headers: req.headers, signal, credentials: "omit", referrerPolicy: "no-referrer" });
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      throw new StockError("offline", `Couldn't reach ${name}. Check your internet connection.`);
    }
    if (res.status === 401 || res.status === 403 || (res.status === 400 && source === "pixabay")) throw new StockError("bad-key", `${name} didn't accept the key. Check it and paste it again.`);
    if (res.status === 429) throw new StockError("busy", `Too many searches on ${name} for now. Wait a minute and try again.`);
    if (!res.ok) throw new StockError("http", `${name} couldn't search right now (error ${res.status}).`);
    try { json = await res.json(); } catch { throw new StockError("bad-reply", `${name} sent a reply the app couldn't read.`); }
    cache.set(req.cacheKey, { at: Date.now(), data: json });
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  }
  return parseResponse(source, opts.kind || "photo", json, { page: opts.page || 1, orientation: opts.orientation || "any" });
}

/**
 * Search several sources at once. `pages` says which page each source is on.
 * @returns {Promise<{items: object[], more: Record<string, boolean>, errors: Record<string, string>}>}
 */
export async function searchMany(sources, opts, pages = {}, { signal } = {}) {
  const settled = await Promise.allSettled(sources.map((s) => searchSource(s, { ...opts, page: pages[s] || 1 }, { signal })));
  const lists = [], more = {}, errors = {};
  settled.forEach((r, i) => {
    const s = sources[i];
    if (r.status === "fulfilled") { lists.push(r.value.items); more[s] = r.value.hasMore; } else {
      if (r.reason?.name === "AbortError") throw r.reason;
      errors[s] = r.reason?.message || "Search failed.";
      more[s] = false;
    }
  });
  return { items: interleave(lists), more, errors };
}

const blobToDataURL = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error("The picture couldn't be read."));
  r.readAsDataURL(blob);
});

async function fetchBlob(url, signal) {
  const res = await fetch(url, { signal, credentials: "omit", referrerPolicy: "no-referrer", mode: "cors" });
  if (!res.ok) throw new Error(`error ${res.status}`);
  return res.blob();
}

/** Decode, shrink to 4096 px on the long side if needed, and return a data URL. */
async function toDataUrl(blob) {
  if (!/^image\//.test(blob.type) && blob.type) throw new Error("not a picture");
  const bmp = await createImageBitmap(blob);
  try {
    const { width: w, height: h } = bmp;
    if (Math.max(w, h) <= MAX_SIDE && /jpeg|png|webp/.test(blob.type)) return { src: await blobToDataURL(blob), width: w, height: h };
    const k = Math.min(1, MAX_SIDE / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return { src: c.toDataURL(blob.type === "image/png" ? "image/png" : "image/jpeg", 0.92), width: c.width, height: c.height };
  } finally {
    bmp.close?.();
  }
}

/**
 * Download a result's full picture into a data URL (tries the big copy, then a smaller one).
 * @returns {Promise<{src: string, width: number, height: number}>}
 */
export async function downloadImage(item, { signal } = {}) {
  const urls = [item.full, item.fallback].filter(Boolean);
  let last = null;
  for (const u of urls) {
    try { return await toDataUrl(await fetchBlob(u, signal)); } catch (e) {
      if (e?.name === "AbortError") throw e;
      last = e;
    }
  }
  const name = SOURCES[item.source]?.name || "The site";
  throw new StockError("download", `${name} didn't let the app download that picture${last ? ` (${last.message})` : ""}. Try another one.`);
}

/**
 * The video file of a stock video result, for the video library (another feature hooks in).
 * @returns {Promise<{blob: Blob, name: string, width: number, height: number, duration: number, credit: object}>}
 */
export async function fetchVideo(item, credit, { signal } = {}) {
  if (item?.kind !== "video" || !item.videoUrl) throw new StockError("not-video", "That result isn't a video.");
  let blob;
  try { blob = await fetchBlob(item.videoUrl, signal); } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new StockError("download", `${SOURCES[item.source]?.name || "The site"} didn't let the app download that video (${e.message}).`);
  }
  const name = `${item.title.replace(/[^\w -]+/g, "").trim().slice(0, 50) || "stock video"} - ${item.author}`.replace(/\s+/g, " ");
  return { blob, name: `${name}.mp4`, width: item.width, height: item.height, duration: item.duration || 0, credit };
}

/** Forget cached searches (tests use this). */
export const clearStockCache = () => cache.clear();
