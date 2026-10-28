// Drawing kit for the video template pack (templates-video builder).
// Primitives are copied from draw.js (read-only for this pack) so the pack stays self-contained;
// the rest are drawn illustrations the video templates share (faces, devices, grids, rays...).
// Fabric 7 defaults to a centre origin, so every helper sets its origin explicitly.
import { Circle, Ellipse, Gradient, Group, Line, Path, Polygon, Rect, Shadow } from "fabric";
import { OcText } from "../text/octext.js";

const TL = { originX: "left", originY: "top" };

// ---- primitives (copied from draw.js) ------------------------------------------------------

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

/** A text box (OcText, so text effects work). x/y is its top-left corner and w its wrapping width. */
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

/** OcText effects (see text/effects.js), so the user can tweak them in the Effects panel. */
export const fx = (effect) => ({ data: { effect } });

export function group(objs, opts = {}) {
  return new Group(objs, { subTargetCheck: false, interactive: false, ...opts });
}

/** A rounded pill with centred text, grouped. */
export function pill(label, { x, y, h = 44, pad = 20, fill = "#111111", color = "#ffffff", font = "Inter",
  weight = 800, size = 20, spacing = 120, stroke = null, strokeWidth = 0, center = false, shadowOf = null, radius = null } = {}) {
  const t = text(label, { x: 0, y: 0, w: 3000, size, font, weight, color, charSpacing: spacing, align: "left" });
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

/** Width of a single line of text at the given style (fonts must be loaded). */
export function measure(str, opts) {
  const t = text(str, { ...opts, w: 4000 });
  return Math.ceil(t.calcTextWidth?.() ?? t.width);
}

/** The largest font size (<= size) at which `str` fits on one line of `maxW`. */
export function fitSize(str, opts, maxW) {
  const w = measure(str, opts);
  return w <= maxW ? opts.size : Math.floor((opts.size * maxW) / w);
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

/** add() for builders: keep the template's own positions and don't select anything. */
export const putter = (app) => (obj, name) => app.editor.add(obj, { center: false, select: false, name });

/** Mark a full-page object so it stretches (instead of fitting) on a page of another size. */
export function bleed(obj) {
  obj.set("data", { ...(obj.data || {}), tpBleed: true });
  return obj;
}

/** Mark an editing guide: shown while editing, skipped in previews. */
export function guide(obj) {
  obj.set("data", { ...(obj.data || {}), guide: true });
  return obj;
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

/** A five-point star. */
export function star(cx, cy, r, fill, opts = {}) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * i) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return poly(pts, fill, opts);
}

// ---- patterns as one path each (one layer, cheap to render) --------------------------------

/** Rays (thin triangles) from (cx, cy) out to radius r: comic "speed lines" / sunburst. */
export function rays(cx, cy, r, n, fill, { spread = 0.5, start = 0 } = {}) {
  const step = (Math.PI * 2) / n, half = (step * spread) / 2;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = start + i * step;
    const p = (ang) => `${(cx + Math.cos(ang) * r).toFixed(1)} ${(cy + Math.sin(ang) * r).toFixed(1)}`;
    d += `M ${cx} ${cy} L ${p(a - half)} L ${p(a + half)} Z `;
  }
  return path(d, { fill, strokeWidth: 0 });
}

/** A grid of lines over a box. */
export function grid(x, y, w, h, step, stroke, width = 2) {
  let d = "";
  for (let gx = x; gx <= x + w + 0.5; gx += step) d += `M ${gx} ${y} L ${gx} ${y + h} `;
  for (let gy = y; gy <= y + h + 0.5; gy += step) d += `M ${x} ${gy} L ${x + w} ${gy} `;
  return path(d, { stroke, strokeWidth: width, strokeLineCap: "butt" });
}

/** A synthwave floor: lines converging to a vanishing point (vx, horizon) plus receding rows. */
export function perspectiveGrid(x, horizon, w, bottom, vx, { cols = 22, rows = 9, stroke = "#ff3df2", width = 3 } = {}) {
  let d = "";
  for (let i = -cols; i <= cols; i++) {
    const bx = vx + (i * w) / cols;
    d += `M ${vx + (bx - vx) * 0.04} ${horizon} L ${bx} ${bottom} `;
  }
  for (let j = 1; j <= rows; j++) {
    const t = (j / rows) ** 2.2;
    const yy = horizon + (bottom - horizon) * t;
    d += `M ${x} ${yy} L ${x + w} ${yy} `;
  }
  return path(d, { stroke, strokeWidth: width, strokeLineCap: "butt" });
}

