// Smart layout: re-lays one page's objects for a new page shape (the heart of Smart resize).
// It works on live Fabric objects (the editor's or an offscreen StaticCanvas's) and is
// synchronous, so an in-place resize of the open page is one plain undo step.
//
//  1. Backgrounds (isBg, or anything covering ~the whole page) fill the new page: shapes
//     stretch, pictures cover.
//  2. Full-width / full-height bars stretch along the new edge and stay on their side.
//     Scenery (a wall, a sky, a tall slash: spans one side and at least half the other, or a
//     turned shape running edge to edge) keeps its place on the page and scales evenly to cover it.
//  3. Everything else is grouped into clusters (things sitting on top of each other move
//     together: a word on its label, a badge on a photo) and re-laid:
//       - similar shape: positions map across, sizes scale, then the hero and the headline
//         grow into any free room;
//       - landscape <-> portrait: clusters are stacked in reading order (portrait) or the hero
//         gets its own column beside the words (landscape).
//  4. Text is kept inside 5% margins and the platform's safe zone (studio/zones.js), nudged out
//     of corner overlays (the YouTube time badge, the Shorts buttons) and never cut.
import { Point } from "fabric";
import { autoKind, zonesFor } from "../studio/zones.js";

export const MARGIN = 0.05;
const JOIN = 0.75;        // a thing at least this much on top of another moves with it
const BG_COVER = 0.9;     // covers this much of both sides: a background
const BAND_SPAN = 0.9;    // spans this much of one side and under half the other: a bar
const SCENE_SPAN = 0.5;   // spans one side and at least this much of the other: scenery
const MAX_BOOST = 1.6;    // the hero and headline may grow this much past the plain fit
const FLIP = 1.15;        // aspect ratios beyond 1/FLIP .. FLIP count as landscape / portrait

// ---- geometry ---------------------------------------------------------------------------

const isTextObj = (o) => typeof o?.text === "string";
const hasText = (o) => isTextObj(o) || Boolean(o?._objects?.some(hasText));
const isPicture = (o) => /image/i.test(o?.type || "");
const area = (b) => Math.max(0, b.w) * Math.max(0, b.h);
const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

