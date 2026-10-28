// The Oddly Clever cast: who they are, and characterSVG(params), which draws one of them as a
// complete <svg> whose viewBox is fitted to the figure. The drawing itself is the user's own
// approved rigs (rigs/), unchanged. The cast and its art are the user's property: all rights
// reserved (see ASSETS.md).
import { HEROES2 } from "./rigs/heroes2.js";
import { STICK } from "./rigs/stick.js";

/** Card colours come from the approved cast sheet (hero_choices_v2.png). */
export const CAST = [
  { who: "sparks", name: "Sparks", line: "The reckless one", expr: "smug", headY: -470,
    acc: "#e8343c", a: "#2a1418", b: "#0a0608" },
  { who: "brick", name: "Brick", line: "The unbothered one", expr: "grin", headY: -440,
    acc: "#ffc21a", a: "#0f2e20", b: "#050e0a" },
  { who: "milo", name: "Milo", line: "The nervous wreck", expr: "worried", headY: -430,
    acc: "#ff7a1a", a: "#2e1a0c", b: "#0e0804" },
  { who: "rae", name: "Rae", line: "The troublemaker", expr: "smug", headY: -500,
    acc: "#ff2fa0", a: "#121c3a", b: "#050814" },
  { who: "keeper", name: "The Keeper", line: "The hooded memory dealer", expr: "grin", headY: -390,
    acc: "#8fe3ff", a: "#14183a", b: "#05060f" },
];
export const castOf = (who) => CAST.find((c) => c.who === who) || CAST[0];

export const EXPRS = [
  { id: "smug", label: "Smug" },
  { id: "worried", label: "Worried" },
  { id: "shock", label: "Shock" },
  { id: "grin", label: "Grin" },
];

/** Where the eyes point. "Ahead" is the rig's own default. */
export const LOOKS = [
  { id: "ahead", label: "Ahead", look: [0.35, 0] },
  { id: "back", label: "Back", look: [-0.6, 0] },
  { id: "up", label: "Up", look: [0.2, -0.7] },
  { id: "down", label: "Down", look: [0.2, 0.7] },
  { id: "you", label: "At you", look: [0, 0] },
];

// The Keeper's rig has eyes (0 shut .. 1 open) and a grin (0 .. 1) instead of named expressions.
const KEEPER_FACE = {
  smug: { eye: 0.55, grin: 0.7 },
  worried: { eye: 0.75, grin: 0 },
  shock: { eye: 1, grin: 0.25 },
  grin: { eye: 1, grin: 1 },
};

// Figure-space bounds [x0, y0, x1, y1] (feet at 0,0, facing +x), measured with getBBox over every
// expression and look (tools/ch_bounds.mjs). The stroke pad is added on top.
const BOUNDS = {
  sparks: [-424, -720, 141, 9], "sparks:head": [-251, -720, 141, -281],
  brick: [-178, -638, 174, 8], "brick:head": [-136, -638, 137, -310],
  milo: [-188, -630, 183, 9], "milo:head": [-171, -630, 174, -293],
  rae: [-221, -646, 168, 8], "rae:head": [-221, -646, 121, -364],
  keeper: [-200, -595, 200, 40], "keeper:head": [-148, -595, 150, -170],
};
const STROKE_PAD = 10;
/** The die-cut sticker edge, in figure units (a head is about 256 across). */
export const STICKER_EDGE = 15;

/** A complete, valid parameter set from anything (saved data, a drop, a template). */
export function normalize(p = {}) {
  const c = castOf(p.who);
  const expr = EXPRS.some((e) => e.id === p.expr) ? p.expr : c.expr;
  const look = Array.isArray(p.look) && p.look.length === 2 && p.look.every((v) => Number.isFinite(v))
    ? [Math.max(-1, Math.min(1, p.look[0])), Math.max(-1, Math.min(1, p.look[1]))] : [0.35, 0];
  return { who: c.who, expr, dir: p.dir === -1 ? -1 : 1, head: Boolean(p.head), look, sticker: Boolean(p.sticker) };
}

/** The rig markup for a figure with its feet at (0, 0). */
function figure(p) {
  if (p.who === "keeper") return STICK.draw({ who: "keeper", x: 0, y: 0, s: 1, dir: p.dir, head: p.head, ...KEEPER_FACE[p.expr] });
  return HEROES2.draw({ who: p.who, x: 0, y: 0, s: 1, dir: p.dir, expr: p.expr, look: p.look, head: p.head, t: 0 });
}

const SHAPE = /<(path|circle|ellipse|rect|line)\b([^>]*?)\/>/g;
const PAINT_ATTRS = /\s(fill|stroke|stroke-width|stroke-linejoin|stroke-linecap|opacity)="[^"]*"/g;

/** The white die-cut backing: every shape again, all white, with a fat white stroke. */
function stickerBacking(markup, edge) {
  return markup.replace(/<defs>[\s\S]*?<\/defs>/g, "").replace(SHAPE, (_, tag, attrs) => {
    const sw = Number(/\sstroke-width="([\d.]+)"/.exec(attrs)?.[1]) || 0;
    const stroked = /\sstroke="(?!none)[^"]+"/.test(attrs);
    const hollow = tag === "line" || /\sfill="none"/.test(attrs);
    const base = attrs.replace(PAINT_ATTRS, "");
    return `<${tag}${base} fill="${hollow ? "none" : "#ffffff"}" stroke="#ffffff" stroke-width="${(stroked ? sw : 0) + edge * 2}" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
}

/**
 * One cast member as a standalone SVG document, its viewBox fitted to the figure.
 * @param {{who?: string, expr?: string, dir?: number, head?: boolean, look?: number[], sticker?: boolean}} params
 * @returns {{ svg: string, box: {x: number, y: number, w: number, h: number} }} box = the viewBox
 *   (figure units, so the feet point is at (-box.x, -box.y) in the SVG's pixel space)
 */
export function characterSVG(params) {
  const p = normalize(params);
  const [bx0, by0, bx1, by1] = BOUNDS[`${p.who}${p.head ? ":head" : ""}`];
  const pad = STROKE_PAD + (p.sticker ? STICKER_EDGE + 2 : 0);
  const [x0, x1] = p.dir === -1 ? [-bx1, -bx0] : [bx0, bx1];
  const box = { x: Math.floor(x0 - pad), y: Math.floor(by0 - pad), w: 0, h: 0 };
  box.w = Math.ceil(x1 + pad) - box.x;
  box.h = Math.ceil(by1 + pad) - box.y;
  const art = figure(p);
  const backing = p.sticker ? `<g>${stickerBacking(art, STICKER_EDGE)}</g>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.w}" height="${box.h}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}">${backing}${art}</svg>`;
  return { svg, box };
}

/** characterSVG as a data: URL, for <img> thumbnails in the UI. */
export function characterDataURL(params) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(characterSVG(params).svg)}`;
}
