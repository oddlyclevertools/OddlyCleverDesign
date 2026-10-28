// Building the objects for add_element (illustration, badge, decoration, sticker, icon, chart,
// photo grid, image), the same way the Elements panel builds them, plus custom words, colours
// and chart data. Nothing is added to the page here; build.js does that inside one undo step.
import { createIllustration, ILLUSTRATIONS } from "../../elements/illustrations.js";
import { BADGES, buildBadge } from "../../elements/badges.js";
import { DECOR, createDecor, setLeakColor } from "../../elements/decor.js";
import { STICKERS, stickerSVG } from "../../elements/stickers.js";
import { iconLabel, iconSVG, replaceGroupColor, searchIcons, svgToGroup, groupColors } from "../../elements/vector.js";
import { CHART_FONTS, CHART_TYPES, PALETTES as CHART_COLORS, buildChart, chartData, chartFonts } from "../../elements/charts.js";
import { GRID_LAYOUTS, createGrid } from "../../elements/grids.js";
import { OcImage, loadElement } from "../../elements/images.js";
import { pageIsDark } from "../../elements/fill.js";
import { ToolInputError, DATA_IMAGE, closest } from "./validate.js";
import { pick } from "./rules.js";
import { myElement } from "./draw.js";

const KEYED = new Set(["illustration", "badge", "decoration", "sticker", "icon", "chart", "photo_grid", "my_element"]);

/** An icon name from the Lucide set, forgiving case and spaces ("arrow right" finds ArrowRight). */
function iconName(key) {
  const all = searchIcons("");
  const flat = String(key).replace(/[\s_-]+/g, "").toLowerCase();
  const hit = all.find((n) => n === key) || all.find((n) => n.toLowerCase() === flat);
  if (hit) return hit;
  const found = searchIcons(String(key).replace(/([a-z])([A-Z])/g, "$1 $2"));
  const hint = found[0] || closest(key, all);
  throw new ToolInputError(`No icon called "${key}".${hint ? ` Did you mean "${hint}"?` : ""} Call list_assets with catalog "icons" and a query.`);
}

/** Chart input (snake_case) to the chart feature's data, with colours filled in. */
export function chartPatch(c = {}, ch = null) {
  const patch = {};
  if (c.rows) {
    patch.rows = c.rows.map((r, i) => ({ label: r.label, value: r.value, color: r.color || ch?.rows?.[i]?.color || CHART_COLORS.brand[i % CHART_COLORS.brand.length] }));
  }
  for (const k of ["value", "number", "label", "color", "ink"]) if (c[k] !== undefined) patch[k] = c[k];
  if (c.font !== undefined) {
    const f = CHART_FONTS.find((x) => x.toLowerCase() === c.font.toLowerCase());
    if (!f) throw new ToolInputError(`Charts use these fonts: ${CHART_FONTS.join(", ")} (got "${c.font}").`);
    patch.font = f;
  }
  if (c.show_values !== undefined) patch.showValues = c.show_values;
  if (c.show_labels !== undefined) patch.showLabels = c.show_labels;
  return patch;
}

const short = (app) => Math.min(app.editor.width, app.editor.height);

async function badge(app, key, text) {
  const spec = pick(BADGES, key, (b) => b.key, { what: "badge", catalog: "badges" });
  const g = await buildBadge(spec.key, text ? { text } : {});
  const target = spec.fixed ? short(app) * 0.34 : Math.min(short(app) * 0.62, Math.max(g.width, g.height));
  g.scale(target / Math.max(g.width, g.height));
  g.set("angle", spec.tilt || 0);
  return { obj: g, label: spec.label };
}

async function decoration(app, key, color) {
  const spec = pick(DECOR, key, (d) => d.key, { what: "decoration", catalog: "decorations" });
  const obj = await createDecor(spec.key, app);
  const fixedPlace = obj._place || null;
  delete obj._place;
  if (color) {
    if (obj.data?.leak) setLeakColor(obj, color);
    else if (obj._objects) replaceGroupColor(obj, groupColors(obj)[0], color);
    else throw new ToolInputError(`The ${spec.label} can't change colour.`);
  }
  return { obj, label: spec.label, fixedPlace };
}

