// Charts: bar, row (horizontal bar), line, pie, donut, progress bar, progress ring and a big
// number stat. A chart is a plain Group drawn from obj.data.chart, so it saves and loads like
// any group; editing the data rebuilds the group in place (one undo step per edit).
import { Circle, Group, Line, Path, Polyline, Rect } from "fabric";
import { ensureFont, nearestWeight } from "../../core/fonts.js";
import { OcText } from "../text/octext.js";
import { pageIsDark } from "./fill.js";

export const CHART_FONTS = ["Inter", "Archivo Black", "Anton", "Poppins", "Montserrat", "Space Grotesk", "Barlow Condensed"];

export const PALETTES = {
  brand: ["#ff2e7e", "#ffc83d", "#8fe3ff", "#8b5cf6", "#3ddc84", "#ff9f1c"],
  neon: ["#ff2e7e", "#8fe3ff", "#f8ff4d", "#b26bff", "#39ffb0", "#ff7a1a"],
  pastel: ["#f6a6c1", "#ffd98a", "#a9e4f5", "#c8b6ff", "#a8e6bf", "#ffc7a1"],
  mono: ["#16121b", "#3d3647", "#6b6478", "#9a93a6", "#c7c1cf", "#e6e1ea"],
};

const rows = (labels, values) => labels.map((label, i) => ({ label, value: values[i], color: PALETTES.brand[i % 6] }));

/** The chart kinds in the panel, with their starting data. */
export const CHART_TYPES = [
  { key: "bar", label: "Bar chart", tags: "bar column chart graph data compare", data: { rows: rows(["Jan", "Feb", "Mar", "Apr", "May"], [32, 48, 41, 66, 90]) } },
  { key: "hbar", label: "Row chart", tags: "horizontal bar row chart ranking compare data", data: { rows: rows(["YouTube", "TikTok", "Instagram", "X"], [84, 61, 47, 22]) } },
  { key: "line", label: "Line chart", tags: "line chart graph trend growth data", data: { rows: rows(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], [12, 19, 15, 28, 34, 52]) } },
  { key: "pie", label: "Pie chart", tags: "pie chart share percent split data", data: { rows: rows(["Rent", "Food", "Fun", "Savings"], [40, 25, 15, 20]) } },
  { key: "donut", label: "Donut chart", tags: "donut doughnut ring chart share percent data", data: { rows: rows(["Ads", "Sponsors", "Merch"], [55, 30, 15]) } },
  { key: "progress", label: "Progress bar", tags: "progress bar percent goal loading complete", data: { value: 72, label: "Goal reached", color: "#ff2e7e" } },
  { key: "ring", label: "Progress ring", tags: "progress ring circle percent goal radial", data: { value: 64, label: "Complete", color: "#8fe3ff" } },
  { key: "stat", label: "Big number", tags: "stat number big figure kpi metric counter", data: { number: "2.4M", label: "views in 30 days", color: "#ff2e7e" } },
];

const DEFAULTS = { showValues: true, showLabels: true, ink: "#16121b", font: "Inter", track: "#e7e0d2", outline: false };

