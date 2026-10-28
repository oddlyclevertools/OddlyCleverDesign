// Shrink to fit for normal text boxes: the box keeps the area it had when the option was turned
// on, and the words shrink (down to 30%) when more of them are typed, then grow back to the chosen
// size when they fit again. The settings live in data.fit = { w, h, size } (object units). "Fit the
// box to the words" trims a box's width to its longest line. Uses the bulk feature's fitter.
import { fitText } from "../bulk/fit.js";
import { applyToTexts, setData, targets } from "./helpers.js";

/** Scale the letter-level font sizes by k (returns a new styles object). */
function scaleSizes(styles, k) {
  const out = {};
  for (const [ln, line] of Object.entries(styles || {})) {
    out[ln] = {};
    for (const [ch, st] of Object.entries(line || {})) out[ln][ch] = st?.fontSize ? { ...st, fontSize: st.fontSize * k } : st;
  }
  return out;
}

export const isFitted = (t) => Boolean(t?.data?.fit);

/** Re-fit a shrink-to-fit text to its area now (no history step). Returns the fit result or null. */
export function refit(t) {
  const f = t?.data?.fit;
  if (!f) return null;
  // Keep the top edge still, like Fabric does while typing (else the text creeps down each key).
  const top = t.getPositionByOrigin("center", "top");
  const k = f.size / (t.fontSize || f.size);
  if (Math.abs(k - 1) > 1e-6) t.set({ fontSize: f.size, styles: scaleSizes(t.styles, k) });
  const res = fitText(t, { w: f.w, h: f.h });
  t.setPositionByOrigin(top, "center", "top");
  t.setCoords();
  t.dirty = true;
  return res;
}

/** Turn shrink to fit on or off for the selected texts. One undo step. */
export function setShrinkToFit(app, on, list = targets(app)) {
  return applyToTexts(app, (t) => {
    if (!on) { setData(t, { fit: null }); return; }
    setData(t, { fit: { w: t.width, h: t.height, size: t.fontSize } });
    refit(t);
  }, on ? "Shrink to fit" : "No shrink to fit", { list });
}

/** After the user picks a size, a fitted text keeps that as its "full" size. */
export function rememberSize(t) {
  if (isFitted(t)) setData(t, { fit: { ...t.data.fit, size: t.fontSize } });
}

/** Make each selected box exactly as wide as its longest line. One undo step. */
export function fitBoxToWords(app, list = targets(app)) {
  return applyToTexts(app, (t) => {
    const c = t.getCenterPoint();
    t.set({ width: 100000 });
    t.initDimensions();
    let w = 1;
    for (let i = 0; i < t._textLines.length; i++) w = Math.max(w, t.getLineWidth(i));
    t.set({ width: Math.ceil(w + 2) });
    t.initDimensions();
    if (isFitted(t)) setData(t, { fit: { ...t.data.fit, w: t.width, h: t.height } });
    t.setPositionByOrigin(c, "center", "center");
  }, "Fit box to words", { list });
}

/** Keep fitted texts fitted while typing and when their box is made wider or narrower. */
export function wireFit(app) {
  const c = app.editor.canvas;
  c.on("text:changed", ({ target }) => {
    if (!isFitted(target)) return;
    refit(target);
    c.requestRenderAll();
  });
  c.on("object:modified", ({ target }) => {
    const list = target ? (target._objects ? target._objects : [target]) : [];
    const changed = list.filter((t) => isFitted(t) && Math.abs(t.width - t.data.fit.w) > 0.5);
    if (!changed.length) return;
    for (const t of changed) {
      setData(t, { fit: { ...t.data.fit, w: t.width } });
      refit(t);
    }
    c.requestRenderAll();
    app.editor.commit("Transform", { merge: true });
  });
}
