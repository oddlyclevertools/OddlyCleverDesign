// Geometry helpers shared by the design check and the variant maker.
import { util } from "fabric";

export const isText = (o) => typeof o?.text === "string";

/** Every visible design object, including ones inside groups, as { obj, top } (top = the
 *  top-level object the user can select). */
export function walk(objects) {
  const out = [];
  const visit = (o, top) => {
    if (!o || o.isPage || o.visible === false || o.data?.guide) return;
    out.push({ obj: o, top });
    if (Array.isArray(o._objects) && !isText(o)) for (const c of o._objects) visit(c, top);
  };
  for (const o of objects) visit(o, o);
  return out;
}

/** The axis-aligned box of an object in page coordinates (works inside groups too). */
export function boxOf(o) {
  const m = o.calcTransformMatrix();
  const w = (o.width || 0) / 2, h = (o.height || 0) / 2;
  const pts = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => util.transformPoint({ x, y }, m));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** How much the object is scaled on the page (vertical axis). */
export function scaleOf(o) {
  const m = o.calcTransformMatrix();
  return Math.hypot(m[2], m[3]);
}

/** The text's largest font size as it shows on the page (style overrides included). */
export function pageFontSize(o, pick = Math.max) {
  const sizes = [o.fontSize || 0];
  for (const line of Object.values(o.styles || {})) {
    for (const st of Object.values(line || {})) if (st?.fontSize) sizes.push(st.fontSize);
  }
  return pick(...sizes) * scaleOf(o);
}

export function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The smallest move (dx, dy) that takes box `a` out of rect `r` while staying on a W x H page,
 *  or null when there is no room. */
export function moveOutOf(a, r, W, H) {
  const options = [
    { dx: r.x - (a.x + a.w), dy: 0 },   // to the left of r
    { dx: r.x + r.w - a.x, dy: 0 },     // to the right
    { dx: 0, dy: r.y - (a.y + a.h) },   // above
    { dx: 0, dy: r.y + r.h - a.y },     // below
  ].filter(({ dx, dy }) => a.x + dx >= -0.5 && a.y + dy >= -0.5 && a.x + a.w + dx <= W + 0.5 && a.y + a.h + dy <= H + 0.5);
  if (!options.length) return null;
  options.sort((p, q) => Math.hypot(p.dx, p.dy) - Math.hypot(q.dx, q.dy));
  return options[0];
}

/** The move that brings box `a` fully onto a W x H page (null when it's bigger than the page). */
export function moveInside(a, W, H, margin = 0) {
  if (a.w > W - 2 * margin || a.h > H - 2 * margin) return null;
  const dx = Math.max(margin - a.x, Math.min(0, W - margin - (a.x + a.w)));
  const dy = Math.max(margin - a.y, Math.min(0, H - margin - (a.y + a.h)));
  return { dx, dy };
}
