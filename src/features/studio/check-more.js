// More "Check my design" checks for thumbnails: too many big words, a main picture (face or
// hero) too small to read at feed size, and a video title the feed cuts after two lines.
// Each finding has a one-click fix where one is safe; nothing here deletes words or pictures.
import { subjectPoint } from "../ai/toolkit/collage.js";
import { readMeta } from "./feed.js";
import { boxOf, scaleOf } from "./geom.js";
import { worstFit } from "./title.js";

const MAX_BIG_WORDS = 5;    // thumbnails read best with 5 big words or fewer
const BIG_TEXT = 0.08;      // a word is "big" from 8% of the page height (58 px on a 1280 × 720 thumbnail)
const SHRINK_TO = 0.5;      // extra words shrink to half their size…
const SHRINK_MAX = 0.8;     // …and at most to 80% of "big", but never below readable at feed size
const READABLE_PX = 12;     // feed pixels: the small-text check asks for 11 or more
const FEED_WIDTH = { "yt-thumb": 360, shorts: 210 };
const HERO_MIN = 0.42;      // the main picture should fill at least this much of the page height…
const HERO_TARGET = 0.66;   // …and the fix makes it about this tall
const BACKDROP = 0.9;       // a picture covering 90% of the page is the backdrop, not the hero
const ALPHA_SIDE = 96;      // size of the copy used to find a cut-out's visible part
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu;

const shortText = (t) => {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  return s.length > 28 ? `"${s.slice(0, 26)}…"` : `"${s}"`;
};

function commitFix(app, label, fn) {
  return async () => {
    const ed = app.editor;
    ed.canvas.discardActiveObject();
    fn();
    ed.canvas.requestRenderAll();
    ed.commit(label);
  };
}

// ---- too many words ------------------------------------------------------------------------

/** Every word of a text with its size on the page: [{ start, end, size }]. */
function wordsOf(obj) {
  const text = obj.text || "", k = scaleOf(obj), out = [];
  for (const m of text.matchAll(WORD)) {
    const st = typeof obj.getStyleAtPosition === "function" ? obj.getStyleAtPosition(m.index, true) : null;
    out.push({ start: m.index, end: m.index + m[0].length, size: (st?.fontSize || obj.fontSize || 0) * k });
  }
  return out;
}

/**
 * More than about five big words on a thumbnail. Fix: the biggest words (the headline) stay big
 * and the extra ones shrink, so nothing is deleted and Ctrl+Z puts it back.
 */
