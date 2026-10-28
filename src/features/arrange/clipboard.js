// The object clipboard (copy, cut, paste) and the style clipboard (copy style / paint roller).
// Copy and cut use the DOM copy/cut events, so the system clipboard gets the objects as JSON
// too. Paste handles the DOM paste event only when it carries no files: the elements feature
// owns pasted images.
import { FabricImage, Gradient, Shadow } from "fabric";
import { OcText } from "../text/octext.js";
import { OcImage, applyMask } from "../elements/images.js";
import { EMPTY, applyFilterSpec } from "../elements/filters.js";
import { toast } from "../../ui/kit.js";
import { isFixed, leaves } from "./geom.js";
import { insertSerialized, serialize } from "./ops.js";

const MIME_TAG = "oddlyclever-design/objects";
const OFFSET = 20;

let clip = null;       // { items, json }
let pasteCount = 0;

const copyable = (app) => app.editor.selection().filter((o) => !isFixed(o));

/** Put the selection on the internal clipboard; returns the JSON text for the system one. */
export function copy(app) {
  const objs = copyable(app);
  if (!objs.length) return null;
  const items = serialize(app, objs);
  const json = JSON.stringify({ [MIME_TAG]: 1, objects: items });
  clip = { items, json };
  pasteCount = 0;
  return json;
}

export function cut(app) {
  const json = copy(app);
  if (json) app.editor.remove(copyable(app));
  return json;
}

function parseClip(text) {
  if (!text || !text.includes(MIME_TAG)) return null;
  try {
    const d = JSON.parse(text);
    return d?.[MIME_TAG] && Array.isArray(d.objects) ? d.objects : null;
  } catch {
    return null;
  }
}

/** Paste from text (the system clipboard) or, failing that, the internal clipboard. */
export async function pasteText(app, text) {
  const fromSystem = parseClip(text);
  if (fromSystem) {
    if (clip?.json !== text) { clip = { items: fromSystem, json: text }; pasteCount = 0; }
    return pasteItems(app);
  }
  if (text && text.trim() && (!clip || text !== clip.json)) return pastePlainText(app, text.trim());
  if (clip) return pasteItems(app);
  return [];
}

function pasteItems(app) {
  pasteCount++;
  return insertSerialized(app, clip.items, { offset: OFFSET * pasteCount });
}

/** Plain text from another app becomes a text box, like Canva. */
function pastePlainText(app, text) {
  const ed = app.editor;
  const size = Math.round(Math.max(24, Math.min(ed.width, ed.height) / 12));
  const t = new OcText(text.slice(0, 5000), {
    width: Math.min(ed.width * 0.8, Math.max(200, text.length * size * 0.55)),
    fontSize: size, fontFamily: "Inter", fill: "#111111", textAlign: "center",
  });
  ed.add(t);
  return [t];
}

/** Paste from the context menu: try the system clipboard, then the internal one. */
export async function pasteFromMenu(app) {
  let text = "";
  try { text = await navigator.clipboard.readText(); } catch { /* not allowed: use ours */ }
  if (!text && !clip) { toast("Nothing to paste yet."); return []; }
  return pasteText(app, text);
}

/** Write to the system clipboard outside a copy event (context menu). */
export async function writeSystem(json) {
  try { await navigator.clipboard.writeText(json); } catch { /* internal clipboard still works */ }
}

export const hasClip = () => Boolean(clip);

/** DOM listeners: copy, cut, paste. */
export function wireClipboard(app) {
  const active = (e) => app.view === "editor" && !app.isTyping(e);
  document.addEventListener("copy", (e) => {
    if (!active(e) || !copyable(app).length) return;
    const json = copy(app);
    if (!json) return;
    e.clipboardData?.setData("text/plain", json);
    e.preventDefault();
  });
  document.addEventListener("cut", (e) => {
    if (!active(e) || !copyable(app).length) return;
    const json = cut(app);
    if (!json) return;
    e.clipboardData?.setData("text/plain", json);
    e.preventDefault();
  });
  document.addEventListener("paste", (e) => {
    if (!active(e)) return;
    const dt = e.clipboardData;
    const hasFiles = dt && ((dt.files && dt.files.length > 0) || [...(dt.items || [])].some((i) => i.kind === "file"));
    if (hasFiles) return; // images: the elements feature
    const text = dt?.getData("text/plain") || "";
    if (!text && !clip) return;
    e.preventDefault();
    pasteText(app, text).catch((err) => toast(`Couldn't paste: ${err.message}`, { error: true }));
  });
}

// ---- copy style -----------------------------------------------------------------------------
// Carries colours, outline, shadow and opacity; for text also the font settings, the text effects
// (outline, glow, ...) and the curve; corner rounding between shapes and photos; and a photo's
// filters, border and sticker outline.

