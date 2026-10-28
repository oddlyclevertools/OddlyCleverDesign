// Every built-in template, plus the categories the home screen and panel filter by.
import thumbnails from "./thumbnails.js";
import vertical from "./vertical.js";
import social from "./social.js";
import print from "./print.js";
import videoMore from "./video-more.js";
import socialMore from "./social-more.js";
import { sizeOf } from "./engine.js";
import { SIZES } from "../../core/sizes.js";

export const TEMPLATES = [...thumbnails, ...vertical, ...social, ...print, ...videoMore, ...socialMore];

/** Other features add template packs here (the characters feature adds the Oddly Clever pack). */
export function addTemplates(list) {
  for (const t of list) if (!TEMPLATES.some((x) => x.id === t.id)) TEMPLATES.push(t);
}

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "oddly", label: "Oddly Clever" },
  { id: "thumbnail", label: "Thumbnails" },
  { id: "vertical", label: "Shorts & stories" },
  { id: "social", label: "Social" },
  { id: "slides", label: "Slides & banners" },
  { id: "print", label: "Print" },
];

/** A template's category: its own `category` when set, otherwise one from its size. */
export function categoryOf(tpl) {
  if (tpl.category && CATEGORIES.some((c) => c.id === tpl.category)) return tpl.category;
  if (tpl.size === "yt-thumb") return "thumbnail";
  if (tpl.size === "shorts" || tpl.size === "ig-story") return "vertical";
  if (tpl.size === "poster" || tpl.size === "a4" || tpl.size === "flyer") return "print";
  return "social";
}

/** "1280 × 720" plus the preset name when there is one. */
export function sizeLabel(tpl) {
  const { w, h } = sizeOf(tpl);
  const preset = typeof tpl.size === "string" ? SIZES.find((s) => s.id === tpl.size) : null;
  return { dims: `${w} × ${h}`, name: preset?.name || "Custom size" };
}

/** True when every word of `query` starts a word of `hay` ("sto" finds "story", not "history"). */
export function matchWords(hay, query) {
  const qs = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!qs.length) return true;
  const words = String(hay).toLowerCase().split(/[^\p{L}\p{N}$]+/u).filter(Boolean);
  return qs.every((q) => words.some((w) => w.startsWith(q)));
}

/** True when `query` matches a template's name, tags or size. */
export function matchesTemplate(tpl, query) {
  const { dims, name } = sizeLabel(tpl);
  return matchWords(`${tpl.name} ${tpl.tags.join(" ")} ${name} ${dims}`, query);
}
