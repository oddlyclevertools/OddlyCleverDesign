// SVG export: Fabric's toSVG cropped to the page, with the fonts it uses embedded as
// @font-face data URLs (only the unicode-range subsets the text needs) and every image
// inlined as a data URL, so the file works on its own. Text with effects or a curve is
// written by svg-text.js, so outlines, glows, 3D and curved words survive as real text.
import { nearestWeight } from "../../core/fonts.js";
import { withTextSVG } from "./svg-text.js";
import { blobToDataURL, withCrispPage } from "./util.js";

const fontCache = new Map(); // font URL -> data URL

/** Every (family, weight, style) a set of objects uses, with the characters it needs. */
function usedFaces(objects) {
  const faces = new Map();
  const add = (family, weight, style, text) => {
    if (!family) return;
    const fam = String(family).replace(/^['"]|['"]$/g, "").split(",")[0].trim();
    const w = nearestWeight(fam, Number(weight) || (weight === "bold" ? 700 : 400));
    const st = style === "italic" || style === "oblique" ? "italic" : "normal";
    const key = `${fam}|${w}|${st}`;
    const f = faces.get(key) || { family: fam, weight: w, style: st, chars: new Set() };
    for (const ch of text || "") f.chars.add(ch.codePointAt(0));
    faces.set(key, f);
  };
  const walk = (o) => {
    if (typeof o.text === "string") {
      add(o.fontFamily, o.fontWeight, o.fontStyle, o.text);
      // Per-character overrides (rich text) can use other faces.
      for (const row of Object.values(o.styles || {})) {
        for (const st of Object.values(row || {})) {
          if (st && (st.fontFamily || st.fontWeight || st.fontStyle)) {
            add(st.fontFamily || o.fontFamily, st.fontWeight || o.fontWeight, st.fontStyle || o.fontStyle, o.text);
          }
        }
      }
    }
    o._objects?.forEach(walk);
  };
  objects.forEach(walk);
  return [...faces.values()];
}

/** "U+0000-00FF, U+0131, U+4??" -> [[lo, hi], ...] */
function parseRanges(str) {
  if (!str) return [[0, 0x10ffff]];
  return str.split(",").map((part) => {
    const p = part.trim().replace(/^u\+/i, "");
    if (p.includes("?")) return [parseInt(p.replace(/\?/g, "0"), 16), parseInt(p.replace(/\?/g, "f"), 16)];
    const [a, b] = p.split("-");
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  }).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
}

function weightMatches(ruleWeight, w) {
  const nums = String(ruleWeight || "400").replace("normal", "400").replace("bold", "700").split(/\s+/).map(Number);
  return nums.length > 1 ? w >= nums[0] && w <= nums[1] : nums[0] === w;
}

/** The @font-face rules on the page (same-origin sheets only). */
function fontFaceRules() {
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin sheet
    for (const r of rules || []) {
      if (r instanceof CSSFontFaceRule) out.push(r);
    }
  }
  return out;
}

function pickUrl(src, base) {
  const urls = [...src.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)\s*(?:format\(\s*['"]?([\w-]+)['"]?\s*\))?/g)]
    .map((m) => ({ url: m[2], format: m[3] || "" }));
  const best = urls.find((u) => u.format === "woff2") || urls.find((u) => u.format === "woff") || urls[0];
  if (!best) return null;
  return { url: new URL(best.url, base).href, format: best.format || "woff2" };
}

async function fontDataURL(url) {
  if (fontCache.has(url)) return fontCache.get(url);
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font ${res.status}`);
  const data = await blobToDataURL(await res.blob());
  fontCache.set(url, data);
  return data;
}

/** CSS @font-face rules (with data URLs) for the faces the objects use. */
export async function embeddedFontCSS(objects) {
  const faces = usedFaces(objects);
  if (!faces.length) return { css: "", missing: [] };
  const rules = fontFaceRules();
  const css = [], missing = [];
  for (const f of faces) {
    const matches = rules.filter((r) => {
      const fam = r.style.getPropertyValue("font-family").replace(/^['"]|['"]$/g, "").trim();
      const st = r.style.getPropertyValue("font-style") || "normal";
      if (fam.toLowerCase() !== f.family.toLowerCase() || st !== f.style) return false;
      if (!weightMatches(r.style.getPropertyValue("font-weight"), f.weight)) return false;
      const ranges = parseRanges(r.style.getPropertyValue("unicode-range"));
      return [...f.chars].some((c) => ranges.some(([lo, hi]) => c >= lo && c <= hi));
    });
    if (!matches.length) { missing.push(f.family); continue; }
    for (const r of matches) {
      const base = r.parentStyleSheet?.href || location.href;
      const src = pickUrl(r.style.getPropertyValue("src"), base);
      if (!src) continue;
      try {
        const data = await fontDataURL(src.url);
        const range = r.style.getPropertyValue("unicode-range");
        css.push(`@font-face{font-family:'${f.family.replace(/'/g, "")}';font-style:${f.style};font-weight:${f.weight};` +
          `src:url(${data}) format('${src.format}');${range ? `unicode-range:${range};` : ""}}`);
      } catch {
        missing.push(f.family);
      }
    }
  }
  return { css: css.join("\n"), missing: [...new Set(missing)] };
}

