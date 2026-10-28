// The shared time function. stateAt(obj, t, env) says how an object looks at time t; the editor
// preview and the MP4/GIF export both call it, so what you preview is exactly what you export.
//
// Stored data (always replaced, never mutated):
//   obj.data.anim  = { in: {type, dur, delay, speed}?, out: {type, dur, speed}?, loop: {type, speed}? }
//   page.data.motion = { duration }   (seconds, 1..30, default 5)
import {
  LOOPS, MOTIONS, TEXT_MOTIONS, baseDuration, charState, isTextType, speedK,
} from "./catalog.js";
import { clamp01 } from "./easing.js";

export const DEFAULT_DURATION = 5;
export const MIN_DURATION = 1;
export const MAX_DURATION = 30;
const GLOW_FALLBACK = "#ff2e7e";

// ---- stored data ------------------------------------------------------------------------

/** The object's animation, or null. */
export function animOf(obj) {
  const a = obj?.data?.anim;
  if (!a || typeof a !== "object") return null;
  return a.in || a.out || a.loop ? a : null;
}

/** Replace obj.data.anim (null removes it). Doesn't commit. */
export function writeAnim(obj, anim) {
  const { anim: _old, ...rest } = obj.data || {};
  const clean = anim && (anim.in || anim.out || anim.loop) ? anim : null;
  obj.set("data", clean ? { ...rest, anim: clean } : rest);
}

export function pageDuration(editor) {
  const d = Number(editor.page?.data?.motion?.duration);
  return Number.isFinite(d) ? Math.max(MIN_DURATION, Math.min(MAX_DURATION, d)) : DEFAULT_DURATION;
}

/** Replace the page's motion settings. Doesn't commit. */
export function writePageDuration(editor, seconds) {
  const page = editor.page;
  const duration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(Number(seconds) * 10) / 10 || DEFAULT_DURATION));
  page.set("data", { ...(page.data || {}), motion: { ...(page.data?.motion || {}), duration } });
}

/** A phase spec ({type, speed}) with its duration filled in. */
export function makePhase(type, { speed = "medium", delay = 0, dur } = {}) {
  return { type, speed, dur: dur ?? round2(baseDuration(type) * speedK(speed)), delay };
}
const round2 = (v) => Math.round(v * 100) / 100;

export const isText = (obj) => typeof obj?.text === "string" && Array.isArray(obj._textLines);

/** When the object's motion has finished arriving (s), for staggering and previews. */
export function introEnd(anim) {
  return anim?.in ? (anim.in.delay || 0) + (anim.in.dur || 0) : 0;
}

/** True when any object in the design is animated. */
export const hasAnimation = (objects) => objects.some((o) => animOf(o));

// ---- geometry ---------------------------------------------------------------------------

/** The object's size and the page's size: what the motions measure distances against. */
export function geoOf(obj, pw, ph) {
  const w = Math.abs(obj.getScaledWidth()), h = Math.abs(obj.getScaledHeight());
  return { w, h, pw, ph, D: Math.min(pw, ph) };
}

function glowColor(obj) {
  const fx = obj.data?.effect;
  if (fx?.neon?.color) return fx.neon.color;
  const f = obj.fill;
  if (typeof f === "string" && /^#|^rgb/i.test(f) && !/^#?fff(fff)?$/i.test(f)) return f;
  return GLOW_FALLBACK;
}

// Character / word / line numbers for text reveals, cached per text layout.
const textCache = new WeakMap();
function textIndex(obj) {
  const lines = obj._textLines || [];
  const hit = textCache.get(obj);
  if (hit && hit.lines === lines) return hit;
  let k = 0, words = 0;
  const map = lines.map((line) => {
    let inWord = false;
    const row = line.map((ch) => {
      const space = /\s/.test(ch);
      if (!space && !inWord) words++;
      inWord = !space;
      return { k: k++, wi: Math.max(0, words - 1) };
    });
    return row;
  });
  const out = { lines, map, n: Math.max(1, k), nw: Math.max(1, words) };
  textCache.set(obj, out);
  return out;
}

// ---- the state ------------------------------------------------------------------------

const IDENTITY = Object.freeze({ dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, skewX: 0, op: 1, blur: 0, glow: null, clip: null, chars: null });

function merge(st, d) {
  if (!d) return st;
  return {
    ...st,
    dx: st.dx + (d.dx || 0),
    dy: st.dy + (d.dy || 0),
    sx: st.sx * (d.sx ?? 1),
    sy: st.sy * (d.sy ?? 1),
    rot: st.rot + (d.rot || 0),
    skewX: st.skewX + (d.skewX || 0),
    op: st.op * (d.op ?? 1),
    blur: st.blur + (d.blur || 0),
    glow: d.glow || st.glow,
    clip: d.clip || st.clip,
    chars: d.chars || st.chars,
  };
}

/** One phase (intro when s = 1, outro when s = -1) at progress p. */
function phaseState(obj, type, p, g, s) {
  if (isTextType(type)) {
    if (!isText(obj)) return MOTIONS[TEXT_MOTIONS[type].fallback].fn(p, g, s);
    const idx = textIndex(obj);
    const fs = obj.fontSize || 40;
    const chars = (li, ci) => {
      const c = idx.map[li]?.[ci];
      if (!c) return null;
      const lineH = obj.getHeightOfLine ? obj.getHeightOfLine(li) : fs * 1.2;
      return charState(type, p, { k: c.k, n: idx.n, wi: c.wi, nw: idx.nw, line: li, fs, lineH });
    };
    return { chars, clip: type === "baseline" ? { type: "below" } : null };
  }
  const m = MOTIONS[type];
  return m ? m.fn(p, g, s) : null;
}

/**
 * How `obj` looks at time t (seconds).
 * @param {object} obj a Fabric object
 * @param {number} t
 * @param {{ duration: number, pw: number, ph: number, anim?: object, geo?: object }} env
 *   `anim` overrides the stored animation (hover previews); `geo` is the object's resting geometry.
 * @returns {{dx,dy,sx,sy,rot,skewX,op,blur,glow,clip,chars}}
 */
export function stateAt(obj, t, env) {
  const anim = env.anim !== undefined ? env.anim : animOf(obj);
  if (!anim) return IDENTITY;
  const g = env.geo || geoOf(obj, env.pw, env.ph);
  const D = env.duration;
  let st = IDENTITY;

  if (anim.loop && LOOPS[anim.loop.type]) {
    const lp = LOOPS[anim.loop.type];
    const P = lp.period * speedK(anim.loop.speed);
    const lt = t - introEnd(anim);
    if (lt > 0) st = merge(st, lp.fn(lt, P, g, glowColor(obj)));
  }
  if (anim.in?.type) {
    const dur = Math.max(0.05, anim.in.dur || 0.6);
    const p = clamp01((t - (anim.in.delay || 0)) / dur);
    if (p < 1) st = merge(st, phaseState(obj, anim.in.type, p, g, 1));
  }
  if (anim.out?.type) {
    const dur = Math.max(0.05, anim.out.dur || 0.5);
    const q = clamp01((t - (D - dur)) / dur);
    if (q > 0) st = merge(st, phaseState(obj, anim.out.type, 1 - q, g, -1));
  }
  return st;
}
