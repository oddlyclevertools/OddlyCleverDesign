// Smart recolour: map every colour in the design onto a palette by role.
//  - the page colour (and its gradient stops) becomes the palette background;
//  - greys, black and white follow the background's light/dark polarity (text stays readable);
//  - real colours are ranked by how much of the design they cover: the biggest becomes "main",
//    then the accents, then lighter / darker variants;
//  - a last pass checks every text against what is behind it and swaps it to a readable colour.
// The mapping is one-to-one, so a later palette maps from the design's ORIGINAL colours
// (see `session`), and shuffling never drifts.
import { Gradient, Shadow } from "fabric";
import { isText } from "../text/helpers.js";
import { normalizeEffect } from "../text/effects.js";
import { parse, hexOf, cssOf, toHsl, mix, shade, luminance, contrast, isNeutral } from "./color.js";
import { refitGroups } from "./recorder.js";

/** Effect colour keys in obj.data.effect (null values mean "match the text" and are skipped). */
const FX_COLOR_KEYS = ["color", "colorA", "colorB", "edge"]; // chrome "tint" (the metal) stays

/** Objects whose colours must never change (the cast, photos, the background image). */
export function keepsColors(o) {
  const d = o.data || {};
  if (d.keepColors || d.character || d.cast || d.kind === "character" || d.kind === "image" || d.kind === "upload") return true;
  if (o.isBg || o._element || typeof o.getSrc === "function") return true;
  return false;
}

// ---- walking every colour in the design ------------------------------------------------------

/**
 * Walk each colour on the page and objects. `visit(css, info)` returns the new CSS colour (or the
 * same string). When `rec` is given, changed values are written through it (a Recorder).
 * info: { page, stop, stops, text, area }
 */
export function walkColors(editor, visit, rec = null) {
  const page = editor.page;
  if (page) {
    const area = editor.width * editor.height;
    const nf = mapFill(page.fill, (c, i, n) => visit(c, { page: true, stop: i, stops: n, area: area / n }));
    if (rec && nf !== page.fill) rec.set(page, "fill", nf);
    const df = page.data?.fill;
    if (df && typeof df === "object" && Array.isArray(df.stops)) {
      const n = df.stops.length;
      const stops = df.stops.map((s, i) => ({ ...s, color: visit(s.color, { page: true, stop: i, stops: n, area: area / n }) }));
      if (rec && stops.some((s, i) => s.color !== df.stops[i].color)) rec.set(page, "data", { ...page.data, fill: { ...df, stops } });
    } else if (typeof df === "string") {
      const v = visit(df, { page: true, stop: 0, stops: 1, area });
      if (rec && v !== df) rec.set(page, "data", { ...page.data, fill: v });
    }
  }
  const walk = (o) => {
    if (!o || o.isPage || keepsColors(o)) return;
    if (o._objects && !isText(o)) {
      o._objects.forEach(walk);
      return;
    }
    const r = o.getBoundingRect();
    const area = Math.max(1, r.width * r.height);
    const text = isText(o);
    const info = { text, area: text ? area * 0.6 : area };

    const nf = mapFill(o.fill, (c, i, n) => visit(c, { ...info, area: info.area / n }));
    if (rec && nf !== o.fill) rec.set(o, "fill", nf);
    if (o.stroke && o.strokeWidth) {
      const ns = mapFill(o.stroke, (c) => visit(c, { ...info, area: info.area * 0.15, stroke: true }));
      if (rec && ns !== o.stroke) rec.set(o, "stroke", ns);
    }
    if (o.shadow?.color) {
      const c = visit(o.shadow.color, { area: 1, shadow: true });
      if (rec && c !== o.shadow.color) rec.set(o, "shadow", new Shadow({ ...o.shadow.toObject(), color: c }));
    }
    if (text) {
      const fx = normalizeEffect(o.data?.effect);
      if (fx) {
        let changed = false;
        const next = {};
        for (const [id, p] of Object.entries(fx)) {
          const q = { ...p };
          for (const k of FX_COLOR_KEYS) {
            if (typeof q[k] !== "string") continue;
            const v = visit(q[k], { area: info.area * 0.25, effect: id });
            if (v !== q[k]) { q[k] = v; changed = true; }
          }
          next[id] = q;
        }
        if (rec && changed) rec.set(o, "data", { ...o.data, effect: next });
      }
      const styles = mapCharStyles(o.styles, (c) => visit(c, { ...info, area: 1 }));
      if (rec && styles !== o.styles) rec.set(o, "styles", styles);
    }
  };
  editor.objects().forEach(walk);
}

