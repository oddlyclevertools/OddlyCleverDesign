// Changing a text's words while keeping its per-letter styles. Fabric keeps rich-text styles as
// styles[line][char] over the text split on "\n" (chars = code points), so we flatten them to
// one style per character, edit the text, and rebuild.

const chars = (s) => Array.from(String(s ?? ""));

/** One entry per character of `text` (newlines included, with null): its style or null. */
export function flattenStyles(text, styles) {
  const out = [];
  String(text ?? "").split("\n").forEach((line, li) => {
    if (li > 0) out.push(null);
    chars(line).forEach((_, ci) => out.push(styles?.[li]?.[ci] || null));
  });
  return out;
}

/** The styles object for `text` from one style (or null) per character. */
export function buildStyles(text, flat) {
  const styles = {};
  let i = 0;
  String(text ?? "").split("\n").forEach((line, li) => {
    if (li > 0) i++;
    chars(line).forEach((_, ci) => {
      const st = flat[i++];
      if (st && Object.keys(st).length) (styles[li] ||= {})[ci] = { ...st };
    });
  });
  return styles;
}

const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;
export const norm = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** The {{column}} names a text uses, as written. */
export function placeholdersIn(text) {
  return [...String(text ?? "").matchAll(PLACEHOLDER)].map((m) => m[1]);
}

/**
 * Replace {{column}} placeholders with values (case- and space-insensitive). The value takes the
 * style of the placeholder's first character. Unknown placeholders stay as they are.
 * @returns {{text: string, styles: object, unknown: string[]}}
 */
export function fillPlaceholders(text, styles, values) {
  const byNorm = new Map(Object.entries(values || {}).map(([k, v]) => [norm(k), v]));
  const src = String(text ?? "");
  const flat = flattenStyles(src, styles);
  const outChars = [], outFlat = [], unknown = [];
  let pos = 0; // character index into flat
  let last = 0; // string index into src
  const push = (str, style) => { for (const ch of chars(str)) { outChars.push(ch); outFlat.push(ch === "\n" ? null : style); } };
  const copy = (str) => { for (const ch of chars(str)) { outChars.push(ch); outFlat.push(flat[pos++] || null); } };
  for (const m of src.matchAll(PLACEHOLDER)) {
    copy(src.slice(last, m.index));
    const key = norm(m[1]);
    if (byNorm.has(key)) {
      const style = flat[pos] || null;
      pos += chars(m[0]).length;
      push(String(byNorm.get(key) ?? ""), style);
    } else {
      unknown.push(m[1]);
      copy(m[0]);
    }
    last = m.index + m[0].length;
  }
  copy(src.slice(last));
  const out = outChars.join("");
  return { text: out, styles: buildStyles(out, outFlat), unknown };
}

/**
 * Replace a text's words entirely. Every character takes the first character's style (so a
 * bold coloured heading stays bold and coloured).
 */
export function replaceAllText(text, styles, next) {
  const first = flattenStyles(text, styles).find(Boolean) || null;
  const out = String(next ?? "");
  return { text: out, styles: first ? buildStyles(out, chars(out).map((c) => (c === "\n" ? null : first))) : {} };
}
