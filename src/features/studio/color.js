// Small colour helpers for the studio: parse, luminance, WCAG contrast and hue shifts.
import { Color } from "fabric";

/** Any CSS colour to {r, g, b, a} (0–255, a 0–1), or null when it can't be read. */
export function parseColor(c) {
  if (typeof c !== "string" || !c || c === "transparent" || c === "none") return null;
  try {
    const [r, g, b, a] = new Color(c).getSource();
    return { r, g, b, a: a ?? 1 };
  } catch {
    return null;
  }
}

/** The colour a fill shows on average: a solid colour, or the mean of a gradient's stops. */
export function fillColor(fill) {
  if (typeof fill === "string") return parseColor(fill);
  const stops = fill?.colorStops;
  if (!Array.isArray(stops) || !stops.length) return null;
  const list = stops.map((s) => parseColor(s.color)).filter(Boolean);
  if (!list.length) return null;
  const avg = (k) => list.reduce((t, c) => t + c[k], 0) / list.length;
  return { r: avg("r"), g: avg("g"), b: avg("b"), a: avg("a") };
}

const lin = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of {r, g, b}. */
export const luminance = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);

/** WCAG contrast ratio between two luminances (1–21). */
export const contrastOf = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

export const contrast = (a, b) => contrastOf(luminance(a), luminance(b));

function rgbToHsl({ r, g, b }) {
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

function hslToRgb({ h, s, l }) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

const hex2 = (v) => Math.round(v).toString(16).padStart(2, "0");

/** A CSS colour turned `deg` degrees round the colour wheel (greys stay as they are). */
export function shiftHue(c, deg) {
  const p = parseColor(c);
  if (!p) return c;
  const hsl = rgbToHsl(p);
  if (hsl.s < 0.08) return c;
  const { r, g, b } = hslToRgb({ ...hsl, h: (hsl.h + deg + 360) % 360 });
  return p.a < 1 ? `rgba(${r},${g},${b},${+p.a.toFixed(3)})` : `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

export const toCss = ({ r, g, b }) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
