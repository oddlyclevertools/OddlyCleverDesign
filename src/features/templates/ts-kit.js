// Drawing kit for the v0.2 social / slides / print templates (templates-social builder).
// Basic helpers are copied from draw.js (read-only for us) so this pack can evolve on its own;
// the rest are new: dot grids, drawn line icons, torn paper, tape, stars, waves and halftones.
// Fabric 7 defaults to a centre origin, so every helper sets its origin explicitly.
import { Circle, Ellipse, Gradient, Group, Line, Path, Polygon, Rect, Shadow } from "fabric";
import { OcText } from "../text/octext.js";

const TL = { originX: "left", originY: "top" };

function stopsOf(stops) {
  return stops.map((s, i) => (Array.isArray(s)
    ? { offset: s[0], color: s[1] }
    : { offset: stops.length === 1 ? 0 : i / (stops.length - 1), color: s }));
}

/** A linear gradient in object percentages. angle is CSS-like: 0 = to top, 90 = to right, 180 = to bottom. */
export function linear(angle, stops) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2;
  return new Gradient({
    type: "linear", gradientUnits: "percentage",
    coords: { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy },
    colorStops: stopsOf(stops),
  });
}

/** A radial gradient in object percentages. */
export function radial(stops, { cx = 0.5, cy = 0.5, r = 0.5 } = {}) {
  return new Gradient({
    type: "radial", gradientUnits: "percentage",
    coords: { x1: cx, y1: cy, r1: 0, x2: cx, y2: cy, r2: r },
    colorStops: stopsOf(stops),
  });
}

export const shadow = (color, blur, x = 0, y = 0) => new Shadow({ color, blur, offsetX: x, offsetY: y });

export function rect(x, y, w, h, fill, opts = {}) {
  return new Rect({ ...TL, left: x, top: y, width: w, height: h, fill, strokeWidth: 0, ...opts });
}

/** A stroked frame (no fill). */
export function frame(x, y, w, h, stroke, width, opts = {}) {
  return new Rect({ ...TL, left: x, top: y, width: w, height: h, fill: null, stroke, strokeWidth: width, ...opts });
}

export function circle(cx, cy, r, fill, opts = {}) {
  return new Circle({ originX: "center", originY: "center", left: cx, top: cy, radius: r, fill, strokeWidth: 0, ...opts });
}

export function ring(cx, cy, r, stroke, width, opts = {}) {
  return new Circle({ originX: "center", originY: "center", left: cx, top: cy, radius: r, fill: null, stroke, strokeWidth: width, ...opts });
}

export function ellipse(cx, cy, rx, ry, fill, opts = {}) {
  return new Ellipse({ originX: "center", originY: "center", left: cx, top: cy, rx, ry, fill, strokeWidth: 0, ...opts });
}

export function poly(points, fill, opts = {}) {
  return new Polygon(points.map(([x, y]) => ({ x, y })), { fill, strokeWidth: 0, ...opts });
}

export function path(d, opts = {}) {
  return new Path(d, { fill: null, strokeLineCap: "round", strokeLineJoin: "round", ...opts });
}

export function line(x1, y1, x2, y2, stroke, width, opts = {}) {
  return new Line([x1, y1, x2, y2], { stroke, strokeWidth: width, strokeLineCap: "round", ...opts });
}

/** A text box: x/y is its top-left corner and w its wrapping width. */
export function text(str, { x = 0, y = 0, w = 600, size = 48, font = "Inter", weight = 400, color = "#111111",
  align = "left", ...rest } = {}) {
  return new OcText(str, {
    ...TL, left: x, top: y, width: w, fontSize: size, fontFamily: font, fontWeight: weight, fill: color,
    textAlign: align, lineHeight: 1, splitByGrapheme: false, ...rest,
  });
}

export function outlined(color = "#000000", width = 14) {
  return { stroke: color, strokeWidth: width, paintFirst: "stroke", strokeLineJoin: "round", strokeUniform: false };
}

export function group(objs, opts = {}) {
  return new Group(objs, { subTargetCheck: false, interactive: false, ...opts });
}

/** A rounded pill with centred text, grouped. */
export function pill(label, { x, y, h = 44, pad = 20, fill = "#111111", color = "#ffffff", font = "Inter",
  weight = 800, size = 20, spacing = 120, stroke = null, strokeWidth = 0, center = false, radius = null,
  shadowOf = null } = {}) {
  const t = text(label, { x: 0, y: 0, w: 4000, size, font, weight, color, charSpacing: spacing, align: "left" });
  const tw = Math.ceil(t.calcTextWidth?.() ?? t.width);
  const w = tw + pad * 2;
  const left = center ? x - w / 2 : x;
  t.set({ width: tw + 4 });
  t.initDimensions();
  t.set({ left: left + pad, top: y + (h - t.height) / 2 + size * 0.04 });
  const r = radius ?? h / 2;
  const bg = rect(left, y, w, h, fill, { rx: r, ry: r, stroke, strokeWidth, shadow: shadowOf });
  return group([bg, t]);
}