export function checkWords(app, texts, kind) {
  if (kind && !["yt-thumb", "shorts"].includes(kind)) return [];
  const ed = app.editor, big = ed.height * BIG_TEXT;
  const words = [];
  texts.forEach(({ obj, top }, order) => {
    if (obj !== top || !(obj.text || "").trim()) return; // grouped text is part of a sticker or badge
    for (const w of wordsOf(obj)) if (w.size >= big) words.push({ ...w, obj, order });
  });
  if (words.length <= MAX_BIG_WORDS) return [];
  // The headline is the biggest text: keep whole texts, biggest first, while they fit in five
  // words. A headline that alone has more keeps its first five words.
  const readable = READABLE_PX / ((FEED_WIDTH[kind] || 360) / ed.width);
  const objs = [...new Set(words.map((w) => w.obj))];
  const per = objs.map((obj) => ({ obj, list: words.filter((w) => w.obj === obj) }))
    .sort((a, b) => Math.max(...b.list.map((w) => w.size)) - Math.max(...a.list.map((w) => w.size)) || a.list[0].order - b.list[0].order);
  const keep = new Set();
  for (const { list } of per) {
    if (keep.size + list.length <= MAX_BIG_WORDS) list.forEach((w) => keep.add(w));
    else if (!keep.size) list.slice(0, MAX_BIG_WORDS).forEach((w) => keep.add(w));
  }
  // Shrink from each extra word to the next kept one, so the spaces between shrink too.
  const extra = [];
  for (const { obj, list } of per) {
    const out = list.filter((w) => !keep.has(w));
    if (!out.length) continue;
    const end = list.some((w) => keep.has(w) && w.start > out[0].start) ? out.at(-1).end : (obj.text || "").length;
    extra.push({ obj, start: out[0].start, end, size: Math.max(...out.map((w) => w.size)) });
  }
  return [{
    id: "words", severity: words.length > MAX_BIG_WORDS + 3 ? "fix" : "look", targets: objs,
    title: `${words.length} big words on the thumbnail`,
    text: `Thumbnails are read in about a second, so ${MAX_BIG_WORDS} big words or fewer work best. Cut some, or shrink the extra words so your headline (${shortText(keep.size ? [...keep].sort((a, b) => a.order - b.order || a.start - b.start).map((w) => w.obj.text.slice(w.start, w.end)).join(" ") : "")}) stands out.`,
    fix: {
      label: "Shrink the extra words",
      run: commitFix(app, "Shrink extra words", () => {
        for (const w of extra) {
          const k = scaleOf(w.obj);
          const size = Math.max(readable, Math.min(w.size * SHRINK_TO, big * SHRINK_MAX));
          const c = w.obj.getCenterPoint();
          if (typeof w.obj.setSelectionStyles === "function") w.obj.setSelectionStyles({ fontSize: Math.round(size / k) }, w.start, w.end);
          w.obj.initDimensions?.();
          w.obj.setPositionByOrigin(c, "center", "center");
          w.obj.setCoords();
          w.obj.dirty = true;
        }
      }),
    },
  }];
}

// ---- the main picture is too small ---------------------------------------------------------

const isPicture = (o) => typeof o.getElement === "function" && !o.isBg && !o.data?.guide && !o.data?.overlay && !o.data?.empty;
const isCharacter = (o) => Boolean(o.data?.character);

/** The visible part of a picture (its non-transparent pixels) as 0..1 fractions of the object. */
function visibleFraction(o) {
  if (!isPicture(o)) return { x: 0, y: 0, w: 1, h: 1 };
  try {
    const src = o.getElement();
    const nw = src.naturalWidth || src.width, nh = src.naturalHeight || src.height;
    const cx = o.cropX || 0, cy = o.cropY || 0, w = o.width || nw, h = o.height || nh;
    const k = ALPHA_SIDE / Math.max(w, h);
    const cw = Math.max(2, Math.round(w * k)), ch = Math.max(2, Math.round(h * k));
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(src, cx, cy, w, h, 0, 0, cw, ch);
    const d = ctx.getImageData(0, 0, cw, ch).data;
    let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        if (d[(y * cw + x) * 4 + 3] < 40) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return null;
    return { x: x0 / cw, y: y0 / ch, w: (x1 - x0 + 1) / cw, h: (y1 - y0 + 1) / ch };
  } catch {
    return { x: 0, y: 0, w: 1, h: 1 }; // a picture the browser won't read back: use its box
  }
}

/** The page box of part of an object (fractions of its own box). */
function partBox(o, f) {
  const b = boxOf(o);
  if (o.angle % 360) return b; // rotated: the whole box is close enough
  return { x: b.x + f.x * b.w, y: b.y + f.y * b.h, w: f.w * b.w, h: f.h * b.h };
}

/** Where the face or subject is, in page coordinates (subject detection on the picture). */
function subjectOnPage(o, vis) {
  const b = partBox(o, vis);
  if (!isPicture(o)) return { x: b.x + b.w / 2, y: b.y + b.h * 0.3 };
  try {
    const src = o.getElement();
    const p = subjectPoint(src);
    const nw = src.naturalWidth || src.width, nh = src.naturalHeight || src.height;
    const fx = (p.x * nw - (o.cropX || 0)) / (o.width || nw), fy = (p.y * nh - (o.cropY || 0)) / (o.height || nh);
    const box = boxOf(o);
    return { x: box.x + Math.min(1, Math.max(0, fx)) * box.w, y: box.y + Math.min(1, Math.max(0, fy)) * box.h };
  } catch {
    return { x: b.x + b.w / 2, y: b.y + b.h * 0.3 };
  }
}

