// Text effect definitions: the defaults and the sliders for each effect, shared by the renderer
// (octext.js) and the Effects panel. An object's effects live in obj.data.effect as
// { shadow: {...}, neon: {...}, outline: {...}, background: {...}, <one look>: {...} }.
// "Layers" stack with each other (and with curve); a "look" replaces the way the letters are
// painted, so only one look is on at a time.

export const LAYERS = ["shadow", "neon", "chrome", "sticker", "outline", "background"];
export const LOOKS = ["lift", "hollow", "splice", "echo", "glitch", "extrude", "longshadow", "double"];
export const ORDER = ["shadow", "lift", "hollow", "splice", "echo", "glitch", "extrude", "longshadow", "double",
  "neon", "chrome", "sticker", "outline", "background"];

const pct = (key, label, extra = {}) => ({ key, label, min: 0, max: 100, step: 1, ...extra });
const dir = (key = "direction") => ({ key, label: "Direction", min: -180, max: 180, step: 1, unit: "°" });
const col = (key, label = "Colour", auto = false) => ({ key, label, type: "color", auto });

/** id -> { label, kind, hint, defaults, controls } */
export const EFFECTS = {
  shadow: {
    label: "Shadow", kind: "layer", hint: "A drop shadow behind the letters.",
    defaults: { offset: 50, direction: 45, blur: 0, transparency: 30, color: "#000000" },
    controls: [pct("offset", "Offset"), dir(), pct("blur", "Blur"), pct("transparency", "Transparency"), col("color")],
  },
  lift: {
    label: "Lift", kind: "look", hint: "A soft shadow that lifts the text off the page.",
    defaults: { intensity: 50 },
    controls: [pct("intensity", "Intensity")],
  },
  hollow: {
    label: "Hollow", kind: "look", hint: "Only the outline of the letters, in the text colour.",
    defaults: { thickness: 50 },
    controls: [pct("thickness", "Thickness")],
  },
  splice: {
    label: "Splice", kind: "look", hint: "An outline with an offset fill behind it.",
    defaults: { thickness: 50, offset: 50, direction: 45, color: "#ff5757" },
    controls: [pct("thickness", "Thickness"), pct("offset", "Offset"), dir(), col("color")],
  },
  echo: {
    label: "Echo", kind: "look", hint: "Fading copies of the text stacked behind it.",
    defaults: { offset: 50, direction: 45, color: null },
    controls: [pct("offset", "Offset"), dir(), col("color", "Colour", true)],
  },
  glitch: {
    label: "Glitch", kind: "look", hint: "Two colour copies, shifted apart.",
    defaults: { offset: 30, direction: 0, colorA: "#00e5ff", colorB: "#ff2bd6" },
    controls: [pct("offset", "Offset"), dir(), col("colorA", "Colour 1"), col("colorB", "Colour 2")],
  },
  neon: {
    label: "Neon", kind: "layer", hint: "A glow around the letters. Raise Tube for a lit neon core.",
    defaults: { intensity: 50, tube: 0, color: null },
    controls: [pct("intensity", "Glow"), pct("tube", "Tube"), col("color", "Glow colour", true)],
  },
  extrude: {
    label: "3D", kind: "look", hint: "Solid 3D depth behind the letters.",
    defaults: { depth: 50, direction: 50, color: null },
    controls: [pct("depth", "Depth"), dir(), col("color", "Side colour", true)],
  },
  longshadow: {
    label: "Long shadow", kind: "look", hint: "A flat shadow that runs off the letters.",
    defaults: { length: 55, direction: 45, color: null },
    controls: [pct("length", "Length"), dir(), col("color", "Colour", true)],
  },
  double: {
    label: "Neon lines", kind: "look", hint: "Two glowing tubes, like a double-line neon sign.",
    defaults: { offset: 35, direction: -135, glow: 60, color: "#8fe3ff" },
    controls: [pct("offset", "Gap"), dir(), pct("glow", "Glow"), col("color", "Second tube")],
  },
  chrome: {
    label: "Chrome", kind: "layer", hint: "Shiny metal letters. Pick gold, silver or any metal colour.",
    defaults: { shine: 60, tint: "#c9ced6" },
    controls: [pct("shine", "Shine"), col("tint", "Metal")],
  },
  sticker: {
    label: "Sticker", kind: "layer", hint: "A die-cut sticker edge around the words.",
    defaults: { thickness: 50, color: "#ffffff", edge: "#16121b", shadow: 45 },
    controls: [pct("thickness", "Thickness"), col("color", "Sticker"), col("edge", "Edge"), pct("shadow", "Shadow")],
  },
  outline: {
    label: "Outline", kind: "layer", hint: "A thick outline painted under the letters, so they stay fat.",
    defaults: { thickness: 50, color: "#000000" },
    controls: [pct("thickness", "Thickness"), col("color")],
  },
  background: {
    label: "Background", kind: "layer", hint: "A highlight box behind each line.",
    defaults: { roundness: 30, spread: 40, transparency: 0, color: "#ffde59" },
    controls: [pct("roundness", "Roundness"), pct("spread", "Spread"), pct("transparency", "Transparency"), col("color")],
  },
};

