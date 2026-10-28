// Languages, writing systems and which bundled fonts can draw them. The font table comes from
// the @fontsource subsets the app ships (core/fonts.js imports every subset of each family).
import { FONTS, nearestWeight } from "../../core/fonts.js";

/** code, English name, own name, right-to-left? */
export const LANGUAGES = [
  ["es", "Spanish", "Español"], ["fr", "French", "Français"], ["de", "German", "Deutsch"], ["it", "Italian", "Italiano"],
  ["pt", "Portuguese", "Português"], ["nl", "Dutch", "Nederlands"], ["pl", "Polish", "Polski"], ["tr", "Turkish", "Türkçe"],
  ["sv", "Swedish", "Svenska"], ["da", "Danish", "Dansk"], ["no", "Norwegian", "Norsk"], ["fi", "Finnish", "Suomi"],
  ["cs", "Czech", "Čeština"], ["ro", "Romanian", "Română"], ["hu", "Hungarian", "Magyar"], ["el", "Greek", "Ελληνικά"],
  ["ru", "Russian", "Русский"], ["uk", "Ukrainian", "Українська"], ["ar", "Arabic", "العربية", true], ["he", "Hebrew", "עברית", true],
  ["ur", "Urdu", "اردو", true], ["fa", "Persian", "فارسی", true], ["hi", "Hindi", "हिन्दी"], ["mr", "Marathi", "मराठी"],
  ["bn", "Bengali", "বাংলা"], ["ta", "Tamil", "தமிழ்"], ["th", "Thai", "ไทย"], ["vi", "Vietnamese", "Tiếng Việt"],
  ["id", "Indonesian", "Bahasa Indonesia"], ["ms", "Malay", "Bahasa Melayu"], ["fil", "Filipino", "Filipino"], ["sw", "Swahili", "Kiswahili"],
  ["ja", "Japanese", "日本語"], ["ko", "Korean", "한국어"], ["zh-Hans", "Chinese (Simplified)", "简体中文"], ["zh-Hant", "Chinese (Traditional)", "繁體中文"],
  ["en", "English", "English"],
].map(([code, name, native, rtl = false]) => ({ code, name, native, rtl }));

/** A language by code or English name (case-insensitive). Unknown ones are kept as given. */
export function findLanguage(q) {
  const s = String(q ?? "").trim();
  if (!s) throw new Error("A language is empty.");
  const l = s.toLowerCase();
  return LANGUAGES.find((x) => x.code.toLowerCase() === l || x.name.toLowerCase() === l || x.native.toLowerCase() === l)
    || { code: s, name: s, native: s, rtl: false };
}

/** Writing systems we check, with the free OFL font to recommend when no bundled one fits. */
export const SCRIPTS = [
  { id: "arabic", re: /\p{Script=Arabic}/u, rtl: true, name: "Arabic", suggest: "Noto Naskh Arabic (@fontsource/noto-naskh-arabic, OFL)" },
  { id: "hebrew", re: /\p{Script=Hebrew}/u, rtl: true, name: "Hebrew", suggest: "Noto Sans Hebrew (@fontsource/noto-sans-hebrew, OFL)" },
  { id: "devanagari", re: /\p{Script=Devanagari}/u, name: "Devanagari", suggest: "Noto Sans Devanagari (@fontsource/noto-sans-devanagari, OFL)" },
  { id: "bengali", re: /\p{Script=Bengali}/u, name: "Bengali", suggest: "Noto Sans Bengali (@fontsource/noto-sans-bengali, OFL)" },
  { id: "tamil", re: /\p{Script=Tamil}/u, name: "Tamil", suggest: "Noto Sans Tamil (@fontsource/noto-sans-tamil, OFL)" },
  { id: "thai", re: /\p{Script=Thai}/u, name: "Thai", suggest: "Noto Sans Thai (@fontsource/noto-sans-thai, OFL)", noSpaces: true },
  { id: "hangul", re: /\p{Script=Hangul}/u, name: "Korean", suggest: "Noto Sans KR (@fontsource/noto-sans-kr, OFL)" },
  { id: "kana", re: /[\p{Script=Hiragana}\p{Script=Katakana}]/u, name: "Japanese", suggest: "Noto Sans JP (@fontsource/noto-sans-jp, OFL)", noSpaces: true },
  { id: "han", re: /\p{Script=Han}/u, name: "Chinese", suggest: "Noto Sans SC or TC (@fontsource/noto-sans-sc, OFL)", noSpaces: true },
  { id: "greek", re: /\p{Script=Greek}/u, name: "Greek", suggest: "Noto Sans (@fontsource/noto-sans, OFL)" },
  { id: "cyrillic", re: /[Ѐ-џ]/u, name: "Cyrillic", suggest: "Noto Sans (@fontsource/noto-sans, OFL)" },
  { id: "vietnamese", re: /[Ạ-ỹƠơƯư]/u, name: "Vietnamese", suggest: "Noto Sans (@fontsource/noto-sans, OFL)" },
  { id: "latin-ext", re: /[Ā-ɏḀ-ẟ]/u, name: "accented Latin", suggest: "Noto Sans (@fontsource/noto-sans, OFL)" },
];

