// "Check my design": plain-English findings about readability, contrast, edges, safe zones,
// fonts, file size, too many words, a small face or hero, and a title the feed cuts (the last
// three live in check-more.js). Each finding: { id, severity: "fix" | "look", title, text, targets,
// rect, fix?: { label, run() } }. Nothing here changes the design unless a Fix runs.
import { contrast, fillColor, luminance, contrastOf, parseColor } from "./color.js";
import { boxOf, isText, moveInside, moveOutOf, overlapArea, pageFontSize, walk } from "./geom.js";
import { printDpi } from "./zones.js";
import { checkHero, checkTitle, checkWords } from "./check-more.js";

const YT_LIMIT = 2_000_000;      // bytes; YouTube's thumbnail limit is 2 MB
const MAX_FONTS = 3;
const MIN_CONTRAST = 3;          // WCAG large-text minimum
const SAMPLE_SIDE = 480;         // contrast sampling render size (long side)
const TINY_PX = 7, SMALL_PX = 11; // readable font size at feed size, in screen pixels

/** How a design is seen, by zone kind: the width it shows at, in plain words. */
function viewing(kind, W, H) {
  switch (kind) {
    case "yt-thumb": return { scale: 360 / W, where: "YouTube's home page (360 px wide)" };
    case "shorts": return { scale: 210 / W, where: "the Shorts shelf (210 px wide)" };
    case "story": return { scale: 390 / W, where: "a phone screen" };
    case "banner": return { scale: 390 / (1546 * (W / 2560)), where: "a phone's channel page" };
    case "ig-grid": return { scale: 390 / W, where: "a phone's feed" };
    case "print": return { scale: 1, where: "print", print: true, dpi: printDpi(W, H) };
    default: return { scale: Math.min(1, 600 / Math.max(W, H)), where: "a typical screen" };
  }
}

const shortText = (o) => {
  const t = (o.text || "").replace(/\s+/g, " ").trim();
  return t.length > 28 ? `"${t.slice(0, 26)}…"` : `"${t}"`;
};

const moveBy = (o, { dx, dy }) => { o.set({ left: o.left + dx, top: o.top + dy }); o.setCoords(); };

function fixRun(app, label, fn) {
  return async () => {
    const ed = app.editor;
    ed.canvas.discardActiveObject();
    fn();
    ed.canvas.requestRenderAll();
    ed.commit(label);
  };
}

// ---- individual checks ---------------------------------------------------------------------

function checkTextSize(app, texts, view) {
  const out = [];
  for (const { obj, top } of texts) {
    const size = pageFontSize(obj, Math.min);
    let shown, severity;
    if (view.print) {
      const pt = (size / view.dpi) * 72;
      if (pt >= 7) continue;
      shown = `${pt.toFixed(1)} pt`;
      severity = pt < 5 ? "fix" : "look";
    } else {
      const px = size * view.scale;
      if (px >= SMALL_PX) continue;
      shown = `about ${Math.max(1, Math.round(px))} px tall`;
      severity = px < TINY_PX ? "fix" : "look";
    }
    const want = view.print ? (8 / 72) * view.dpi : (SMALL_PX + 2) / view.scale;
    out.push({
      id: `size-${obj.id || out.length}`, severity, targets: [top], rect: boxOf(obj),
      title: severity === "fix" ? "Text too small to read" : "Text may be hard to read",
      text: `${shortText(obj)} is ${shown} on ${view.where}. Make it bigger or cut it.`,
      fix: top === obj ? {
        label: "Make it bigger",
        run: fixRun(app, "Bigger text", () => {
          const f = want / pageFontSize(obj, Math.min);
          const c = obj.getCenterPoint();
          const grow = { fontSize: Math.ceil(obj.fontSize * f), styles: scaleStyles(obj.styles, f) };
          // A text box keeps its line breaks when it grows with its letters (capped at the page).
          if (/textbox/i.test(obj.type)) grow.width = Math.min(obj.width * f, app.editor.width * 0.9 / (obj.scaleX || 1));
          obj.set(grow);
          obj.initDimensions?.();
          obj.setPositionByOrigin(c, "center", "center");
          const mv = moveInside(boxOf(obj), app.editor.width, app.editor.height);
          if (mv) moveBy(obj, mv);
        }),
      } : null,
    });
  }
  return out;
}

function scaleStyles(styles, f) {
  if (!styles) return styles;
  const out = {};
  for (const [ln, line] of Object.entries(styles)) {
    out[ln] = {};
    for (const [ch, st] of Object.entries(line || {})) out[ln][ch] = st?.fontSize ? { ...st, fontSize: Math.ceil(st.fontSize * f) } : st;
  }
  return out;
}

