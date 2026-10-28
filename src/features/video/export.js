// MP4 export of the whole timeline: H.264 video on the graphics card's encoder (WebCodecs,
// "prefer-hardware") and AAC sound mixed with an OfflineAudioContext, muxed with mp4-muxer.
// Frames are reached by seeking, so a video is made as fast as the computer allows (often
// faster than real time) and every frame is exact.
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { el, icon } from "../../ui/kit.js";
import { fitSize, pickEncoder } from "../motion/export.js";
import { MIX_RATE, renderMix } from "./audio.js";
import { createCompositor } from "./compose.js";
import { createFramePool } from "./frames.js";
import { soundsFor } from "./media.js";
import { totalDuration } from "./model.js";
import { readTimeline, scenesOf } from "./store.js";

export const QUALITIES = [
  { value: "1080p", label: "1080p (Full HD)", long: 1920 },
  { value: "4k", label: "4K (Ultra HD)", long: 3840 },
];
export const FPS = [30, 60];
const AUDIO_BITRATE = 192000;
const AUDIO_BLOCK = 4800; // 0.1 s of sound per AudioData

// ---- progress chip with a Stop button ---------------------------------------------------

let job = null;
/** True while a video is being made. */
export const exportBusy = () => Boolean(job);

function startJob(title) {
  if (job) throw new Error("A video is already being made. Wait for it or stop it.");
  const fill = el("i");
  const text = el("span.vd-job-text", {}, title);
  const stop = el("button.btn.small.vd-job-stop", { type: "button", title: "Stop making this video" }, icon("Square", 13), "Stop");
  const chip = el("div.vd-job", { role: "status", "aria-live": "polite" }, icon("Clapperboard", 16), text, el("div.vd-job-bar", {}, fill), stop);
  document.body.append(chip);
  const j = {
    stopped: false,
    progress(f, label) {
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`;
      if (label) text.textContent = label;
    },
    check() { if (j.stopped) throw new Error("You stopped the video export."); },
    end() { chip.remove(); job = null; },
  };
  stop.addEventListener("click", () => { j.stopped = true; text.textContent = "Stopping…"; });
  job = j;
  return j;
}

/** Stop the running export (if any). */
export function stopExport() { if (job) job.stopped = true; }

// ---- sound ------------------------------------------------------------------------------

async function pickAudio() {
  if (typeof AudioEncoder === "undefined") return null;
  for (const [codec, mux] of [["mp4a.40.2", "aac"], ["opus", "opus"]]) {
    const config = { codec, sampleRate: MIX_RATE, numberOfChannels: 2, bitrate: AUDIO_BITRATE };
    try {
      if ((await AudioEncoder.isConfigSupported(config)).supported) return { config, mux };
    } catch { /* try the next one */ }
  }
  return null;
}

/** Encode a stereo AudioBuffer; resolves the chunks [{ chunk, meta }] in order. */
async function encodeAudio(buffer, config, check) {
  const chunks = [];
  let failure = null;
  const enc = new AudioEncoder({ output: (chunk, meta) => chunks.push({ chunk, meta }), error: (e) => { failure = e; } });
  enc.configure(config);
  const L = buffer.getChannelData(0), R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
  try {
    for (let i = 0; i < buffer.length; i += AUDIO_BLOCK) {
      check();
      if (failure) throw failure;
      const n = Math.min(AUDIO_BLOCK, buffer.length - i);
      const data = new Float32Array(n * 2);
      data.set(L.subarray(i, i + n), 0);
      data.set(R.subarray(i, i + n), n);
      const ad = new AudioData({ format: "f32-planar", sampleRate: MIX_RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / MIX_RATE) * 1e6), data });
      enc.encode(ad);
      ad.close();
      if (enc.encodeQueueSize > 20) await new Promise((r) => setTimeout(r, 0));
    }
    await enc.flush();
    if (failure) throw failure;
  } finally {
    if (enc.state !== "closed") enc.close();
  }
  return chunks;
}

// ---- the video --------------------------------------------------------------------------

/**
 * Make an MP4 of the timeline.
 * @param {object} app
 * @param {{ quality?: "1080p"|"4k", fps?: number, onProgress?: (f: number, label: string) => void }} opts
 * @returns {Promise<{ blob: Blob, width: number, height: number, fps: number, frames: number,
 *   duration: number, hardware: boolean, codec: string, audioCodec: string|null, notes: string[] }>}
 */
export async function exportVideo(app, { quality = "1080p", fps = 30, onProgress = () => {} } = {}) {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
    throw new Error("This browser can't make videos (it has no WebCodecs). Use a recent Chrome or Edge.");
  }
  const ed = app.editor;
  const tl = readTimeline(app);
  const scenes = scenesOf(app, tl);
  const duration = totalDuration(tl, scenes);
  if (!(duration > 0)) throw new Error("The timeline is empty.");
  const notes = [];
  const want = QUALITIES.find((q) => q.value === quality) || QUALITIES[0];
  fps = FPS.includes(Number(fps)) ? Number(fps) : 30;
  let size = fitSize(ed.width, ed.height, want.long);
  let enc = await pickEncoder(size.width, size.height, fps);
  if (!enc && want.long > 1920) {
    size = fitSize(ed.width, ed.height, 1920);
    enc = await pickEncoder(size.width, size.height, fps);
    if (enc) notes.push("This computer's video encoder can't make 4K, so the video is 1080p.");
  }
  if (!enc) throw new Error("This browser has no H.264 video encoder for this size.");
  if (!enc.hardware) notes.push("The graphics card's video encoder isn't available in this browser, so the processor made this video (slower).");
  const audio = await pickAudio();
  if (!audio) notes.push("This browser can't encode sound, so the video is silent.");
  else if (audio.mux !== "aac") notes.push("This browser can't make AAC sound, so the sound is Opus (YouTube accepts it).");

  const j = startJob("Getting the video ready…");
  const report = (f, label) => { j.progress(f, label); onProgress(f, label); };
  const frames = createFramePool();
  let comp = null, encoder = null;
  try {
    // 1. Sound: mix everything, then encode it (fast, so it goes first).
    let audioChunks = [];
    if (audio) {
      report(0.01, "Mixing the sound…");
      const sounds = await soundsFor(tl);
      j.check();
      const mix = await renderMix(tl, sounds, duration);
      j.check();
      report(0.04, "Encoding the sound…");
      audioChunks = await encodeAudio(mix, audio.config, j.check);
    }
    // 2. Picture.
    report(0.06, "Drawing the scenes…");
    comp = await createCompositor(app, { width: size.width, height: size.height, tl, scenes, frames });
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    const total = Math.max(1, Math.round(duration * fps));
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target, fastStart: false, firstTimestampBehavior: "offset",
      video: { codec: "avc", width: size.width, height: size.height, frameRate: fps },
      ...(audio ? { audio: { codec: audio.mux, numberOfChannels: 2, sampleRate: MIX_RATE } } : {}),
    });
    let ai = 0;
    const audioUpTo = (us) => {
      while (ai < audioChunks.length && audioChunks[ai].chunk.timestamp <= us) {
        muxer.addAudioChunk(audioChunks[ai].chunk, audioChunks[ai].meta);
        ai++;
      }
    };
    let failure = null;
    encoder = new VideoEncoder({
      output: (chunk, meta) => { audioUpTo(chunk.timestamp); muxer.addVideoChunk(chunk, meta); },
      error: (e) => { failure = e; },
    });
    encoder.configure(enc.config);
    const frameUs = 1e6 / fps;
    const t0 = performance.now();
    for (let i = 0; i < total; i++) {
      j.check();
      if (failure) throw failure;
      const t = i / fps;
      await frames.prepare(comp.needed(t));
      comp.draw(ctx, t);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 8 && !failure) await new Promise((r) => setTimeout(r, 2));
      if (i % 5 === 0) {
        const speed = (t / ((performance.now() - t0) / 1000)) || 0;
        report(0.08 + (i / total) * 0.9, `Making the video: ${fmt(t)} of ${fmt(duration)}${speed ? ` (${speed.toFixed(1)}× real time)` : ""}`);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    report(0.98, "Finishing the video…");
    await encoder.flush();
    if (failure) throw failure;
    encoder.close();
    encoder = null;
    audioUpTo(Infinity);
    muxer.finalize();
    const blob = new Blob([target.buffer], { type: "video/mp4" });
    report(1, "Done");
    return {
      blob, width: size.width, height: size.height, fps, frames: total, duration,
      hardware: enc.hardware, codec: enc.config.codec, audioCodec: audio?.config.codec || null, notes,
    };
  } finally {
    if (encoder && encoder.state !== "closed") { try { encoder.close(); } catch { /* closed */ } }
    comp?.dispose();
    frames.dispose();
    j.end();
  }
}

/** 75.4 -> "1:15". */
export function fmt(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
