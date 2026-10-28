// Auto captions: listen to the voice (or the video's own sound) on the timeline, write down
// every word with its time (Whisper on the graphics card, whisper.js) and turn the words into
// short Shorts-style captions on the caption track. Nothing leaves this PC.
import { CUE_LENGTHS, groupWords } from "./cues.js";
import { infoOf, soundOf } from "./media.js";
import * as M from "./model.js";
import { readTimeline, writeTimeline } from "./store.js";
import { SAMPLE_RATE, transcribe } from "./whisper.js";

/** The languages offered (Whisper base knows many more; these read well with it). */
export const LANGUAGES = [
  ["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["it", "Italian"],
  ["pt", "Portuguese"], ["nl", "Dutch"], ["hi", "Hindi"], ["ja", "Japanese"], ["ko", "Korean"],
  ["zh", "Chinese"], ["ru", "Russian"], ["pl", "Polish"], ["tr", "Turkish"], ["ar", "Arabic"],
].map(([value, label]) => ({ value, label }));

/**
 * The clips to listen to: the voice track when it has clips, otherwise the video clips' own
 * sound. `source`: "auto" | "voice" | "video" | "all". Backwards clips and stills are skipped.
 */
export async function clipsToHear(tl, source = "auto") {
  const ok = (c) => !c.muted && !c.freeze && !c.reverse && c.volume > 0;
  const voice = M.clipsOn(tl, "voice").filter(ok);
  const video = [];
  for (const c of M.clipsOn(tl, "video").filter(ok)) {
    const info = await infoOf(c.mediaId).catch(() => null);
    if (info?.hasAudio) video.push(c);
  }
  if (source === "voice") return voice;
  if (source === "video") return video;
  if (source === "all") return [...voice, ...video];
  return voice.length ? voice : video;
}

/** A clip's sound as 16 kHz mono (what Whisper hears), from its in to its out point. */
async function clipSamples(c) {
  const buf = await soundOf(c.mediaId);
  if (!buf) return null;
  const len = Math.max(1, Math.ceil((c.out - c.in) * SAMPLE_RATE));
  const off = new OfflineAudioContext(1, len, SAMPLE_RATE);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start(0, c.in, c.out - c.in);
  return (await off.startRendering()).getChannelData(0);
}

/**
 * Write captions from the speech on the timeline (replaces the caption track: one undo step).
 * @param {object} app
 * @param {{ source?: string, language?: string, length?: "short"|"medium"|"long", style?: object,
 *   write?: boolean, onProgress?: (f: number, label: string) => void }} opts
 * @returns {Promise<{ cues: object[], words: number, clips: number, onGPU: boolean, gpuName: string, ms: number }>}
 */
export async function makeCaptions(app, { source = "auto", language = "en", length = "short", style, write = true, onProgress = () => {} } = {}) {
  const tl = readTimeline(app);
  const clips = await clipsToHear(tl, source);
  if (!clips.length) throw new Error("There's no speech to caption yet. Add or record a voice-over, or a video clip with sound.");
  const words = [];
  let gpu = { onGPU: true, gpuName: "" }, ms = 0;
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const label = clips.length > 1 ? `Listening to clip ${i + 1} of ${clips.length}…` : "Listening…";
    onProgress(i / clips.length, label);
    const samples = await clipSamples(c);
    if (!samples) continue;
    const r = await transcribe(samples, { language, onProgress: (f) => onProgress((i + f) / clips.length, label) });
    gpu = { onGPU: r.onGPU, gpuName: r.gpuName };
    ms += r.ms;
    // Word times are seconds into the clip's sound: put them on the timeline (speed included).
    const end = M.clipEnd(c);
    for (const w of r.words) {
      const s = M.timelineTime(c, c.in + w.start), e = M.timelineTime(c, c.in + w.end);
      if (s >= end) continue;
      words.push({ text: w.text, start: s, end: Math.min(e, end) });
    }
  }
  if (!words.length) throw new Error("No words were heard. Is the voice loud enough, and is the language right?");
  words.sort((a, b) => a.start - b.start);
  const maxWords = (CUE_LENGTHS.find((x) => x.value === length) || CUE_LENGTHS[0]).words;
  const cues = groupWords(words, { maxWords, maxDur: maxWords > 6 ? 6 : 3 });
  if (write) {
    const st = { ...(tl.captions?.style || {}), ...(style || {}) };
    writeTimeline(app, M.setCaptions(readTimeline(app), cues, st), "Auto captions");
  }
  onProgress(1, "Done");
  return { cues, words: words.length, clips: clips.length, ...gpu, ms };
}
