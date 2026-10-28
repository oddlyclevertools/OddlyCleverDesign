// Bringing files in and getting at them later: checks the type, stores the file in the media
// library, measures it (length, size, a poster frame), decodes its sound for the waveform, and
// keeps object URLs and decoded sound in memory while the app is open.
import { computePeaks, decodeAudio, detectBeats, mono, PEAK_RATE } from "./audio.js";
import { getMedia, patchMedia, saveMedia } from "./media-db.js";

const VIDEO_EXT = /\.(mp4|m4v|webm|mov)$/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|weba)$/i;
export const ACCEPT = "video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac";
export const MAX_BYTES = 4 * 1024 ** 3;

/** "video", "audio" or null for a File. */
export function kindOf(file) {
  const t = (file?.type || "").toLowerCase();
  if (t.startsWith("video/") || (!t && VIDEO_EXT.test(file?.name || ""))) {
    // MediaRecorder sound-only WebM files say "video/webm" in some browsers: the probe sorts that out.
    return "video";
  }
  if (t.startsWith("audio/") || AUDIO_EXT.test(file?.name || "")) return "audio";
  if (VIDEO_EXT.test(file?.name || "")) return "video";
  return null;
}

const urls = new Map();      // mediaId -> Promise<string>
const sounds = new Map();    // mediaId -> Promise<AudioBuffer|null>
const infos = new Map();     // mediaId -> Promise<record without blob>

/** An object URL for the file (kept while the app is open). */
export function urlOf(id) {
  if (!urls.has(id)) {
    const p = getMedia(id).then((r) => {
      if (!r?.blob) throw new Error("A video or sound file of this design isn't in this browser any more.");
      return URL.createObjectURL(r.blob);
    });
    p.catch(() => urls.delete(id));
    urls.set(id, p);
  }
  return urls.get(id);
}

/** The decoded sound of a file (null when it has none). */
export function soundOf(id) {
  if (!sounds.has(id)) {
    const p = getMedia(id).then((r) => (r?.blob && r.hasAudio !== false ? decodeAudio(r.blob) : null));
    p.catch(() => sounds.delete(id));
    sounds.set(id, p);
  }
  return sounds.get(id);
}

/** The library record without the file (cached). */
export function infoOf(id) {
  if (!infos.has(id)) {
    const p = getMedia(id).then((r) => {
      if (!r) return null;
      const { blob, ...rest } = r;
      return rest;
    });
    p.catch(() => infos.delete(id));
    infos.set(id, p);
  }
  return infos.get(id);
}

/** Decoded sound for every file the timeline uses: Map(mediaId -> AudioBuffer|null). */
export async function soundsFor(tl) {
  const ids = [...new Set(tl.clips.map((c) => c.mediaId))];
  const out = new Map();
  await Promise.all(ids.map(async (id) => { out.set(id, await soundOf(id).catch(() => null)); }));
  return out;
}

const once = (target, ok, bad, ms = 20000) => new Promise((resolve, reject) => {
  const done = (fn, v) => { clearTimeout(timer); target.removeEventListener(ok, okFn); if (bad) target.removeEventListener(bad, badFn); fn(v); };
  const okFn = () => done(resolve);
  const badFn = () => done(reject, new Error("This file can't be played in this browser."));
  const timer = setTimeout(() => done(reject, new Error("This file took too long to open.")), ms);
  target.addEventListener(ok, okFn);
  if (bad) target.addEventListener(bad, badFn);
});

/** Wait until a video element shows the frame at `t` (seconds). */
export async function seekTo(v, t) {
  const target = Math.max(0, Math.min(t, (Number.isFinite(v.duration) ? v.duration : t) - 0.001));
  if (Math.abs(v.currentTime - target) < 0.0005 && v.readyState >= 2 && !v.seeking) return;
  const p = once(v, "seeked", "error");
  v.currentTime = target;
  await p;
}

