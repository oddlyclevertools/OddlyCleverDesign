// The contextual toolbar for text: font, weight, size, colour, B/I/U/S, highlight, alignment, case,
// spacing, shrink to fit and Effects. Every change applies to all selected text (text inside
// selected groups too) or, while typing with some letters selected, to just those letters.
import { el, icon, iconButton, popover, closePopover, colorButton, openColorPicker, slider, toast, toggle } from "../../ui/kit.js";
import { openFontPicker } from "./fontpicker.js";
import { previewFont, endFontPreview } from "./fontpreview.js";
import { applyToTexts, targets, first, fontPropsFor, pushRecentFont, toFabricFill, fromFabricFill } from "./helpers.js";
import { applyTextStyle, ensureStyleFaces, mapCharStyles, partSel, popWord, shownStyle } from "./richtext.js";
import { canBold, canItalic, toggleBold, toggleItalic, weightButton } from "./weight.js";
import { CASES, caseOf, originalOf, setCase } from "./casing.js";
import { fitBoxToWords, isFitted, rememberSize, setShrinkToFit } from "./fit.js";
import { nearestWeight } from "../../core/fonts.js";

export { toggleBold, toggleItalic };
export { CASES, setCase };

const SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 110, 128, 144, 160, 200, 250, 300];
const ALIGNS = [
  ["left", "TextAlignStart", "Align left"],
  ["center", "TextAlignCenter", "Align centre"],
  ["right", "TextAlignEnd", "Align right"],
  ["justify", "TextAlignJustify", "Justify"],
];

/** Effective on-screen font size (the box may have been scaled with its corner handles). */
export const sizeOf = (t) => Math.round(t.fontSize * (t.scaleY || 1) * 10) / 10;

export function setSize(app, v, label = "Font size", merge = false) {
  const n = Math.max(1, Math.min(1600, Number(v)));
  if (!Number.isFinite(n)) return;
  if (partSel(app)) {
    applyTextStyle(app, (t) => ({ fontSize: n / (t.scaleY || 1) }), label, { merge });
    return;
  }
  applyToTexts(app, (t) => {
    if (t.styleHas?.("fontSize")) t.removeStyle("fontSize");
    t.set("fontSize", n / (t.scaleY || 1));
    rememberSize(t);
  }, label, { merge });
}

export function stepSize(app, d, merge = false) {
  const t = first(app);
  if (!t) return;
  const shown = shownStyle(app);
  const cur = Math.round((shown?.fontSize || t.fontSize) * (t.scaleY || 1));
  setSize(app, Math.max(1, cur + d), "Font size step", merge);
}

export async function setFamily(app, family) {
  const list = targets(app);
  try {
    const props = await Promise.all(list.map((t) => fontPropsFor(t, family)));
    const map = new Map(list.map((t, i) => [t, props[i]]));
    // Styled letters keep their weight, moved to the nearest one the new font has.
    const styles = new Map(list.map((t) => [t, mapCharStyles(t, (st) => (st.fontWeight ? { ...st, fontWeight: nearestWeight(family, Number(st.fontWeight)) } : st))]));
    await Promise.all(list.map((t) => ensureStyleFaces({ ...map.get(t), styles: styles.get(t) })));
    applyToTexts(app, (t) => t.set({ ...(map.get(t) || {}), styles: styles.get(t) }), "Font", { list });
    pushRecentFont(family);
  } catch (e) {
    toast(`Couldn't load ${family}: ${e.message}`, { error: true });
  }
}

export function toggleFlag(app, prop, label) {
  const sel = partSel(app);
  if (sel) {
    const st = shownStyle(app);
    applyTextStyle(app, { [prop]: !st[prop] }, label);
    return;
  }
  const list = targets(app);
  if (!list.length) return;
  const on = !list.every((t) => t[prop] && !t.styleHas?.(prop));
  applyTextStyle(app, { [prop]: on }, label, { list });
}

export function setAlign(app, align) {
  applyToTexts(app, (t) => t.set("textAlign", align), "Align");
}

/** Highlight colour behind the letters ("" removes it). */
export function setHighlight(app, color, { merge = false } = {}) {
  applyTextStyle(app, { textBackgroundColor: color && color !== "transparent" ? color : "" }, "Highlight", { merge });
}

// ---- rendering ----------------------------------------------------------------------------

/** Toolbar buttons mustn't take the typing focus away from a text being edited. */
function keepFocus(app) {
  return (e) => {
    if (e.target.closest?.("button") && app.editor.active()?.isEditing) e.preventDefault();
  };
}
const group = (app, ...children) => el("div.tgroup", { on: { mousedown: keepFocus(app) } }, ...children);

