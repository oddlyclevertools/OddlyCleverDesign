// Captions on top of the video, in Shorts styles: big words with an outline and the spoken word
// lit up, filled like karaoke, popping, in a box, revealed one by one, minimal or glowing. The
// cues come from auto captions (autocaption.js), the caption editor or addCaptionTrack(cues);
// this file only draws them, the same way in the preview and in the MP4.
import { ensureFont, nearestWeight } from "../../core/fonts.js";
import { wordsOf } from "./cues.js";

export const CAPTION_FONT = "Anton";

/**
 * The caption looks. `anim`: how the words move as they're spoken. `stroke` is the outline
 * width (share of the text size); `strokeHi` outlines in the highlight colour instead of black.
 */
export const CAPTION_PRESETS = [
  { id: "highlight", label: "Word highlight", font: "Anton", weight: 400, upper: true, size: 1, color: "#ffffff", highlight: "#ffc83d", stroke: 0.18, anim: "highlight" },
  { id: "karaoke", label: "Karaoke fill", font: "Archivo Black", weight: 400, upper: true, size: 0.9, color: "#ffffff", highlight: "#2ee6ff", stroke: 0.16, anim: "karaoke" },
  { id: "pop", label: "Big pop", font: "Luckiest Guy", weight: 400, upper: true, size: 1.2, color: "#ffffff", highlight: "#7cff4f", stroke: 0.2, anim: "pop" },
  { id: "boxed", label: "Boxed", font: "Montserrat", weight: 900, upper: false, size: 0.85, color: "#ffffff", highlight: "#ff2e7e", stroke: 0, anim: "box" },
  { id: "outline", label: "Outline", font: "Bebas Neue", weight: 400, upper: true, size: 1.25, color: "#ffffff", highlight: "#ff2e7e", stroke: 0.13, strokeHi: true, anim: "reveal" },
  { id: "minimal", label: "Minimal", font: "Inter", weight: 700, upper: false, size: 0.7, color: "#ffffff", highlight: "#ffffff", stroke: 0, shadow: true, anim: "fade" },
  { id: "neon", label: "Neon glow", font: "Righteous", weight: 400, upper: true, size: 0.95, color: "#fff4fb", highlight: "#ff4fd8", stroke: 0.1, anim: "glow" },
];

/** A caption style with its preset filled in: what the drawing uses. */
export function resolveStyle(style = {}) {
  const p = CAPTION_PRESETS.find((x) => x.id === style.preset) || CAPTION_PRESETS[0];
  return {
    ...p,
    font: style.font || p.font,
    weight: nearestWeight(style.font || p.font, p.weight),
    color: style.color || p.color,
    highlight: style.highlight || p.highlight,
    size: p.size * (style.size || 1),
    position: style.position || "bottom",
    y: style.y,
  };
}

/** Where the middle of the caption block sits (share of the height). */
export function captionY(st, w, h) {
  if (Number.isFinite(st.y)) return st.y;
  if (st.position === "top") return 0.16;
  if (st.position === "middle") return 0.5;
  return h > w ? 0.68 : 0.82; // above the Shorts buttons and caption area on vertical videos
}

/** Load the caption font before drawing (preview and export). */
export async function prepareCaptionFont(captions) {
  const st = resolveStyle(captions?.style);
  try { await ensureFont(st.font, st.weight); } catch { /* the fallback font is fine */ }
}

/** The cue showing at time t, or null. */
export function cueAt(captions, t) {
  if (!captions?.cues?.length) return null;
  return captions.cues.find((q) => t >= q.start && t < q.end) || null;
}

