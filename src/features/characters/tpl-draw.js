// Drawing helpers for the Oddly Clever template pack: the night street (brick, light pools,
// wet street, rain), neon signs, paper labels, the gold crown and big outlined thumbnail type.
// The basic shape helpers are copied from templates/draw.js (read-only for this feature).
import { Circle, Ellipse, Gradient, Group, Path, Point, Polygon, Rect, Shadow } from "fabric";
import { OcText } from "../text/octext.js";
import { makePlaced, headLocal, toPagePoint } from "./character.js";

export const C = {
  night: "#0d0a10", ink: "#16121b", pink: "#ff2e7e", gold: "#ffc83d", cyan: "#8fe3ff",
  paper: "#f3ead8", amber: "#ffb15c", brick: "#4a2224", brickDark: "#241012", white: "#ffffff",
};
const TL = { originX: "left", originY: "top" };

// ---- basics (from templates/draw.js) ---------------------------------------------------------

function stopsOf(stops) {
  return stops.map((s, i) => (Array.isArray(s)
    ? { offset: s[0], color: s[1] }
    : { offset: stops.length === 1 ? 0 : i / (stops.length - 1), color: s }));
}
/** angle is CSS-like: 0 = to top, 90 = to right, 180 = to bottom. */
export function linear(angle, stops) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a) / 2, dy = -Math.cos(a) / 2;
  return new Gradient({ type: "linear", gradientUnits: "percentage",
    coords: { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy }, colorStops: stopsOf(stops) });
}
export function radial(stops, { cx = 0.5, cy = 0.5, r = 0.5 } = {}) {
  return new Gradient({ type: "radial", gradientUnits: "percentage",
    coords: { x1: cx, y1: cy, r1: 0, x2: cx, y2: cy, r2: r }, colorStops: stopsOf(stops) });
}
export const shadow = (color, blur, x = 0, y = 0) => new Shadow({ color, blur, offsetX: x, offsetY: y });
export const rect = (x, y, w, h, fill, o = {}) => new Rect({ ...TL, left: x, top: y, width: w, height: h, fill, strokeWidth: 0, ...o });
export const circle = (cx, cy, r, fill, o = {}) => new Circle({ originX: "center", originY: "center", left: cx, top: cy, radius: r, fill, strokeWidth: 0, ...o });
export const ellipse = (cx, cy, rx, ry, fill, o = {}) => new Ellipse({ originX: "center", originY: "center", left: cx, top: cy, rx, ry, fill, strokeWidth: 0, ...o });
export const poly = (pts, fill, o = {}) => new Polygon(pts.map(([x, y]) => ({ x, y })), { fill, strokeWidth: 0, ...o });
export const path = (d, o = {}) => new Path(d, { fill: null, strokeLineCap: "round", strokeLineJoin: "round", ...o });
export const group = (objs, o = {}) => new Group(objs, { subTargetCheck: false, interactive: false, ...o });
export function text(str, { x = 0, y = 0, w = 600, size = 48, font = "Inter", weight = 400, color = "#111111", align = "left", ...rest } = {}) {
  return new OcText(str, { ...TL, left: x, top: y, width: w, fontSize: size, fontFamily: font, fontWeight: weight, fill: color,
    textAlign: align, lineHeight: 1, splitByGrapheme: false, ...rest });
}
/** Full-page objects stretch (instead of fitting) when the template lands on another page size. */
export function bleed(obj) {
  obj.set("data", { ...(obj.data || {}), tpBleed: true });
  return obj;
}
export const putter = ({ editor }) => (obj, name) => editor.add(obj, { center: false, select: false, name });

// A tiny seeded random, so a template draws the same every time.
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296;
}

// ---- the night street ------------------------------------------------------------------------