function fontGroup(app) {
  const t = first(app);
  const family = t.fontFamily;
  const mixed = targets(app).some((x) => x.fontFamily !== family);
  const fontBtn = el("button.tx-font-btn", {
    type: "button", title: "Font", "aria-label": `Font: ${family}`, style: { fontFamily: `"${family}"` }, dataset: { fold: "0" },
    on: { click: () => openFontPicker(fontBtn, family, (f) => setFamily(app, f), {
      onPreview: (f) => previewFont(app, f).catch(() => {}),
      onPreviewEnd: () => endFontPreview(app),
    }) },
  }, el("span", {}, mixed ? "Mixed fonts" : family), icon("ChevronDown", 15));

  const shown = shownStyle(app);
  const num = el("input.tx-size-num", {
    type: "number", min: 1, max: 1600, step: 1, value: Math.round((shown?.fontSize || t.fontSize) * (t.scaleY || 1) * 10) / 10,
    title: "Font size", "aria-label": "Font size",
    on: {
      change: () => setSize(app, num.value),
      keydown: (e) => { if (e.key === "Enter") num.blur(); },
    },
  });
  const listBtn = el("button.tx-size-list", {
    type: "button", title: "Font sizes", "aria-label": "Font sizes",
    on: { click: () => popover(listBtn, el("div.tx-size-pop", {}, SIZES.map((s) => el("button.tx-size-opt", {
      type: "button", class: Math.round(Number(num.value)) === s ? "on" : null,
      on: { click: () => { closePopover(); setSize(app, s); } },
    }, String(s)))), { cls: "tx-pop" }) },
  }, icon("ChevronDown", 14));
  const size = el("div.tx-size", { dataset: { fold: "0" } },
    iconButton("Minus", "Smaller (Ctrl+Shift+,)", () => stepSize(app, -1)),
    el("div.tx-size-box", {}, num, listBtn),
    iconButton("Plus", "Bigger (Ctrl+Shift+.)", () => stepSize(app, 1)));
  return group(app, fontBtn, weightButton(app), size);
}

function styleGroup(app) {
  const list = targets(app);
  const t = list[0];
  const shown = shownStyle(app);
  const part = shown?.part || 0;
  const color = colorButton({
    value: fromFabricFill(shown?.fill ?? t.fill), gradient: !part, title: part ? "Colour of the selected letters" : "Text colour", cls: "tx-color",
    onChange: (v, done) => applyTextStyle(app, { fill: toFabricFill(v) }, "Text colour", { merge: !done }),
  });
  color.dataset.fold = "0";
  const btn = (name, title, on, run, disabled = false, fold = null) => {
    const b = iconButton(name, title, run, { active: on });
    if (fold != null) b.dataset.fold = String(fold);
    b.disabled = disabled;
    b.setAttribute("aria-pressed", String(on));
    return b;
  };
  const boldOn = part ? shown.styles.every((s) => Number(s.fontWeight) >= 600)
    : list.filter(canBold).length > 0 && list.filter(canBold).every((x) => Number(x.fontWeight) >= 600);
  const hl = shown?.textBackgroundColor || "";
  const highlight = el("button.ibtn.tx-hl-btn", {
    type: "button", title: part ? "Highlight the selected letters" : "Highlight", "aria-label": "Highlight", class: hl ? "on" : null, dataset: { fold: "3" },
    on: { click: () => openColorPicker(highlight, {
      value: hl || "#ffde59", title: "Highlight behind the letters",
      onChange: (v, done) => setHighlight(app, v, { merge: !done }),
    }) },
  }, icon("Highlighter"), el("i.tx-hl-bar", { style: { background: hl || "transparent" } }));
  return group(app,
    part ? el("span.tx-part-chip", { title: "Changes go to the letters you selected. Click outside the text to style the whole box." },
      String(part), el("span.tx-chip-word", {}, ` letter${part === 1 ? "" : "s"}`)) : null,
    color,
    btn("Bold", "Bold (Ctrl+B)", boldOn, () => toggleBold(app), !list.some(canBold)),
    btn("Italic", list.some(canItalic) ? "Italic (Ctrl+I)" : "Italic (this font has none)",
      part ? shown.styles.every((s) => s.fontStyle === "italic") : list.some((x) => x.fontStyle === "italic"), () => toggleItalic(app), !list.some(canItalic)),
    btn("Underline", "Underline (Ctrl+U)", part ? shown.underline : list.every((x) => x.underline), () => toggleFlag(app, "underline", "Underline"), false, 2),
    btn("Strikethrough", "Strikethrough (Ctrl+Shift+S)", part ? shown.linethrough : list.every((x) => x.linethrough),
      () => toggleFlag(app, "linethrough", "Strikethrough"), false, 3),
    highlight,
    t.isEditing && list.length === 1 ? el("button.btn.small.tx-pop-btn", {
      type: "button", title: "Make this word pop: accent colour and the heaviest weight (the selected letters, or the word at the cursor)",
      on: { click: () => popWord(app).catch((e) => toast(e.message, { error: true })) },
    }, icon("Zap", 15), "Pop") : null);
}

