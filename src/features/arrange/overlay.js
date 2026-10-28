// The overlay canvas above the Fabric canvas: ruler guides, margins, bleed, smart guides,
// equal-spacing markers, the live size label and the Layers-panel hover outline. It never
// takes pointer events and is never exported.
import { el } from "../../ui/kit.js";
import { bleedOf, getGuides, getPrefs, live, marginOf } from "./state.js";
import { rectOf } from "./geom.js";

export const COLORS = {
  smart: "#ff2fb4",
  guide: "#22d3ee",
  margin: "rgba(167, 139, 250, 0.95)",
  bleed: "rgba(248, 113, 113, 0.95)",
  hover: "#ff7aa8",
};

export function createOverlay(app) {
  const ed = app.editor, host = app.shell.canvasHost;
  const cv = el("canvas.ar-overlay", { "aria-hidden": "true" });
  host.append(cv);
  const ctx = cv.getContext("2d");
  let raf = 0;
  const extra = []; // other painters (rulers) run after the overlay

  const fit = () => {
    const dpr = window.devicePixelRatio || 1, w = host.clientWidth, h = host.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
    }
    return { dpr, w, h };
  };

  const draw = () => {
    raf = 0;
    const { dpr, w, h } = fit();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (app.view !== "editor" || !ed.page) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = ed.canvas.viewportTransform, z = v[0];
    const sx = (x) => x * z + v[4], sy = (y) => y * v[3] + v[5];
    const crisp = (n) => Math.round(n) + 0.5;
    const p = getPrefs();

    // Safe-area margins and print bleed.
    const page = { l: sx(0), t: sy(0), r: sx(ed.width), b: sy(ed.height) };
    if (p.margins) dashedRect(ctx, inset(page, marginOf(ed) * z), COLORS.margin, crisp);
    if (p.margins && isWideVideo(ed)) timeBadge(ctx, ed, sx, sy);
    if (p.bleed) {
      dashedRect(ctx, inset(page, bleedOf(ed) * z), COLORS.bleed, crisp);
      tag(ctx, "Trim line", page.l + bleedOf(ed) * z + 6, page.t + bleedOf(ed) * z + 14, COLORS.bleed);
    }

    // Ruler guides.
    if (p.guides) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = COLORS.guide;
      getGuides(ed).forEach((g, i) => {
        if (i === live.hideGuide) return;
        line(ctx, g.axis, g.axis === "x" ? crisp(sx(g.pos)) : crisp(sy(g.pos)), w, h);
      });
    }
    if (live.guideDrag) {
      const g = live.guideDrag;
      ctx.strokeStyle = g.remove ? "rgba(248,113,113,.8)" : COLORS.guide;
      ctx.setLineDash(g.remove ? [4, 4] : []);
      const at = g.axis === "x" ? sx(g.pos) : sy(g.pos);
      line(ctx, g.axis, crisp(at), w, h);
      ctx.setLineDash([]);
      if (!g.remove) {
        tag(ctx, `${Math.round(g.pos)}`, g.axis === "x" ? at + 6 : 30, g.axis === "x" ? 34 : at - 6, COLORS.guide);
      }
    }

    // Layers-panel hover outline.
    if (live.hover && live.hover.canvas && live.hover.visible !== false) {
      try {
        const pts = live.hover.getCoords();
        ctx.strokeStyle = COLORS.hover;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        pts.forEach((pt, i) => (i ? ctx.lineTo(sx(pt.x), sy(pt.y)) : ctx.moveTo(sx(pt.x), sy(pt.y))));
        ctx.closePath();
        ctx.stroke();
      } catch { /* object gone */ }
    }

    // Smart guides.
    ctx.strokeStyle = COLORS.smart;
    ctx.lineWidth = 1;
    for (const ln of live.lines) {
      ctx.beginPath();
      if (ln.axis === "x") {
        const x = crisp(sx(ln.pos));
        ctx.moveTo(x, sy(ln.from) - 8);
        ctx.lineTo(x, sy(ln.to) + 8);
      } else {
        const y = crisp(sy(ln.pos));
        ctx.moveTo(sx(ln.from) - 8, y);
        ctx.lineTo(sx(ln.to) + 8, y);
      }
      ctx.stroke();
    }
    // Equal spacing markers: a bar with end ticks and the gap in px.
    for (const g of live.gaps) {
      ctx.strokeStyle = COLORS.smart;
      ctx.fillStyle = COLORS.smart;
      ctx.beginPath();
      if (g.axis === "x") {
        const y = crisp(sy(g.at)), a = sx(g.from), b = sx(g.to);
        ctx.moveTo(a, y); ctx.lineTo(b, y);
        ctx.moveTo(crisp(a), y - 5); ctx.lineTo(crisp(a), y + 5);
        ctx.moveTo(crisp(b), y - 5); ctx.lineTo(crisp(b), y + 5);
        ctx.stroke();
        pill(ctx, `${Math.round(g.to - g.from)}`, (a + b) / 2, y - 12, COLORS.smart, "#fff");
      } else {
        const x = crisp(sx(g.at)), a = sy(g.from), b = sy(g.to);
        ctx.moveTo(x, a); ctx.lineTo(x, b);
        ctx.moveTo(x - 5, crisp(a)); ctx.lineTo(x + 5, crisp(a));
        ctx.moveTo(x - 5, crisp(b)); ctx.lineTo(x + 5, crisp(b));
        ctx.stroke();
        pill(ctx, `${Math.round(g.to - g.from)}`, x + 20, (a + b) / 2, COLORS.smart, "#fff");
      }
    }

    if (live.label) pill(ctx, live.label.text, live.label.x, live.label.y, "rgba(17,18,28,.92)", "#fff", true);

    for (const fn of extra) fn();
  };

  const request = () => { if (!raf) raf = requestAnimationFrame(draw); };
  ed.canvas.on("after:render", request);
  new ResizeObserver(request).observe(host);
  return { request, draw, el: cv, addPainter: (fn) => extra.push(fn) };
}