/** Render the page without `obj` and measure the pixels behind it. */
function backgroundBehind(ed, obj, rect) {
  const scale = Math.min(1, SAMPLE_SIDE / Math.max(ed.width, ed.height));
  const parents = [];
  for (let p = obj.group; p; p = p.group) parents.push(p);
  const was = obj.visible;
  obj.visible = false;
  for (const p of parents) p.dirty = true;
  let cv;
  try {
    cv = ed.renderPage({ scale });
  } finally {
    obj.visible = was;
    for (const p of parents) p.dirty = true;
  }
  const x = Math.max(0, Math.floor(rect.x * scale)), y = Math.max(0, Math.floor(rect.y * scale));
  const x2 = Math.min(cv.width, Math.ceil((rect.x + rect.w) * scale));
  const y2 = Math.min(cv.height, Math.ceil((rect.y + rect.h) * scale));
  if (x2 - x < 1 || y2 - y < 1) return null;
  const px = cv.getContext("2d", { willReadFrequently: true }).getImageData(x, y, x2 - x, y2 - y).data;
  const lums = [];
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < px.length; i += 4) {
    r += px[i]; g += px[i + 1]; b += px[i + 2];
    lums.push(luminance({ r: px[i], g: px[i + 1], b: px[i + 2] }));
  }
  const n = lums.length;
  return { mean: { r: r / n, g: g / n, b: b / n }, lums };
}

function checkContrast(app, texts) {
  const ed = app.editor, out = [];
  for (const { obj, top } of texts) {
    const fill = fillColor(obj.fill);
    if (!fill || fill.a < 0.15 || !(obj.text || "").trim()) continue;
    const rect = boxOf(obj);
    // A text drawn on its own plate (the "background" effect, e.g. paper labels) is read against
    // that plate: hiding the text to sample the page would hide the plate too.
    const plate = obj.effect?.background;
    const plateColor = plate && (plate.transparency ?? 0) <= 40 ? parseColor(plate.color) : null;
    const bg = plateColor ? { mean: plateColor, lums: [luminance(plateColor)] } : backgroundBehind(ed, obj, rect);
    if (!bg) continue;
    const fs = obj.fontSize || 1;
    const stroke = obj.strokeWidth >= fs * 0.04 ? parseColor(obj.stroke) : null;
    const sh = obj.shadow;
    const shadow = sh && (sh.blur >= fs * 0.04 || Math.hypot(sh.offsetX || 0, sh.offsetY || 0) >= fs * 0.03) ? parseColor(sh.color) : null;
    const halo = [stroke, shadow && shadow.a >= 0.55 ? shadow : null].filter(Boolean);
    let ratio = contrast(fill, bg.mean);
    for (const h of halo) ratio = Math.max(ratio, contrast(fill, h));
    const fl = luminance(fill);
    const weak = bg.lums.filter((l) => contrastOf(l, fl) < 1.6).length / bg.lums.length;
    const busy = !halo.length && weak > 0.45 && ratio < 4.5;
    if (ratio >= MIN_CONTRAST && !busy) continue;
    const dark = fl > 0.3; // light words get a dark outline, dark words a light one
    out.push({
      id: `contrast-${obj.id || out.length}`, severity: ratio < 2 ? "fix" : "look", targets: [top], rect,
      title: "Text blends into the background",
      text: `${shortText(obj)} doesn't stand out enough from what's behind it (contrast ${ratio.toFixed(1)} : 1, aim for 3 or more). An outline makes it pop.`,
      fix: {
        label: dark ? "Add a dark outline" : "Add a light outline",
        run: fixRun(app, "Outline text", () => {
          obj.set({ stroke: dark ? "#16121b" : "#ffffff", strokeWidth: Math.max(2, Math.round(fs * 0.09)), paintFirst: "stroke", strokeLineJoin: "round" });
          if (top !== obj) top.dirty = true;
        }),
      },
    });
  }
  return out;
}

function checkEdges(app, all) {
  const { width: W, height: H } = app.editor, out = [];
  for (const { obj, top } of all) {
    if (obj !== top && !isText(obj)) continue;
    if (obj.isBg) continue;
    const b = boxOf(obj);
    const inside = overlapArea(b, { x: 0, y: 0, w: W, h: H });
    if (obj === top && inside <= 0) {
      out.push({
        id: `off-${obj.id}`, severity: "look", targets: [top], rect: b,
        title: "Something is off the page",
        text: `${isText(obj) ? shortText(obj) : obj.name || "An item"} sits outside the page, so it won't show in your picture.`,
        fix: moveInside(b, W, H) ? { label: "Bring it back", run: fixRun(app, "Move onto page", () => moveBy(top, moveInside(b, W, H, 24))) } : null,
      });
    } else if (isText(obj) && inside > 0 && inside < b.w * b.h * 0.97) {
      const mv = moveInside(b, W, H, Math.min(W, H) * 0.03);
      out.push({
        id: `cut-${obj.id || out.length}`, severity: "fix", targets: [top], rect: b,
        title: "Text is cut by the edge",
        text: `${shortText(obj)} runs off the edge of the page, so part of it is cut off.`,
        fix: mv ? { label: "Move it inside", run: fixRun(app, "Move onto page", () => moveBy(top, mv)) } : null,
      });
    }
  }
  return out;
}

