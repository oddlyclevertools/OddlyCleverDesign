// Safe zones: where each platform's UI covers a design. Drawn on the editor's own screen
// canvas after it renders (never as design objects, never into exports).
//
// A zone set is { label, note, rects: [{ x, y, w, h, level, label, check }], outlines: [...] }
// in page coordinates. level: "danger" (covered or cut) | "caution" (sometimes covered).
// check: true when the design check should warn about text inside it.
import { SIZES } from "../../core/sizes.js";

export const ZONE_KINDS = [
  { id: "auto", label: "Match my design size" },
  { id: "yt-thumb", label: "YouTube thumbnail" },
  { id: "shorts", label: "Shorts, Reels, TikTok" },
  { id: "story", label: "Instagram / Facebook story" },
  { id: "banner", label: "YouTube channel banner" },
  { id: "ig-grid", label: "Instagram profile grid" },
  { id: "print", label: "Print (bleed and margins)" },
];

const PRINT_DPI = { a4: 300, menu: 300, flyer: 300, "business-card": 300, invitation: 300, certificate: 300, poster: 100 };
const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;

/** The zone kind that fits a page size best (or null when no platform applies). */
export function autoKind(W, H) {
  const preset = SIZES.find((s) => s.w === W && s.h === H && PRINT_DPI[s.id]);
  if (preset) return "print";
  const r = W / H;
  if (near(r, 16 / 9)) return W >= 2048 ? "banner" : "yt-thumb";
  if (near(r, 9 / 16)) return "shorts";
  if (near(r, 1) || near(r, 4 / 5)) return "ig-grid";
  return null;
}

/** Print resolution for a page (pixels per inch). */
export function printDpi(W, H) {
  const preset = SIZES.find((s) => s.w === W && s.h === H && PRINT_DPI[s.id]);
  return preset ? PRINT_DPI[preset.id] : 300;
}

const mm = (v, dpi) => (v / 25.4) * dpi;

/** Four rects covering the page outside the inner rect (x, y, w, h). */
function outside(W, H, x, y, w, h, extra) {
  return [
    { x: 0, y: 0, w: W, h: y, ...extra },
    { x: 0, y: y + h, w: W, h: H - y - h, ...extra },
    { x: 0, y, w: x, h, ...extra },
    { x: x + w, y, w: W - x - w, h, ...extra },
  ].filter((r) => r.w > 0.5 && r.h > 0.5);
}

/** The zone set for `kind` on a W x H page. */
export function zonesFor(kind, W, H) {
  switch (kind) {
    case "yt-thumb":
      return {
        label: "YouTube thumbnail",
        note: "The video length badge sits in the bottom-right corner. Keep faces and words out of it.",
        rects: [
          { x: W * 0.8, y: H * 0.84, w: W * 0.2, h: H * 0.16, level: "danger", label: "Video length", check: true },
          { x: W * 0.89, y: 0, w: W * 0.11, h: H * 0.34, level: "caution", label: "Hover icons" },
          { x: 0, y: H * 0.975, w: W * 0.8, h: H * 0.025, level: "caution", label: "Watched bar" },
        ],
        outlines: [],
      };
    case "shorts":
      return {
        label: "Shorts, Reels, TikTok",
        note: "Buttons cover the right edge, and the caption and channel name cover the bottom.",
        rects: [
          { x: 0, y: 0, w: W, h: H * 0.08, level: "caution", label: "Top icons" },
          { x: W * 0.84, y: H * 0.4, w: W * 0.16, h: H * 0.38, level: "danger", label: "Like, comment, share", check: true },
          { x: 0, y: H * 0.78, w: W, h: H * 0.22, level: "danger", label: "Caption and channel", check: true },
        ],
        outlines: [],
        buttons: { x: W * 0.92, y0: H * 0.44, step: H * 0.068, r: W * 0.04 },
      };
    case "story":
      return {
        label: "Story",
        note: "The top bar shows your name and progress; the bottom bar holds the reply box.",
        rects: [
          { x: 0, y: 0, w: W, h: H * 0.13, level: "danger", label: "Name and progress bar", check: true },
          { x: 0, y: H * 0.86, w: W, h: H * 0.14, level: "danger", label: "Reply bar", check: true },
        ],
        outlines: [],
      };
    case "banner": {
      const sx = W / 2560, sy = H / 1440;
      const box = (w, h) => ({ x: (W - w * sx) / 2, y: (H - h * sy) / 2, w: w * sx, h: h * sy });
      const safe = box(1546, 423), tablet = box(1855, 423), desktop = box(2560, 423);
      return {
        label: "YouTube channel banner",
        note: "Only the middle 1546 × 423 shows on every device. TVs show the whole picture.",
        rects: [
          ...outside(W, H, desktop.x, desktop.y, desktop.w, desktop.h, { level: "caution", label: "Only TVs show this" }),
          ...outside(W, H, safe.x, safe.y, safe.w, safe.h, { level: "none", check: true, label: "Cut off on phones" }),
        ],
        outlines: [
          { ...desktop, label: "Desktop", style: "dash" },
          { ...tablet, label: "Tablet", style: "dash" },
          { ...safe, label: "Safe on every device", style: "safe" },
        ],
      };
    }
    case "ig-grid": {
      // The profile grid shows a 3:4 crop from the middle.
      const cw = Math.min(W, (H * 3) / 4), ch = Math.min(H, (W * 4) / 3);
      const x = (W - cw) / 2, y = (H - ch) / 2;
      return {
        label: "Instagram profile grid",
        note: "Your profile grid crops posts to 3:4, so the edges are hidden there.",
        rects: outside(W, H, x, y, cw, ch, { level: "caution", label: "Hidden on your profile grid", check: true }),
        outlines: [{ x, y, w: cw, h: ch, label: "Profile grid", style: "safe" }],
      };
    }
    case "print": {
      const dpi = printDpi(W, H), b = mm(3, dpi), m = mm(5, dpi);
      return {
        label: "Print",
        note: `Printers can trim up to 3 mm off each edge. Keep words at least 5 mm in (at ${dpi} pixels per inch).`,
        rects: outside(W, H, b, b, W - 2 * b, H - 2 * b, { level: "danger", label: "May be cut off (3 mm)", check: true }),
        outlines: [{ x: m, y: m, w: W - 2 * m, h: H - 2 * m, label: "Keep words inside (5 mm)", style: "safe" }],
      };
    }
    default:
      return null;
  }
}

