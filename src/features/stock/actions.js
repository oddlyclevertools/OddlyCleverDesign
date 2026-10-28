// Stock actions shared by the panel and the AI: search, add a result to the design (into a frame
// or photo-grid cell when there is one), credits, and handing videos to the video library.
import { placeImage } from "../elements/actions.js";
import { frameAt, isEmptyFrame, isFrame, setBackgroundImage } from "../elements/images.js";
import { SOURCES, creditOf, creditsInObjects, creditsText, uniqueCredits } from "./sources.js";
import { StockError, fetchVideo, downloadImage, readySources, searchMany } from "./api.js";

const items = new Map(); // id -> item, every result seen this session (addStock looks here)
const ITEMS_MAX = 2000;

/** Keep results so they can be added by id later. */
export function rememberItems(list) {
  for (const it of list) {
    items.delete(it.id);
    items.set(it.id, it);
  }
  while (items.size > ITEMS_MAX) items.delete(items.keys().next().value);
}
export const itemById = (id) => items.get(id) || null;

const brief = (it) => ({
  id: it.id, kind: it.kind, source: SOURCES[it.source]?.name || it.source, title: it.title, author: it.author,
  license: it.license, width: it.width, height: it.height, ...(it.duration ? { seconds: it.duration } : {}),
});

/**
 * Search free stock photos or videos and return a short list (for the AI).
 * @param {*} app
 * @param {{query: string, kind?: "photo"|"video", source?: "all"|"pexels"|"pixabay"|"openverse", orientation?: string, color?: string, limit?: number}} opts
 * @returns {Promise<{results: object[], searched: string[], skipped: string[], errors: Record<string,string>}>}
 */
export async function searchStock(app, { query, kind = "photo", source = "all", orientation = "any", color = "", limit = 12 } = {}) {
  if (!["photo", "video"].includes(kind)) throw new StockError("bad-input", "kind must be photo or video.");
  if (source !== "all" && !SOURCES[source]) throw new StockError("bad-input", "source must be all, pexels, pixabay or openverse.");
  const wanted = source === "all" ? Object.keys(SOURCES) : [source];
  const ready = readySources(kind, source);
  const skipped = wanted.filter((s) => !ready.includes(s)).map((s) => SOURCES[s].name);
  if (!ready.length) {
    throw new StockError("needs-key", kind === "video"
      ? "Videos come from Pexels and Pixabay, which need a free key. Add one in the Photos panel."
      : `Add a free ${SOURCES[source]?.name || "Pexels or Pixabay"} key in the Photos panel first.`);
  }
  const res = await searchMany(ready, { query, kind, orientation, color }, {});
  rememberItems(res.items);
  return {
    results: res.items.slice(0, Math.max(1, Math.min(40, limit))).map(brief),
    searched: ready.map((s) => SOURCES[s].name), skipped,
    errors: Object.fromEntries(Object.entries(res.errors).map(([k, v]) => [SOURCES[k].name, v])),
  };
}

// ---- videos ---------------------------------------------------------------------------------

let videoHandler = null;
/** The video feature registers `fn({blob, name, width, height, duration, credit, item})` here. */
export function setStockVideoHandler(fn) { videoHandler = typeof fn === "function" ? fn : null; }
export const hasVideoHandler = () => Boolean(videoHandler);

/**
 * The file of a stock video result (by item or id), with its credit.
 * @returns {Promise<{blob: Blob, name: string, width: number, height: number, duration: number, credit: object}>}
 */
export async function getStockVideoBlob(item) {
  const it = typeof item === "string" ? itemById(item) : item;
  if (!it) throw new StockError("unknown", "That video isn't loaded. Search again first.");
  return fetchVideo(it, creditOf(it));
}

/** Save a video file to the computer (used when no video library is installed). */
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ---- adding to the design --------------------------------------------------------------------

/**
 * Add a stock result to the open design. `place`: nothing (centre, or the selected empty frame),
 * a page point {x, y} (fills a frame or grid cell under it), or "background".
 * Photos are downloaded into the design; the credit goes in the object's data.credit.
 * Videos go to the video library when one is installed.
 * @returns {Promise<{id?: string, name?: string, credit: object, video?: boolean, savedTo?: string}>}
 */
export async function addStock(app, id, place = null) {
  const it = itemById(id);
  if (!it) throw new StockError("unknown", "That result isn't loaded. Search again first.");
  const credit = creditOf(it);
  if (it.kind === "video") {
    if (!videoHandler) throw new StockError("no-video-library", "The video library isn't installed yet. Save the video file from the Photos panel instead.");
    const file = await fetchVideo(it, credit);
    await videoHandler({ ...file, item: it });
    return { video: true, savedTo: "video library", credit };
  }
  if (app.view !== "editor") throw new StockError("no-design", "Open a design first.");
  const { src } = await downloadImage(it);
  const ed = app.editor;
  const name = it.title.slice(0, 40) || "Photo";
  if (place === "background") {
    const bg = await setBackgroundImage(app, src, { credit, stockId: it.id });
    bg.set("name", name);
    ed.commit(ed.history.lastLabel || "Background image", { merge: true });
    return { id: bg.id, name, credit };
  }
  const at = place && typeof place === "object" && Number.isFinite(place.x) && Number.isFinite(place.y) ? place : null;
  const target = at ? frameAt(app, at) : ed.selection().find((o) => isEmptyFrame(o));
  // A click on a result (or a drop) with one photo selected replaces that photo; Shift adds. The AI
  // and the "Add to design" menu always add (placeImage only replaces after a tile click or a drop).
  const placed = await placeImage(app, src, name, at);
  const tagged = target && isFrame(target) ? target : placed;
  if (!tagged) throw new StockError("place", "The picture couldn't be placed.");
  tagged.set("data", { ...(tagged.data || {}), credit, stockId: it.id });
  if (tagged === placed && !isFrame(placed) && !placed.isBg) tagged.set("name", name);
  // Same step as the add, fill or replace, so one undo removes picture and credit together.
  ed.commit(ed.history.lastLabel || "Add photo", { merge: true });
  return { id: tagged.id, name: tagged.name, credit };
}

// ---- credits --------------------------------------------------------------------------------

/** Every stock credit in the open design. */
export function designCredits(app) {
  const out = [];
  const walk = (o) => {
    if (o.data?.credit) out.push(o.data.credit);
    (o._objects || []).forEach(walk);
  };
  app.editor.objects().forEach(walk);
  return uniqueCredits(out);
}

/** Credits in a saved design record (from app.store). */
export const projectCredits = (rec) => creditsInObjects(rec?.doc?.canvas?.objects || []);

export { creditsText };
