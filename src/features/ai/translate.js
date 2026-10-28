// app.ai.translate for the Translate feature: one plain request (no tools) to the user's own AI,
// asking for a JSON list of translations in the same order. Long designs go in batches.
import { createSession } from "./providers/index.js";
import { FriendlyError } from "./providers/common.js";
import { getKey } from "./keys.js";
import { providerSettings } from "./settings.js";

const BATCH = 60;

const SYSTEM = "You translate the text of a graphic design (thumbnails, posters, social posts). "
  + "Keep it short and punchy like the original, keep line breaks, emoji, numbers, prices, names and brand words. "
  + "Answer with a JSON array of strings only: one translation per input, in the same order, nothing else.";

/** The JSON array in a reply, even when the model wrapped it in a code fence or a sentence. */
export function parseList(reply, count) {
  const text = String(reply || "");
  const start = text.indexOf("["), end = text.lastIndexOf("]");
  let list = null;
  if (start >= 0 && end > start) {
    try { list = JSON.parse(text.slice(start, end + 1)); } catch { list = null; }
  }
  if (!Array.isArray(list) || list.length !== count || !list.every((s) => typeof s === "string")) {
    throw new FriendlyError("The AI's translation didn't come back as a list I could use.", { hint: "Try again, or pick a stronger model in Ask AI." });
  }
  return list.map((s) => s.slice(0, 4000)); // AI text is untrusted: keep it to a sane length
}

async function translateBatch(texts, langName, info, signal) {
  const s = providerSettings();
  const session = createSession(s, getKey(s.id), { system: SYSTEM, tools: [] });
  const dir = info?.rtl ? " It is written right to left." : "";
  session.addUser(`Translate each string into ${langName}${info?.code ? ` (${info.code})` : ""}.${dir}\n\n${JSON.stringify(texts)}`);
  const r = await session.step({ signal });
  return parseList(r.text, texts.length);
}

/**
 * @param {string[]} texts
 * @param {string} langName e.g. "Spanish"
 * @param {{ code?: string, name?: string, rtl?: boolean }} [info]
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<string[]>} the translations, same order and length as `texts`
 */
export async function aiTranslate(texts, langName, info = {}, { signal } = {}) {
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    out.push(...(await translateBatch(texts.slice(i, i + BATCH), langName, info, signal)));
  }
  return out;
}