// Bundled family -> the scripts (beyond basic Latin) its subsets cover.
const COVER = {
  "Abril Fatface": "latin-ext", "Alfa Slab One": "latin-ext vietnamese", "Anton": "latin-ext vietnamese",
  "Archivo Black": "latin-ext", "Bangers": "latin-ext vietnamese", "Barlow Condensed": "latin-ext vietnamese",
  "Bebas Neue": "latin-ext", "Black Ops One": "latin-ext vietnamese", "Bungee": "latin-ext vietnamese",
  "Caveat": "cyrillic latin-ext", "Dancing Script": "latin-ext vietnamese", "DM Serif Display": "latin-ext",
  "Fredoka": "hebrew latin-ext", "Inter": "cyrillic greek latin-ext vietnamese", "Kanit": "latin-ext thai vietnamese",
  "Lilita One": "latin-ext", "Lobster": "cyrillic latin-ext vietnamese", "Lora": "cyrillic latin-ext vietnamese",
  "Luckiest Guy": "latin-ext", "Merriweather": "cyrillic latin-ext vietnamese", "Montserrat": "cyrillic latin-ext vietnamese",
  "Nunito": "cyrillic latin-ext vietnamese", "Oswald": "cyrillic latin-ext vietnamese", "Pacifico": "cyrillic latin-ext vietnamese",
  "Permanent Marker": "", "Playfair Display": "cyrillic latin-ext vietnamese", "Poppins": "devanagari latin-ext",
  "Raleway": "cyrillic latin-ext vietnamese", "Righteous": "latin-ext", "Roboto": "cyrillic greek latin-ext vietnamese",
  "Rubik": "arabic cyrillic hebrew latin-ext", "Russo One": "cyrillic latin-ext", "Space Grotesk": "latin-ext vietnamese",
  "Teko": "devanagari latin-ext", "Titan One": "latin-ext",
};
export const FONT_SCRIPTS = Object.fromEntries(Object.entries(COVER).map(([f, s]) => [f, new Set(s.split(/\s+/).filter(Boolean))]));

/** The scripts a text needs (beyond basic Latin). */
export function scriptsIn(text) {
  return SCRIPTS.filter((s) => s.re.test(String(text || "")));
}

/** True when most letters of a text are right-to-left. */
export function isRtlText(text) {
  const letters = String(text || "").match(/\p{L}/gu) || [];
  if (!letters.length) return false;
  const rtl = letters.filter((c) => /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}]/u.test(c)).length;
  return rtl / letters.length > 0.5;
}

/** True when a text is written without spaces between words (wrap by letter instead). */
export const needsLetterWrap = (text) => scriptsIn(text).some((s) => s.noSpaces);

/**
 * Can `family` draw `text`? Returns { ok, family, missing }: family is a bundled font to switch
 * to when the current one can't (same style group first), missing lists scripts no bundled
 * font covers. Fonts the user uploaded (not bundled) are trusted.
 */
export function fontFor(family, text) {
  const needs = scriptsIn(text);
  if (!needs.length || !FONT_SCRIPTS[family]) return { ok: true, family, missing: [] };
  const has = FONT_SCRIPTS[family];
  if (needs.every((s) => has.has(s.id))) return { ok: true, family, missing: [] };
  const fits = Object.keys(FONT_SCRIPTS).filter((f) => needs.every((s) => FONT_SCRIPTS[f].has(s.id)));
  if (fits.length) {
    const cat = FONTS[family]?.category;
    return { ok: false, family: fits.find((f) => FONTS[f]?.category === cat) || fits[0], missing: [] };
  }
  const missing = needs.filter((s) => !Object.values(FONT_SCRIPTS).some((set) => set.has(s.id)));
  // Cover what we can: the font that covers the most of the needed scripts.
  const best = Object.keys(FONT_SCRIPTS).map((f) => [f, needs.filter((s) => FONT_SCRIPTS[f].has(s.id)).length]).sort((a, b) => b[1] - a[1])[0];
  return { ok: false, family: best && best[1] > needs.filter((s) => has.has(s.id)).length ? best[0] : family, missing };
}

export { nearestWeight };
