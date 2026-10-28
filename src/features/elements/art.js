// A tiny drawing kit for our paper-cut sticker illustrations (our own artwork, CC0).
// Every illustration is a list of parts drawn in a 200 x 200 box. The renderer draws them
// twice: first a white die-cut backing (each outlined part with a fat white stroke), then the
// art itself with one heavy ink outline. Flat parts (shades, highlights) get no outline.
// The output is plain SVG markup, so it previews in the panel and loads as a recolourable group.

export const INK = "#16121b";
/** The die-cut backing. Art never uses pure white, so this colour stays its own swatch. */
export const CUT = "#ffffff";

/** The house palette: the Oddly Clever brand colours plus a few helpers. Each has a shade. */
export const P = {
  pink: "#ff2e7e", pinkDk: "#c8155c",
  gold: "#ffc83d", goldDk: "#e0991a",
  cyan: "#8fe3ff", cyanDk: "#3fb1dc",
  paper: "#f3ead8", paperDk: "#d8c7a6",
  white: "#fbf7ee", whiteDk: "#ddd5c4",
  green: "#3ddc84", greenDk: "#1f9e57",
  brick: "#d0573c", brickDk: "#963622",
  amber: "#ff9f1c", amberDk: "#d56f00",
  purple: "#8b5cf6", purpleDk: "#5b34c4",
  red: "#ff4141", redDk: "#c01f2c",
  night: "#2b2433", nightDk: "#1d1824",
  steel: "#9aa3b5", steelDk: "#66708a",
  skin: "#f2b48c", skinDk: "#cf8a62",
  ink: INK,
};

const OUT = 6; // ink outline width
const BACK = 11; // white border width outside the outline

const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const attrs = (o) => Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => `${k}="${esc(v)}"`).join(" ");

/**
 * An outlined part: any SVG element (path, circle, rect, ellipse, polygon) with a fill.
 * @param {string} tag
 * @param {object} a geometry attributes
 * @param {string} fill
 * @param {{w?: number, back?: boolean}} [o] w = outline width; back = false keeps it out of the die-cut
 */
export const part = (tag, a, fill, o = {}) => ({ tag, a, fill, w: o.w ?? OUT, back: o.back ?? true, kind: "part" });
/** An outlined path. */
export const shape = (d, fill, o) => part("path", { d }, fill, o);
export const circle = (cx, cy, r, fill, o) => part("circle", { cx, cy, r }, fill, o);
export const ellipse = (cx, cy, rx, ry, fill, o) => part("ellipse", { cx, cy, rx, ry }, fill, o);
export const rect = (x, y, width, height, rx, fill, o) => part("rect", { x, y, width, height, rx, ry: rx }, fill, o);
/** A flat part with no outline (shade, highlight, shine), never part of the die-cut. */
export const flat = (d, fill, o = {}) => ({ tag: o.tag || "path", a: o.tag ? o.a : { d }, fill, kind: "flat", opacity: o.opacity });
export const flatCircle = (cx, cy, r, fill) => ({ tag: "circle", a: { cx, cy, r }, fill, kind: "flat" });
/** An ink line (stroke only). w = width; back = include it in the die-cut (for parts that stick out). */
export const line = (d, o = {}) => ({ tag: "path", a: { d }, kind: "line", w: o.w ?? OUT, color: o.color || INK, back: o.back ?? false, cap: o.cap || "round" });
/** Group parts with a transform, e.g. rotate(-10 100 100). */
export const g = (transform, ...parts) => ({ kind: "group", transform, parts: parts.flat() });

function backing(p) {
  if (p.kind === "group") {
    const inner = p.parts.map(backing).join("");
    return inner ? `<g transform="${esc(p.transform)}">${inner}</g>` : "";
  }
  if (!p.back) return "";
  if (p.kind === "line") {
    return `<${p.tag} ${attrs(p.a)} fill="none" stroke="${CUT}" stroke-width="${p.w + BACK * 2}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (p.kind === "part") {
    return `<${p.tag} ${attrs(p.a)} fill="${CUT}" stroke="${CUT}" stroke-width="${p.w + BACK * 2}" stroke-linejoin="round"/>`;
  }
  return "";
}

function art(p) {
  if (p.kind === "group") return `<g transform="${esc(p.transform)}">${p.parts.map(art).join("")}</g>`;
  if (p.kind === "line") {
    return `<${p.tag} ${attrs(p.a)} fill="none" stroke="${p.color}" stroke-width="${p.w}" stroke-linecap="${p.cap}" stroke-linejoin="round"/>`;
  }
  if (p.kind === "flat") return `<${p.tag} ${attrs(p.a)} fill="${p.fill}"${p.opacity != null ? ` opacity="${p.opacity}"` : ""}/>`;
  return `<${p.tag} ${attrs(p.a)} fill="${p.fill}" stroke="${INK}" stroke-width="${p.w}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

/**
 * Render parts as a paper-cut sticker. `cut: false` skips the white die-cut border.
 * @param {Array} parts
 * @param {{cut?: boolean, tilt?: number, box?: string}} [o]
 */
export function paperCut(parts, { cut = true, tilt = 0, box = "0 0 200 200" } = {}) {
  const list = parts.flat();
  const [, , w, h] = box.split(" ").map(Number);
  const body = `${cut ? list.map(backing).join("") : ""}${list.map(art).join("")}`;
  const inner = tilt ? `<g transform="rotate(${tilt} ${w / 2} ${h / 2})">${body}</g>` : body;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${w}" height="${h}">${inner}</svg>`;
}

/** Points on a spiky star, as an SVG points/path string. */
export function starPoints(cx, cy, outer, inner, n = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / n;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/** A rounded star burst path (many short points), for badges and bangs. */
export function burstPath(cx, cy, outer, inner, n = 16, rot = 0) {
  return starPoints(cx, cy, outer, inner, n, rot - Math.PI / 2);
}

/** A seeded random generator, so drawings come out the same every time. */
export function rng(seed = 1) {
  let s = Math.imul(seed | 0, 2654435761) >>> 0 || 1;
  const next = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 6; i++) next();
  return next;
}
