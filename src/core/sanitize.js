// Cleans design JSON from outside (an .ocd file, the clipboard, an old autosave) before
// Fabric sees it. Only registered object types survive, and images may only come from
// data: URLs, so a design can never make the browser fetch anything (no tracking pixels,
// no probing of local servers).
import { classRegistry } from "fabric";

const MAX_DEPTH = 40;
const MAX_OBJECTS = 20000;
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const URL_KEYS = new Set(["src", "source", "href", "xlink:href"]);
const SAFE_URL = /^data:image\//i;

/** A deep plain-JSON copy without prototype keys. Throws when nested too deep. */
function plain(v, depth = 0) {
  if (depth > MAX_DEPTH) throw new Error("This design is nested too deeply.");
  if (Array.isArray(v)) return v.map((x) => plain(x, depth + 1));
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, x] of Object.entries(v)) if (!BAD_KEYS.has(k)) out[k] = plain(x, depth + 1);
    return out;
  }
  return v;
}

/** False when any URL-like field anywhere inside points somewhere other than a data: image. */
function urlsSafe(v) {
  if (Array.isArray(v)) return v.every(urlsSafe);
  if (!v || typeof v !== "object") return true;
  for (const [k, x] of Object.entries(v)) {
    if (URL_KEYS.has(k) && typeof x === "string" && x !== "" && !SAFE_URL.test(x)) return false;
    if (!urlsSafe(x)) return false;
  }
  return true;
}

/**
 * Clean a list of serialised objects. An object of an unknown type or with an outside URL
 * is dropped along with its children. Returns copies; the input is not changed.
 * @param {unknown[]} list
 * @returns {{ objects: object[], dropped: number }}
 */
export function sanitizeObjects(list) {
  let dropped = 0, count = 0;
  const one = (o) => {
    // Children and clip paths are checked on their own, so one bad child drops only itself.
    const { objects: kids, clipPath: clip0, ...own } = o && typeof o === "object" ? o : {};
    if (!o || typeof o !== "object" || typeof o.type !== "string" || !classRegistry.has(o.type) || !urlsSafe(own)) {
      dropped++;
      return null;
    }
    if (++count > MAX_OBJECTS) throw new Error(`This design has more than ${MAX_OBJECTS} objects.`);
    const out = { ...o };
    if (Array.isArray(kids)) out.objects = kids.map(one).filter(Boolean);
    if (clip0) {
      const clip = one(clip0);
      if (clip) out.clipPath = clip;
      else delete out.clipPath;
    }
    return out;
  };
  const objects = plain(Array.isArray(list) ? list : []).map(one).filter(Boolean);
  return { objects, dropped };
}

/**
 * Clean a whole canvas JSON: keep only the objects (and a plain colour background).
 * Canvas-level images and settings are dropped, because the editor rebuilds those itself.
 * @param {{ objects?: unknown[], background?: unknown, version?: unknown }} canvasJSON
 */
export function sanitizeCanvas(canvasJSON) {
  const { objects, dropped } = sanitizeObjects(canvasJSON?.objects);
  const out = { objects };
  if (typeof canvasJSON?.version === "string") out.version = canvasJSON.version;
  if (typeof canvasJSON?.background === "string") out.background = canvasJSON.background;
  return { canvas: out, dropped };
}