/**
 * The biggest picture or character (not the backdrop) is the hero. On a thumbnail it should
 * fill a good part of the height, or the face is a few pixels tall in the feed. Fix: scale it
 * up around the face, keeping it on the page (the bottom may run off, as cut-outs do).
 */
export function checkHero(app, kind) {
  if (kind && !["yt-thumb", "shorts"].includes(kind)) return [];
  const ed = app.editor, W = ed.width, H = ed.height;
  const cands = ed.objects().filter((o) => o.visible !== false && (isPicture(o) || isCharacter(o)) && !o.locked)
    .map((o) => ({ o, b: boxOf(o) }))
    .filter(({ b }) => b.w * b.h < W * H * BACKDROP)
    .sort((p, q) => q.b.w * q.b.h - p.b.w * p.b.h);
  if (!cands.length) return [];
  const hero = cands[0].o;
  const vis = visibleFraction(hero);
  if (!vis) return [];
  const shown = partBox(hero, vis);
  const onPage = Math.min(H, shown.y + shown.h) - Math.max(0, shown.y);
  const share = onPage / H;
  if (share >= HERO_MIN) return [];
  const feedPx = Math.round(share * (kind === "shorts" ? 374 : 202));
  const what = isCharacter(hero) ? "Your character" : vis.w < 0.98 || vis.h < 0.98 ? "Your cut-out" : "Your main picture";
  return [{
    id: `hero-${hero.id || "main"}`, severity: share < HERO_MIN * 0.6 ? "fix" : "look", targets: [hero], rect: shown,
    title: "The face or main picture is small",
    text: `${what} fills ${Math.round(share * 100)}% of the height, about ${feedPx} px tall in the feed. Faces and heroes read best at ${Math.round(HERO_MIN * 100)}% or more.`,
    fix: {
      label: "Make the picture bigger",
      run: commitFix(app, "Bigger main picture", () => {
        const f = Math.min(4, (HERO_TARGET * H) / Math.max(1, shown.h));
        const anchor = subjectOnPage(hero, vis);
        const c = hero.getCenterPoint();
        hero.set({ scaleX: hero.scaleX * f, scaleY: hero.scaleY * f });
        // Scale about the face: it stays where it was while everything grows around it.
        hero.setPositionByOrigin({ x: anchor.x + (c.x - anchor.x) * f, y: anchor.y + (c.y - anchor.y) * f }, "center", "center");
        hero.setCoords();
        // Keep the visible part on the page: inside left, right and top; it may run off the bottom.
        const nb = partBox(hero, vis);
        const margin = Math.min(W, H) * 0.02;
        const dx = nb.w > W - 2 * margin ? W / 2 - (nb.x + nb.w / 2) : Math.max(margin - nb.x, Math.min(0, W - margin - (nb.x + nb.w)));
        const dy = Math.max(margin - nb.y, Math.min(0, H - (nb.y + nb.h * 0.15)));
        hero.set({ left: hero.left + dx, top: hero.top + dy });
        hero.setCoords();
      }),
    },
  }];
}

// ---- the video title -----------------------------------------------------------------------

/** The title typed into the feed preview, if the feed would cut it. Fix: open the preview at the title. */
export function checkTitle(app, kind, openFeed) {
  if (kind !== "yt-thumb" || !app.project) return [];
  const meta = readMeta(app.project.id, app.project.name || "");
  const fit = worstFit(meta.title);
  if (fit.fits) return [];
  return [{
    id: "title", severity: "look", targets: [],
    title: "The title gets cut in the feed",
    text: `On ${fit.label} the title stops after two lines: "${fit.shown}…". People never see "${fit.hidden}". Put the words that matter first.`,
    fix: openFeed ? { label: "Edit the title", run: async () => openFeed({ focusTitle: true }), keep: true } : null,
  }];
}

