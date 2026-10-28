// list_assets: searchable catalogues of everything an AI can place, with the keys other tools take.
import { SIZES } from "../../../core/sizes.js";
import { FONTS } from "../../../core/fonts.js";
import { TEMPLATES, categoryOf, matchWords, sizeLabel } from "../../templates/registry.js";
import { ILLUSTRATIONS } from "../../elements/illustrations.js";
import { BADGES } from "../../elements/badges.js";
import { DECOR } from "../../elements/decor.js";
import { STICKERS } from "../../elements/stickers.js";
import { searchIcons } from "../../elements/vector.js";
import { CHART_TYPES } from "../../elements/charts.js";
import { GRID_LAYOUTS } from "../../elements/grids.js";
import { SHAPES } from "../../elements/shapes.js";
import { LINES } from "../../elements/lines.js";
import { SCENES } from "../../elements/scenes.js";
import { GRADIENT_PRESETS } from "../../elements/panel-background.js";
import { CAST, EXPRS, LOOKS } from "../../characters/cast.js";
import { PRESETS } from "../../text/presets.js";
import { EFFECTS } from "../../text/effects.js";
import { PALETTES, PAIRINGS } from "../../styles/palettes.js";
import { userFonts } from "../../styles/user-fonts.js";
import { LOOPS, MOTIONS, PAGE_PRESETS, SPEEDS, TEXT_MOTIONS } from "../../motion/catalog.js";
import { json } from "./context.js";
import { myElementsCatalog } from "./draw.js";

const DEFAULT_LIMIT = 40;

/** The main part of a text preset (the biggest words), whose style add_text copies. */
export const mainPart = (preset) => preset.parts.reduce((a, b) => (b[1].fontSize > a[1].fontSize ? b : a));

