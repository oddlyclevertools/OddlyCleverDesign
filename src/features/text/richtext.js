// Styling part of a text. While a text is being edited with some letters selected, the toolbar's
// colour, weight, size, underline and highlight apply to those letters only (Fabric's selection
// styles, which save, undo, copy and export with the text). With nothing selected they apply to
// the whole box, and a whole-box change also clears that setting from styled letters, so "make it
// red" really makes all of it red. "Make it pop" gives one word the accent colour and the
// heaviest weight in one click.
import { ensureFont, nearestWeight } from "../../core/fonts.js";
import { brandColors, toast } from "../../ui/kit.js";
import { applyToTexts, isText, first, weightsOf } from "./helpers.js";
import { solidOf } from "./octext.js";

/** The letters being styled: { t, start, end } while editing with a selection, else null. */
export function partSel(app) {
  const t = app.editor.active();
  if (!t || !isText(t) || !t.isEditing) return null;
  const start = Math.min(t.selectionStart, t.selectionEnd), end = Math.max(t.selectionStart, t.selectionEnd);
  return end > start ? { t, start, end } : null;
}

/** Full styles of the selected letters (one per letter). */
export const partStyles = (sel) => sel.t.getSelectionStyles(sel.start, sel.end, true);

/**
 * What the toolbar shows: the selected letters' style, or the first text's own settings.
 * @returns {{fill, fontWeight, fontSize, underline, linethrough, fontStyle, textBackgroundColor, part: number}}
 */
export function shownStyle(app) {
  const sel = partSel(app);
  if (sel) {
    const st = partStyles(sel);
    const all = (k) => st.every((s) => Boolean(s[k]));
    return { ...st[0], underline: all("underline"), linethrough: all("linethrough"), part: sel.end - sel.start, styles: st };
  }
  const t = first(app);
  return t ? { fill: t.fill, fontWeight: t.fontWeight, fontSize: t.fontSize, underline: t.underline, linethrough: t.linethrough,
    fontStyle: t.fontStyle, textBackgroundColor: t.textBackgroundColor, part: 0, styles: null } : null;
}

/** Set props on the whole box, clearing the same props from any styled letters. */
export function setWhole(t, props) {
  for (const k of Object.keys(props)) if (t.styleHas?.(k)) t.removeStyle(k);
  t.set(props);
}

/** Give the box's styles a new value per letter style (returns a new styles object). */
export function mapCharStyles(t, fn) {
  const out = {};
  for (const [ln, line] of Object.entries(t.styles || {})) {
    out[ln] = {};
    for (const [ch, st] of Object.entries(line || {})) out[ln][ch] = fn({ ...st });
  }
  return out;
}

/** Load every face the letters of `t` use (before measuring). */
export async function ensureStyleFaces(t) {
  const jobs = [];
  for (const line of Object.values(t.styles || {})) {
    for (const st of Object.values(line || {})) {
      if (st?.fontWeight || st?.fontFamily || st?.fontStyle) {
        jobs.push(ensureFont(st.fontFamily || t.fontFamily, st.fontWeight || t.fontWeight || 400, st.fontStyle || t.fontStyle || "normal"));
      }
    }
  }
  await Promise.all(jobs);
}

/** Put the typing focus back in the text after a toolbar click (not after a popover input). */
function keepTyping(t) {
  const a = document.activeElement;
  if (!t.isEditing || !t.hiddenTextarea) return;
  if (!a || a === document.body || a.closest?.(".ctx-toolbar")) t.hiddenTextarea.focus({ preventScroll: true });
}

/** Style the selected letters. props: an object, or (text) => object. One undo step. */
export function stylePart(app, sel, props, label, { merge = false } = {}) {
  const p = typeof props === "function" ? props(sel.t) : props;
  const out = applyToTexts(app, (t) => t.setSelectionStyles(p, sel.start, sel.end), label, { merge, list: [sel.t] });
  keepTyping(sel.t);
  return out;
}

