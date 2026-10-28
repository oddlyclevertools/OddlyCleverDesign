// Letter case. A case change remembers the words as they were typed (data.textCase), so
// "As typed" brings them back. Edit the words afterwards and the new words become the original.
import { applyToTexts, setData, targets } from "./helpers.js";

export const CASES = [
  ["upper", "UPPERCASE", (s) => s.toUpperCase()],
  ["title", "Title Case", (s) => s.toLowerCase().replace(/(^|[\s\-(/"'“‘])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())],
  ["lower", "lowercase", (s) => s.toLowerCase()],
  ["sentence", "Sentence case", (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())],
];
const caseFn = (id) => CASES.find((c) => c[0] === id)?.[2];

/** The words as typed, when this text's case was changed and the words weren't edited since. */
export function originalOf(t) {
  const tc = t.data?.textCase;
  const fn = tc && caseFn(tc.id);
  return fn && typeof tc.original === "string" && fn(tc.original) === t.text ? tc.original : null;
}

/** The case applied to a text right now ("original" when none, or the words were edited). */
export const caseOf = (t) => (originalOf(t) != null ? t.data.textCase.id : "original");

/** Change the case of the selected texts ("original" goes back to the words as typed). One undo step. */
export function setCase(app, id, list = targets(app)) {
  const fn = caseFn(id);
  if (!fn && id !== "original") return [];
  return applyToTexts(app, (t) => {
    const base = originalOf(t) ?? t.text ?? "";
    if (id === "original") {
      t.set("text", base);
      setData(t, { textCase: null });
      return;
    }
    t.set("text", fn(base));
    setData(t, { textCase: { id, original: base } });
  }, id === "original" ? "As typed" : "Case", { list });
}

/** Ctrl+Shift+K: UPPERCASE, then back to the words as typed (or Sentence case if they were typed in capitals). */
export function toggleUpper(app) {
  const list = targets(app);
  if (!list.length) return [];
  if (!list.every((t) => (t.text || "") === (t.text || "").toUpperCase())) return setCase(app, "upper", list);
  return setCase(app, list.every((t) => originalOf(t) != null) ? "original" : "sentence", list);
}
