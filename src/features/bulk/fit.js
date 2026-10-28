// Auto-fit: when new words (a long name, a longer translation) no longer fit a text's box, the
// font shrinks until they do, down to a floor. Rich-text sizes shrink with it.
import { Textbox } from "fabric";

export const MIN_RATIO = 0.3; // never shrink below 30% of the designed size
const STEPS = 9;

function scaleStyles(styles, k) {
  if (!styles) return styles;
  const out = {};
  for (const [ln, line] of Object.entries(styles)) {
    out[ln] = {};
    for (const [ch, st] of Object.entries(line || {})) out[ln][ch] = st?.fontSize ? { ...st, fontSize: st.fontSize * k } : st;
  }
  return out;
}

/**
 * Shrink `o` until it fits a box of box.w x box.h (object units, before scaling).
 * @returns {{scale: number, overflow: boolean}} scale 1 = untouched
 */
export function fitText(o, box, { minRatio = MIN_RATIO } = {}) {
  const base = o.fontSize, baseStyles = o.styles;
  const wrap = o instanceof Textbox;
  const apply = (k) => {
    o.set({ fontSize: base * k, styles: scaleStyles(baseStyles, k) });
    if (wrap) o.set({ width: box.w });
    o.initDimensions();
  };
  const fits = () => o.width <= box.w + 0.5 && o.height <= box.h + 0.5;
  apply(1);
  if (fits()) return { scale: 1, overflow: false };
  apply(minRatio);
  if (!fits()) return { scale: minRatio, overflow: true };
  let lo = minRatio, hi = 1;
  for (let i = 0; i < STEPS; i++) {
    const mid = (lo + hi) / 2;
    apply(mid);
    if (fits()) lo = mid; else hi = mid;
  }
  apply(lo);
  o.set({ fontSize: Math.max(1, Math.floor(o.fontSize * 10) / 10) });
  o.initDimensions();
  return { scale: lo, overflow: false };
}

/**
 * Give a text new words and styles, then (optionally) shrink it into the box it had before,
 * keeping its centre where it was.
 * @param {object} o a Fabric text object
 * @param {{text: string, styles?: object, props?: object}} next
 * @param {{fit?: boolean}} opts
 */
export function setTextFitted(o, next, { fit = true } = {}) {
  const box = { w: o.width, h: o.height };
  const center = o.getRelativeCenterPoint();
  o.set({ text: next.text, styles: next.styles || {}, ...(next.props || {}) });
  if (o instanceof Textbox) o.set({ width: box.w });
  o.initDimensions();
  const res = fit ? fitText(o, box) : { scale: 1, overflow: false };
  o.setPositionByOrigin(center, "center", "center");
  o.setCoords();
  o.set("dirty", true);
  for (let p = o.group || o.parent; p; p = p.group || p.parent) p.set("dirty", true);
  return res;
}