async function sticker(key, color) {
  const spec = pick(STICKERS, key, (s) => s.key, { what: "sticker", catalog: "stickers" });
  const g = await svgToGroup(stickerSVG(spec.key, color || null), 260);
  g.set({ name: spec.label, data: { kind: "sticker", sticker: spec.key } });
  return { obj: g, label: spec.label };
}

async function icon(app, key, color) {
  const name = iconName(key);
  const c = color || (pageIsDark(app) ? "#f3ead8" : "#16121b");
  const g = await svgToGroup(iconSVG(name, c), Math.round(short(app) * 0.22));
  g.set({ name: iconLabel(name), data: { kind: "icon", icon: name, color: c } });
  return { obj: g, label: iconLabel(name) };
}

async function chart(app, key, data) {
  const spec = pick(CHART_TYPES, key, (c) => c.key, { what: "chart type", catalog: "charts" });
  const base = pageIsDark(app) ? { ink: "#fbf7ee", track: "#3a3346" } : {};
  const ch = chartData(spec.key, { ...base, ...chartPatch(data || {}) });
  await chartFonts(ch);
  const g = buildChart(ch);
  const s = short(app);
  const k = (spec.key === "stat" || spec.key === "ring" ? s * 0.42 : spec.key === "progress" ? s * 0.9 : s * 0.7) / Math.max(g.width, g.height);
  g.scale(k);
  return { obj: g, label: spec.label };
}

async function image(app, src) {
  if (!src || !DATA_IMAGE.test(src)) throw new ToolInputError("add_element image needs image_data: data:image/png, jpeg, webp or gif as base64.");
  let el;
  try { el = await loadElement(src); } catch { throw new ToolInputError("That picture couldn't be read. Check the base64 data."); }
  const img = new OcImage(el, { name: "Image", data: { kind: "image" } });
  const ed = app.editor;
  img.scale(Math.min(1, (ed.width * 0.62) / img.width, (ed.height * 0.62) / img.height));
  return { obj: img, label: "image" };
}

/**
 * Build the object for an add_element call.
 * @returns {Promise<{obj: object, label: string, fixedPlace?: {x: number, y: number}|null}>}
 */
export async function buildElement(app, inp) {
  const { type, key } = inp;
  if (KEYED.has(type) && !key) throw new ToolInputError(`add_element: "key" is required for ${type}. Call list_assets for the keys.`);
  if (inp.text !== undefined && type !== "badge") throw new ToolInputError("add_element: text is only for badges. Use add_text for words.");
  if (inp.chart !== undefined && type !== "chart") throw new ToolInputError("add_element: chart data is only for type chart.");
  if (inp.color !== undefined && !["icon", "sticker", "decoration", "illustration"].includes(type)) {
    throw new ToolInputError(`add_element: color isn't used for ${type}.${type === "chart" ? " Use chart.color or the rows' colors." : ""}`);
  }
  switch (type) {
    case "illustration": {
      const spec = pick(ILLUSTRATIONS, key, (i) => i.key, { what: "illustration", catalog: "illustrations" });
      const g = await createIllustration(spec.key, app);
      if (inp.color) replaceGroupColor(g, groupColors(g).find((c) => c !== "#16121b" && c !== "#ffffff") || groupColors(g)[0], inp.color);
      return { obj: g, label: spec.label };
    }
    case "badge": return badge(app, key, inp.text);
    case "decoration": return decoration(app, key, inp.color);
    case "sticker": return sticker(key, inp.color);
    case "icon": return icon(app, key, inp.color);
    case "chart": return chart(app, key, inp.chart);
    case "photo_grid": {
      const spec = pick(GRID_LAYOUTS, key, (g) => g.key, { what: "photo grid layout", catalog: "photo_grids" });
      return { obj: await createGrid(spec.key, app), label: `photo grid (${spec.label})` };
    }
    case "image": return image(app, inp.image_data);
    case "my_element": return myElement(key);
    default: throw new ToolInputError(`Unknown element type "${type}".`);
  }
}