/**
 * Apply a style where the user means it: the selected letters while editing, else every
 * selected text (whole box). props: an object, or (text) => object.
 */
export function applyTextStyle(app, props, label, { merge = false, list = null } = {}) {
  const sel = list ? null : partSel(app);
  if (sel) return stylePart(app, sel, props, label, { merge });
  return applyToTexts(app, (t) => setWhole(t, typeof props === "function" ? props(t) : props), label, { merge, list });
}

// ---- make it pop ----------------------------------------------------------------------------

const hexRgb = (c) => {
  const m = /^#?([0-9a-f]{6})/i.exec(c || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const saturation = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };

/** The accent for a word: a bold brand colour, else thumbnail yellow, pink or cyan, whichever stands out from the text. */
export function accentFor(t) {
  const base = hexRgb(solidOf(t.fill, "#ffffff")) || [255, 255, 255];
  const brand = brandColors().filter((c) => { const r = hexRgb(c); return r && saturation(r) > 0.55 && Math.max(...r) > 140; });
  const list = [...brand, "#ffd60a", "#ff2e7e", "#2ee6ff"];
  return list.find((c) => distance(hexRgb(c), base) > 140) || list[0];
}

/** The heaviest weight a family has. */
export const heaviest = (family) => Math.max(...weightsOf(family));

/**
 * Make the selected word (or the word at the cursor) pop: accent colour and the heaviest weight.
 * @returns {Promise<boolean>} false when there was no word to style
 */
export async function popWord(app, { color = null } = {}) {
  const t = app.editor.active();
  let sel = partSel(app);
  if (!sel && t && isText(t) && t.isEditing) {
    t.selectWord(t.selectionStart);
    sel = partSel(app);
  }
  if (!sel) {
    toast("Double-click the text, then select the word to make it pop.");
    return false;
  }
  const weight = heaviest(sel.t.fontFamily);
  await ensureFont(sel.t.fontFamily, weight, sel.t.fontStyle || "normal");
  stylePart(app, sel, { fill: color || accentFor(sel.t), fontWeight: weight }, "Make it pop");
  return true;
}

// ---- for the AI and scripts -----------------------------------------------------------------

/**
 * Style part of a text without editing it: the first match of `find` (any case), or start..end.
 * @param {object} app
 * @param {{target?: object, find?: string, start?: number, end?: number, color?: string, weight?: number,
 *   size?: number, underline?: boolean, highlight?: string|null}} opts size is in page pixels
 * @returns {Promise<{start: number, end: number}>}
 */
export async function styleTextPart(app, { target = null, find = "", start = null, end = null, color, weight, size, underline, highlight } = {}) {
  const t = target || first(app);
  if (!t || !isText(t)) throw new Error("Select a text first.");
  if (find) {
    const i = (t.text || "").toLowerCase().indexOf(String(find).toLowerCase());
    if (i < 0) throw new Error(`"${find}" isn't in this text.`);
    start = i;
    end = i + String(find).length;
  }
  if (!(Number.isInteger(start) && Number.isInteger(end) && end > start && start >= 0 && end <= (t.text || "").length)) {
    throw new Error("Say which letters to style (a word to find, or a start and end).");
  }
  const props = {};
  if (typeof color === "string") props.fill = color;
  if (weight != null) props.fontWeight = nearestWeight(t.fontFamily, Number(weight));
  if (size != null) props.fontSize = Math.max(1, Number(size)) / (t.scaleY || 1);
  if (underline != null) props.underline = Boolean(underline);
  if (highlight !== undefined) props.textBackgroundColor = highlight || "";
  if (!Object.keys(props).length) throw new Error("Say what to change: color, weight, size, underline or highlight.");
  if (props.fontWeight) await ensureFont(t.fontFamily, props.fontWeight, t.fontStyle || "normal");
  applyToTexts(app, (x) => x.setSelectionStyles(props, start, end), "Style letters", { list: [t] });
  return { start, end };
}
