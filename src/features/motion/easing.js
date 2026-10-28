// Easing curves for the motion feature. Every curve maps 0 -> 0 and 1 -> 1 exactly, so an
// animation always lands precisely on the object's real position.
export const clamp01 = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export const linear = (p) => p;
export const outCubic = (p) => 1 - (1 - p) ** 3;
export const inCubic = (p) => p ** 3;
export const inOutCubic = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
export const outQuart = (p) => 1 - (1 - p) ** 4;
export const outExpo = (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
export const inOutSine = (p) => -(Math.cos(Math.PI * p) - 1) / 2;

/** Overshoot then settle (s = how far it overshoots). */
export function outBack(p, s = 1.70158) {
  const c3 = s + 1;
  return 1 + c3 * (p - 1) ** 3 + s * (p - 1) ** 2;
}

/** A damped spring: shoots past 1, wobbles, settles. Normalised to end exactly at 1. */
export function spring(p, { damping = 6.2, freq = 3.1 } = {}) {
  const raw = (x) => 1 - Math.exp(-damping * x) * Math.cos(x * Math.PI * freq);
  return raw(p) + p * (1 - raw(1));
}

export function outBounce(p) {
  const n = 7.5625, d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
  return n * (p -= 2.625 / d) * p + 0.984375;
}

/** A repeatable pseudo-random number in 0..1 for an integer seed (flicker, shake). */
export function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