const inset = (r, d) => ({ l: r.l + d, t: r.t + d, r: r.r - d, b: r.b - d });

function dashedRect(ctx, r, color, crisp) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(0,0,0,.45)";
  ctx.strokeRect(crisp(r.l) + 1, crisp(r.t) + 1, Math.round(r.r - r.l), Math.round(r.b - r.t));
  ctx.strokeStyle = color;
  ctx.strokeRect(crisp(r.l), crisp(r.t), Math.round(r.r - r.l), Math.round(r.b - r.t));
  ctx.restore();
}

function line(ctx, axis, at, w, h) {
  ctx.beginPath();
  if (axis === "x") { ctx.moveTo(at, 0); ctx.lineTo(at, h); } else { ctx.moveTo(0, at); ctx.lineTo(w, at); }
  ctx.stroke();
}

const isWideVideo = (ed) => Math.abs(ed.width / ed.height - 16 / 9) < 0.01;

/** Where YouTube puts the video length on a thumbnail: keep text out of it. */
function timeBadge(ctx, ed, sx, sy) {
  const W = ed.width, H = ed.height;
  const w = W * 0.12, h = H * 0.09, m = W * 0.012;
  const x = sx(W - m - w), y = sy(H - m - h), x2 = sx(W - m), y2 = sy(H - m);
  ctx.save();
  ctx.fillStyle = "rgba(167, 139, 250, 0.18)";
  ctx.strokeStyle = COLORS.margin;
  ctx.setLineDash([4, 3]);
  ctx.fillRect(x, y, x2 - x, y2 - y);
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(x2 - x), Math.round(y2 - y));
  ctx.restore();
  if (x2 - x > 60) tag(ctx, "Video length", x + 4, y - 6, COLORS.margin);
}

function tag(ctx, text, x, y, color) {
  ctx.save();
  ctx.font = "600 11px Inter, system-ui, sans-serif";
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** A rounded label centred on (x, y). */
export function pill(ctx, text, x, y, bg, fg, shadow = false) {
  ctx.save();
  ctx.font = "600 11.5px Inter, system-ui, sans-serif";
  const w = Math.ceil(ctx.measureText(text).width) + 14, h = 21;
  const l = Math.round(x - w / 2), t = Math.round(y - h / 2);
  if (shadow) { ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; }
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(l, t, w, h, 6);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, l + w / 2, t + h / 2 + 0.5);
  ctx.restore();
}

/** Selection extent in page px (for the ruler highlight), or null. */
export function selectionExtent(ed) {
  const a = ed.active();
  return a ? rectOf(a) : null;
}
