// Colour maths for the styles feature: parsing CSS colours, HSL, mixing, WCAG contrast.
// Colours travel as { r, g, b, a } (0..255, alpha 0..1) and come back out as hex / rgba().

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/** Parse "#rgb", "#rrggbb", "#rrggbbaa", "rgb()/rgba()" into {r,g,b,a}, or null. */
export function parse(c) {
  if (typeof c !== "string") return null;
  const s = c.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) {
    const [r, g, b] = [...m[1]].map((x) => parseInt(x + x, 16));
    return { r, g, b, a: 1 };
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (m) {
    let a = m[4] == null ? 1 : parseFloat(m[4]);
    if (m[4]?.endsWith("%")) a /= 100;
    return { r: +m[1], g: +m[2], b: +m[3], a: clamp(a) };
  }
  if (s === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (s === "black") return { r: 0, g: 0, b: 0, a: 1 };
  return null;
}

const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");

/** "#rrggbb" of a colour (alpha ignored). */
export const hexOf = ({ r, g, b }) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

/** CSS string: hex when opaque, rgba() otherwise. */
export function cssOf({ r, g, b, a = 1 }) {
  if (a >= 0.999) return hexOf({ r, g, b });
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.round(a * 1000) / 1000})`;
}

/** {h: 0..360, s: 0..1, l: 0..1} */
export function toHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function fromHsl({ h, s, l }, a = 1) {
  h = ((h % 360) + 360) % 360 / 360;
  s = clamp(s);
  l = clamp(l);
  if (!s) return { r: l * 255, g: l * 255, b: l * 255, a };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: f(h + 1 / 3) * 255, g: f(h) * 255, b: f(h - 1 / 3) * 255, a };
}

/** Mix two colours (t = 0 gives a, 1 gives b). */
export function mix(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: a.a ?? 1 };
}

/** Shift lightness by d (-1..1), keeping hue and saturation. */
export function shade(c, d) {
  const hsl = toHsl(c);
  return fromHsl({ ...hsl, l: clamp(hsl.l + d) }, c.a ?? 1);
}

/** Relative luminance (WCAG). */
export function luminance({ r, g, b }) {
  const ch = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG contrast ratio, 1..21. */
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** True for greys, near-black and near-white (colours with no real hue). */
export function isNeutral(c) {
  const { s, l } = toHsl(c);
  return s < 0.16 || l < 0.07 || l > 0.96;
}

/** Hex helpers for palette data. */
export const P = (hex) => parse(hex);