export const putter = (app) => (obj, name) => app.editor.add(obj, { center: false, select: false, name });

/** Mark a full-page object so it stretches (instead of fitting) on a page of another size. */
export function bleed(obj) {
  obj.set("data", { ...(obj.data || {}), tpBleed: true });
  return obj;
}

/** A per-character style map that styles one line of a multi-line text. */
export function lineStyle(str, lineIndex, style) {
  const lineText = str.split("\n")[lineIndex] || "";
  const chars = {};
  for (let i = 0; i < lineText.length; i++) chars[i] = { ...style };
  return { [lineIndex]: chars };
}

/** Merge several lineStyle() maps. */
export const styles = (...maps) => Object.assign({}, ...maps);

export function sparkle(cx, cy, r, fill, opts = {}) {
  const k = r * 0.22;
  return poly([[cx, cy - r], [cx + k, cy - k], [cx + r, cy], [cx + k, cy + k], [cx, cy + r], [cx - k, cy + k], [cx - r, cy], [cx - k, cy - k]], fill, opts);
}

export function burst(cx, cy, r1, r2, n, fill, opts = {}) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2, r = i % 2 ? r2 : r1;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts, fill, opts);
}

/** A classic 5-point star. */
export const star = (cx, cy, r, fill, opts = {}) => burst(cx, cy, r, r * 0.42, 5, fill, opts);

// ---- new helpers ---------------------------------------------------------------------------

/** A grid of dots, grouped. */
export function dotGrid(x0, y0, cols, rows, gap, r, fill) {
  const dots = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) dots.push(circle(x0 + i * gap, y0 + j * gap, r, fill));
  return group(dots);
}

/** A halftone patch: dots that shrink from one corner to the other. */
export function halftone(x0, y0, cols, rows, gap, rMax, fill) {
  const dots = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const t = 1 - (i / cols + j / rows) / 2;
    const r = rMax * t;
    if (r > 0.6) dots.push(circle(x0 + i * gap, y0 + j * gap, r, fill));
  }
  return group(dots);
}

/** Parallel diagonal stripes clipped to nothing: a block of short lines. */
export function stripes(x, y, w, h, gap, stroke, width) {
  const ls = [];
  for (let k = -h; k < w; k += gap) ls.push(line(x + Math.max(k, 0), y + Math.max(0, -k) + 0, x + Math.min(k + h, w), y + Math.min(h, w - k), stroke, width, { strokeLineCap: "butt" }));
  return group(ls);
}

/** A sine wave line from x0 to x1 around y. */
export function wave(x0, x1, y, amp, period, stroke, width, opts = {}) {
  let d = `M ${x0} ${y}`;
  for (let x = x0; x < x1; x += period / 2) {
    const up = Math.round((x - x0) / (period / 2)) % 2 === 0 ? -1 : 1;
    d += ` Q ${x + period / 4} ${y + up * amp * 2} ${x + period / 2} ${y}`;
  }
  return path(d, { stroke, strokeWidth: width, ...opts });
}

/** A seeded random, so torn edges look the same every render. */
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** A paper scrap with torn top and bottom edges. */
export function tornPaper(x, y, w, h, fill, { seed = 3, jag = 10, step = 22, ...opts } = {}) {
  const rnd = seeded(seed), pts = [];
  for (let px = x; px <= x + w; px += step) pts.push([Math.min(px, x + w), y + rnd() * jag]);
  pts.push([x + w, y + jag / 2]);
  for (let px = x + w; px >= x; px -= step) pts.push([Math.max(px, x), y + h - rnd() * jag]);
  pts.push([x, y + h - jag / 2]);
  return poly(pts, fill, opts);
}

/** A strip of translucent tape, centred on (cx, cy). */
export function tape(cx, cy, w, h, angle, fill = "rgba(255,240,190,0.75)") {
  return rect(cx - w / 2, cy - h / 2, w, h, fill, { angle, originX: "left", originY: "top" });
}

/** An arch (rectangle with a semicircle top). */
export function arch(x, y, w, h, fill, opts = {}) {
  const r = w / 2;
  return path(`M ${x} ${y + h} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} L ${x + w} ${y + h} Z`, { fill, ...opts });
}

/** A short decorative rule with a diamond in the middle. */
export function ornament(cx, y, half, color, width = 3) {
  return group([
    line(cx - half, y, cx - 18, y, color, width),
    line(cx + 18, y, cx + half, y, color, width),
    poly([[cx, y - 9], [cx + 9, y], [cx, y + 9], [cx - 9, y]], color),
  ]);
}

