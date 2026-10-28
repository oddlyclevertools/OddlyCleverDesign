// The animation catalogue: intros/outros, text-only reveals, loops, speeds and page presets.
// Each motion is a pure function of progress p (0 = hidden, 1 = at rest) that returns a partial
// visual state. At p = 1 every motion is the identity, so objects end exactly where they began.
import {
  clamp01, hash01, inCubic, inOutCubic, outBack, outBounce, outCubic, outExpo, spring,
} from "./easing.js";

/** Speed presets scale a motion's base duration (and a loop's period). */
export const SPEEDS = [
  { id: "slow", label: "Slow", k: 1.6 },
  { id: "medium", label: "Medium", k: 1 },
  { id: "fast", label: "Fast", k: 0.6 },
];
export const speedK = (id) => SPEEDS.find((s) => s.id === id)?.k ?? 1;

const between = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const appear = (p, k = 3) => clamp01(p * k);

// g = geometry: { w, h } of the object, { pw, ph } of the page, D = the page's short side.
const riseDist = (g) => between(g.h * 0.25, g.D * 0.04, g.D * 0.15);
const dropDist = (g) => between(g.h * 0.5, g.D * 0.08, g.D * 0.3);

const FLICKER = [0, 1, 0, 0, 0.9, 0.15, 1, 0, 0.6, 1, 0.25, 1, 1, 0.7, 1, 1];

/**
 * Intro/outro motions. fn(p, g, s): s = 1 for an intro, -1 for an outro (an exit keeps
 * travelling the same way instead of reversing). `base` is the duration in seconds at Medium.
 */
export const MOTIONS = {
  fade: { label: "Fade", base: 0.6, fn: (p) => ({ op: outCubic(p) }) },
  rise: { label: "Rise", base: 0.7, fn: (p, g, s) => ({ dy: s * (1 - outCubic(p)) * riseDist(g), op: outCubic(appear(p, 1.6)) }) },
  drop: { label: "Drop", base: 0.8, fn: (p, g, s) => ({ dy: -s * (1 - outBack(p, 1.3)) * dropDist(g), op: appear(p) }) },
  "pan-left": { label: "Pan left", base: 0.8, fn: (p, g, s) => ({ dx: s * (1 - outExpo(p)) * g.pw * 0.22, op: outCubic(appear(p, 2)) }) },
  "pan-right": { label: "Pan right", base: 0.8, fn: (p, g, s) => ({ dx: -s * (1 - outExpo(p)) * g.pw * 0.22, op: outCubic(appear(p, 2)) }) },
  pop: { label: "Pop", base: 0.65, fn: (p) => { const k = spring(p); return { sx: k, sy: k, op: appear(p, 4) }; } },
  zoom: { label: "Zoom", base: 0.9, fn: (p) => { const k = 1 + (1 - outExpo(p)) * 0.45; return { sx: k, sy: k, op: outCubic(p) }; } },
  wipe: { label: "Wipe", base: 0.8, fn: (p, g, s) => ({ clip: { type: "wipe", dir: s, p: inOutCubic(p) }, dx: -s * (1 - outExpo(p)) * g.w * 0.03 }) },
  blur: {
    label: "Blur in", base: 0.9,
    fn: (p, g) => { const e = outCubic(p), k = 1 + 0.08 * (1 - e); return { blur: (1 - e) * between(g.D * 0.06, 8, 60), op: e, sx: k, sy: k }; },
  },
  tumble: {
    label: "Tumble", base: 0.9,
    fn: (p, g, s) => { const e = outBack(p, 1.4), k = 0.2 + 0.8 * e; return { rot: -s * (1 - e) * 120, sx: k, sy: k, op: appear(p) }; },
  },
  spin: {
    label: "Spin", base: 1,
    fn: (p, g, s) => { const e = outExpo(p), k = 0.3 + 0.7 * e; return { rot: -s * (1 - e) * 360, sx: k, sy: k, op: appear(p, 2.5) }; },
  },
  bounce: { label: "Bounce", base: 1.1, fn: (p, g, s) => ({ dy: -s * (1 - outBounce(p)) * dropDist(g), op: appear(p, 5) }) },
  flicker: {
    label: "Neon flicker", base: 1.1,
    fn: (p) => (p >= 0.88 ? { op: 1 } : { op: FLICKER[Math.min(FLICKER.length - 1, Math.floor((p / 0.88) * FLICKER.length))] }),
  },
  stomp: {
    label: "Stomp", base: 0.7,
    fn: (p, g) => {
      const split = 0.5;
      if (p < split) {
        const q = p / split, k = 1 + (1 - inCubic(q)) * 1.4;
        return { sx: k, sy: k, op: appear(q) };
      }
      const q = (p - split) / (1 - split), damp = Math.sin(q * Math.PI * 2) * (1 - q);
      return { sx: 1 + 0.1 * damp, sy: 1 - 0.13 * damp, dx: Math.sin(q * Math.PI * 7) * (1 - q) * g.D * 0.012 };
    },
  },
  "slide-settle": {
    label: "Slide & settle", base: 1,
    fn: (p, g, s) => ({
      dx: -s * (1 - outBack(p, 1.1)) * g.pw * 0.45,
      rot: s * (1 - outBack(p, 2.4)) * -7,
      skewX: s * (1 - outCubic(p)) * -14,
      op: appear(p),
    }),
  },
};

/** Text-only reveals: the object stays put and each letter/word animates (see stateAt). */
export const TEXT_MOTIONS = {
  typewriter: { label: "Typewriter", base: 1.4, fallback: "wipe" },
  words: { label: "Word by word", base: 1.2, fallback: "rise" },
  letters: { label: "Letter pop", base: 1.2, fallback: "pop" },
  baseline: { label: "Baseline rise", base: 1, fallback: "rise" },
};