function lines(ctx, words, maxW) {
  const out = [];
  let cur = [];
  for (const w of words) {
    const test = [...cur, w].map((x) => x.text).join(" ");
    if (cur.length && ctx.measureText(test).width > maxW) {
      out.push(cur);
      cur = [w];
    } else cur.push(w);
  }
  if (cur.length) out.push(cur);
  return out;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
// A quick overshoot, for the pop.
const backOut = (x) => 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2;

/** Draw the caption for time t onto a w x h frame. */
export function drawCaptions(ctx, captions, t, w, h) {
  const cue = cueAt(captions, t);
  if (!cue) return;
  const st = resolveStyle(captions.style);
  const words = wordsOf(cue).map((x) => ({ ...x, text: st.upper ? x.text.toUpperCase() : x.text }));
  const px = Math.round(Math.min(w, h) * 0.08 * st.size);
  ctx.save();
  ctx.font = `${st.weight} ${px}px "${st.font}", "Archivo Black", Impact, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const rows = lines(ctx, words, w * 0.86).slice(-3);
  const lh = px * (st.anim === "box" ? 1.3 : 1.12);
  const blockH = rows.length * lh;
  const cy = Math.max(blockH / 2 + h * 0.03, Math.min(h - blockH / 2 - h * 0.03, captionY(st, w, h) * h));
  const space = ctx.measureText(" ").width * (st.anim === "pop" ? 1.8 : 1); // room for the popping word
  // The whole caption fades (minimal) or pops (big pop) in as it starts.
  const age = t - cue.start, left = cue.end - t;
  if (st.anim === "fade") ctx.globalAlpha *= clamp01(Math.min(age, left) / 0.15);
  const enter = st.anim === "pop" ? 0.82 + 0.18 * backOut(clamp01(age / 0.18)) : 1;
  rows.forEach((row, r) => {
    const widths = row.map((x) => ctx.measureText(x.text).width);
    const total = widths.reduce((a, b) => a + b, 0) + space * (row.length - 1);
    let x = (w - total) / 2;
    const y = cy - blockH / 2 + lh * (r + 0.5);
    row.forEach((word, i) => {
      drawWord(ctx, st, word, t, x, y, widths[i], px, enter);
      x += widths[i] + space;
    });
  });
  ctx.restore();
}

function drawWord(ctx, st, word, t, x, y, ww, px, enter) {
  const on = t >= word.start && t < word.end;
  const said = t >= word.end;
  const k = clamp01((t - word.start) / Math.max(0.05, word.end - word.start));
  if (st.anim === "reveal" && t < word.start) return;
  ctx.save();
  // Scale about the word's middle: the cue's entrance, and the pop of the spoken word.
  let s = enter;
  if (st.anim === "pop" && on) s *= 1 + 0.22 * backOut(clamp01((t - word.start) / 0.16));
  if (st.anim === "reveal") {
    const a = clamp01((t - word.start) / 0.12);
    ctx.globalAlpha *= a;
    ctx.translate(0, (1 - a) * px * 0.25);
  }
  if (s !== 1) {
    const cx = x + ww / 2;
    ctx.translate(cx, y);
    ctx.scale(s, s);
    ctx.translate(-cx, -y);
  }
  if (st.anim === "box" && on) {
    const pad = px * 0.18;
    ctx.fillStyle = st.highlight;
    ctx.beginPath();
    ctx.roundRect(x - pad, y - px * 0.62, ww + pad * 2, px * 1.24, px * 0.22);
    ctx.fill();
  }
  if (st.shadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = px * 0.25;
    ctx.shadowOffsetY = px * 0.06;
  }
  if (st.stroke > 0) {
    ctx.lineWidth = px * st.stroke;
    ctx.strokeStyle = st.strokeHi ? st.highlight : "rgba(0, 0, 0, 0.92)";
    ctx.strokeText(word.text, x, y);
  }
  let fill = st.color;
  if (st.anim === "highlight" || st.anim === "pop") fill = on ? st.highlight : st.color;
  if (st.anim === "glow" && on) {
    fill = "#ffffff";
    ctx.shadowColor = st.highlight;
    ctx.shadowBlur = px * 0.6;
  }
  if (st.anim === "karaoke" && said) fill = st.highlight;
  ctx.fillStyle = fill;
  ctx.fillText(word.text, x, y);
  if (st.anim === "glow" && on) ctx.fillText(word.text, x, y); // twice: a brighter glow
  if (st.anim === "karaoke" && on) {
    // The spoken word fills with colour from left to right as it is said.
    ctx.beginPath();
    ctx.rect(x - px, y - px, px + ww * k, px * 2);
    ctx.clip();
    ctx.fillStyle = st.highlight;
    ctx.fillText(word.text, x, y);
  }
  ctx.restore();
}