// ---- line icons (our own, drawn on a 24-unit grid) ----------------------------------------

const ICONS = {
  check: "M5 12.5 L10 17.5 L19 7",
  arrow: "M4 12 H20 M14 6 L20 12 L14 18",
  heart: "M12 20 C5 15 3 11.5 3 8.5 C3 5.5 5.3 4 7.5 4 C9.5 4 11 5.3 12 7 C13 5.3 14.5 4 16.5 4 C18.7 4 21 5.5 21 8.5 C21 11.5 19 15 12 20 Z",
  bolt: "M13 2 L4 14 H11 L10 22 L20 9 H13 Z",
  leaf: "M5 19 C5 10 10 5 20 4 C19 14 14 19 5 19 Z M5 19 L13 11",
  drop: "M12 3 C8 8.5 6 11.5 6 14.5 C6 18 8.7 21 12 21 C15.3 21 18 18 18 14.5 C18 11.5 16 8.5 12 3 Z",
  clock: "M12 3 A9 9 0 1 1 11.99 3 Z M12 7 V12 L15.5 14",
  pin: "M12 21 C12 21 5 14.5 5 9.5 A7 7 0 0 1 19 9.5 C19 14.5 12 21 12 21 Z M12 7 A2.5 2.5 0 1 1 11.99 7 Z",
  phone: "M5 4 H9 L11 9 L8.5 10.5 C9.5 12.8 11.2 14.5 13.5 15.5 L15 13 L20 15 V19 C20 20 19 21 18 21 C10 20.5 3.5 14 3 6 C3 5 4 4 5 4 Z",
  mail: "M3 6 H21 V18 H3 Z M3 6 L12 13 L21 6",
  globe: "M12 3 A9 9 0 1 1 11.99 3 Z M3 12 H21 M12 3 C9 6 9 18 12 21 M12 3 C15 6 15 18 12 21",
  cup: "M5 8 H17 V14 C17 17.3 14.3 20 11 20 C7.7 20 5 17.3 5 14 Z M17 10 H19 C20.1 10 21 10.9 21 12 C21 13.1 20.1 14 19 14 H17 M8 3 V5 M11 3 V5 M14 3 V5",
  sun: "M12 7.5 A4.5 4.5 0 1 1 11.99 7.5 Z M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M4.9 4.9 L6.3 6.3 M17.7 17.7 L19.1 19.1 M4.9 19.1 L6.3 17.7 M17.7 6.3 L19.1 4.9",
  recycle: "M7 7 L10 3 H14 L17 7 M17 7 L13.5 7 M17 7 L17 3.5 M20 12 L21 16 L19 19.5 H14 M14 19.5 L16.5 17 M14 19.5 L16.5 22 M4 12 L3 16 L5 19.5 H9",
  bike: "M6 17 A3.5 3.5 0 1 1 5.99 17 Z M18 17 A3.5 3.5 0 1 1 17.99 17 Z M6 17 L10 9 H15 L18 17 M10 9 L13 17 H6 M9 6 H12",
  bag: "M5 8 H19 L18 21 H6 Z M9 8 V6 A3 3 0 0 1 15 6 V8",
  chart: "M4 20 H20 M7 20 V13 M12 20 V8 M17 20 V4",
  star: "M12 3 L14.6 8.9 L21 9.5 L16.2 13.8 L17.6 20 L12 16.8 L6.4 20 L7.8 13.8 L3 9.5 L9.4 8.9 Z",
  calendar: "M4 6 H20 V20 H4 Z M4 10 H20 M8 3 V7 M16 3 V7",
  user: "M12 4 A4 4 0 1 1 11.99 4 Z M4 21 C4 16.5 7.6 14 12 14 C16.4 14 20 16.5 20 21",
  play: "M8 5 L19 12 L8 19 Z",
};

/**
 * One of our line icons, centred on (cx, cy) and `size` px tall.
 * @param {string} name a key of ICONS
 * @param {{ stroke?: string, fill?: string|null, weight?: number }} o  weight is the stroke on the 24-unit grid
 */
export function icon(name, cx, cy, size, { stroke = "#111111", fill = null, weight = 2, ...opts } = {}) {
  const d = ICONS[name];
  if (!d) throw new Error(`Unknown icon ${name}`);
  const p = new Path(d, { fill, stroke, strokeWidth: weight, strokeLineCap: "round", strokeLineJoin: "round", ...opts });
  const k = size / 24;
  // Centre on the icon's 24-unit box, not on the path's own bounds, so icons line up.
  const bx = p.pathOffset.x, by = p.pathOffset.y;
  p.set({ originX: "center", originY: "center", scaleX: k, scaleY: k, left: cx + (bx - 12) * k, top: cy + (by - 12) * k });
  p.setCoords();
  return p;
}

export const ICON_NAMES = Object.keys(ICONS);