/** Per-character state for a text reveal. k = char, wi = word, of n chars / nw words. */
export function charState(type, p, { k, n, wi, nw, line, fs, lineH }) {
  const stagger = (i, count, span) => {
    const start = count > 1 ? (i / (count - 1)) * (1 - span) : 0;
    return clamp01((p - start) / span);
  };
  if (type === "typewriter") {
    return { a: p * n > k + 0.35 ? 1 : 0 };
  }
  if (type === "words") {
    const q = stagger(wi, nw, 0.4);
    return { a: outCubic(q), dy: (1 - outCubic(q)) * fs * 0.45 };
  }
  if (type === "letters") {
    const q = stagger(k, n, 0.3);
    const sc = spring(q);
    return { a: clamp01(q * 4), s: sc };
  }
  // baseline: each letter rises from below its line, close together
  const q = stagger(k, n, 0.55);
  return { a: clamp01(q * 2.5), dy: (1 - outExpo(q)) * lineH * 0.9, line };
}

/** Loops ("emphasis"): fn(lt, P, g, obj) with lt = seconds since the loop began, P = period. */
export const LOOPS = {
  pulse: { label: "Pulse", period: 1.2, fn: (lt, P) => { const k = 1 + 0.07 * (1 - Math.cos((2 * Math.PI * lt) / P)) / 2; return { sx: k, sy: k }; } },
  wiggle: {
    label: "Wiggle", period: 1.6,
    fn: (lt, P) => {
      const ph = (lt / P) % 1;
      const env = ph < 0.45 ? Math.sin((Math.PI * ph) / 0.45) : 0;
      return { rot: 6 * env * Math.sin((2 * Math.PI * lt * 5) / P) };
    },
  },
  float: {
    label: "Float", period: 2.6,
    fn: (lt, P, g) => {
      const amp = between(g.h * 0.06, 4, g.D * 0.03);
      return { dy: -amp * (1 - Math.cos((2 * Math.PI * lt) / P)) / 2, rot: 1.2 * Math.sin((2 * Math.PI * lt) / P) };
    },
  },
  spin: { label: "Spin", period: 4, fn: (lt, P) => ({ rot: (360 * lt) / P }) },
  glow: {
    label: "Glow pulse", period: 1.6,
    fn: (lt, P, g, color) => ({ glow: { color, b: between(g.D * 0.035, 6, 48) * (1 - Math.cos((2 * Math.PI * lt) / P)) / 2 } }),
  },
  shake: {
    label: "Shake", period: 1.4,
    fn: (lt, P, g) => {
      const ph = (lt / P) % 1;
      const env = ph < 0.35 ? Math.sin((Math.PI * ph) / 0.35) : 0;
      const n = Math.floor(lt * 30);
      return { dx: env * (hash01(n) - 0.5) * g.D * 0.025, dy: env * (hash01(n + 99) - 0.5) * g.D * 0.012, rot: env * (hash01(n + 7) - 0.5) * 3 };
    },
  },
};

export const isTextType = (type) => type in TEXT_MOTIONS;
export const motionLabel = (type) => MOTIONS[type]?.label || TEXT_MOTIONS[type]?.label || LOOPS[type]?.label || type;
export const baseDuration = (type) => MOTIONS[type]?.base ?? TEXT_MOTIONS[type]?.base ?? 0.7;

/** Groups shown in the Animate panel. */
export const GROUPS = {
  intro: [
    { title: "Simple", items: ["fade", "rise", "drop", "pan-left", "pan-right", "wipe"] },
    { title: "Punchy", items: ["pop", "stomp", "bounce", "slide-settle", "tumble", "spin"] },
    { title: "Cinematic", items: ["zoom", "blur", "flicker"] },
    { title: "Text only", text: true, items: ["typewriter", "words", "letters", "baseline"] },
  ],
  loop: [{ title: "Keep it moving", items: ["pulse", "wiggle", "float", "spin", "glow", "shake"] }],
};

/**
 * One-click page animations. pick(kind) gets "text", "image", "shape" or "bg" and returns
 * { in, loop?, out? } motion ids (null = leave that object still).
 */
export const PAGE_PRESETS = [
  {
    id: "smooth", label: "Smooth", help: "Soft rises and fades", stagger: 0.14, speed: "medium",
    pick: (kind) => (kind === "bg" ? null : { in: kind === "text" ? "rise" : "fade", out: "fade" }),
  },
  {
    id: "bold", label: "Bold", help: "Big, loud entrances", stagger: 0.16, speed: "fast",
    pick: (kind) => (kind === "bg" ? null : { in: kind === "text" ? "stomp" : "pop" }),
  },
  {
    id: "bouncy", label: "Bouncy", help: "Playful pops and bounces", stagger: 0.12, speed: "medium",
    pick: (kind, i) => (kind === "bg" ? null : { in: kind === "text" ? "letters" : "bounce", loop: kind === "image" && i === 0 ? "float" : null }),
  },
  {
    id: "cinematic", label: "Cinematic", help: "Slow zooms and soft focus", stagger: 0.3, speed: "slow",
    pick: (kind) => (kind === "bg" ? { in: "zoom" } : { in: kind === "text" ? "blur" : "zoom", out: "fade" }),
  },
  {
    id: "typewriter", label: "Typewriter", help: "Text types itself in", stagger: 0.2, speed: "medium",
    pick: (kind) => (kind === "bg" ? null : { in: kind === "text" ? "typewriter" : "fade" }),
  },
  {
    id: "neon", label: "Neon", help: "Flickering signs that glow", stagger: 0.18, speed: "medium",
    pick: (kind) => (kind === "bg" ? null : kind === "text" ? { in: "flicker", loop: "glow" } : { in: "wipe" }),
  },
];