/** A field of dots (halftone-ish when `grow` > 0: dots grow toward the bottom-right). */
export function dots(x, y, cols, rows, gap, r, fill, { grow = 0 } = {}) {
  let d = "";
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const rr = r * (1 + grow * ((i / cols + j / rows) / 2));
      const cx = x + i * gap, cy = y + j * gap;
      d += `M ${cx - rr} ${cy} a ${rr} ${rr} 0 1 0 ${rr * 2} 0 a ${rr} ${rr} 0 1 0 ${-rr * 2} 0 Z `;
    }
  }
  return path(d, { fill, strokeWidth: 0 });
}

/** Diagonal stripes inside a box (hazard tape). Stripes are clipped to the box by maths. */
export function stripes(x, y, w, h, band, fill) {
  let d = "";
  for (let s = -h; s < w; s += band * 2) {
    const pts = [[s, h], [s + band, h], [s + band + h, 0], [s + h, 0]]
      .map(([px, py]) => [Math.min(Math.max(px, 0), w), py]);
    d += `M ${pts.map(([px, py]) => `${x + px} ${y + py}`).join(" L ")} Z `;
  }
  return path(d, { fill, strokeWidth: 0, strokeLineJoin: "miter" });
}

/** A sound waveform of vertical rounded bars centred on cy. */
export function waveform(x, cy, w, n, maxH, stroke, width, seed = 3) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const env = Math.sin(Math.PI * t) ** 0.6;
    const v = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + seed) * Math.cos(i * 0.43 + seed * 2));
    const hh = Math.max(width, maxH * env * v);
    const px = x + t * w;
    d += `M ${px} ${cy - hh / 2} L ${px} ${cy + hh / 2} `;
  }
  return path(d, { stroke, strokeWidth: width });
}

// ---- drawn illustrations -------------------------------------------------------------------

const INK = "#16121b";

/**
 * A drawn cartoon head with shoulders: a stand-in for the creator's face photo.
 * mood: "shock" (wide eyes, open mouth), "smile", "smirk", "think".
 */
export function face(cx, cy, r, { skin = "#ffc9a3", hair = "#2b1d16", shirt = "#ff2e63", mood = "shock", outline = INK,
  ow = null } = {}) {
  const w = ow ?? r * 0.07;
  const st = { stroke: outline, strokeWidth: w };
  const parts = [];
  // shoulders
  const sy = cy + r * 0.95;
  parts.push(path(`M ${cx - r * 1.55} ${cy + r * 2.4} C ${cx - r * 1.5} ${sy + r * 0.2} ${cx - r * 0.9} ${sy} ${cx} ${sy}
    C ${cx + r * 0.9} ${sy} ${cx + r * 1.5} ${sy + r * 0.2} ${cx + r * 1.55} ${cy + r * 2.4} Z`, { fill: shirt, ...st }));
  parts.push(rect(cx - r * 0.28, cy + r * 0.6, r * 0.56, r * 0.5, skin, { ...st, rx: r * 0.1, ry: r * 0.1 }));
  // ears
  parts.push(ellipse(cx - r * 0.92, cy + r * 0.08, r * 0.17, r * 0.24, skin, st));
  parts.push(ellipse(cx + r * 0.92, cy + r * 0.08, r * 0.17, r * 0.24, skin, st));
  // head
  parts.push(ellipse(cx, cy, r * 0.9, r, skin, st));
  // hair: a swept cap
  parts.push(path(`M ${cx - r * 0.92} ${cy - r * 0.05} C ${cx - r * 1.02} ${cy - r * 0.95} ${cx - r * 0.4} ${cy - r * 1.22} ${cx + r * 0.1} ${cy - r * 1.12}
    C ${cx + r * 0.7} ${cy - r * 1.1} ${cx + r * 1.02} ${cy - r * 0.7} ${cx + r * 0.9} ${cy - r * 0.12}
    C ${cx + r * 0.7} ${cy - r * 0.55} ${cx + r * 0.2} ${cy - r * 0.6} ${cx - r * 0.25} ${cy - r * 0.72}
    C ${cx - r * 0.5} ${cy - r * 0.5} ${cx - r * 0.75} ${cy - r * 0.4} ${cx - r * 0.92} ${cy - r * 0.05} Z`, { fill: hair, ...st }));
  // cheeks
  parts.push(ellipse(cx - r * 0.55, cy + r * 0.32, r * 0.14, r * 0.08, "rgba(255,90,90,0.35)"));
  parts.push(ellipse(cx + r * 0.55, cy + r * 0.32, r * 0.14, r * 0.08, "rgba(255,90,90,0.35)"));
  const ey = cy - r * 0.08, ex = r * 0.34;
  if (mood === "shock") {
    for (const s of [-1, 1]) {
      parts.push(ellipse(cx + s * ex, ey, r * 0.2, r * 0.25, "#ffffff", st));
      parts.push(circle(cx + s * ex, ey + r * 0.02, r * 0.07, INK));
      parts.push(path(`M ${cx + s * (ex - r * 0.2)} ${ey - r * 0.42} Q ${cx + s * ex} ${ey - r * 0.56} ${cx + s * (ex + r * 0.2)} ${ey - r * 0.44}`,
        { stroke: hair === "#ffffff" ? INK : hair, strokeWidth: r * 0.08 }));
    }
    parts.push(ellipse(cx, cy + r * 0.52, r * 0.24, r * 0.3, "#5a1020", st));
    parts.push(ellipse(cx, cy + r * 0.68, r * 0.15, r * 0.1, "#ff6b81"));
  } else {
    const smirk = mood === "smirk";
    for (const s of [-1, 1]) {
      parts.push(path(`M ${cx + s * ex - r * 0.13} ${ey + r * 0.02} Q ${cx + s * ex} ${ey - r * 0.12} ${cx + s * ex + r * 0.13} ${ey + r * 0.02}`,
        { stroke: INK, strokeWidth: r * 0.07 }));
      const lift = smirk && s === 1 ? -r * 0.08 : 0;
      parts.push(path(`M ${cx + s * (ex - r * 0.18)} ${ey - r * 0.3 + lift} L ${cx + s * (ex + r * 0.18)} ${ey - r * 0.36 + lift}`,
        { stroke: hair, strokeWidth: r * 0.08 }));
    }
    if (smirk) {
      parts.push(path(`M ${cx - r * 0.3} ${cy + r * 0.5} Q ${cx + r * 0.05} ${cy + r * 0.62} ${cx + r * 0.36} ${cy + r * 0.38}`,
        { stroke: INK, strokeWidth: r * 0.08 }));
    } else {
      parts.push(path(`M ${cx - r * 0.36} ${cy + r * 0.38} Q ${cx} ${cy + r * 0.86} ${cx + r * 0.36} ${cy + r * 0.38} Z`,
        { fill: "#ffffff", ...st }));
    }
  }
  return group(parts);
}

