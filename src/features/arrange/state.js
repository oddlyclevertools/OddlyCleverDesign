// Shared state of the arrange feature: view preferences (per browser), the ruler guides
// (stored in the design, on the page object) and the live snapping overlay data.

const PREFS_KEY = "oc-design.arrange.view";
const DEFAULTS = { rulers: false, guides: true, snapGuides: true, smart: true, margins: false, bleed: false };

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

let prefs = loadPrefs();
const listeners = new Set();

export const getPrefs = () => prefs;

export function setPref(key, value) {
  prefs = { ...prefs, [key]: value };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage blocked: keep in memory */ }
  for (const fn of listeners) fn(prefs);
}

export function onPrefs(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- guides: [{ axis: "x" | "y", pos }] in page px. x = a vertical line at x = pos. ----

export function getGuides(editor) {
  const g = editor.page?.data?.guides;
  return Array.isArray(g) ? g.filter((x) => (x.axis === "x" || x.axis === "y") && Number.isFinite(x.pos)) : [];
}

export function setGuides(editor, guides, label = "Guides") {
  const page = editor.page;
  if (!page) return;
  page.set("data", { ...(page.data || {}), guides: guides.map((g) => ({ axis: g.axis, pos: Math.round(g.pos * 10) / 10 })) });
  editor.canvas.requestRenderAll();
  editor.commit(label);
}

/** The safe-area margin (fixed, like Canva) and the print bleed, in page px. */
export const marginOf = (editor) => Math.round(Math.min(editor.width, editor.height) * 0.05);
export const bleedOf = (editor) => (Math.max(editor.width, editor.height) >= 2400 ? 38 : 12);

/** Live overlay data written by snapping and read by the overlay renderer. */
export const live = {
  lines: [],     // [{ axis: "x"|"y", pos, from, to }] smart guide lines (page px)
  gaps: [],      // [{ axis: "x"|"y", from, to, at }] equal-spacing markers (page px)
  label: null,   // { text, x, y } screen px, or null
  hover: null,   // object highlighted from the Layers panel
  guideDrag: null, // { axis, pos, remove } a guide being dragged from a ruler
  hideGuide: -1, // index of the guide being moved (drawn as guideDrag instead)
};

export function clearLive() {
  live.lines = [];
  live.gaps = [];
  live.label = null;
}