function boxOf(o) {
  o.setCoords();
  const r = o.getBoundingRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function union(boxes) {
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function overlap(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function intersect(a, b) {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 1 && h > 1 ? { x, y, w, h } : a; // never let a zone erase the frame
}

const inside = (b, f, eps = 0.5) => b.x >= f.x - eps && b.y >= f.y - eps && b.x + b.w <= f.x + f.w + eps && b.y + b.h <= f.y + f.h + eps;

/** Scale `o` by k about `from` and move that point to `to` (uniform, so rotation stays). */
function place(o, k, from, to) {
  const c = o.getCenterPoint();
  o.set({ scaleX: o.scaleX * k, scaleY: o.scaleY * k });
  o.setPositionByOrigin(new Point(to.x + (c.x - from.x) * k, to.y + (c.y - from.y) * k), "center", "center");
  o.setCoords();
  const cp = o.clipPath;
  if (cp?.absolutePositioned) place(cp, k, from, to);
}

/** Stretch an unrotated object so its box becomes `nb` (shapes change size, others scale). */
function stretchTo(o, box, nb) {
  const fx = nb.w / Math.max(1e-6, box.w), fy = nb.h / Math.max(1e-6, box.h);
  // Rects change size (keeps corners and strokes even); the box includes the stroke.
  if (/^rect$/i.test(o.type || "") && !o.angle) {
    o.set({ width: Math.max(1, o.width + (nb.w - box.w) / Math.abs(o.scaleX || 1)), height: Math.max(1, o.height + (nb.h - box.h) / Math.abs(o.scaleY || 1)) });
  }
  else o.set({ scaleX: o.scaleX * fx, scaleY: o.scaleY * fy });
  o.setPositionByOrigin(new Point(nb.x + nb.w / 2, nb.y + nb.h / 2), "center", "center");
  o.setCoords();
}

// ---- safe areas -------------------------------------------------------------------------

/**
 * Where things may go on a W x H page.
 * content: the page minus platform bars that cover it (the Shorts caption, story bars, bleed).
 * text: content inside 5% margins and the platform's "safe" outline.
 * corners: overlays that cover part of an edge (time badge, side buttons): text moves off them.
 */
export function safeAreas(W, H) {
  let content = { x: 0, y: 0, w: W, h: H };
  let text = { x: W * MARGIN, y: H * MARGIN, w: W * (1 - 2 * MARGIN), h: H * (1 - 2 * MARGIN) };
  const corners = [];
  const kind = autoKind(W, H);
  const set = kind ? zonesFor(kind, W, H) : null;
  const cut = (f, r) => {
    let { x, y } = f, x1 = f.x + f.w, y1 = f.y + f.h;
    const wide = r.w >= W * 0.6, tall = r.h >= H * 0.6;
    if (wide && r.y <= 1) y = Math.max(y, r.y + r.h);
    else if (wide && r.y + r.h >= H - 1) y1 = Math.min(y1, r.y);
    else if (tall && r.x <= 1) x = Math.max(x, r.x + r.w);
    else if (tall && r.x + r.w >= W - 1) x1 = Math.min(x1, r.x);
    return x1 - x > 1 && y1 - y > 1 ? { x, y, w: x1 - x, h: y1 - y } : f;
  };
  for (const r of set?.rects || []) {
    if (r.level !== "danger") continue;
    const band = (r.w >= W * 0.6 && (r.y <= 1 || r.y + r.h >= H - 1)) || (r.h >= H * 0.6 && (r.x <= 1 || r.x + r.w >= W - 1));
    if (band) {
      content = cut(content, r);
      text = cut(text, r);
    } else if (r.check) corners.push(r);
  }
  for (const o of set?.outlines || []) if (o.style === "safe") text = intersect(text, o);
  text = intersect(text, content);
  return { content, text, corners, kind };
}

// ---- classification ---------------------------------------------------------------------

/** A wall or sky behind everything (spans a side and half the other) or a turned edge-to-edge shape. */
function isScenery(o, b, ow, oh) {
  const wide = b.w >= ow * BAND_SPAN, tall = b.h >= oh * BAND_SPAN;
  if ((wide && b.h >= oh * SCENE_SPAN) || (tall && b.w >= ow * SCENE_SPAN)) return true;
  return Boolean(o.angle) && (wide || tall);
}

function classify(objs, ow, oh) {
  const bgs = [], bands = [], scenery = [], content = [];
  for (const o of objs) {
    if (o.isPage || o.data?.guide) continue;
    const b = boxOf(o), t = hasText(o);
    if (!t && (o.isBg || (b.w >= ow * BG_COVER && b.h >= oh * BG_COVER))) bgs.push({ o, b });
    else if (!t && !o.angle && b.w >= ow * BAND_SPAN && b.h < oh * 0.5) bands.push({ o, b, dir: "h" });
    else if (!t && !o.angle && b.h >= oh * BAND_SPAN && b.w < ow * 0.5) bands.push({ o, b, dir: "v" });
    else if (!t && isScenery(o, b, ow, oh)) scenery.push({ o, b });
    else content.push({ o, b, text: t });
  }
  return { bgs, bands, scenery, content };
}

/** Group items that sit on top of each other (>= JOIN of the smaller one is covered). */
function clusterize(items) {
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i].b, b = items[j].b;
      const small = Math.min(area(a), area(b));
      if (small > 0 && overlap(a, b) >= small * JOIN) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  items.forEach((it, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(it);
  });
  return [...groups.values()].map((list) => ({
    items: list, box: union(list.map((x) => x.b)), text: list.some((x) => x.text), important: false,
  }));
}

/** The headline: the text drawn biggest. The hero: the biggest picture or shape. */
function findStars(items, ow, oh) {
  let headline = null, hero = null;
  const size = (o) => (Number(o.fontSize) || 0) * Math.abs(o.scaleY || 1);
  for (const it of items) {
    if (it.text && isTextObj(it.o) && (!headline || size(it.o) > size(headline.o)
      || (size(it.o) === size(headline.o) && area(it.b) > area(headline.b)))) headline = it;
    if (!it.text && area(it.b) >= ow * oh * 0.06 && (!hero || area(it.b) > area(hero.b))) hero = it;
  }
  return { headline, hero };
}

/** Clusters in reading order: rows top to bottom, left to right inside a row. */
function readingOrder(clusters) {
  const rows = [];
  for (const c of [...clusters].sort((a, b) => a.box.y - b.box.y)) {
    const cy = center(c.box).y;
    const row = rows.find((r) => cy >= r.y0 && cy <= r.y1);
    if (row) {
      row.list.push(c);
      row.y0 = Math.min(row.y0, c.box.y);
      row.y1 = Math.max(row.y1, c.box.y + c.box.h);
    } else rows.push({ y0: c.box.y, y1: c.box.y + c.box.h, list: [c] });
  }
  return rows.flatMap((r) => r.list.sort((a, b) => a.box.x - b.box.x));
}

// ---- moving clusters ----------------------------------------------------------------------

function moveCluster(cl, k, to) {
  const from = center(cl.box);
  for (const it of cl.items) place(it.o, k, from, to);
  cl.box = { x: to.x - (cl.box.w * k) / 2, y: to.y - (cl.box.h * k) / 2, w: cl.box.w * k, h: cl.box.h * k };
}

/** Shrink a cluster to fit frame f, then slide it inside. */
function containCluster(cl, f) {
  const k = Math.min(1, f.w / cl.box.w, f.h / cl.box.h);
  const w = cl.box.w * k, h = cl.box.h * k;
  const c = center(cl.box);
  const x = Math.min(Math.max(c.x - w / 2, f.x), f.x + f.w - w), y = Math.min(Math.max(c.y - h / 2, f.y), f.y + f.h - h);
  if (k === 1 && Math.abs(x - cl.box.x) < 0.01 && Math.abs(y - cl.box.y) < 0.01) return;
  moveCluster(cl, k, { x: x + w / 2, y: y + h / 2 });
}

/** Grow an important cluster as far as it can without covering more of the others. It may
 *  grow from its centre or from any side or corner, whichever leaves room. */
function boost(cl, others, frame, maxK) {
  const b0 = cl.box;
  const covered = (b) => others.reduce((n, o) => n + overlap(b, o.box), 0);
  const base = covered(b0);
  const ax = [0.5, 0, 1], ay = [0.5, 0, 1]; // which point of the box stays put
  const fits = (k) => {
    const w = b0.w * k, h = b0.h * k;
    if (w > frame.w + 0.5 || h > frame.h + 0.5) return null;
    for (const fy of ay) {
      for (const fx of ax) {
        const x = Math.min(Math.max(b0.x + b0.w * fx - w * fx, frame.x), frame.x + frame.w - w);
        const y = Math.min(Math.max(b0.y + b0.h * fy - h * fy, frame.y), frame.y + frame.h - h);
        const b = { x, y, w, h };
        if (covered(b) <= base + area(b0) * 0.02) return b;
      }
    }
    return null;
  };
  let lo = 1, hi = maxK, best = null;
  for (let i = 0; i < 9 && hi - lo > 0.01; i++) {
    const mid = (lo + hi) / 2;
    const b = fits(mid);
    if (b) { lo = mid; best = { k: mid, b }; } else hi = mid;
  }
  if (best && best.k > 1.02) moveCluster(cl, best.k, center(best.b));
}

/** Stack clusters top to bottom inside frame f, centred, with the stars filling the width. */
function stack(list, f, s0, H) {
  if (!list.length) return;
  const gap = H * 0.02;
  const want = list.map((cl) => {
    const fill = (f.w * 0.96) / cl.box.w;
    return cl.important ? Math.min(fill, (f.h * 0.55) / cl.box.h) : Math.min(fill, s0 * 1.2);
  });
  const gaps = gap * (list.length - 1);
  const total = list.reduce((n, cl, i) => n + cl.box.h * want[i], 0);
  const fit = Math.min(1, Math.max(0.05, (f.h - gaps) / Math.max(1, total)));
  const ks = want.map((k) => k * fit);
  const used = list.reduce((n, cl, i) => n + cl.box.h * ks[i], 0) + gaps;
  const extra = Math.min(H * 0.06, Math.max(0, (f.h - used) / (list.length + 1)));
  let y = f.y + Math.max(0, (f.h - used - extra * (list.length - 1)) / 2);
  list.forEach((cl, i) => {
    const h = cl.box.h * ks[i];
    moveCluster(cl, ks[i], { x: f.x + f.w / 2, y: y + h / 2 });
    y += h + gap + extra;
  });
}

// ---- text safety ----------------------------------------------------------------------------

function keepTextSafe(objs, safe, W, H) {
  let moved = 0;
  for (const o of objs) {
    if (!hasText(o) || o.isPage || o.data?.guide) continue;
    let b = boxOf(o);
    const f = safe.text;
    const k = Math.min(1, f.w / b.w, f.h / b.h);
    const c = center(b);
    const nw = b.w * k, nh = b.h * k;
    const x = Math.min(Math.max(c.x - nw / 2, f.x), f.x + f.w - nw), y = Math.min(Math.max(c.y - nh / 2, f.y), f.y + f.h - nh);
    if (k < 1 || Math.abs(x - b.x) > 0.5 || Math.abs(y - b.y) > 0.5) {
      place(o, k, c, { x: x + nw / 2, y: y + nh / 2 });
      moved++;
    }
    // Off corner overlays: the smallest move that keeps it in the safe area, else shrink.
    for (const z of safe.corners) {
      for (let tries = 0; tries < 4; tries++) {
        b = boxOf(o);
        if (!overlap(b, z)) break;
        const cands = [
          { x: z.x - b.w, y: b.y }, { x: z.x + z.w, y: b.y }, { x: b.x, y: z.y - b.h }, { x: b.x, y: z.y + z.h },
        ].filter((p) => inside({ ...p, w: b.w, h: b.h }, f))
          .sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y));
        const bc = center(b);
        if (cands.length) {
          const p = cands[0];
          place(o, 1, bc, { x: p.x + b.w / 2, y: p.y + b.h / 2 });
          moved++;
          break;
        }
        place(o, 0.85, bc, bc);
        moved++;
      }
    }
    // Never cut: whatever happened, the text ends up on the page.
    b = boxOf(o);
    if (!inside(b, { x: 0, y: 0, w: W, h: H })) {
      const kk = Math.min(1, W / b.w, H / b.h), bc = center(b);
      const w2 = b.w * kk, h2 = b.h * kk;
      place(o, kk, bc, { x: Math.min(Math.max(bc.x, w2 / 2), W - w2 / 2), y: Math.min(Math.max(bc.y, h2 / 2), H - h2 / 2) });
    }
  }
  return moved;
}