/** A phone: rounded body, notch, screen (fill or gradient). Returns the group. */
export function phone(x, y, w, h, { body = "#1b1b22", screen = "#2a2a35", edge = "#3a3a46" } = {}) {
  const r = w * 0.14, b = w * 0.045;
  return group([
    rect(x, y, w, h, body, { rx: r, ry: r, stroke: edge, strokeWidth: w * 0.012, shadow: shadow("rgba(0,0,0,0.5)", w * 0.25, 0, w * 0.08) }),
    rect(x + b, y + b, w - b * 2, h - b * 2, screen, { rx: r - b, ry: r - b }),
    rect(x + w / 2 - w * 0.15, y + b + w * 0.03, w * 0.3, w * 0.07, body, { rx: w * 0.035, ry: w * 0.035 }),
  ]);
}

/** The back of a phone with a three-lens camera bump. */
export function phoneBack(x, y, w, h, { body = "#2c3b55", glass = "#1a1a22", angle = 0 } = {}) {
  const r = w * 0.14, cam = w * 0.44;
  const lens = (lx, ly) => [
    circle(lx, ly, cam * 0.19, "#0b0b10", { stroke: "#55607a", strokeWidth: cam * 0.03 }),
    circle(lx, ly, cam * 0.1, radial(["#4b6cff", [0.5, "#16163a"], [1, "#050508"]])),
    circle(lx - cam * 0.04, ly - cam * 0.04, cam * 0.025, "rgba(255,255,255,0.8)"),
  ];
  const cx0 = x + w * 0.07, cy0 = y + w * 0.07;
  return group([
    rect(x, y, w, h, linear(135, [body, "#121826"]), { rx: r, ry: r, stroke: "#8fa3c8", strokeWidth: w * 0.012,
      shadow: shadow("rgba(0,0,0,0.55)", w * 0.3, 0, w * 0.1) }),
    rect(x + w * 0.05, y + h * 0.02, w * 0.04, h * 0.96, "rgba(255,255,255,0.08)", { rx: w * 0.02, ry: w * 0.02 }),
    rect(cx0, cy0, cam, cam, glass, { rx: cam * 0.28, ry: cam * 0.28, stroke: "#55607a", strokeWidth: w * 0.01 }),
    ...lens(cx0 + cam * 0.28, cy0 + cam * 0.28),
    ...lens(cx0 + cam * 0.28, cy0 + cam * 0.72),
    ...lens(cx0 + cam * 0.72, cy0 + cam * 0.5),
    circle(cx0 + cam * 0.75, cy0 + cam * 0.2, cam * 0.06, "#ffe9b0"),
  ], { angle });
}

