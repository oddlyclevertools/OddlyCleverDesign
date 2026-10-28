// Smart guides and snapping while moving, scaling and rotating, plus the live size/angle label.
// Snap targets: page edges and centre lines (and margins when shown), other objects' edges and
// centres, ruler guides, and equal spacing between objects in a row. Ctrl/Cmd suspends it.
import { getGuides, getPrefs, live, clearLive, marginOf } from "./state.js";
import { rectOf, round } from "./geom.js";

const SNAP_PX = 6;      // screen px
const ROT_STEP = 15;    // degrees with Shift
const EPS = 0.5;

export function wireSnapping(app, redraw) {
  const ed = app.editor, c = ed.canvas;
  let cache = null; // { target, xs, ys, others }

  const targetsFor = (t) => {
    if (cache?.target === t) return cache;
    const p = getPrefs();
    const skip = new Set([t, ...(t._objects || [])]);
    const xs = [], ys = [], others = [];
    if (p.smart) {
      const W = ed.width, H = ed.height;
      for (const v of [0, W / 2, W]) xs.push({ v, kind: "page" });
      for (const v of [0, H / 2, H]) ys.push({ v, kind: "page" });
      if (p.margins) {
        const m = marginOf(ed);
        xs.push({ v: m, kind: "page" }, { v: W - m, kind: "page" });
        ys.push({ v: m, kind: "page" }, { v: H - m, kind: "page" });
      }
      for (const o of ed.objects()) {
        if (skip.has(o) || o.visible === false || o.isBg) continue;
        const r = rectOf(o);
        others.push(r);
        for (const v of [r.l, r.cx, r.r]) xs.push({ v, kind: "obj", r });
        for (const v of [r.t, r.cy, r.b]) ys.push({ v, kind: "obj", r });
      }
    }
    if (p.snapGuides && p.guides) {
      for (const g of getGuides(ed)) (g.axis === "x" ? xs : ys).push({ v: g.pos, kind: "guide" });
    }
    cache = { target: t, xs, ys, others };
    return cache;
  };

  const threshold = () => SNAP_PX / ed.zoom;
  const suspended = (e) => Boolean(e && (e.ctrlKey || e.metaKey));

  // ---- moving ----------------------------------------------------------------------------
  c.on("object:moving", (opt) => {
    const t = opt.target;
    if (!t) return;
    clearLive();
    if (!suspended(opt.e)) {
      const T = targetsFor(t), th = threshold();
      let r = rectOf(t);
      const sx = snapAxis([r.l, r.cx, r.r], T.xs, th), sy = snapAxis([r.t, r.cy, r.b], T.ys, th);
      const gx = getPrefs().smart ? spacingSnap(r, T.others, "x", th) : null;
      const gy = getPrefs().smart ? spacingSnap(r, T.others, "y", th) : null;
      const dx = pick(sx, gx), dy = pick(sy, gy);
      if (dx.d || dy.d) {
        t.set({ left: t.left + dx.d, top: t.top + dy.d });
        t.setCoords();
        r = rectOf(t);
      }
      live.lines = [...linesFor(r, T.xs, "x", ed), ...linesFor(r, T.ys, "y", ed)];
      live.gaps = [...(dx.gap ? dx.gap.markers(r) : []), ...(dy.gap ? dy.gap.markers(r) : [])];
    }
    const r = rectOf(t);
    setLabel(`X ${round(r.l)}  ·  Y ${round(r.t)}`, r);
  });

  // ---- scaling (edge snapping for unrotated objects) ---------------------------------------
  const onScale = (opt) => {
    const t = opt.target, tr = opt.transform;
    if (!t) return;
    clearLive();
    if (!suspended(opt.e) && tr && !(t.angle % 360)) snapScale(t, tr);
    const r = rectOf(t);
    setLabel(`${round(t.getScaledWidth())} × ${round(t.getScaledHeight())}`, r);
  };

  const snapScale = (t, tr) => {
    const T = targetsFor(t), th = threshold();
    const ox = tr.originX, oy = tr.originY;
    const r = rectOf(t);
    const movingX = ox === "left" ? r.r : ox === "right" ? r.l : null;
    const movingY = oy === "top" ? r.b : oy === "bottom" ? r.t : null;
    const corner = String(tr.corner || "");
    const sideX = corner === "ml" || corner === "mr", sideY = corner === "mt" || corner === "mb";
    const fx = movingX != null && !sideY ? snapAxis([movingX], T.xs, th) : null;
    const fy = movingY != null && !sideX ? snapAxis([movingY], T.ys, th) : null;
    if (!fx && !fy) return finishLines(t, T);
    const anchor = t.translateToOriginPoint(t.getCenterPoint(), ox, oy);
    const resizing = tr.action === "resizing";
    const wantW = fx ? (ox === "left" ? r.w + fx.d : r.w - fx.d) : null;
    const wantH = fy ? (oy === "top" ? r.h + fy.d : r.h - fy.d) : null;
    if (resizing) {
      if (wantW > 1) t.set("width", (t.width * wantW) / r.w);
      t.initDimensions?.();
    } else {
      const orig = tr.original || {};
      const uniform = /^(tl|tr|bl|br)$/.test(corner) && orig.scaleY
        && Math.abs(t.scaleX / t.scaleY - orig.scaleX / orig.scaleY) < 1e-6;
      if (uniform) {
        const kx = wantW ? wantW / r.w : null, ky = wantH ? wantH / r.h : null;
        const k = kx && ky ? (Math.abs(fx.d) <= Math.abs(fy.d) ? kx : ky) : kx || ky;
        if (k > 0) t.set({ scaleX: t.scaleX * k, scaleY: t.scaleY * k });
      } else {
        if (wantW > 1) t.set("scaleX", (t.scaleX * wantW) / r.w);
        if (wantH > 1) t.set("scaleY", (t.scaleY * wantH) / r.h);
      }
    }
    t.setPositionByOrigin(anchor, ox, oy);
    t.setCoords();
    finishLines(t, T);
  };

  const finishLines = (t, T) => {
    const r = rectOf(t);
    live.lines = [...linesFor(r, T.xs, "x", ed), ...linesFor(r, T.ys, "y", ed)];
  };

  c.on("object:scaling", onScale);
  c.on("object:resizing", onScale);

  // ---- rotating: Shift snaps to 15° steps ------------------------------------------------
  c.on("object:rotating", (opt) => {
    const t = opt.target;
    if (!t) return;
    clearLive();
    if (opt.e?.shiftKey) {
      const a = (Math.round(t.angle / ROT_STEP) * ROT_STEP) % 360;
      if (a !== t.angle) {
        const ctr = t.getCenterPoint();
        t.set("angle", a);
        t.setPositionByOrigin(ctr, "center", "center");
        t.setCoords();
      }
    }
    setLabel(`${round(((t.angle % 360) + 360) % 360)}°`, rectOf(t));
  });

  const end = () => {
    cache = null;
    if (live.lines.length || live.gaps.length || live.label) {
      clearLive();
      redraw();
    }
  };
  c.on("mouse:up", end);
  c.on("object:modified", end);
  c.on("selection:cleared", end);

  function setLabel(text, r) {
    const v = c.viewportTransform;
    live.label = { text, x: r.cx * v[0] + v[4], y: r.b * v[3] + v[5] + 22 };
  }
}