function spacingPop(app) {
  const t = first(app);
  return el("div.tx-spacing", {},
    slider({
      label: "Letter spacing", min: -200, max: 800, step: 5, value: Math.round(t.charSpacing || 0),
      onInput: (v) => applyToTexts(app, (x) => x.set("charSpacing", v), "Letter spacing", { merge: true }),
      onChange: (v) => applyToTexts(app, (x) => x.set("charSpacing", v), "Letter spacing"),
    }),
    slider({
      label: "Line spacing", min: 0.5, max: 2.5, step: 0.01, value: Math.round((t.lineHeight || 1.16) * 100) / 100,
      onInput: (v) => applyToTexts(app, (x) => x.set("lineHeight", v), "Line spacing", { merge: true }),
      onChange: (v) => applyToTexts(app, (x) => x.set("lineHeight", v), "Line spacing"),
    }));
}

function casePop(app) {
  const list = targets(app);
  const cur = list.length ? caseOf(list[0]) : "original";
  const canRestore = list.some((t) => originalOf(t) != null);
  const opt = (id, label) => el("button.tx-case-opt", {
    type: "button", class: cur === id && (id !== "original" || canRestore) ? "on" : null,
    on: { click: () => { closePopover(); setCase(app, id); } },
  }, el("span", {}, label), cur === id && id !== "original" ? icon("Check", 14) : null);
  return el("div.tx-case-pop", {}, CASES.map(([id, label]) => opt(id, label)),
    canRestore ? el("div.tx-case-sep") : null,
    canRestore ? opt("original", "As typed") : null);
}

function fitPop(app) {
  const list = targets(app);
  return el("div.tx-fit", {},
    toggle({ label: "Shrink text to fit the box", value: list.every(isFitted), onChange: (on) => setShrinkToFit(app, on) }),
    el("p.tx-fit-hint", {}, "Type more and the words get smaller instead of spilling out. Delete words and they grow back."),
    el("button.btn.small", { type: "button", on: { click: () => { closePopover(); fitBoxToWords(app); } } },
      icon("Scaling", 15), "Fit the box to the words"));
}

function layoutGroup(app) {
  const t = first(app);
  const cur = ALIGNS.findIndex((a) => a[0] === t.textAlign);
  const [, alignIcon, alignTitle] = ALIGNS[Math.max(0, cur)];
  const next = ALIGNS[(Math.max(0, cur) + 1) % ALIGNS.length];
  const align = iconButton(alignIcon, `${alignTitle} (click for ${next[2].toLowerCase()})`, () => setAlign(app, next[0]));
  const caseBtn = el("button.ibtn.tx-case-btn", {
    type: "button", title: "Letter case", "aria-label": "Letter case", dataset: { fold: "3" },
    on: { click: () => popover(caseBtn, casePop(app), { cls: "tx-pop" }) },
  }, icon("CaseSensitive"));
  const spacing = el("button.ibtn", {
    type: "button", title: "Spacing", "aria-label": "Spacing", dataset: { fold: "3" },
    on: { click: () => popover(spacing, spacingPop(app), { cls: "tx-pop" }) },
  }, icon("UnfoldVertical"));
  const fitted = targets(app).some(isFitted);
  const fit = el("button.ibtn", {
    type: "button", title: fitted ? "Shrink to fit is on" : "Shrink to fit", "aria-label": "Shrink to fit", class: fitted ? "on" : null,
    "aria-pressed": String(fitted), dataset: { fold: "3" }, on: { click: () => popover(fit, fitPop(app), { cls: "tx-pop" }) },
  }, icon("Shrink"));
  return group(app, align, caseBtn, spacing, fit);
}

function effectsGroup(app) {
  const open = app.currentPanel?.() === "text-effects";
  const b = el("button.btn.small.tx-fx-btn", {
    type: "button", title: "Text effects", class: open ? "on" : null, "aria-pressed": String(open),
    on: { click: () => { app.openPanel(open ? null : "text-effects"); app.refreshToolbar?.(); } },
  }, icon("Sparkles", 15), "Effects");
  return group(app, b);
}

export const TOOL_GROUPS = [
  { id: "text-font", order: 10, render: fontGroup },
  { id: "text-style", order: 14, render: styleGroup },
  { id: "text-layout", order: 18, render: layoutGroup },
  { id: "text-effects", order: 22, render: effectsGroup },
];