/** Every catalogue: () => [{ ...entry, _search: "words to match" }]. */
const CATALOG_ITEMS = {
  templates: () => TEMPLATES.map((t) => {
    const { dims, name } = sizeLabel(t);
    return { id: t.id, name: t.name, size: typeof t.size === "string" ? t.size : dims, px: dims, category: categoryOf(t), tags: t.tags.join(" "),
      _search: `${t.id} ${t.name} ${t.tags.join(" ")} ${name} ${categoryOf(t)}` };
  }),
  sizes: () => SIZES.map((s) => ({ id: s.id, name: s.name, group: s.group, w: s.w, h: s.h, _search: `${s.id} ${s.name} ${s.group}` })),
  illustrations: () => ILLUSTRATIONS.map((i) => ({ key: i.key, name: i.label, tags: i.tags, _search: `${i.key} ${i.label} ${i.tags}` })),
  badges: () => BADGES.map((b) => ({ key: b.key, name: b.label, default_text: b.text, tags: b.tags, _search: `${b.key} ${b.label} ${b.tags}` })),
  decorations: () => DECOR.map((d) => ({ key: d.key, name: d.label, color: d.color, ...(d.special ? { overlay: true } : {}), tags: d.tags, _search: `${d.key} ${d.label} ${d.tags}` })),
  stickers: () => STICKERS.map((s) => ({ key: s.key, name: s.label, color: s.color, tags: s.tags, _search: `${s.key} ${s.label} ${s.tags}` })),
  icons: (q) => searchIcons(q || "").map((n) => ({ key: n, _search: "" })),
  charts: () => CHART_TYPES.map((c) => ({ key: c.key, name: c.label, data: Object.keys(c.data).join(", "), _search: `${c.key} ${c.label} ${c.tags}` })),
  photo_grids: () => GRID_LAYOUTS.map((g) => ({ key: g.key, name: g.label, cells: g.cells.length, _search: `${g.key} ${g.label} grid collage photo` })),
  shapes: () => SHAPES.map((s) => ({ key: s.key, name: s.label, _search: `${s.key} ${s.label} ${s.tags || ""}` })),
  lines: () => LINES.map((l) => ({ name: l.label, style: l.style, start_cap: l.start, end_cap: l.end, _search: `${l.key} ${l.label} ${l.tags || ""}` })),
  scenes: () => SCENES.map((s) => ({ key: s.key, name: s.label, group: s.group, colors: Object.fromEntries(s.colors.map((c) => [c.id, c.value])), tags: s.tags,
    _search: `${s.key} ${s.label} ${s.group} ${s.tags}` })),
  gradients: () => GRADIENT_PRESETS.map((g, i) => ({ gradient: g, _search: `gradient ${i}` })),
  characters: () => CAST.map((c) => ({ who: c.who, name: c.name, personality: c.line, default_expression: c.expr, _search: `${c.who} ${c.name} ${c.line}` }))
    .concat([{ expressions: EXPRS.map((e) => e.id), looks: LOOKS.map((l) => l.id), facing: ["right", "left"], _search: "expressions looks face" }]),
  fonts: () => [
    ...Object.entries(FONTS).map(([family, f]) => ({ family, category: f.category, weights: f.weights, italic: f.italic, _search: `${family} ${f.category}` })),
    ...userFonts().map((f) => ({ family: f.family, category: "Your fonts", weights: [400], _search: `${f.family} user own uploaded` })),
  ],
  text_presets: () => PRESETS.map((p) => {
    const [, props] = mainPart(p);
    return { id: p.id, name: p.label, mood: p.mood, font: props.fontFamily, sample: p.parts.map((x) => x[0]).join(" / ").replace(/\n/g, " "),
      parts: p.parts.length, _search: `${p.id} ${p.label} ${p.mood} ${props.fontFamily}` };
  }),
  text_effects: () => Object.entries(EFFECTS).map(([id, e]) => ({ id, name: e.label, kind: e.kind, hint: e.hint, defaults: e.defaults, _search: `${id} ${e.label} ${e.hint}` })),
  palettes: () => PALETTES.map((p) => ({ id: p.id, name: p.name, mood: p.mood, bg: p.bg, ink: p.ink, main: p.main, a1: p.a1, a2: p.a2, _search: `${p.id} ${p.name} ${p.mood}` })),
  font_pairings: () => PAIRINGS.map((p) => ({ id: p.id, name: p.name, mood: p.mood, heading: `${p.head.family} ${p.head.weight}`, body: `${p.body.family} ${p.body.weight}`,
    _search: `${p.id} ${p.name} ${p.mood} ${p.head.family} ${p.body.family}` })),
  animations: () => [
    ...Object.entries(MOTIONS).map(([id, m]) => ({ id, name: m.label, use: "intro or outro", _search: `${id} ${m.label} intro outro` })),
    ...Object.entries(TEXT_MOTIONS).map(([id, m]) => ({ id, name: m.label, use: "intro, text only", _search: `${id} ${m.label} text intro` })),
    ...Object.entries(LOOPS).map(([id, m]) => ({ id, name: m.label, use: "loop", _search: `${id} ${m.label} loop` })),
    ...PAGE_PRESETS.map((p) => ({ id: p.id, name: p.label, use: "page_preset", help: p.help, _search: `${p.id} ${p.label} ${p.help} page preset` })),
    { speeds: SPEEDS.map((s) => s.id), _search: "speed" },
  ],
  my_elements: async () => (await myElementsCatalog()).map((x) => ({ ...x, _search: `${x.key} ${x.name} ${x.tags.join(" ")}` })),
};

export async function listAssets(_app, inp) {
  const items = await CATALOG_ITEMS[inp.catalog](inp.query);
  const q = (inp.query || "").trim();
  const hits = q && inp.catalog !== "icons" ? items.filter((x) => matchWords(x._search, q)) : items;
  const offset = inp.offset || 0, limit = inp.limit || DEFAULT_LIMIT;
  const page = hits.slice(offset, offset + limit).map(({ _search, ...rest }) => rest);
  const more = hits.length > offset + page.length;
  return {
    text: json({
      catalog: inp.catalog, total: hits.length, shown: page.length, ...(more ? { next_offset: offset + page.length } : {}),
      ...(q && !hits.length ? { hint: "Nothing matched. Try one simpler word, or no query to see everything." } : {}),
      items: page,
    }),
  };
}