/** Length, size and a small poster frame of a video file. */
async function probeVideo(blob) {
  const url = URL.createObjectURL(blob);
  const v = document.createElement("video");
  v.muted = true;
  v.preload = "auto";
  v.playsInline = true;
  try {
    const ready = once(v, "loadedmetadata", "error");
    v.src = url;
    await ready;
    let duration = v.duration;
    if (!Number.isFinite(duration)) {
      // Recorded WebM files often don't say how long they are until the end has been read.
      const known = once(v, "durationchange", null, 8000).catch(() => {});
      v.currentTime = 1e7;
      await known;
      await once(v, "seeked", "error", 8000).catch(() => {});
      duration = Number.isFinite(v.duration) ? v.duration : v.currentTime;
    }
    const width = v.videoWidth, height = v.videoHeight;
    let thumb = null;
    if (width && height) {
      await seekTo(v, Math.min(0.5, duration / 3));
      const tw = 192, th = Math.max(2, Math.round((tw * height) / width));
      const c = document.createElement("canvas");
      c.width = tw;
      c.height = th;
      c.getContext("2d").drawImage(v, 0, 0, tw, th);
      thumb = c.toDataURL("image/jpeg", 0.72);
    }
    return { duration, width, height, thumb };
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * Put a video or sound file in the media library, measured and ready to use.
 * @param {File|Blob} file
 * @param {{ name?: string, onStep?: (label: string) => void }} opts
 * @returns {Promise<object>} the library record (without the file)
 */
export async function importMedia(file, { name, onStep = () => {} } = {}) {
  let kind = kindOf(file);
  if (!kind) throw new Error(`"${file?.name || "This file"}" isn't a video (MP4, WebM, MOV) or sound (MP3, WAV, M4A) file.`);
  if (file.size > MAX_BYTES) throw new Error("This file is bigger than 4 GB. Trim it in another app first.");
  if (!file.size) throw new Error("This file is empty.");
  onStep("Opening the file…");
  let info = { duration: 0, width: 0, height: 0, thumb: null };
  if (kind === "video") {
    info = await probeVideo(file);
    if (!info.width) kind = "audio"; // a sound-only WebM
  }
  onStep("Reading the sound…");
  const sound = await decodeAudio(file);
  if (kind === "audio" && !sound) throw new Error("This sound file can't be read in this browser. Try MP3 or WAV.");
  const duration = kind === "audio" ? sound.duration : (info.duration || sound?.duration || 0);
  if (!(duration > 0)) throw new Error("This file has no length, so it can't go on the timeline.");
  const peaks = sound ? computePeaks(mono(sound), sound.sampleRate) : null;
  onStep("Saving it in this browser…");
  const rec = await saveMedia({
    name: (name || file.name || (kind === "video" ? "Video" : "Sound")).slice(0, 120),
    type: file.type || "", kind, size: file.size, blob: file,
    duration: Math.round(duration * 1000) / 1000, width: info.width, height: info.height, thumb: info.thumb,
    hasAudio: Boolean(sound), peaks, peakRate: PEAK_RATE,
  });
  if (sound) sounds.set(rec.id, Promise.resolve(sound));
  const { blob, ...rest } = rec;
  infos.set(rec.id, Promise.resolve(rest));
  return rest;
}

/** The beats of a music file (found once, then kept in the library). */
export async function beatsOf(id) {
  const info = await infoOf(id);
  if (info?.beats) return info.beats;
  const sound = await soundOf(id);
  if (!sound) throw new Error("This clip has no sound to find beats in.");
  const res = detectBeats(mono(sound), sound.sampleRate);
  const beats = { bpm: res.bpm, beats: res.beats };
  const next = await patchMedia(id, { beats });
  if (next) {
    const { blob, ...rest } = next;
    infos.set(id, Promise.resolve(rest));
  }
  return beats;
}

/** Forget cached data for a removed file. */
export function forget(id) {
  urls.get(id)?.then((u) => URL.revokeObjectURL(u)).catch(() => {});
  urls.delete(id);
  sounds.delete(id);
  infos.delete(id);
}