/** A paper-cut "actor" (Paper Diorama style): pawn body, head with eyes looking along lookX. */
export function actor(cx, baseY, h, color, { lookX = 0, brows = 0, ink = "#2a2a2c", paper = null } = {}) {
  const sh = paper || shadow("rgba(70, 60, 45, 0.16)", 22, 0, 8);
  const bw = h * 0.46, bh = h * 0.56, top = baseY - bh, x0 = cx - bw / 2;
  const body = path(`M ${x0} ${baseY} L ${x0 + bw * 0.05} ${top + bw * 0.32} Q ${x0 + bw * 0.08} ${top} ${x0 + bw * 0.32} ${top}
    L ${x0 + bw * 0.68} ${top} Q ${x0 + bw * 0.92} ${top} ${x0 + bw * 0.95} ${top + bw * 0.32} L ${x0 + bw} ${baseY} Z`,
  { fill: color, shadow: sh });
  const r = h * 0.15, hy = top - r - h * 0.035;
  const head = circle(cx, hy, r, color, { shadow: shadow("rgba(70, 60, 45, 0.16)", 22, 0, 8) });
  const ex = r * 0.34 * lookX, er = r * 0.11;
  const parts = [body, head, circle(cx - r * 0.3 + ex, hy, er, ink), circle(cx + r * 0.3 + ex, hy, er, ink)];
  if (brows) {
    const by = hy - r * 0.32, d = r * 0.16 * brows;
    parts.push(line(cx - r * 0.46 + ex, by - d, cx - r * 0.14 + ex, by + d, ink, r * 0.07));
    parts.push(line(cx + r * 0.14 + ex, by + d, cx + r * 0.46 + ex, by - d, ink, r * 0.07));
  }
  const stand = rect(cx - bw * 0.62, baseY - 8, bw * 1.24, 18, "#c9c6bd", { rx: 9, ry: 9 });
  return { obj: group([stand, ...parts]), headTop: hy - r };
}

/** A studio microphone on a short stand. (cx, top) is the top of the capsule. */
export function mic(cx, top, s, { body = "#2a2a30", grille = "#cfd3da", accent = "#ff2e63" } = {}) {
  const w = 120 * s, h = 190 * s;
  const meshD = [];
  for (let i = 1; i < 7; i++) meshD.push(`M ${cx - w / 2 + 8 * s} ${top + i * h / 7} L ${cx + w / 2 - 8 * s} ${top + i * h / 7}`);
  return group([
    path(`M ${cx - w * 0.85} ${top + h * 0.55} L ${cx - w * 0.85} ${top + h * 0.75} C ${cx - w * 0.85} ${top + h * 1.25} ${cx + w * 0.85} ${top + h * 1.25} ${cx + w * 0.85} ${top + h * 0.75} L ${cx + w * 0.85} ${top + h * 0.55}`,
      { stroke: body, strokeWidth: 16 * s }),
    rect(cx - 9 * s, top + h * 1.12, 18 * s, h * 0.45, body),
    rect(cx - w * 0.6, top + h * 1.55, w * 1.2, 22 * s, body, { rx: 11 * s, ry: 11 * s }),
    rect(cx - w / 2, top, w, h, linear(90, ["#9aa1ad", grille, "#8a909b"]), { rx: w / 2, ry: w / 2, stroke: body, strokeWidth: 8 * s }),
    path(meshD.join(" "), { stroke: "rgba(40,40,50,0.35)", strokeWidth: 4 * s }),
    rect(cx - w / 2 - 4 * s, top + h * 0.62, w + 8 * s, 26 * s, accent, { rx: 6 * s, ry: 6 * s }),
  ]);
}

/** A tiny "Your photo" style label for drawn placeholders. */
export function placeholderTag(cx, y, label = "SWAP FOR YOUR PHOTO", { fill = "rgba(0,0,0,0.55)", size = 16 } = {}) {
  return pill(label, { x: cx, y, h: size * 2.1, size, pad: size, fill, color: "#ffffff", spacing: 180, center: true });
}