const BASE_KEYS = ["fill", "stroke", "strokeWidth", "strokeDashArray", "strokeLineCap", "strokeLineJoin", "opacity", "shadow"];
const TEXT_KEYS = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "underline", "linethrough", "overline",
  "textAlign", "lineHeight", "charSpacing", "textBackgroundColor"];
const isText = (o) => typeof o.text === "string"; // Textbox, OcText and friends
const isRect = (o) => o.type === "rect";

let styleClip = null;

const cloneVal = (v) => {
  if (v instanceof Gradient) return new Gradient(v.toObject());
  if (v instanceof Shadow) return new Shadow(v.toObject());
  if (Array.isArray(v)) return [...v];
  return v;
};
const copyData = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

/** Corner rounding in page pixels, for a rectangle or a rounded photo; null when it has none. */
function radiusOf(o) {
  if (isRect(o)) return o.data?.radius ?? Math.round((o.rx || 0) * (o.scaleX || 1));
  if (o instanceof FabricImage && o.data?.mask?.shape === "roundRect") return o.data.mask.radius || 0;
  return null;
}

/** Capture the style of an object (a group gives the style of its first leaf). */
export function captureStyle(obj) {
  const src = obj._objects ? leaves(obj)[0] : obj;
  if (!src) return null;
  const base = {}, text = {}, extra = {};
  for (const k of BASE_KEYS) if (src[k] !== undefined && !(k === "fill" && typeof src.fill === "object" && !(src.fill instanceof Gradient))) base[k] = cloneVal(src[k]);
  base.opacity = obj.opacity;
  if (isText(src)) {
    for (const k of TEXT_KEYS) text[k] = cloneVal(src[k]);
    extra.effect = copyData(src.data?.effect ?? null);
    extra.curve = Number(src.data?.curve) || 0;
  }
  const r = radiusOf(src);
  if (r != null) extra.radius = r;
  if (src instanceof FabricImage) {
    extra.filters = copyData(src.data?.filters ?? null);
    extra.border = copyData(src.data?.border ?? null);
    extra.outline = copyData(src.data?.outline ?? null);
  }
  return { base, text, extra, isImage: src instanceof FabricImage };
}

export function copyStyle(app, obj = app.editor.active()) {
  if (!obj || isFixed(obj)) return false;
  styleClip = captureStyle(obj);
  return Boolean(styleClip);
}

export const hasStyle = () => Boolean(styleClip);

/** Apply the copied style to objects (images keep their pixels: no fill, but filters, border and outline). */
export function pasteStyle(app, targets = app.editor.selection()) {
  if (!styleClip) { toast("Copy a style first (Ctrl+Alt+C)."); return; }
  const list = targets.filter((o) => !isFixed(o) && !o.locked);
  if (!list.length) return;
  for (const t of list) {
    t.set("opacity", styleClip.base.opacity);
    for (const leaf of t._objects ? leaves(t) : [t]) applyTo(leaf);
    t.setCoords();
  }
  app.editor.canvas.requestRenderAll();
  app.editor.commit("Paste style");
  app.bus.emit("objects:changed", list);
}

function applyTo(o) {
  const { base, text, extra } = styleClip;
  const props = {};
  for (const [k, v] of Object.entries(base)) {
    if (k === "opacity") continue;
    if (k === "fill" && o instanceof FabricImage) continue;
    props[k] = cloneVal(v);
  }
  let data = o.data || {};
  if (isText(o) && Object.keys(text).length) {
    for (const [k, v] of Object.entries(text)) props[k] = cloneVal(v);
    props.styles = {};
    data = { ...data, effect: copyData(extra.effect), curve: extra.curve };
  }
  if (extra.radius != null && isRect(o)) {
    props.rx = extra.radius / (o.scaleX || 1);
    props.ry = extra.radius / (o.scaleY || 1);
    data = { ...data, radius: extra.radius };
  }
  const c = isText(o) ? o.getCenterPoint() : null;
  o.set({ ...props, data });
  if (o instanceof FabricImage) applyImage(o);
  o.initDimensions?.();
  if (c) o.setPositionByOrigin(c, "center", "center"); // a curve changes the height: stay put
  o.dirty = true;
}

function applyImage(o) {
  const { extra } = styleClip;
  if ("filters" in extra) applyFilterSpec(o, extra.filters || EMPTY);
  // Border and sticker outline are drawn by OcImage (every photo added in the app is one).
  if (o instanceof OcImage && "border" in extra) {
    const data = { ...o.data, border: copyData(extra.border) };
    if (!o.data?.mask) data.outline = copyData(extra.outline);
    o.set("data", data);
    o._outline = null;
  }
  if (extra.radius != null && !o.data?.frame && (!o.data?.mask || o.data.mask.shape === "roundRect")) {
    o.set("data", { ...o.data, mask: extra.radius > 0 ? { shape: "roundRect", radius: extra.radius } : null });
    applyMask(o);
  }
}
