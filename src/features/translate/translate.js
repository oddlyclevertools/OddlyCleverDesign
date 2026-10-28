// Translate a design: every text (or the selected ones) into one copy per language, as new
// designs or new pages. The words come from a `translator` the caller passes in (the user's AI);
// this file keeps the styles, sets right-to-left, swaps to a bundled font that has the letters,
// wraps languages without spaces by letter and shrinks text that grew so it still fits.
import { ensureFont } from "../../core/fonts.js";
import { setTextFitted } from "../bulk/fit.js";
import { allObjects, variantOf } from "../bulk/offscreen.js";
import { addPages, hasPages } from "../bulk/pages.js";
import { replaceAllText } from "../bulk/textstyles.js";
import { findLanguage, fontFor, isRtlText, nearestWeight, needsLetterWrap } from "./languages.js";

const MAX_LANGUAGES = 20;
const isText = (o) => typeof o?.text === "string";
const hasWords = (t) => /[\p{L}\p{N}]/u.test(String(t || ""));
const FLIP = { left: "right", right: "left", "justify-left": "justify-right", "justify-right": "justify-left" };

/** The texts to translate in the open design: [{id, text}] (all, or the selected ones). */
export function textsToTranslate(app, { scope = "all" } = {}) {
  const ed = app.editor;
  const pool = scope === "selection" ? ed.selection() : ed.objects();
  return allObjects(pool).filter((o) => isText(o) && o.id && hasWords(o.text) && o.visible !== false).map((o) => ({ id: o.id, text: o.text }));
}

async function checkedTranslation(translator, texts, lang) {
  const out = await translator(texts.slice(), lang.name, { code: lang.code, name: lang.name, rtl: lang.rtl });
  if (!Array.isArray(out) || out.length !== texts.length) {
    throw new Error(`The AI sent back ${Array.isArray(out) ? out.length : "no"} texts for ${lang.name} (expected ${texts.length}).`);
  }
  const kept = out.filter((t) => !(typeof t === "string" && t.trim())).length;
  return { words: out.map((t, i) => (typeof t === "string" && t.trim() ? t : texts[i])), kept };
}

/** Put translated words into one off-screen copy. Returns warnings. */
async function applyTranslation(off, byId, lang, fit) {
  const warnings = [];
  for (const o of allObjects(off.objects())) {
    if (!isText(o) || !byId.has(o.id)) continue;
    const words = byId.get(o.id);
    const props = {};
    // Right-to-left: set the direction and mirror left/right alignment.
    const rtl = lang.rtl || isRtlText(words);
    const wasRtl = o.direction === "rtl";
    if (rtl !== wasRtl) {
      props.direction = rtl ? "rtl" : "ltr";
      if (FLIP[o.textAlign]) props.textAlign = FLIP[o.textAlign];
    }
    if (needsLetterWrap(words)) props.splitByGrapheme = true;
    // A font that has the letters.
    const pick = fontFor(o.fontFamily, words);
    if (!pick.ok && pick.family !== o.fontFamily) {
      props.fontFamily = pick.family;
      props.fontWeight = nearestWeight(pick.family, Number(o.fontWeight) || (o.fontWeight === "bold" ? 700 : 400));
      warnings.push(`${o.fontFamily} has no ${lang.name} letters, so ${pick.family} is used instead.`);
    }
    if (pick.missing.length) {
      warnings.push(`No bundled font has ${pick.missing.map((s) => s.name).join(" or ")} letters. Upload one, e.g. ${pick.missing[0].suggest}.`);
    }
    const fam = props.fontFamily || o.fontFamily;
    await ensureFont(fam, props.fontWeight || o.fontWeight || 400, o.fontStyle || "normal", words);
    const next = replaceAllText(o.text, o.styles, words);
    // Per-letter font overrides would point back at a font without these letters.
    if (props.fontFamily) {
      for (const line of Object.values(next.styles)) for (const st of Object.values(line)) delete st.fontFamily;
    }
    const res = setTextFitted(o, { ...next, props }, { fit });
    if (res.overflow) warnings.push(`A text is still too long in ${lang.name}. Check it.`);
  }
  return [...new Set(warnings)];
}

/**
 * Translate the open design into each language: one copy per language.
 * @param {object} app
 * @param {{languages: string[], translator: (texts: string[], lang: string, info: {code: string, name: string, rtl: boolean}) => Promise<string[]>,
 *   asNew?: boolean, scope?: "all"|"selection", fit?: boolean, onProgress?: (f: number, text: string) => void}} opts
 *   asNew: true = new designs, false = new pages (needs page support). Default: pages when available.
 * @returns {Promise<{made: {language: string, id?: string, page?: boolean, warnings: string[]}[], failed: {language: string, error: string}[]}>}
 */
export async function translateDesign(app, { languages, translator, asNew, scope = "all", fit = true, onProgress } = {}) {
  if (typeof translator !== "function") throw new Error("Connect an AI in Ask AI to translate.");
  const list = (Array.isArray(languages) ? languages : [languages]).filter((l) => l != null && String(l).trim());
  if (!list.length) throw new Error("Pick at least one language.");
  if (list.length > MAX_LANGUAGES) throw new Error(`Pick up to ${MAX_LANGUAGES} languages at a time.`);
  const langs = [...new Map(list.map(findLanguage).map((l) => [l.code, l])).values()];
  const ed = app.editor;
  if (ed.active()?.isEditing) ed.active().exitEditing();
  const items = textsToTranslate(app, { scope });
  if (!items.length) throw new Error(scope === "selection" ? "Select some text to translate first." : "There's no text in this design to translate.");
  const usePages = asNew === false || (asNew == null && hasPages(app));
  if (asNew === false && !hasPages(app)) throw new Error("Pages aren't available here: make new designs instead.");
  const doc = ed.toJSON();
  const base = app.project?.name || "Untitled design";
  const made = [], failed = [], pages = [];
  for (const [i, lang] of langs.entries()) {
    onProgress?.(i / langs.length, `Translating into ${lang.name}…`);
    try {
      const { words, kept } = await checkedTranslation(translator, items.map((x) => x.text), lang);
      if (kept === words.length) throw new Error(`The AI didn't translate anything into ${lang.name}.`);
      const byId = new Map(items.map((x, k) => [x.id, words[k]]));
      const v = await variantOf(doc, (off) => applyTranslation(off, byId, lang, fit));
      if (kept) v.result.unshift(`${kept} text${kept === 1 ? " wasn't" : "s weren't"} translated and kept the original words.`);
      if (usePages) {
        pages.push(v.doc);
        made.push({ language: lang.name, page: true, warnings: v.result });
      } else {
        const rec = await app.store.saveProject({
          id: app.store.newProjectId(), name: `${base} (${lang.name})`,
          width: v.doc.width, height: v.doc.height, thumb: v.thumb, doc: v.doc,
        });
        made.push({ language: lang.name, id: rec.id, name: rec.name, thumb: v.thumb, warnings: v.result });
      }
    } catch (e) {
      failed.push({ language: lang.name, error: e?.message || String(e) });
    }
  }
  if (pages.length) await addPages(app, pages);
  onProgress?.(1, "Done");
  return { made, failed };
}
