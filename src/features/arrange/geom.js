// Geometry and stacking helpers shared by the arrange feature. All rects are in page
// coordinates (the viewport transform is ignored), axis aligned.
import { ActiveSelection } from "fabric";

/** The axis-aligned box of an object: {l, t, r, b, w, h, cx, cy}. */
export function rectOf(o) {
  o.setCoords();
  const r = o.getBoundingRect();
  return box(r.left, r.top, r.width, r.height);
}

export function box(l, t, w, h) {
  return { l, t, r: l + w, b: t + h, w, h, cx: l + w / 2, cy: t + h / 2 };
}

/** The box around several objects. */
export function unionRect(objs) {
  if (!objs.length) return box(0, 0, 0, 0);
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const o of objs) {
    const x = rectOf(o);
    l = Math.min(l, x.l); t = Math.min(t, x.t); r = Math.max(r, x.r); b = Math.max(b, x.b);
  }
  return box(l, t, r - l, b - t);
}

export const intersects = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

/** Move an object by a page-space delta (works for any origin). */
export function moveBy(o, dx, dy) {
  if (!dx && !dy) return;
  o.set({ left: o.left + dx, top: o.top + dy });
  o.setCoords();
}

/** Set the angle while keeping the object's centre where it is. */
export function setAngleKeepCenter(o, angle) {
  const c = o.getCenterPoint();
  o.set("angle", angle);
  o.setPositionByOrigin(c, "center", "center");
  o.setCoords();
}

// The page, background image, crop helpers and template guides aren't arranged like normal objects.
export const isFixed = (o) => Boolean(o.isPage || o.isBg || o.data?.cropUI || o.data?.guide);
export const isMulti = (a) => a instanceof ActiveSelection;

/**
 * Run fn(objs) on the selected objects with any multi-selection taken apart first, so their
 * coordinates are absolute, then select them again.
 */
export function withDetached(editor, fn, objs = editor.selection()) {
  const multi = isMulti(editor.active());
  if (multi) editor.canvas.discardActiveObject();
  const out = fn(objs);
  for (const o of objs) o.setCoords();
  if (multi) editor.select(objs);
  return out;
}

/** Index of the first object above the page and background images. */
export function floorIndex(list) {
  let i = 0;
  while (i < list.length && isFixed(list[i])) i++;
  return i;
}

/** Put the canvas objects in exactly this order (bottom to top). */
export function applyOrder(canvas, order) {
  order.forEach((o, i) => {
    if (canvas._objects[i] !== o) canvas.moveObjectTo(o, i);
  });
}

/**
 * Change the stacking of `sel`. mode: front | back | forward | backward.
 * Forward/backward jump past the next object that overlaps (like Canva), or one step.
 * @returns {boolean} true if the order changed
 */
export function reorder(canvas, sel, mode) {
  const all = canvas.getObjects();
  const S = new Set(sel.filter((o) => !isFixed(o)));
  if (!S.size) return false;
  const rest = all.filter((o) => !S.has(o));
  const moving = all.filter((o) => S.has(o));
  const idx = moving.map((o) => all.indexOf(o));
  let at;
  if (mode === "front") at = rest.length;
  else if (mode === "back") at = floorIndex(rest);
  else if (mode === "forward") {
    const top = Math.max(...idx), u = unionRect(moving);
    const above = all.slice(top + 1).filter((o) => !S.has(o) && o.visible !== false);
    const target = above.find((o) => intersects(u, rectOf(o))) || above[0];
    if (!target) return false;
    at = rest.indexOf(target) + 1;
  } else if (mode === "backward") {
    const bottom = Math.min(...idx), u = unionRect(moving);
    const below = all.slice(floorIndex(all), bottom).filter((o) => !S.has(o) && o.visible !== false).reverse();
    const target = below.find((o) => intersects(u, rectOf(o))) || below[0];
    if (!target) return false;
    at = rest.indexOf(target);
  } else return false;
  at = Math.max(floorIndex(rest), at);
  const order = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
  if (order.every((o, i) => o === all[i])) return false;
  applyOrder(canvas, order);
  return true;
}

/** Can `sel` move in that direction at all? (for disabling buttons) */
export function canReorder(canvas, sel, mode) {
  const all = canvas.getObjects();
  const idx = sel.filter((o) => !isFixed(o)).map((o) => all.indexOf(o)).filter((i) => i >= 0);
  if (!idx.length) return false;
  const floor = floorIndex(all), n = idx.length;
  if (mode === "front" || mode === "forward") return Math.min(...idx) < all.length - n;
  return Math.max(...idx) >= floor + n;
}

/** Every leaf object (groups opened up). */
export function leaves(o) {
  return o._objects ? o._objects.flatMap(leaves) : [o];
}

export const round = (v, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};