/** A clean effect object (unknown keys dropped, params filled from the defaults), or null. */
export function normalizeEffect(fx) {
  if (!fx || typeof fx !== "object") return null;
  const out = {};
  let look = null;
  for (const id of ORDER) {
    if (!fx[id]) continue;
    if (EFFECTS[id].kind === "look") {
      if (look) continue; // only one look
      look = id;
    }
    out[id] = { ...EFFECTS[id].defaults, ...fx[id] };
  }
  return Object.keys(out).length ? out : null;
}

/** Turn effect `id` on (with params) or off, returning a new effect object (never mutates). */
export function withEffect(fx, id, params) {
  const next = { ...(fx || {}) };
  if (params === null) {
    delete next[id];
  } else {
    if (EFFECTS[id].kind === "look") for (const l of LOOKS) delete next[l];
    next[id] = { ...EFFECTS[id].defaults, ...(fx?.[id] || {}), ...params };
  }
  return normalizeEffect(next);
}

// ---- geometry helpers used by the renderer (all in object units, from the font size) -----

export const outlineWidth = (p, fs) => (fs * p.thickness) / 100 * 0.26;
export const hollowWidth = (p, fs) => fs * (0.008 + (p.thickness / 100) * 0.06);
export const offsetDist = (p, fs, k = 0.2) => (fs * p.offset) / 100 * k;
export const dirVec = (deg, d) => [Math.cos((deg * Math.PI) / 180) * d, Math.sin((deg * Math.PI) / 180) * d];
export const shadowBlur = (p, fs) => (fs * p.blur) / 100 * 0.45;
export const bgPad = (p, fs) => fs * (0.06 + (p.spread / 100) * 0.4);
export const extrudeDist = (p, fs) => fs * 0.22 * (p.depth / 100);
export const longDist = (p, fs) => fs * 1.3 * (p.length / 100);
export const stickerWidth = (p, fs) => fs * (0.1 + (p.thickness / 100) * 0.34);
export const stickerEdge = (fs) => fs * 0.035;
export const tubeWidth = (fs) => fs * 0.04;

/** How far (object units) the effects can paint outside the text box, for the cache canvas. */
export function effectPad(fx, fs) {
  if (!fx) return 0;
  let pad = 0;
  if (fx.outline) pad = Math.max(pad, outlineWidth(fx.outline, fs) / 2 + 2);
  const ow = fx.outline ? outlineWidth(fx.outline, fs) / 2 : 0;
  if (fx.shadow) pad = Math.max(pad, offsetDist(fx.shadow, fs) + shadowBlur(fx.shadow, fs) * 1.6 + ow);
  if (fx.lift) pad = Math.max(pad, fs * 0.5);
  if (fx.hollow) pad = Math.max(pad, hollowWidth(fx.hollow, fs));
  if (fx.splice) pad = Math.max(pad, offsetDist(fx.splice, fs) + hollowWidth(fx.splice, fs) + ow);
  if (fx.echo) pad = Math.max(pad, offsetDist(fx.echo, fs, 0.3) * 2 + ow);
  if (fx.glitch) pad = Math.max(pad, offsetDist(fx.glitch, fs, 0.12) + ow);
  if (fx.neon) pad = Math.max(pad, fs * 0.9 + ow);
  if (fx.background) pad = Math.max(pad, bgPad(fx.background, fs) + 2);
  if (fx.extrude) pad = Math.max(pad, extrudeDist(fx.extrude, fs) + ow);
  if (fx.longshadow) pad = Math.max(pad, longDist(fx.longshadow, fs) + ow);
  if (fx.double) pad = Math.max(pad, offsetDist(fx.double, fs, 0.32) + fs * (0.15 + fx.double.glow / 100 * 0.5));
  if (fx.sticker) pad = Math.max(pad, stickerWidth(fx.sticker, fs) / 2 + stickerEdge(fs) + fs * 0.12 * (1 + fx.sticker.shadow / 100) + ow);
  return Math.ceil(pad + 2);
}
