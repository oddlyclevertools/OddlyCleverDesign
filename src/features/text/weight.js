// Font weight: a picker with every weight the font really has (Thin 100 to Black 900), and the
// Bold / Italic toggles. All of them work on the selected letters while editing, else on whole boxes.
import { FONTS, ensureFont, nearestWeight } from "../../core/fonts.js";
import { el, icon, popover, closePopover, toast } from "../../ui/kit.js";
import { targets, weightsOf } from "./helpers.js";
import { applyTextStyle, partSel, partStyles, stylePart, shownStyle } from "./richtext.js";

export const WEIGHT_NAMES = {
  100: "Thin", 200: "Extra light", 300: "Light", 400: "Regular", 500: "Medium",
  600: "Semi bold", 700: "Bold", 800: "Extra bold", 900: "Black",
};
export const weightName = (w) => WEIGHT_NAMES[Math.round(Number(w) / 100) * 100] || String(w);

const isBold = (w) => Number(w) >= 600;
export const canBold = (t) => weightsOf(t.fontFamily).some((w) => w >= 600);
export const canItalic = (t) => Boolean(FONTS[t.fontFamily]?.italic);

/** Set a weight (the nearest one each font has). One undo step. */
export async function setWeight(app, weight, label = "Font weight") {
  const sel = partSel(app);
  if (sel) {
    const w = nearestWeight(sel.t.fontFamily, Number(weight));
    await ensureFont(sel.t.fontFamily, w, sel.t.fontStyle || "normal");
    return stylePart(app, sel, { fontWeight: w }, label);
  }
  const list = targets(app);
  if (!list.length) return [];
  await Promise.all(list.map((t) => ensureFont(t.fontFamily, nearestWeight(t.fontFamily, Number(weight)), t.fontStyle || "normal")));
  return applyTextStyle(app, (t) => ({ fontWeight: nearestWeight(t.fontFamily, Number(weight)) }), label, { list });
}

/** Ctrl+B: bold on or off (Bold 700 or Regular 400, or the nearest the font has). */
export async function toggleBold(app) {
  const sel = partSel(app);
  if (sel) {
    if (!canBold(sel.t)) return toast("This font has no bold.");
    return setWeight(app, partStyles(sel).every((s) => isBold(s.fontWeight)) ? 400 : 700, "Bold");
  }
  const list = targets(app).filter(canBold);
  if (!list.length) return toast("This font has no bold.");
  const on = !list.every((t) => isBold(t.fontWeight) && !t.styleHas?.("fontWeight"));
  const weights = new Map(list.map((t) => [t, nearestWeight(t.fontFamily, on ? 700 : 400)]));
  await Promise.all(list.map((t) => ensureFont(t.fontFamily, weights.get(t), t.fontStyle || "normal")));
  return applyTextStyle(app, (t) => ({ fontWeight: weights.get(t) }), on ? "Bold" : "Not bold", { list });
}

/** Ctrl+I: italic on or off, for fonts that have an italic. */
export async function toggleItalic(app) {
  const sel = partSel(app);
  if (sel) {
    if (!canItalic(sel.t)) return toast("This font has no italic.");
    const on = !partStyles(sel).every((s) => s.fontStyle === "italic");
    await Promise.all(partStyles(sel).map((s) => ensureFont(sel.t.fontFamily, s.fontWeight || 400, on ? "italic" : "normal")));
    return stylePart(app, sel, { fontStyle: on ? "italic" : "normal" }, on ? "Italic" : "Not italic");
  }
  const list = targets(app).filter(canItalic);
  if (!list.length) return toast("This font has no italic.");
  const on = !list.every((t) => t.fontStyle === "italic");
  await Promise.all(list.map((t) => ensureFont(t.fontFamily, t.fontWeight || 400, on ? "italic" : "normal")));
  return applyTextStyle(app, { fontStyle: on ? "italic" : "normal" }, on ? "Italic" : "Not italic", { list });
}

/** The weight button for the toolbar: shows the current weight, opens the list. */
export function weightButton(app) {
  const t = targets(app)[0];
  const shown = shownStyle(app);
  const cur = Number(shown?.fontWeight) || 400;
  const ws = weightsOf(t.fontFamily);
  const mixed = shown?.styles ? shown.styles.some((s) => Number(s.fontWeight) !== cur) : targets(app).some((x) => Number(x.fontWeight) !== cur);
  const one = ws.length < 2;
  const btn = el("button.tx-weight-btn", {
    type: "button", disabled: one, "aria-haspopup": "listbox",
    title: one ? `${t.fontFamily} has one weight` : "Font weight", "aria-label": `Font weight: ${mixed ? "mixed" : weightName(cur)}`,
    on: { click: () => popover(btn, el("div.tx-weight-pop", { role: "listbox", "aria-label": "Font weights" }, ws.map((w) => el("button.tx-weight-opt", {
      type: "button", role: "option", "aria-selected": String(w === cur && !mixed), class: w === cur && !mixed ? "on" : null,
      style: { fontFamily: `"${t.fontFamily}", var(--ui)`, fontWeight: w },
      on: { click: () => { closePopover(); setWeight(app, w).catch((e) => toast(e.message, { error: true })); } },
    }, el("span", {}, weightName(w)), el("small", {}, String(w))))), { cls: "tx-pop" }) },
  }, el("span.tx-w-name", {}, mixed ? "Mixed" : weightName(cur)), el("span.tx-w-num", {}, mixed ? "–" : String(cur)), icon("ChevronDown", 14));
  return btn;
}