/** A brick wall: base gradient, staggered mortar, a few lighter and darker bricks. */
export function brickWall(put, x, y, w, h, { brick = 64, seed = 7, top = C.brick, bottom = C.brickDark } = {}) {
  const bh = brick * 0.42, rnd = seeded(seed);
  put(bleed(rect(x, y, w, h, linear(180, [top, [0.65, "#331618"], [1, bottom]]))), "Brick wall");
  let mortar = "", lit = "", dark = "", edge = "";
  for (let r = 0, yy = y; yy < y + h; r++, yy += bh) {
    mortar += `M ${x} ${yy} L ${x + w} ${yy} `;
    const off = r % 2 ? brick / 2 : 0;
    for (let xx = x - off; xx < x + w; xx += brick) {
      if (xx > x) mortar += `M ${xx} ${yy} L ${xx} ${Math.min(yy + bh, y + h)} `;
      const v = rnd();
      const bx = Math.max(x, xx + 3), bw = Math.min(xx + brick, x + w) - bx - 3;
      if (bw <= 4) continue;
      const cell = `M ${bx} ${yy + 3} h ${bw} v ${bh - 6} h ${-bw} Z `;
      if (v < 0.16) lit += cell;
      else if (v > 0.84) dark += cell;
      if (rnd() < 0.5) edge += `M ${bx + 2} ${yy + 4} L ${bx + bw - 2} ${yy + 4} `;
    }
  }
  if (lit) put(bleed(path(lit, { fill: "rgba(255,190,150,0.07)", strokeWidth: 0 })), "Brick tint");
  if (dark) put(bleed(path(dark, { fill: "rgba(0,0,0,0.16)", strokeWidth: 0 })), "Brick tint");
  put(bleed(path(edge, { stroke: "rgba(255,210,180,0.06)", strokeWidth: 2 })), "Brick edges");
  put(bleed(path(mortar, { stroke: "rgba(10,4,6,0.55)", strokeWidth: Math.max(2, brick * 0.07), strokeLineCap: "butt" })), "Mortar");
}

/** A soft pool of light (a radial gradient ellipse). */
export function glow(put, cx, cy, rx, ry, color, alpha = 0.45, name = "Light") {
  const rgba = (a) => hexA(color, a);
  put(ellipse(cx, cy, rx, ry, radial([rgba(alpha), [0.45, rgba(alpha * 0.45)], [1, rgba(0)]])), name);
}
export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** The wet street: a dark band, a kerb, and coloured light streaks reflected in it. */
export function wetStreet(put, x, y, w, h, reflections = []) {
  put(bleed(rect(x, y, w, h, linear(180, ["#17121c", [0.25, "#0d0a10"], [1, "#050407"]]))), "Street");
  put(bleed(rect(x, y, w, Math.max(6, h * 0.035), "#2a2230")), "Kerb");
  for (const [cx, rw, color, a = 0.32] of reflections) {
    put(ellipse(cx, y + h * 0.62, rw / 2, h * 0.6, radial([hexA(color, Math.min(1, a * 1.4)), [0.4, hexA(color, a * 0.6)], [1, hexA(color, 0)]])), "Reflection");
  }
}

/** Rain: one path of thin slanted streaks. */
export function rain(put, x, y, w, h, { n = 140, len = 26, seed = 3, alpha = 0.14 } = {}) {
  const rnd = seeded(seed);
  let d = "";
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w, py = y + rnd() * h, l = len * (0.6 + rnd() * 0.8);
    d += `M ${px.toFixed(1)} ${py.toFixed(1)} l ${(-l * 0.22).toFixed(1)} ${l.toFixed(1)} `;
  }
  put(bleed(path(d, { stroke: `rgba(205,225,255,${alpha})`, strokeWidth: Math.max(1.5, len * 0.07) })), "Rain");
}

/** Darken the edges of the frame. */
export function vignette(put, W, H, strength = 0.72) {
  put(bleed(rect(0, 0, W, H, radial(["rgba(0,0,0,0)", [0.55, "rgba(0,0,0,0)"], [1, `rgba(0,0,0,${strength})`]], { r: 0.72 }))), "Vignette");
}

// ---- type ------------------------------------------------------------------------------------

/** Neon sign text: a lit tube with a coloured glow. */
export function neon(str, { color = C.pink, core = "#ffe3ee", glowBlur = 34, ...o } = {}) {
  return text(str, { color: core, ...o, stroke: color, strokeWidth: Math.max(2, (o.size || 48) * 0.035), paintFirst: "stroke",
    shadow: shadow(color, glowBlur), data: { effect: { neon: { intensity: 70, tube: 40, color } } } });
}

/** Big thumbnail type: heavy, with a fat ink outline under the fill and a hard drop. */
export function punch(str, { size = 120, color = C.white, outline = C.ink, ow = null, font = "Archivo Black", ...o } = {}) {
  return text(str, { size, font, weight: 400, color, stroke: outline, strokeWidth: ow ?? size * 0.14, paintFirst: "stroke",
    strokeLineJoin: "round", lineHeight: 0.92, shadow: shadow("rgba(0,0,0,0.55)", 0, size * 0.04, size * 0.06), ...o });
}