/** Smallest correction that puts one of `edges` on a candidate, within th. */
function snapAxis(edges, cands, th) {
  let best = null;
  for (const e of edges) {
    for (const c of cands) {
      const d = c.v - e;
      if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d };
    }
  }
  return best;
}

function pick(edge, gap) {
  if (edge && (!gap || Math.abs(edge.d) <= Math.abs(gap.d) + 1e-9)) return { d: edge.d, gap: null };
  if (gap) return { d: gap.d, gap };
  return { d: 0, gap: null };
}

/** The guide lines to show for a rect that now touches candidates. */
function linesFor(r, cands, axis, ed) {
  const edges = axis === "x" ? [r.l, r.cx, r.r] : [r.t, r.cy, r.b];
  const out = new Map();
  for (const c of cands) {
    if (!edges.some((e) => Math.abs(e - c.v) < EPS)) continue;
    let from, to;
    if (c.kind === "obj") {
      from = axis === "x" ? Math.min(r.t, c.r.t) : Math.min(r.l, c.r.l);
      to = axis === "x" ? Math.max(r.b, c.r.b) : Math.max(r.r, c.r.r);
    } else {
      from = axis === "x" ? Math.min(0, r.t) : Math.min(0, r.l);
      to = axis === "x" ? Math.max(ed.height, r.b) : Math.max(ed.width, r.r);
    }
    const key = Math.round(c.v * 2) / 2;
    const prev = out.get(key);
    out.set(key, prev ? { ...prev, from: Math.min(prev.from, from), to: Math.max(prev.to, to) }
      : { axis, pos: c.v, from, to, kind: c.kind });
  }
  return [...out.values()];
}

/**
 * Equal spacing: neighbours in a row (overlapping on the other axis) with gap g suggest
 * positions for the moving rect at the same gap. Returns { d, markers(rect) } or null.
 */
function spacingSnap(r, others, axis, th) {
  const [lo, hi, size, oLo, oHi] = axis === "x" ? ["l", "r", "w", "t", "b"] : ["t", "b", "h", "l", "r"];
  const row = others.filter((o) => o[oLo] < r[oHi] && o[oHi] > r[oLo]).sort((a, b) => a[lo] - b[lo]);
  let best = null;
  const offer = (d, markers) => {
    if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, markers };
  };
  const mid = (a, b) => (Math.max(a[oLo], b[oLo]) + Math.min(a[oHi], b[oHi])) / 2;
  const mk = (from, to, at) => ({ axis, from, to, at });
  for (let i = 0; i + 1 < row.length; i++) {
    const a = row[i], b = row[i + 1];
    if (a[hi] > b[lo]) continue;
    const g = b[lo] - a[hi];
    if (g < 1) continue;
    // After b, at the same gap.
    offer(b[hi] + g - r[lo], (t) => [mk(a[hi], b[lo], mid(a, b)), mk(b[hi], t[lo], mid(b, t))]);
    // Before a.
    offer(a[lo] - g - r[size] - r[lo], (t) => [mk(t[hi], a[lo], mid(t, a)), mk(a[hi], b[lo], mid(a, b))]);
    // Centred between a and b.
    if (g > r[size] + 2) {
      offer(a[hi] + (g - r[size]) / 2 - r[lo], (t) => [mk(a[hi], t[lo], mid(a, t)), mk(t[hi], b[lo], mid(t, b))]);
    }
  }
  return best;
}
