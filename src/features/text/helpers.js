// Shared helpers for the text feature: which objects the tools act on, how a change is applied
// (one undo step, sliders merge), colour <-> Fabric fill, and page-relative sizes.
import { Group, Textbox } from "fabric";
import { ensureFont, FONTS, nearestWeight } from "../../core/fonts.js";
import { OcText } from "./octext.js";
import { isUserFont } from "../styles/user-fonts.js";
import { refit } from "./fit.js";

export const isText = (o) => o instanceof Textbox || o?.type === "i-text" || o?.type === "text";

/** Text objects in a list of objects, including text inside groups. */
export function textsIn(objs) {
  const out = [];
  const walk = (o) => {
    if (!o) return;
    if (isText(o)) out.push(o);
    else if (o instanceof Group) o.getObjects().forEach(walk);
  };
  objs.forEach(walk);
  return out;
}

/** The text objects the toolbar acts on right now. */
export const targets = (app) => textsIn(app.editor.selection());

/** The first selected text, for showing the current values. */
export const first = (app) => targets(app)[0] || null;

/** Groups that hold any of `texts`, so their bounds can be refitted after a change. */
function parentsOf(texts) {
  const set = new Set();
  // `parent` is the real group; `group` can also be the ActiveSelection holding the object.
  for (const t of texts) {
    for (let g = t.parent; g; g = g.parent) set.add(g);
    for (let g = t.group; g; g = g.group) set.add(g);
  }
  // Inner groups first, so outer ones refit around the new inner bounds.
  return [...set].sort((a, b) => depth(b) - depth(a));
}
function depth(g) {
  let d = 0;
  for (let p = g.parent; p; p = p.parent) d++;
  return d;
}

/**
 * Apply `fn(text)` to every target text and record one history step.
 * merge: true while a slider drags (the drag becomes one undo step).
 * keepCenter: keep each text's centre still (used when the height jumps, e.g. curve).
 */
export function applyToTexts(app, fn, label, { merge = false, keepCenter = false, list = null } = {}) {
  const texts = list || targets(app);
  if (!texts.length) return [];
  for (const t of texts) {
    const c = keepCenter ? t.getCenterPoint() : null;
    fn(t);
    t.initDimensions?.();
    refit(t); // shrink-to-fit texts stay inside their area after any change
    if (c) t.setPositionByOrigin(c, "center", "center");
    t.setCoords();
    t.dirty = true;
  }
  for (const g of parentsOf(texts)) {
    g.triggerLayout?.();
    g.setCoords();
    g.dirty = true;
  }
  app.editor.canvas.requestRenderAll();
  app.editor.commit(label, { merge });
  app.bus.emit("objects:changed", texts);
  return texts;
}

/** Replace obj.data with a merged copy (feature data is never mutated in place). */
export function setData(obj, patch) {
  obj.set("data", { ...(obj.data || {}), ...patch });
}

// ---- colours ------------------------------------------------------------------------------

// Kit colour values (a CSS colour, or a linear or radial gradient) <-> Fabric fills. One shared
// implementation with shapes and the page background.
export { toFabricFill, fromFabricFill } from "../elements/fill.js";

/** True when a CSS colour is dark (used to pick readable default text on dark pages). */
export function isDark(color) {
  const m = /^#?([0-9a-f]{6})$/i.exec(typeof color === "string" ? color : "");
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum < 110;
}

// ---- fonts --------------------------------------------------------------------------------

const RECENT_KEY = "oc.text.recentFonts";
export function recentFonts() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(list) ? list.filter((f) => FONTS[f] || isUserFont(f)).slice(0, 6) : [];
  } catch {
    return [];
  }
}
export function pushRecentFont(family) {
  try {
    const list = [family, ...recentFonts().filter((f) => f !== family)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* storage blocked: recent list just stays empty */ }
}

/** Load the faces a family change needs, then return the props to set on `t`. */
export async function fontPropsFor(t, family) {
  const weight = nearestWeight(family, Number(t.fontWeight) || 400);
  const italic = t.fontStyle === "italic" && FONTS[family]?.italic;
  const style = italic ? "italic" : "normal";
  await ensureFont(family, weight, style);
  return { fontFamily: family, fontWeight: weight, fontStyle: style };
}

// ---- creating text ------------------------------------------------------------------------

/** Size unit for a page: 1 at a 720 px short side (the YouTube thumbnail). */
export const pageUnit = (editor) => Math.min(editor.width, editor.height) / 720;

/** New OcText with sensible defaults (curve/effects go in `data`). */
export function makeText(text, opts = {}) {
  return new OcText(text, {
    fontFamily: "Inter", fontSize: 40, fontWeight: 400, fill: "#1f1f29", textAlign: "center",
    lineHeight: 1.12, splitByGrapheme: false, strokeLineJoin: "round", ...opts,
  });
}

/** Shrink a text's font size until it fits inside maxW (long single words grow the box). */
export function fitWidth(t, maxW) {
  let guard = 0;
  while (t.width * (t.scaleX || 1) > maxW && t.fontSize > 8 && guard++ < 40) {
    t.set({ fontSize: Math.floor(t.fontSize * 0.92), width: maxW / (t.scaleX || 1) });
    t.initDimensions();
  }
}

/** The weights a family really has (bundled fonts list theirs; your own fonts have one). */
export const weightsOf = (family) => FONTS[family]?.weights || [400];