const unescapeAttr = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/**
 * Replace blob: image links with data URLs so the SVG is self-contained. Only local blob:
 * links are fetched; designs never hold outside URLs (core/sanitize.js drops them).
 */
async function inlineImages(svg) {
  const re = /(xlink:href|href)="(blob:[^"]+)"/g;
  const urls = [...new Set([...svg.matchAll(re)].map((m) => m[2]))];
  const map = new Map();
  let failed = 0;
  for (const u of urls) {
    try {
      const res = await fetch(unescapeAttr(u));
      if (!res.ok) throw new Error(String(res.status));
      map.set(u, await blobToDataURL(await res.blob()));
    } catch {
      failed++;
    }
  }
  return { svg: svg.replace(re, (all, attr, u) => (map.has(u) ? `${attr}="${map.get(u)}"` : all)), failed };
}

/**
 * The page as a standalone SVG string.
 * @param {import("../../core/editor.js").Editor} editor
 * @param {{transparent?: boolean, embedFonts?: boolean}} opts
 */
export async function buildSVG(editor, { transparent = false, embedFonts = true } = {}) {
  const c = editor.canvas;
  const hidden = editor.objects().filter((o) => o.data?.guide && !o.excludeFromExport);
  const pageWasExcluded = editor.page.excludeFromExport;
  const selected = editor.selection();
  // Exporting inside an ActiveSelection would write objects relative to it: release it first.
  if (selected.length) c.discardActiveObject();
  let svg;
  try {
    hidden.forEach((o) => { o.excludeFromExport = true; });
    if (transparent) editor.page.excludeFromExport = true;
    svg = withTextSVG(editor.objects(), () => withCrispPage(editor, () => c.toSVG({
      width: `${editor.width}`, height: `${editor.height}`,
      viewBox: { x: 0, y: 0, width: editor.width, height: editor.height },
    }))).result;
  } finally {
    hidden.forEach((o) => { o.excludeFromExport = false; });
    editor.page.excludeFromExport = pageWasExcluded;
    if (selected.length) editor.select(selected);
    c.requestRenderAll();
  }
  svg = svg.replace("<desc>Created with Fabric.js", "<desc>Made with OddlyClever Design (Fabric.js");
  svg = svg.replace(/(<desc>Made with OddlyClever Design \(Fabric\.js [^<]*)<\/desc>/, "$1)</desc>");

  const notes = [];
  if (embedFonts) {
    const { css, missing } = await embeddedFontCSS(editor.objects());
    if (css) svg = svg.replace("<defs>\n", `<defs>\n<style type="text/css"><![CDATA[\n${css}\n]]></style>\n`);
    if (missing.length) notes.push(`Couldn't embed ${missing.join(", ")}: text needs those fonts installed.`);
  } else if (usedFaces(editor.objects()).length) {
    notes.push("Fonts aren't embedded: text needs the fonts installed.");
  }
  const inl = await inlineImages(svg);
  if (inl.failed) notes.push(`${inl.failed} image(s) link to the web and may not show offline.`);
  return { svg: inl.svg, notes };
}