/** A fill (CSS string or Gradient) with every colour passed through fn; same ref if unchanged. */
function mapFill(fill, fn) {
  if (typeof fill === "string") {
    if (!parse(fill)) return fill;
    const v = fn(fill, 0, 1);
    return v === fill ? fill : v;
  }
  if (fill instanceof Gradient || fill?.colorStops) {
    const n = fill.colorStops.length;
    let changed = false;
    const colorStops = fill.colorStops.map((s, i) => {
      if (!parse(s.color)) return { ...s };
      const v = fn(s.color, i, n);
      if (v !== s.color) changed = true;
      return { ...s, color: v };
    });
    if (!changed) return fill;
    return new Gradient({
      type: fill.type, gradientUnits: fill.gradientUnits, coords: { ...fill.coords }, colorStops,
      offsetX: fill.offsetX, offsetY: fill.offsetY, gradientTransform: fill.gradientTransform ? [...fill.gradientTransform] : null,
    });
  }
  return fill;
}

function mapCharStyles(styles, fn, keys = ["fill", "stroke", "textBackgroundColor"]) {
  if (!styles || typeof styles !== "object") return styles;
  let changed = false;
  const out = {};
  for (const [line, chars] of Object.entries(styles)) {
    out[line] = {};
    for (const [ch, st] of Object.entries(chars || {})) {
      const s = { ...st };
      for (const k of keys) {
        if (typeof s[k] === "string" && parse(s[k])) {
          const v = fn(s[k]);
          if (v !== s[k]) { s[k] = v; changed = true; }
        }
      }
      out[line][ch] = s;
    }
  }
  return changed ? out : styles;
}

// ---- the mapping -----------------------------------------------------------------------------

/** Remembers which original colour produced each colour we wrote, per design. */
const session = { key: null, reverse: new Map() };
const sessionFor = (key) => {
  if (session.key !== key) { session.key = key; session.reverse = new Map(); }
  return session;
};
const baseHex = (hex) => session.reverse.get(hex) || hex;

const PERMS = [[0, 1, 2], [1, 0, 2], [2, 1, 0], [0, 2, 1], [1, 2, 0], [2, 0, 1]];
/** How many different looks Shuffle cycles through for one palette. */
export const VARIATIONS = 12;

/** The palette's colours for a variation: accent order and light/dark swap. */
export function resolvePalette(p, variation = 0) {
  const roles = [p.main, p.a1, p.a2].map(parse);
  const perm = PERMS[variation % PERMS.length];
  let bg = parse(p.bg), ink = parse(p.ink);
  if (Math.floor(variation / PERMS.length) % 2 === 1) [bg, ink] = [ink, bg];
  const [dark, light] = luminance(bg) < luminance(ink) ? [bg, ink] : [ink, bg];
  return { bg, ink, dark, light, main: roles[perm[0]], a1: roles[perm[1]], a2: roles[perm[2]] };
}

/** Collect the design's colours (by original colour) with how much area each covers. */
function survey(editor) {
  const stats = new Map();
  let pageColor = null;
  walkColors(editor, (css, info) => {
    const c = parse(css);
    if (!c || c.a < 0.02) return css;
    const hex = baseHex(hexOf(c));
    const s = stats.get(hex) || { hex, c: parse(hex), weight: 0, page: false, pageStop: Infinity, text: 0 };
    s.weight += info.area || 1;
    if (info.page) {
      s.page = true;
      s.pageStop = Math.min(s.pageStop, info.stop);
      if (info.stop === 0 && !pageColor) pageColor = s.c;
    }
    if (info.text) s.text++;
    stats.set(hex, s);
    return css;
  });
  return { stats: [...stats.values()].sort((a, b) => b.weight - a.weight), pageColor: pageColor || parse("#ffffff") };
}

/** base hex -> new {r,g,b}. One to one: two original colours never land on the same output. */
function buildMap(stats, pageColor, P) {
  const out = new Map();
  const used = new Set();
  const lBg = toHsl(pageColor).l;
  const wasLight = luminance(pageColor) > 0.4;
  const isLight = luminance(P.bg) > luminance(P.ink);
  const flipped = wasLight !== isLight;
  const bgNeutral = isNeutral(pageColor);
  const slots = [P.main, P.a1, P.a2];
  let rank = 0;

  for (const s of stats) {
    const { l } = toHsl(s.c);
    let c;
    if (s.page) {
      c = s.pageStop === 0 ? P.bg : mix(shade(P.bg, isLight ? -0.06 * s.pageStop : 0.07 * s.pageStop), P.main, 0.16 * s.pageStop);
    } else if (isNeutral(s.c)) {
      if (bgNeutral && Math.abs(l - lBg) < 0.1) {
        // a panel just off the page colour: keep it just off the new page colour
        const d = Math.max(0.03, Math.abs(l - lBg));
        const sign = flipped ? (isLight ? -1 : 1) : Math.sign(l - lBg) || (isLight ? -1 : 1);
        c = shade(P.bg, d * sign);
      } else {
        const t = flipped ? 1 - l : l;
        c = mix(P.dark, P.light, Math.max(0, Math.min(1, (t - 0.12) / 0.76)));
      }
    } else {
      const slot = slots[rank % 3];
      const tier = Math.floor(rank / 3);
      rank++;
      // variants move away from the page colour, so they stay visible on it
      c = tier === 0 ? slot : shade(slot, (isLight ? -0.15 : 0.15) * Math.min(tier, 3));
      if (l < 0.2) c = mix(c, P.dark, 0.55);
      else if (l > 0.9) c = mix(c, P.light, 0.6);
    }
    // keep it one to one
    let hex = hexOf(c);
    for (let k = 1; used.has(hex) && k < 10; k++) hex = hexOf(shade(c, (isLight ? -0.035 : 0.035) * k));
    used.add(hex);
    out.set(s.hex, parse(hex));
  }
  return out;
}

