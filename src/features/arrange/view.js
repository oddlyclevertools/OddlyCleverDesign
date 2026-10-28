// The "View" top-bar menu: rulers, guides, snapping, margins, bleed, and guide presets.
import { el, icon, popover, toggle } from "../../ui/kit.js";
import { getGuides, getPrefs, setGuides, setPref } from "./state.js";

const PRESETS = [
  { id: "cols12", label: "12 columns", icon: "Columns3", make: (W) => cols(W, 12) },
  { id: "cols3", label: "3 columns", icon: "Columns3", make: (W) => cols(W, 3) },
  { id: "grid3", label: "3 × 3 grid", icon: "Grid3x3", make: (W, H) => [...cols(W, 3), ...rows(H, 3)] },
  { id: "centre", label: "Centre lines", icon: "Plus", make: (W, H) => [{ axis: "x", pos: W / 2 }, { axis: "y", pos: H / 2 }] },
];
const cols = (W, n) => Array.from({ length: n - 1 }, (_, i) => ({ axis: "x", pos: (W * (i + 1)) / n }));
const rows = (H, n) => Array.from({ length: n - 1 }, (_, i) => ({ axis: "y", pos: (H * (i + 1)) / n }));

export function viewMenu(app) {
  const ed = app.editor;
  const opt = (key, label, hint) => el("div.ar-view-opt", {}, toggle({
    label, value: getPrefs()[key], onChange: (v) => setPref(key, v),
  }), hint ? el("small.ar-hint", {}, hint) : null);
  const n = getGuides(ed).length;
  return el("div.ar-view", {},
    el("h4.sec-title", {}, "Show"),
    opt("rulers", "Rulers (Shift+R)", "Drag from a ruler to add a guide."),
    opt("guides", "Guides"),
    opt("margins", "Margins", "A safe area: keep text inside it."),
    opt("bleed", "Print bleed", "Anything past the trim line may be cut off."),
    el("h4.sec-title", {}, "Snapping"),
    opt("smart", "Smart guides", "Snap to the page and other objects. Hold Ctrl to move freely."),
    opt("snapGuides", "Snap to guides"),
    el("h4.sec-title", {}, "Add guides"),
    el("div.ar-presets", {}, PRESETS.map((p) => el("button.btn.small.ar-preset", {
      type: "button", title: `Replace the guides with ${p.label.toLowerCase()}`,
      on: { click: () => { if (!getPrefs().guides) setPref("guides", true); setGuides(ed, p.make(ed.width, ed.height), "Add guides"); } },
    }, icon(p.icon, 15), p.label))),
    el("button.btn.small.ghost.ar-clear", {
      type: "button", disabled: !n,
      on: { click: (e) => { setGuides(ed, [], "Clear guides"); e.currentTarget.disabled = true; } },
    }, icon("Trash2", 15), n ? `Clear ${n} guide${n > 1 ? "s" : ""}` : "No guides yet"));
}

export function viewButton(app) {
  const b = el("button.btn.small.ghost.ar-view-btn", {
    type: "button", title: "View: rulers, guides, margins", "aria-label": "View options",
    on: { click: () => popover(b, viewMenu(app), { align: "end", cls: "ar-pop" }) },
  }, icon("Eye", 16), el("span", {}, "View"));
  return b;
}