/** A torn paper label with wide-tracked ink type, rotated. Returns a group centred on (cx, cy). */
export function paperLabel(str, { cx, cy, size = 30, angle = -3, pad = 26, color = C.paper, ink = C.ink, seed = 5,
  font = "Archivo Black", spacing = 260 } = {}) {
  const t = text(str, { x: 0, y: 0, w: 4000, size, font, weight: 400, color: ink, charSpacing: spacing });
  const tw = Math.ceil(t.calcTextWidth?.() ?? t.width);
  t.set({ width: tw + 6 });
  t.initDimensions();
  const w = tw + pad * 2, h = t.height + pad * 1.1, rnd = seeded(seed);
  const pts = [];
  const steps = Math.max(8, Math.round(w / 26));
  for (let i = 0; i <= steps; i++) pts.push([(w * i) / steps, (rnd() - 0.5) * size * 0.16]);
  for (let i = steps; i >= 0; i--) pts.push([(w * i) / steps, h + (rnd() - 0.5) * size * 0.16]);
  const paper = poly(pts, color, { shadow: shadow("rgba(0,0,0,0.5)", size * 0.6, 0, size * 0.25) });
  paper.set({ left: 0, top: 0, originX: "left", originY: "top" });
  t.set({ left: pad, top: (h - t.height) / 2 + size * 0.05 });
  const g = group([paper, t]);
  g.set({ originX: "center", originY: "center", left: cx, top: cy, angle });
  return g;
}

// ---- props -----------------------------------------------------------------------------------

/** The gold crown from the channel avatar: three points with ball tips and a jewel. */
export function crown(cx, cy, size, angle = 16) {
  const s = size / 100, sw = 6 * s;
  const body = poly([[-50, 20], [-56, -36], [-26, -6], [0, -48], [26, -6], [56, -36], [50, 20]].map(([x, y]) => [x * s, y * s]), C.gold,
    { stroke: C.ink, strokeWidth: sw, strokeLineJoin: "round" });
  const band = rect(-52 * s, 12 * s, 104 * s, 20 * s, "#e0a92a", { stroke: C.ink, strokeWidth: sw, rx: 3 * s, ry: 3 * s });
  const balls = [[-56, -40], [0, -54], [56, -40]].map(([x, y]) => circle(x * s, y * s, 9 * s, "#ffe08a", { stroke: C.ink, strokeWidth: sw * 0.8 }));
  const jewel = circle(0, 22 * s, 6 * s, C.pink, { stroke: C.ink, strokeWidth: sw * 0.6 });
  const shine = path(`M ${-30 * s} ${-4 * s} L ${-40 * s} ${-22 * s}`, { stroke: "rgba(255,255,255,0.75)", strokeWidth: 5 * s });
  const g = group([body, band, ...balls, jewel, shine]);
  g.set({ originX: "center", originY: "center", left: cx, top: cy, angle });
  return g;
}

/** A thick slanted slash (the avatar's pink stripe). */
export function slash(put, x, y, w, h, lean, fill, name = "Slash") {
  put(poly([[x + lean, y], [x + w + lean, y], [x + w, y + h], [x, y + h]], fill), name);
}

/** A dashed placeholder (end-screen video slots). Never exported. */
export function guideBox(put, x, y, w, h, label, { rx = 18, size = 26 } = {}) {
  const data = { guide: true };
  put(rect(x, y, w, h, "rgba(255,255,255,0.04)", { rx, ry: rx, stroke: "rgba(255,255,255,0.55)", strokeWidth: 4,
    strokeDashArray: [18, 12], data }), `${label} (not exported)`);
  put(text(label.toUpperCase(), { x, y: y + h / 2 - size / 2, w, size, font: "Inter", weight: 800, color: "rgba(255,255,255,0.7)",
    align: "center", charSpacing: 220, data }), `${label} label (not exported)`);
}

// ---- cast ------------------------------------------------------------------------------------

/**
 * Put a cast member on the page: feet (or head) at `at`, `height` px tall. Resolves to the object
 * plus its head centre and head radius on the page (for props like the crown).
 */
export async function castMember(put, params, opts) {
  const g = await makePlaced(params, opts);
  put(g, g.name);
  const head = toPagePoint(g, headLocal(g));
  return { g, head: new Point(head.x, head.y), r: 128 * g.scaleX };
}
