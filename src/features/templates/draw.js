// Small drawing helpers the template builders share: shapes, text, gradients and shadows,
// plain Fabric built-ins plus OcText, so template text takes text effects and curves.
// Fabric 7 defaults to a centre origin, so every helper sets its origin explicitly.
import { Circle, Ellipse, Gradient, Group, Line, Path, Polygon, Rect, Shadow } from "fabric";
import { OcText } from "../text/octext.js";

const TL = { originX: "left", originY: "top" };

/** Colour stops from ["#a", "#b"] (evenly spread) or [[0, "#a"], [1, "#b"]]. */
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

/** A radial gradient in object percentages (it stretches with the object's aspect). */
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

export function circle(cx, cy, r, fill, opts = {}) {
  return new Circle({ originX: "center", originY: "center", left: cx, top: cy, radius: r, fill, strokeWidth: 0, ...opts });
}

export function ellipse(cx, cy, rx, ry, fill, opts = {}) {
  return new Ellipse({ originX: "center", originY: "center", left: cx, top: cy, rx, ry, fill, strokeWidth: 0, ...opts });
}

/** A polygon from [[x, y], ...] in page coordinates. */
export function poly(points, fill, opts = {}) {
  return new Polygon(points.map(([x, y]) => ({ x, y })), { fill, strokeWidth: 0, ...opts });
}

/** An SVG path in page coordinates. */
export function path(d, opts = {}) {
  return new Path(d, { fill: null, strokeLineCap: "round", strokeLineJoin: "round", ...opts });
}

export function line(x1, y1, x2, y2, stroke, width, opts = {}) {
  return new Line([x1, y1, x2, y2], { stroke, strokeWidth: width, strokeLineCap: "round", ...opts });
}

/**
 * A text box. x/y is its top-left corner and w its wrapping width.
 * @param {string} str
 * @param {object} o  x, y, w, size, font, weight, color, align, plus any Textbox option
 */
export function text(str, { x = 0, y = 0, w = 600, size = 48, font = "Inter", weight = 400, color = "#111111",
  align = "left", ...rest } = {}) {
  return new OcText(str, {
    ...TL, left: x, top: y, width: w, fontSize: size, fontFamily: font, fontWeight: weight, fill: color,
    textAlign: align, lineHeight: 1, splitByGrapheme: false, ...rest,
  });
}

/** The bold "thumbnail text" look: a thick outline painted behind the fill. */
export function outlined(color = "#000000", width = 14) {
  return { stroke: color, strokeWidth: width, paintFirst: "stroke", strokeLineJoin: "round", strokeUniform: false };
}

export function group(objs, opts = {}) {
  return new Group(objs, { subTargetCheck: false, interactive: false, ...opts });
}

/** A rounded pill with centred text, grouped. */
export function pill(label, { x, y, h = 44, pad = 20, fill = "#111111", color = "#ffffff", font = "Inter",
  weight = 800, size = 20, spacing = 120, stroke = null, strokeWidth = 0, center = false, shadowOf = null } = {}) {
  const t = text(label, { x: 0, y: 0, w: 2000, size, font, weight, color, charSpacing: spacing, align: "left" });
  const tw = Math.ceil(t.calcTextWidth?.() ?? t.width);
  const w = tw + pad * 2;
  const left = center ? x - w / 2 : x;
  t.set({ width: tw + 4 });
  t.initDimensions();
  t.set({ left: left + pad, top: y + (h - t.height) / 2 + size * 0.04 });
  const bg = rect(left, y, w, h, fill, { rx: h / 2, ry: h / 2, stroke, strokeWidth, shadow: shadowOf });
  return group([bg, t]);
}

/** A thick arrow along a quadratic curve from (x1,y1) to (x2,y2), bending through (cx,cy). */
export function curvedArrow(x1, y1, cx, cy, x2, y2, { color = "#ff2d2d", width = 22, head = 64, outline = null } = {}) {
  const ang = Math.atan2(y2 - cy, x2 - cx);
  const back = head * 0.75;
  const ex = x2 - Math.cos(ang) * back, ey = y2 - Math.sin(ang) * back;
  const shaftD = `M ${x1} ${y1} Q ${cx} ${cy} ${ex} ${ey}`;
  const hx = (a, d) => x2 - Math.cos(ang + a) * d, hy = (a, d) => y2 - Math.sin(ang + a) * d;
  const tip = [[x2, y2], [hx(0.5, head), hy(0.5, head)], [hx(-0.5, head), hy(-0.5, head)]];
  const parts = [];
  if (outline) {
    parts.push(path(shaftD, { stroke: outline, strokeWidth: width + 14 }));
    parts.push(poly(tip, outline, { stroke: outline, strokeWidth: 14, strokeLineJoin: "round" }));
  }
  parts.push(path(shaftD, { stroke: color, strokeWidth: width }));
  parts.push(poly(tip, color, { stroke: color, strokeWidth: 4, strokeLineJoin: "round" }));
  return group(parts);
}

/** A centred label for a photo placeholder ("Your photo"). */
export function slotLabel(cx, cy, { label = "Your photo", size = 30, color = "rgba(255,255,255,0.9)" } = {}) {
  return text(label, { x: cx - 260, y: cy - size / 2, w: 520, size, font: "Inter", weight: 700, color, align: "center", charSpacing: 60 });
}

/** A simple person silhouette (head + shoulders), for photo placeholders. */
export function silhouette(cx, baseY, h, fill) {
  const r = h * 0.21, bw = h * 0.78, top = baseY - h * 0.5;
  const body = path(`M ${cx - bw / 2} ${baseY} C ${cx - bw / 2} ${top + h * 0.05} ${cx - bw * 0.3} ${top} ${cx} ${top}
    C ${cx + bw * 0.3} ${top} ${cx + bw / 2} ${top + h * 0.05} ${cx + bw / 2} ${baseY} Z`, { fill });
  const head = circle(cx, top - r * 0.95, r, fill);
  return group([body, head]);
}

/** add() for builders: keep the template's own positions and don't select anything. */
export const putter = (app) => (obj, name) => app.editor.add(obj, { center: false, select: false, name });

/** Mark a full-page object so it stretches (instead of fitting) on a page of another size. */
export function bleed(obj) {
  obj.set("data", { ...(obj.data || {}), tpBleed: true });
  return obj;
}

/** A per-character style map that colours one line of a multi-line text. */
export function lineStyle(str, lineIndex, style) {
  const lineText = str.split("\n")[lineIndex] || "";
  const chars = {};
  for (let i = 0; i < lineText.length; i++) chars[i] = { ...style };
  return { [lineIndex]: chars };
}

/** A 4-point sparkle star centred on (cx, cy). */
export function sparkle(cx, cy, r, fill, opts = {}) {
  const k = r * 0.22;
  return poly([[cx, cy - r], [cx + k, cy - k], [cx + r, cy], [cx + k, cy + k], [cx, cy + r], [cx - k, cy + k], [cx - r, cy], [cx - k, cy - k]], fill, opts);
}

/** A starburst with n points between radii r1 (outer) and r2 (inner). */
export function burst(cx, cy, r1, r2, n, fill, opts = {}) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n - Math.PI / 2, r = i % 2 ? r2 : r1;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts, fill, opts);
}