// ---- readability -----------------------------------------------------------------------------

const solid = (fill) => {
  if (typeof fill === "string") return parse(fill);
  const st = fill?.colorStops;
  if (!st?.length) return null;
  const cs = st.map((s) => parse(s.color)).filter(Boolean);
  if (!cs.length) return null;
  return cs.reduce((a, b) => mix(a, b, 0.5));
};

/** The colour right behind a text: the topmost solid shape under its centre, else the page. */
function behind(editor, text, ordered) {
  const top = text.parent && !text.parent.isPage ? outermost(text) : text;
  const idx = ordered.indexOf(top);
  const p = text.getCenterPoint();
  for (let i = idx - 1; i >= 0; i--) {
    const o = ordered[i];
    if (o.isPage || isText(o) || (o.opacity ?? 1) < 0.6 || o._objects) continue;
    if (!o.containsPoint?.(p)) continue;
    if (o._element) return null; // a photo: can't judge
    const c = solid(o.fill);
    if (c && c.a > 0.6) return c;
  }
  return solid(editor.page?.fill) || parse("#ffffff");
}
const outermost = (o) => { let g = o; while (g.parent && !g.parent.isPage) g = g.parent; return g; };

/** The colour a text's letters must stand out from: its outline, sticker, box, or what's behind. */
function edgeOf(editor, t, ordered) {
  const fx = normalizeEffect(t.data?.effect);
  if (fx?.outline && fx.outline.thickness >= 15) return parse(fx.outline.color);
  if (fx?.sticker) return parse(fx.sticker.color);
  if (fx?.background && fx.background.transparency < 50) return parse(fx.background.color);
  if (typeof t.stroke === "string" && t.strokeWidth >= t.fontSize * 0.04) return parse(t.stroke);
  return behind(editor, t, ordered);
}

/** Swap unreadable text colours (the fill and coloured words) for a readable palette colour. */
function fixContrast(editor, P, rec) {
  const ordered = editor.objects();
  const texts = [];
  const walk = (o) => {
    if (keepsColors(o)) return;
    if (isText(o)) texts.push(o);
    else o._objects?.forEach(walk);
  };
  ordered.forEach(walk);
  const readable = (css, back) => {
    const fill = parse(css);
    if (!fill || contrast(fill, back) >= 3) return css;
    let pick = null;
    if (!isNeutral(fill)) {
      // keep it colourful: the palette colours, then deeper / lighter versions of them
      const away = luminance(back) > 0.4 ? -1 : 1;
      for (const d of [0, 0.1, 0.2, 0.3, 0.4]) {
        pick = [P.main, P.a1, P.a2].map((c) => shade(c, away * d)).find((c) => contrast(c, back) >= 3 && toHsl(c).s > 0.25);
        if (pick) break;
      }
    }
    if (!pick) pick = contrast(P.light, back) >= contrast(P.dark, back) ? P.light : P.dark;
    return cssOf({ ...pick, a: fill.a });
  };
  for (const t of texts) {
    const back = edgeOf(editor, t, ordered);
    if (!back) continue;
    if (typeof t.fill === "string") {
      const v = readable(t.fill, back);
      if (v !== t.fill) rec.set(t, "fill", v);
    }
    const styles = mapCharStyles(t.styles, (css) => readable(css, back), ["fill"]);
    if (styles !== t.styles) rec.set(t, "styles", styles);
  }
}

// ---- public ----------------------------------------------------------------------------------

/**
 * Recolour the whole design with palette `p` (variation for Shuffle), writing through `rec`.
 * Returns how many colours changed.
 */
export function recolor(app, p, variation, rec) {
  const ed = app.editor;
  sessionFor(app.project?.id || "none");
  const P = resolvePalette(p, variation);
  const { stats, pageColor } = survey(ed);
  const map = buildMap(stats, pageColor, P);
  walkColors(ed, (css) => {
    const c = parse(css);
    if (!c) return css;
    const to = map.get(baseHex(hexOf(c)));
    if (!to) return css;
    return cssOf({ ...to, a: c.a });
  }, rec);
  fixContrast(ed, P, rec);
  refitGroups([...rec.saved.keys()]);
  ed.canvas.requestRenderAll();
  return { map, P };
}

/** After a recolour is kept: remember output -> original, so the next palette maps cleanly. */
export function rememberMap(app, map) {
  const s = sessionFor(app.project?.id || "none");
  const reverse = new Map();
  for (const [base, to] of map) reverse.set(hexOf(to), base);
  s.reverse = reverse;
}

/** Forget the original colours (after the user edits colours by hand). */
export function forgetMap() { session.reverse = new Map(); }
