// Style references: pictures the user likes, sent to the AI with a request so it designs in that
// style. Attached pictures live in memory until the next send; "My styles" (named sets) are saved
// in this browser's IndexedDB (`oddlyclever-styles`). They never go into designs, .ocd files,
// exports or autosave, and they leave the PC only when the user sends them to a cloud AI.
import { analyseImage, describeNotes } from "./analyse.js";

export const MAX_REFS = 5;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const LONG_SIDE = 1280;   // plenty for an AI to read a style; keeps each picture to ~1.5k tokens
const THUMB_SIDE = 160;
const MAX_STYLES = 60;
const DB_NAME = "oddlyclever-styles";
const STORE = "styles";

// ---- preparing a picture --------------------------------------------------------------------

function drawScaled(src, side) {
  const k = Math.min(1, side / Math.max(src.width, src.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(src.width * k));
  c.height = Math.max(1, Math.round(src.height * k));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff"; // transparent PNGs become JPEG on white
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

let seq = 0;

/**
 * A picture (File, Blob or data:image URL) -> a reference: a downscaled JPEG for the AI, a small
 * thumbnail for the UI, and the local measurements.
 */
export async function prepareRef(src, name = "") {
  let blob = src;
  if (typeof src === "string") {
    if (!/^data:image\//.test(src)) throw new Error("Only pictures from your computer can be used.");
    blob = await (await fetch(src)).blob();
  }
  if (!(blob instanceof Blob) || !/^image\//.test(blob.type)) throw new Error("That isn't a picture.");
  if (blob.size > MAX_FILE_BYTES) throw new Error("That picture is too big (over 25 MB).");
  let bmp;
  try { bmp = await createImageBitmap(blob); } catch { throw new Error("Couldn't read that picture. Try a PNG, JPG or WebP."); }
  try {
    const big = drawScaled(bmp, LONG_SIDE);
    return {
      id: `ref${Date.now().toString(36)}${seq++}`,
      name: String(name || blob.name || "picture").slice(0, 60),
      mediaType: "image/jpeg",
      data: big.toDataURL("image/jpeg", 0.86).split(",")[1],
      thumb: drawScaled(bmp, THUMB_SIDE).toDataURL("image/jpeg", 0.8),
      notes: analyseImage(big),
    };
  } finally {
    bmp.close?.();
  }
}

// ---- the attached pictures (for the next request) -------------------------------------------

let attached = [];
let attachedStyle = "";
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export const attachedRefs = () => attached;
/** The saved style the attached pictures came from, if they all did. */
export const attachedStyleName = () => attachedStyle;
export function onRefsChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Replace the attached pictures (at most MAX_REFS). */
export function setAttached(list, styleName = "") {
  attached = list.slice(0, MAX_REFS);
  attachedStyle = attached.length ? styleName : "";
  emit();
}

export function removeAttached(id) {
  setAttached(attached.filter((r) => r.id !== id), attachedStyle);
}

/** Add pictures from files; returns the error messages of the ones that couldn't be added. */
export async function attachFiles(files) {
  const errors = [];
  const added = [];
  for (const f of files) {
    if (attached.length + added.length >= MAX_REFS) { errors.push(`Up to ${MAX_REFS} style pictures at a time.`); break; }
    try { added.push(await prepareRef(f)); } catch (e) { errors.push(`${f.name || "Picture"}: ${e.message}`); }
  }
  if (added.length) setAttached([...attached, ...added], "");
  return errors;
}

// ---- telling the AI ---------------------------------------------------------------------------

/** The text that goes with the pictures: what to copy (the style) and the measured numbers. */
export function styleBrief(refs, styleName = "") {
  if (!refs.length) return "";
  const n = refs.length;
  return [
    `## Style reference${n > 1 ? "s" : ""}${styleName ? ` (my saved style “${styleName}”)` : ""}`,
    `I attached ${n === 1 ? "a picture" : `${n} pictures`} whose STYLE I want for this design. Study ${n === 1 ? "it" : "them"} first and match the style closely:`,
    "- Layout: where the subject sits and how big it is (share of the frame), where the text sits, how much empty space.",
    "- Headline: number of words, size compared to the frame, font weight and case, colour, outline, shadow or glow, tilt.",
    "- Background: plain, gradient, photo-like scene, blur, vignette; how dark or bright.",
    "- Colour: the palette below, and which colour is the accent that grabs the eye.",
    "- Extras: arrows, circles, badges, emoji, borders, glow, grain; the overall mood and energy.",
    "Rebuild that style with this app's own tools, fonts, cast and elements. Use my topic and my words, not theirs. Never copy their logos, faces, characters or the pictures themselves: same style, new design.",
    "When you have built it, look_at_design and compare it with the reference side by side in your head. Fix the biggest difference (usually size, position or colour), once or twice.",
    "",
    "Measured from the pictures on my PC (use these exact colours):",
    ...refs.map((r, i) => describeNotes(r.notes, i)),
  ].join("\n");
}

// ---- My styles (saved in this browser) ------------------------------------------------------

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Couldn't open the style library."));
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const out = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(out?.result ?? out);
      t.onerror = () => reject(t.error || new Error("The style library couldn't be changed."));
    });
  } finally {
    db.close();
  }
}

const keep = (r) => ({ id: r.id, name: r.name, mediaType: r.mediaType, data: r.data, thumb: r.thumb, notes: r.notes });

/** Saved styles, newest first. */
export async function listStyles() {
  const all = await tx("readonly", (s) => s.getAll());
  return (all || []).sort((a, b) => b.created - a.created);
}

/** Save the given pictures as a named style (a name that exists is replaced). */
export async function saveStyle(name, refs) {
  const clean = String(name || "").trim().slice(0, 40);
  if (!clean) throw new Error("Give the style a name.");
  if (!refs.length) throw new Error("Add a style picture first.");
  const all = await listStyles();
  const same = all.find((s) => s.name.toLowerCase() === clean.toLowerCase());
  if (!same && all.length >= MAX_STYLES) throw new Error(`You have ${MAX_STYLES} saved styles. Delete one first.`);
  const style = { id: same?.id || `style${Date.now().toString(36)}`, name: clean, created: Date.now(), refs: refs.slice(0, MAX_REFS).map(keep) };
  await tx("readwrite", (s) => s.put(style));
  emit();
  return style;
}

export async function deleteStyle(id) {
  await tx("readwrite", (s) => s.delete(id));
  emit();
}

/** A saved style by name (case-insensitive), or null. */
export async function findStyle(name) {
  const want = String(name || "").trim().toLowerCase();
  return (await listStyles()).find((s) => s.name.toLowerCase() === want) || null;
}