// ---- the layout ---------------------------------------------------------------------------

/**
 * Re-lay a page's objects from ow x oh to W x H (the caller resizes the page itself).
 * @param {import("fabric").FabricObject[]} objs the page's objects (the page rect is skipped)
 * @returns {{ mode: "fit"|"stack"|"columns", hero: string|null, headline: string|null, textMoved: number }}
 */
export function smartLayout(objs, ow, oh, W, H) {
  const safe = safeAreas(W, H);
  const fx = W / ow, fy = H / oh, s0 = Math.min(fx, fy), cover = Math.max(fx, fy);
  const { bgs, bands, scenery, content } = classify(objs, ow, oh);

  for (const { o, b } of bgs) {
    if (isPicture(o) || o.angle || o._objects) place(o, cover, { x: ow / 2, y: oh / 2 }, { x: W / 2, y: H / 2 });
    else stretchTo(o, b, { x: b.x * fx, y: b.y * fy, w: b.w * fx, h: b.h * fy });
  }
  for (const { o, b, dir } of bands) {
    if (dir === "h") {
      const h = b.h * s0, top = b.y <= oh * 0.02, bottom = b.y + b.h >= oh * 0.98;
      const y = top ? b.y * s0 : bottom ? H - (oh - b.y - b.h) * s0 - h : center(b).y * fy - h / 2;
      stretchTo(o, b, { x: b.x * fx, y, w: b.w * fx, h });
    } else {
      const w = b.w * s0, left = b.x <= ow * 0.02, right = b.x + b.w >= ow * 0.98;
      const x = left ? b.x * s0 : right ? W - (ow - b.x - b.w) * s0 - w : center(b).x * fx - w / 2;
      stretchTo(o, b, { x, y: b.y * fy, w, h: b.h * fy });
    }
  }

  // scenery keeps its spot on the page and scales evenly (bricks stay square) to cover it
  for (const { o, b } of scenery) {
    const nb = { x: b.x * fx, y: b.y * fy, w: b.w * fx, h: b.h * fy };
    place(o, Math.max(nb.w / b.w, nb.h / b.h), center(b), center(nb));
  }

  const clusters = clusterize(content);
  const { headline, hero } = findStars(content, ow, oh);
  for (const cl of clusters) {
    cl.important = cl.items.includes(headline) || cl.items.includes(hero);
    cl.hero = cl.items.includes(hero) && !cl.text;
    const b = cl.box;
    cl.bleeds = !cl.text && (b.x < -1 || b.y < -1 || b.x + b.w > ow + 1 || b.y + b.h > oh + 1);
    cl.edges = { l: b.x <= ow * 0.01, r: b.x + b.w >= ow * 0.99, t: b.y <= oh * 0.01, b: b.y + b.h >= oh * 0.99 };
  }
  const r0 = ow / oh, r1 = W / H;
  const toPortrait = r0 > FLIP && r1 < 1 / FLIP, toLandscape = r0 < 1 / FLIP && r1 > FLIP;
  const frameOf = (cl) => (cl.text ? safe.text : safe.content);
  let mode = "fit";

  if ((toPortrait || toLandscape) && clusters.length > 1) {
    const order = readingOrder(clusters);
    const heroCl = clusters.find((c) => c.hero);
    if (toLandscape && heroCl) {
      mode = "columns";
      const f = safe.text, gap = W * 0.03;
      const heroCol = { x: f.x + f.w * 0.55 + gap / 2, y: safe.content.y, w: f.w * 0.45 - gap / 2, h: safe.content.h };
      const textCol = { x: f.x, y: f.y, w: f.w * 0.55 - gap / 2, h: f.h };
      const k = Math.min(heroCol.w / heroCl.box.w, heroCol.h / heroCl.box.h);
      const hh = heroCl.box.h * k;
      const y = heroCl.edges.b ? safe.content.y + safe.content.h - hh / 2 : heroCol.y + heroCol.h / 2;
      moveCluster(heroCl, k, { x: heroCol.x + heroCol.w / 2, y });
      stack(order.filter((c) => c !== heroCl), textCol, s0, H);
    } else {
      mode = "stack";
      stack(order, safe.text, s0, H);
      // A hero that stood on the bottom edge (a cut-off person) stands on it again.
      const last = order[order.length - 1];
      if (last?.hero && last.edges.b) {
        const c = center(last.box);
        moveCluster(last, 1, { x: c.x, y: safe.content.y + safe.content.h - last.box.h / 2 });
      }
    }
  } else {
    for (const cl of clusters) {
      const b = cl.box, w = b.w * s0, h = b.h * s0;
      let x = center(b).x * fx - w / 2, y = center(b).y * fy - h / 2;
      if (cl.edges.l) x = b.x * s0;
      else if (cl.edges.r) x = W - (ow - b.x - b.w) * s0 - w;
      if (cl.edges.t) y = b.y * s0;
      else if (cl.edges.b) y = H - (oh - b.y - b.h) * s0 - h;
      moveCluster(cl, s0, { x: x + w / 2, y: y + h / 2 });
    }
    for (const cl of clusters) if (!cl.bleeds) containCluster(cl, frameOf(cl));
    const maxK = Math.min(MAX_BOOST, cover / s0);
    for (const cl of clusters.filter((c) => c.important).sort((a, b) => area(b.box) - area(a.box))) {
      if (maxK > 1.02 && !cl.bleeds) boost(cl, clusters.filter((c) => c !== cl), frameOf(cl), maxK);
    }
  }
  const textMoved = keepTextSafe(objs, safe, W, H);
  return { mode, hero: hero?.o.name || null, headline: headline?.o.name || null, textMoved };
}