/** A full chart description for a type (defaults filled in). */
export function chartData(type, patch = {}) {
  const t = CHART_TYPES.find((c) => c.key === type) || CHART_TYPES[0];
  return { ...DEFAULTS, type: t.key, ...JSON.parse(JSON.stringify(t.data)), ...patch };
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (v) => {
  const n = num(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

function txt(ch, text, x, y, { size = 26, weight = 700, color = ch.ink, align = "center", originX = "center", width } = {}) {
  const fam = ch.font || "Inter";
  const t = new OcText(String(text), {
    fontFamily: fam, fontWeight: nearestWeight(fam, weight), fontSize: size, fill: color, textAlign: align,
    originX, originY: "center", left: x, top: y, width: width || 2000, splitByGrapheme: false, lineHeight: 1.05,
    data: { keepName: true, chartText: true },
  });
  if (!width) {
    let w = 0;
    for (let i = 0; i < t._textLines.length; i++) w = Math.max(w, t.getLineWidth(i));
    t.set("width", w + 2);
    t.initDimensions();
    t.set({ left: x, top: y });
  }
  return t;
}

const outline = (ch) => (ch.outline ? { stroke: ch.ink, strokeWidth: 4, strokeLineJoin: "round" } : { strokeWidth: 0 });

function buildBar(ch) {
  const W = 640, H = 400, top = ch.showValues ? 46 : 14, bottom = ch.showLabels ? 54 : 12;
  const list = ch.rows.length ? ch.rows : [{ label: "", value: 0, color: "#ccc" }];
  const max = Math.max(1, ...list.map((r) => num(r.value)));
  const plotH = H - top - bottom, slot = W / list.length, bw = Math.min(120, slot * 0.64);
  const out = [new Rect({ left: W / 2, top: H / 2, width: W, height: H, fill: "transparent", strokeWidth: 0 })];
  list.forEach((r, i) => {
    const h = Math.max(4, (num(r.value) / max) * plotH), cx = slot * (i + 0.5);
    out.push(new Rect({ left: cx, top: top + plotH - h / 2, width: bw, height: h, rx: Math.min(12, bw / 4), ry: Math.min(12, bw / 4), fill: r.color, ...outline(ch) }));
    if (ch.showValues) out.push(txt(ch, fmt(r.value), cx, top + plotH - h - 22, { size: 26, weight: 800 }));
    if (ch.showLabels) out.push(txt(ch, r.label, cx, H - bottom / 2 + 4, { size: 22, weight: 600 }));
  });
  out.push(new Line([0, top + plotH, W, top + plotH], { stroke: ch.ink, strokeWidth: 3, strokeLineCap: "round", opacity: 0.85 }));
  return out;
}

function buildHBar(ch) {
  const W = 640, rowH = 64, list = ch.rows.length ? ch.rows : [{ label: "", value: 0, color: "#ccc" }];
  const H = rowH * list.length, labelW = ch.showLabels ? 150 : 0, valueW = ch.showValues ? 70 : 0;
  const max = Math.max(1, ...list.map((r) => num(r.value)));
  const plotW = W - labelW - valueW - 12;
  const out = [new Rect({ left: W / 2, top: H / 2, width: W, height: H, fill: "transparent", strokeWidth: 0 })];
  list.forEach((r, i) => {
    const cy = rowH * (i + 0.5), w = Math.max(6, (num(r.value) / max) * plotW), bh = rowH * 0.62;
    out.push(new Rect({ left: labelW + w / 2, top: cy, width: w, height: bh, rx: bh / 2, ry: bh / 2, fill: r.color, ...outline(ch) }));
    if (ch.showLabels) out.push(txt(ch, r.label, labelW - 14, cy, { size: 24, weight: 700, align: "right", originX: "right" }));
    if (ch.showValues) out.push(txt(ch, fmt(r.value), labelW + w + 12, cy, { size: 24, weight: 800, align: "left", originX: "left" }));
  });
  return out;
}

function buildLine(ch) {
  const W = 640, H = 400, top = 40, bottom = ch.showLabels ? 54 : 16, side = 30;
  const list = ch.rows.length ? ch.rows : [{ label: "", value: 0 }];
  const vals = list.map((r) => num(r.value));
  const max = Math.max(1, ...vals), min = Math.min(0, ...vals);
  const plotH = H - top - bottom, plotW = W - side * 2;
  const xs = list.map((_, i) => side + (list.length === 1 ? plotW / 2 : (i / (list.length - 1)) * plotW));
  const ys = vals.map((v) => top + plotH - ((v - min) / (max - min || 1)) * plotH);
  const color = list[0]?.color || "#ff2e7e";
  const out = [new Rect({ left: W / 2, top: H / 2, width: W, height: H, fill: "transparent", strokeWidth: 0 })];
  for (let k = 0; k <= 4; k++) {
    const y = top + (plotH * k) / 4;
    out.push(new Line([0, y, W, y], { stroke: ch.ink, strokeWidth: 2, opacity: k === 4 ? 0.85 : 0.14 }));
  }
  const area = [`M${xs[0]} ${top + plotH}`, ...xs.map((x, i) => `L${x} ${ys[i]}`), `L${xs.at(-1)} ${top + plotH} Z`].join(" ");
  out.push(new Path(area, { fill: color, opacity: 0.18, strokeWidth: 0 }));
  out.push(new Polyline(xs.map((x, i) => ({ x, y: ys[i] })), { fill: "", stroke: color, strokeWidth: 7, strokeLineJoin: "round", strokeLineCap: "round" }));
  xs.forEach((x, i) => {
    out.push(new Circle({ left: x, top: ys[i], radius: 9, fill: "#ffffff", stroke: color, strokeWidth: 5 }));
    if (ch.showValues) out.push(txt(ch, fmt(vals[i]), x, ys[i] - 30, { size: 22, weight: 800 }));
    if (ch.showLabels) out.push(txt(ch, list[i].label, x, H - bottom / 2 + 4, { size: 22, weight: 600 }));
  });
  return out;
}

const pt = (cx, cy, r, a) => `${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`;

function slicePath(cx, cy, r, ri, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  if (ri > 0) {
    return `M${pt(cx, cy, r, a0)} A${r} ${r} 0 ${large} 1 ${pt(cx, cy, r, a1)} L${pt(cx, cy, ri, a1)} A${ri} ${ri} 0 ${large} 0 ${pt(cx, cy, ri, a0)} Z`;
  }
  return `M${cx} ${cy} L${pt(cx, cy, r, a0)} A${r} ${r} 0 ${large} 1 ${pt(cx, cy, r, a1)} Z`;
}

function buildPie(ch, donut) {
  const R = 170, ri = donut ? 98 : 0, cx = R, cy = R;
  const list = ch.rows.filter((r) => num(r.value) > 0);
  const total = list.reduce((s, r) => s + num(r.value), 0) || 1;
  const out = [];
  let a = -Math.PI / 2;
  const sep = ch.outline ? { stroke: ch.ink, strokeWidth: 4 } : { stroke: "#ffffff", strokeWidth: 4 };
  if (list.length === 1) {
    out.push(new Circle({ left: cx, top: cy, radius: R, fill: list[0].color, ...sep }));
    if (donut) out.push(new Circle({ left: cx, top: cy, radius: ri, fill: "#ffffff", ...sep }));
  } else {
    for (const r of list) {
      const a1 = a + (num(r.value) / total) * Math.PI * 2;
      out.push(new Path(slicePath(cx, cy, R, ri, a, a1), { fill: r.color, strokeLineJoin: "round", ...sep }));
      a = a1;
    }
  }
  if (donut) out.push(txt(ch, fmt(total), cx, cy - 6, { size: 52, weight: 900 }), txt(ch, "total", cx, cy + 36, { size: 20, weight: 600 }));
  if (ch.showLabels || ch.showValues) {
    const lx = R * 2 + 46, gap = 52, y0 = cy - ((ch.rows.length - 1) * gap) / 2;
    ch.rows.forEach((r, i) => {
      const y = y0 + i * gap;
      out.push(new Rect({ left: lx + 14, top: y, width: 28, height: 28, rx: 8, ry: 8, fill: r.color, ...outline(ch) }));
      const words = [ch.showLabels ? r.label : "", ch.showValues ? `${Math.round((num(r.value) / total) * 100)}%` : ""].filter(Boolean).join("  ");
      out.push(txt(ch, words, lx + 40, y, { size: 26, weight: 700, align: "left", originX: "left" }));
    });
  }
  return out;
}

function buildProgress(ch) {
  const W = 620, bh = 46, v = Math.max(0, Math.min(100, num(ch.value)));
  const y = ch.showLabels ? 56 : 0;
  const out = [];
  if (ch.showLabels) out.push(txt(ch, ch.label || "", 0, 20, { size: 28, weight: 800, align: "left", originX: "left" }));
  if (ch.showValues) out.push(txt(ch, `${fmt(v)}%`, W, 20, { size: 28, weight: 900, align: "right", originX: "right" }));
  out.push(new Rect({ left: W / 2, top: y + bh / 2, width: W, height: bh, rx: bh / 2, ry: bh / 2, fill: ch.track, ...outline(ch) }));
  if (v > 0) {
    const w = Math.max(bh, (W * v) / 100);
    out.push(new Rect({ left: w / 2, top: y + bh / 2, width: w, height: bh, rx: bh / 2, ry: bh / 2, fill: ch.color, ...outline(ch) }));
  }
  return out;
}

function buildRing(ch) {
  const R = 130, sw = 38, v = Math.max(0, Math.min(100, num(ch.value))), c = R + sw / 2;
  const out = [new Circle({ left: c, top: c, radius: R, fill: "", stroke: ch.track, strokeWidth: sw })];
  if (v >= 99.95) out.push(new Circle({ left: c, top: c, radius: R, fill: "", stroke: ch.color, strokeWidth: sw }));
  else if (v > 0) {
    const a0 = -Math.PI / 2, a1 = a0 + (v / 100) * Math.PI * 2;
    out.push(new Path(`M${pt(c, c, R, a0)} A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(c, c, R, a1)}`, {
      fill: "", stroke: ch.color, strokeWidth: sw, strokeLineCap: "round",
    }));
  }
  if (ch.showValues) out.push(txt(ch, `${fmt(v)}%`, c, ch.showLabels ? c - 14 : c, { size: 76, weight: 900 }));
  if (ch.showLabels) out.push(txt(ch, ch.label || "", c, c + 46, { size: 24, weight: 600 }));
  return out;
}

function buildStat(ch) {
  const out = [new Rect({ left: 60, top: 10, width: 120, height: 14, rx: 7, ry: 7, fill: ch.color, strokeWidth: 0 })];
  const big = txt(ch, ch.number || "0", 0, 120, { size: 170, weight: 900, color: ch.color, align: "left", originX: "left" });
  out.push(big);
  if (ch.showLabels) out.push(txt(ch, ch.label || "", 4, 230, { size: 34, weight: 700, align: "left", originX: "left" }));
  return out;
}

/** Load the chart's font faces before building. */
export async function chartFonts(ch) {
  const fam = ch.font || "Inter";
  await Promise.all([600, 700, 800, 900].map((w) => ensureFont(fam, nearestWeight(fam, w))));
}

/** Build the chart group (call chartFonts first). */
export function buildChart(ch) {
  const parts = {
    bar: buildBar, hbar: buildHBar, line: buildLine, pie: (c) => buildPie(c, false), donut: (c) => buildPie(c, true),
    progress: buildProgress, ring: buildRing, stat: buildStat,
  }[ch.type];
  if (!parts) throw new Error("Unknown chart type.");
  const g = new Group(parts(ch), { objectCaching: true });
  const label = CHART_TYPES.find((c) => c.key === ch.type)?.label || "Chart";
  g.set({ name: label, data: { kind: "chart", chart: ch } });
  return g;
}

export const isChart = (o) => o?.type === "group" && Boolean(o.data?.chart);

/** A new chart sized for the page. */
export async function createChart(type, app) {
  const ch = chartData(type, pageIsDark(app) ? { ink: "#fbf7ee", track: "#3a3346" } : {});
  await chartFonts(ch);
  const g = buildChart(ch);
  const short = Math.min(app.editor.width, app.editor.height);
  const k = (type === "stat" || type === "ring" ? short * 0.42 : type === "progress" ? short * 0.9 : short * 0.7) / Math.max(g.width, g.height);
  g.scale(k);
  return g;
}

/** Rebuild a chart with new data, in the same place, and return the new group. */
export async function updateChart(app, g, patch) {
  const ed = app.editor, c = ed.canvas;
  // Keep a font the user picked with the text toolbar.
  const firstText = g.getObjects().find((o) => o instanceof OcText);
  const prev = g.data.chart;
  const font = firstText && firstText.fontFamily !== prev.font && !patch.font ? firstText.fontFamily : prev.font;
  const ch = { ...prev, font, ...patch };
  await chartFonts(ch);
  const next = buildChart(ch);
  const index = c.getObjects().indexOf(g);
  if (index < 0) return g;
  const center = g.getCenterPoint();
  // Scale the new group so it keeps the old one's on-page size along its long side.
  const oldLong = Math.max(g.width * g.scaleX, g.height * g.scaleY);
  const same = prev.type === ch.type;
  const k = same ? g.scaleX : oldLong / Math.max(next.width, next.height);
  next.set({
    scaleX: k, scaleY: same ? g.scaleY : k, angle: g.angle, flipX: g.flipX, flipY: g.flipY, opacity: g.opacity, shadow: g.shadow,
    id: g.id, name: same ? g.name : next.name, locked: g.locked, data: { ...g.data, chart: ch },
  });
  ed.history.pause();
  c.remove(g);
  c.insertAt(index, next);
  next.setPositionByOrigin(center, "center", "center");
  next.setCoords();
  c.setActiveObject(next);
  ed.history.resume();
  c.requestRenderAll();
  return next;
}

/** Small SVG pictures for the panel tiles. */
export function chartPreview(type) {
  const ink = "#e9e4f2", pink = "#ff2e7e", gold = "#ffc83d", cyan = "#8fe3ff", purple = "#8b5cf6";
  const body = {
    bar: `<rect x="14" y="56" width="14" height="30" rx="3" fill="${pink}"/><rect x="34" y="38" width="14" height="48" rx="3" fill="${gold}"/><rect x="54" y="48" width="14" height="38" rx="3" fill="${cyan}"/><rect x="74" y="20" width="14" height="66" rx="3" fill="${purple}"/><path d="M8 88 H94" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    hbar: `<rect x="12" y="18" width="70" height="12" rx="6" fill="${pink}"/><rect x="12" y="38" width="52" height="12" rx="6" fill="${gold}"/><rect x="12" y="58" width="38" height="12" rx="6" fill="${cyan}"/><rect x="12" y="78" width="20" height="12" rx="6" fill="${purple}"/>`,
    line: `<path d="M10 80 L30 62 L48 68 L66 40 L88 22 L88 88 L10 88 Z" fill="${pink}" opacity=".2"/><path d="M10 80 L30 62 L48 68 L66 40 L88 22" fill="none" stroke="${pink}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="66" cy="40" r="5" fill="#fff" stroke="${pink}" stroke-width="3"/>`,
    pie: `<path d="M50 50 L50 12 A38 38 0 0 1 86 62 Z" fill="${pink}"/><path d="M50 50 L86 62 A38 38 0 0 1 24 78 Z" fill="${gold}"/><path d="M50 50 L24 78 A38 38 0 0 1 50 12 Z" fill="${cyan}"/>`,
    donut: `<circle cx="50" cy="50" r="30" fill="none" stroke="${cyan}" stroke-width="16"/><path d="M50 20 A30 30 0 0 1 76 65" fill="none" stroke="${pink}" stroke-width="16"/><path d="M76 65 A30 30 0 0 1 30 72" fill="none" stroke="${gold}" stroke-width="16"/>`,
    progress: `<rect x="8" y="42" width="84" height="16" rx="8" fill="#3a3346"/><rect x="8" y="42" width="60" height="16" rx="8" fill="${pink}"/><rect x="8" y="26" width="30" height="7" rx="3" fill="${ink}"/>`,
    ring: `<circle cx="50" cy="50" r="32" fill="none" stroke="#3a3346" stroke-width="12"/><path d="M50 18 A32 32 0 1 1 20 61" fill="none" stroke="${cyan}" stroke-width="12" stroke-linecap="round"/><rect x="38" y="44" width="24" height="12" rx="3" fill="${ink}"/>`,
    stat: `<rect x="12" y="20" width="22" height="5" rx="2.5" fill="${pink}"/><text x="10" y="66" font-family="Inter, sans-serif" font-weight="900" font-size="38" fill="${pink}">2.4M</text><rect x="12" y="76" width="54" height="6" rx="3" fill="${ink}"/>`,
  }[type];
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
}