function checkZones(app, texts, zoneSet) {
  if (!zoneSet) return [];
  const { width: W, height: H } = app.editor, out = [];
  for (const { obj, top } of texts) {
    if (!(obj.text || "").trim()) continue;
    const b = boxOf(obj);
    const hit = zoneSet.rects.filter((r) => r.check && overlapArea(b, r) > b.w * b.h * 0.08);
    if (!hit.length) continue;
    const r = hit.sort((p, q) => overlapArea(b, q) - overlapArea(b, p))[0];
    const mv = moveOutOf(b, r, W, H);
    out.push({
      id: `zone-${obj.id || out.length}`, severity: "fix", targets: [top], rect: b,
      title: "Text is under the platform's buttons",
      text: `${shortText(obj)} sits in the "${r.label}" area (${zoneSet.label}), where it gets covered or cut off.`,
      fix: mv ? { label: "Move it clear", run: fixRun(app, "Move out of safe zone", () => moveBy(top, mv)) } : null,
    });
  }
  return out;
}

function checkFonts(texts) {
  const count = new Map();
  for (const { obj, top } of texts) {
    const fams = new Set([obj.fontFamily]);
    for (const line of Object.values(obj.styles || {})) for (const st of Object.values(line || {})) if (st?.fontFamily) fams.add(st.fontFamily);
    for (const f of fams) {
      if (!f) continue;
      const e = count.get(f) || { n: 0, tops: new Set() };
      e.n++; e.tops.add(top);
      count.set(f, e);
    }
  }
  if (count.size <= MAX_FONTS) return [];
  const sorted = [...count.entries()].sort((a, b) => b[1].n - a[1].n);
  const rare = sorted.slice(2);
  return [{
    id: "fonts", severity: "look", targets: [...new Set(rare.flatMap(([, e]) => [...e.tops]))],
    title: `${count.size} fonts in one design`,
    text: `You use ${sorted.map(([f]) => f).join(", ")}. Two fonts (one bold headline, one simple) usually look cleaner. Show me picks the text in the extra fonts.`,
  }];
}

async function checkFileSize(app, kind) {
  if (kind !== "yt-thumb" || !app.files?.exportDesign) return [];
  const res = await app.files.exportDesign("jpg", { quality: 0.92, download: false });
  if (res.bytes <= YT_LIMIT) return [];
  return [{
    id: "jpg-size", severity: "fix", targets: [],
    title: "JPG is over YouTube's 2 MB limit",
    text: `As a JPG this design is ${(res.bytes / 1e6).toFixed(1)} MB. YouTube refuses thumbnails over 2 MB.`,
    fix: {
      label: "Download under 2 MB",
      run: async () => { await app.files.exportDesign("jpg", { quality: 0.92, limitKB: 1990 }); },
      keep: true,
    },
  }];
}

/**
 * Run every check on the open design.
 * @param {object} app
 * @param {{ kind: string|null, zones: object|null, openFeed?: (opts: object) => void }} ctx
 * @returns {Promise<object[]>} findings, worst first
 */
export async function runCheck(app, { kind, zones, openFeed }) {
  const ed = app.editor;
  const all = walk(ed.objects());
  if (!all.length) {
    return [{ id: "empty", severity: "look", targets: [], title: "Your design is empty", text: "Add a template, a photo or some text first, then check again." }];
  }
  // Words only: lone symbols ("$", "!", arrows) are decoration, not something to read.
  const texts = all.filter(({ obj }) => isText(obj) && obj.opacity > 0.05 && /[\p{L}\p{N}]/u.test(obj.text || ""));
  const view = viewing(kind, ed.width, ed.height);
  const findings = [
    ...checkEdges(app, all),
    ...checkZones(app, texts, zones),
    ...checkTextSize(app, texts, view),
    ...checkContrast(app, texts),
    ...checkFonts(texts),
    ...checkWords(app, texts, kind),
    ...checkHero(app, kind),
    ...checkTitle(app, kind, openFeed),
    ...(await checkFileSize(app, kind)),
  ];
  // One card per object per kind of problem; worst first.
  const rank = { fix: 0, look: 1 };
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
