// Live font preview: while the pointer (or the arrow keys) rests on a font in the picker, the
// selected texts show it. Nothing is recorded; leaving the list or closing the picker puts the
// texts back exactly as they were, and picking a font then applies it as one undo step.
import { ensureFont, nearestWeight, FONTS } from "../../core/fonts.js";
import { targets } from "./helpers.js";

let saved = null; // Map(text -> its own font settings) while previewing
let token = 0;

const KEYS = ["fontFamily", "fontWeight", "fontStyle", "width", "styles"];

function redraw(app, list) {
  for (const t of list) {
    t.initDimensions?.();
    t.setCoords();
    t.dirty = true;
    for (let g = t.parent || t.group; g; g = g.parent || g.group) g.dirty = true;
  }
  app.editor.canvas.requestRenderAll();
}

/** Show `family` on the selected texts for now. */
export async function previewFont(app, family) {
  const list = saved ? [...saved.keys()] : targets(app);
  if (!list.length) return;
  if (!saved) saved = new Map(list.map((t) => [t, Object.fromEntries(KEYS.map((k) => [k, t[k]]))]));
  const my = ++token;
  const props = list.map((t) => {
    const s = saved.get(t);
    const weight = nearestWeight(family, Number(s.fontWeight) || 400);
    const style = s.fontStyle === "italic" && FONTS[family]?.italic ? "italic" : "normal";
    return { fontFamily: family, fontWeight: weight, fontStyle: style };
  });
  await Promise.all(props.map((p) => ensureFont(p.fontFamily, p.fontWeight, p.fontStyle)));
  if (my !== token || !saved) return; // the pointer moved on, or the preview ended
  list.forEach((t, i) => t.set({ ...props[i], width: saved.get(t).width }));
  redraw(app, list);
}

/** Put the texts back as they were. */
export function endFontPreview(app) {
  token++;
  if (!saved) return;
  const list = [...saved.keys()];
  for (const t of list) t.set(saved.get(t));
  saved = null;
  redraw(app, list);
}
