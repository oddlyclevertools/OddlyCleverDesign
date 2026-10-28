// Caption cues as pure data: grouping transcribed words into short captions, and the hand edits
// (text, timing, split, merge, remove). Every function returns NEW cues and never changes the
// ones it was given. A cue = { start, end, text, words?: [{ text, start, end }] } in timeline s.

const round = (v) => Math.round(v * 1000) / 1000;
const MIN_CUE = 0.1;

/** How many words a caption holds at most, by the "Words per caption" choice. */
export const CUE_LENGTHS = [
  { value: "short", label: "1–3 words (punchy)", words: 3 },
  { value: "medium", label: "Up to 6 words", words: 6 },
  { value: "long", label: "Whole sentences", words: 12 },
];

/**
 * Words with times -> captions. A caption ends at `maxWords`, at the end of a sentence, at a
 * pause longer than `maxGap` s, or when it would last longer than `maxDur` s.
 * @param {{ text: string, start: number, end: number }[]} words timeline seconds
 */
export function groupWords(words, { maxWords = 3, maxGap = 0.6, maxDur = 3 } = {}) {
  const cues = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    cues.push({ start: cur[0].start, end: cur[cur.length - 1].end, text: cur.map((w) => w.text).join(" "), words: cur });
    cur = [];
  };
  for (const w of words) {
    if (!w?.text) continue;
    const last = cur[cur.length - 1];
    if (last && (cur.length >= maxWords || w.start - last.end > maxGap || w.end - cur[0].start > maxDur)) flush();
    cur.push({ text: w.text, start: round(w.start), end: round(Math.max(w.end, w.start + 0.05)) });
    if (/[.!?…]["')\]]*$/.test(w.text)) flush();
  }
  flush();
  // Close tiny gaps so captions don't blink off between words.
  return cues.map((q, i) => {
    const next = cues[i + 1];
    const end = next && next.start - q.end < 0.35 ? next.start : q.end;
    return { ...q, start: round(q.start), end: round(Math.max(end, q.start + MIN_CUE)) };
  });
}

/** The words of a cue (made from its text, spread evenly by length, when it has none). */
export function wordsOf(cue) {
  if (cue.words?.length) return cue.words;
  return spread(cue.text, cue.start, cue.end);
}

/** Split `text` into words timed across start..end in proportion to their length. */
export function spread(text, start, end) {
  const parts = String(text || "").split(/\s+/).filter(Boolean);
  const total = parts.reduce((s, p) => s + p.length + 1, 0) || 1;
  let at = start;
  return parts.map((p) => {
    const d = ((end - start) * (p.length + 1)) / total;
    const w = { text: p, start: round(at), end: round(at + d) };
    at += d;
    return w;
  });
}

const check = (cues, i) => {
  if (!cues[i]) throw new Error("That caption isn't there any more.");
  return cues[i];
};

/**
 * Change a cue's text and/or timing. New text keeps the word times when the word count is the
 * same; otherwise its words are spread over the cue. New times stretch the word times to fit.
 */
export function editCue(cues, i, { text, start, end } = {}) {
  const q = check(cues, i);
  const s = start != null ? Math.max(0, Number(start)) : q.start;
  const e = end != null ? Math.max(s + MIN_CUE, Number(end)) : Math.max(s + MIN_CUE, q.end);
  let words = wordsOf(q);
  // Retime: map the old range onto the new one.
  const k = (e - s) / Math.max(1e-6, q.end - q.start);
  words = words.map((w) => ({ ...w, start: round(s + (w.start - q.start) * k), end: round(s + (w.end - q.start) * k) }));
  let txt = q.text;
  if (text != null) {
    txt = String(text).replace(/\s+/g, " ").trim().slice(0, 400);
    if (!txt) throw new Error("A caption needs some words. Use Remove to take it away.");
    const parts = txt.split(" ");
    words = parts.length === words.length ? words.map((w, n) => ({ ...w, text: parts[n] })) : spread(txt, s, e);
  }
  const next = { start: round(s), end: round(e), text: txt, words };
  return sortCues(cues.map((x, n) => (n === i ? next : x)));
}

/** Split a cue in two at timeline time `at` (between the nearest words), or in the middle. */
export function splitCue(cues, i, at) {
  const q = check(cues, i);
  const words = wordsOf(q);
  if (words.length < 2) throw new Error("A caption needs at least two words to split.");
  let cut = Math.ceil(words.length / 2);
  if (Number.isFinite(at) && at > q.start && at < q.end) {
    cut = words.findIndex((w) => (w.start + w.end) / 2 >= at);
    if (cut <= 0) cut = 1;
    if (cut >= words.length) cut = words.length - 1;
  }
  const a = words.slice(0, cut), b = words.slice(cut);
  const mid = b[0].start;
  const left = { start: q.start, end: round(Math.max(q.start + MIN_CUE, mid)), text: a.map((w) => w.text).join(" "), words: a };
  const right = { start: round(mid), end: q.end, text: b.map((w) => w.text).join(" "), words: b };
  return [...cues.slice(0, i), left, right, ...cues.slice(i + 1)];
}

/** Join a cue with the next one. */
export function mergeCues(cues, i) {
  const a = check(cues, i), b = cues[i + 1];
  if (!b) throw new Error("This is the last caption, so there's nothing after it to join.");
  const words = [...wordsOf(a), ...wordsOf(b)];
  const merged = { start: a.start, end: Math.max(a.end, b.end), text: `${a.text} ${b.text}`.trim(), words };
  return [...cues.slice(0, i), merged, ...cues.slice(i + 2)];
}

/** Take a cue away. */
export function removeCue(cues, i) {
  check(cues, i);
  return cues.filter((_, n) => n !== i);
}

/** Add a new cue at time `at` (in the gap there, up to 2 s long). */
export function addCue(cues, at, text = "New caption") {
  const t = Math.max(0, Number(at) || 0);
  const next = cues.find((q) => q.start > t);
  const end = Math.max(t + MIN_CUE * 5, Math.min(t + 2, next ? next.start : t + 2));
  return sortCues([...cues.filter((q) => !(t >= q.start && t < q.end)), { start: round(t), end: round(end), text, words: spread(text, t, end) }]);
}

/** Move a cue (and its words) by `dt` seconds. */
export function shiftCue(cues, i, dt) {
  const q = check(cues, i);
  const d = Math.max(-q.start, Number(dt) || 0);
  const move = (x) => ({ ...x, start: round(x.start + d), end: round(x.end + d) });
  return sortCues(cues.map((x, n) => (n === i ? { ...move(x), words: wordsOf(x).map(move) } : x)));
}

const sortCues = (cues) => [...cues].sort((a, b) => a.start - b.start);