// ---- drawing ----------------------------------------------------------------------------

const COLORS = {
  danger: { fill: "rgba(255, 46, 94, 0.20)", line: "rgba(255, 70, 110, 0.95)", hatch: "rgba(255, 70, 110, 0.38)" },
  caution: { fill: "rgba(255, 200, 61, 0.14)", line: "rgba(255, 200, 61, 0.9)", hatch: "rgba(255, 200, 61, 0.3)" },
  safe: "rgba(52, 211, 153, 0.95)",
  dash: "rgba(143, 227, 255, 0.85)",
};

const patterns = new Map();
function hatch(ctx, color) {
  if (!patterns.has(color)) {
    const c = document.createElement("canvas");
    c.width = c.height = 12;
    const g = c.getContext("2d");
    g.strokeStyle = color;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-3, 15); g.lineTo(15, -3);
    g.moveTo(-3, 3); g.lineTo(3, -3);
    g.moveTo(9, 15); g.lineTo(15, 9);
    g.stroke();
    patterns.set(color, c);
  }
  return ctx.createPattern(patterns.get(color), "repeat");
}

function label(ctx, text, x, y, z, color) {
  const fs = 11 / z;
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 10 / z, h = fs + 8 / z;
  ctx.fillStyle = "rgba(10, 8, 14, 0.82)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4 / z);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 5 / z, y + h / 2);
}

/** Draw a zone set on a 2D context already in screen space; `vpt` is the viewport transform. */
export function drawZones(ctx, set, vpt) {
  const z = vpt[0];
  ctx.save();
  ctx.transform(...vpt);
  for (const r of set.rects) {
    const col = COLORS[r.level];
    if (!col) continue;
    ctx.fillStyle = col.fill;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const p = hatch(ctx, col.hatch);
    p.setTransform(new DOMMatrix().scale(1 / z));
    ctx.fillStyle = p;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = col.line;
    ctx.lineWidth = 1.5 / z;
    ctx.setLineDash([]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }
  if (set.buttons) {
    const b = set.buttons;
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(b.x, b.y0 + i * b.step, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const o of set.outlines) {
    ctx.strokeStyle = o.style === "safe" ? COLORS.safe : COLORS.dash;
    ctx.lineWidth = (o.style === "safe" ? 2 : 1.5) / z;
    ctx.setLineDash(o.style === "safe" ? [] : [8 / z, 6 / z]);
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }
  ctx.setLineDash([]);
  const seen = new Set();
  for (const r of set.rects) {
    if (!COLORS[r.level] || !r.label || seen.has(r.label)) continue;
    seen.add(r.label);
    const thin = r.h * z < 36; // too thin to hold its label: put it just above
    label(ctx, r.label, r.x + 6 / z, thin ? r.y - 26 / z : r.y + 6 / z, z, COLORS[r.level].line);
  }
  for (const o of set.outlines) label(ctx, o.label, o.x + 6 / z, o.y + o.h - 26 / z, z, o.style === "safe" ? COLORS.safe : COLORS.dash);
  ctx.restore();
}

/** A pulsing outline round a page rect (for "Show me"). `t` runs 0 → 1. */
export function drawFlash(ctx, rect, vpt, t) {
  const z = vpt[0], pad = 8 / z;
  ctx.save();
  ctx.transform(...vpt);
  ctx.strokeStyle = `rgba(255, 46, 126, ${0.95 * (1 - t * 0.6)})`;
  ctx.lineWidth = (3 + 2 * Math.sin(t * Math.PI * 6)) / z;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.roundRect(rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2, 6 / z);
  ctx.stroke();
  ctx.restore();
}
