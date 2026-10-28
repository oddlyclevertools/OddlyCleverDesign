// MP4 and GIF export. Frames are drawn offscreen on a Fabric StaticCanvas loaded from the
// design, with the same stateAt() the preview uses. MP4 frames go to the GPU's H.264 encoder
// through WebCodecs (VideoEncoder, hardwareAcceleration "prefer-hardware") and mp4-muxer;
// GIF frames go through gifenc.
import { StaticCanvas } from "fabric";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { ensureFontsFor } from "../../core/fonts.js";
import { sanitizeCanvas } from "../../core/sanitize.js";
import { el, icon } from "../../ui/kit.js";
import { downloadBlob, sanitizeFilename } from "../files/util.js";
import { applyState, captureBase } from "./render.js";
import { animOf, hasAnimation, pageDuration, stateAt } from "./timeline.js";

export const MP4_SIZES = [
  { value: 1280, label: "720p (HD)" },
  { value: 1920, label: "1080p (Full HD)" },
  { value: 3840, label: "4K (Ultra HD)" },
];
export const MP4_FPS = [30, 60];
export const GIF_SIZES = [
  { value: 480, label: "Small (480 px)" },
  { value: 720, label: "Medium (720 px)" },
  { value: 1080, label: "Large (1080 px)" },
];
export const GIF_FPS = [10, 15, 24];

// H.264 levels: [level_idc, max macroblocks per frame, max macroblocks per second]
const AVC_LEVELS = [
  [0x1f, 3600, 108000], [0x20, 5120, 216000], [0x28, 8192, 245760], [0x2a, 8704, 522240],
  [0x32, 22080, 589824], [0x33, 36864, 983040], [0x34, 36864, 2073600],
];
const PROFILES = ["6400", "4d00", "42e0"]; // High, Main, Constrained Baseline

/** Output size: the design scaled so its long side is `long`, both sides even (H.264 needs it). */
export function fitSize(w, h, long) {
  const s = long / Math.max(w, h);
  const even = (v) => Math.max(2, Math.round((v * s) / 2) * 2);
  return { width: even(w), height: even(h), scale: s };
}

function avcLevel(width, height, fps) {
  const mbs = Math.ceil(width / 16) * Math.ceil(height / 16);
  const hit = AVC_LEVELS.find(([, fs, mbps]) => mbs <= fs && mbs * fps <= mbps);
  return hit ? hit[0] : null;
}

/** The best supported H.264 encoder config: GPU first, then the browser's software encoder. */
export async function pickEncoder(width, height, fps) {
  if (typeof VideoEncoder === "undefined") return null;
  const level = avcLevel(width, height, fps);
  if (!level) return null;
  const bitrate = Math.round(Math.max(2e6, Math.min(50e6, width * height * fps * 0.1)));
  for (const hardwareAcceleration of ["prefer-hardware", "no-preference"]) {
    for (const p of PROFILES) {
      const config = {
        codec: `avc1.${p}${level.toString(16).padStart(2, "0")}`,
        width, height, bitrate, framerate: fps, hardwareAcceleration,
        latencyMode: "quality", avc: { format: "avc" },
      };
      try {
        const res = await VideoEncoder.isConfigSupported(config);
        if (res.supported) return { config: res.config || config, hardware: hardwareAcceleration === "prefer-hardware" };
      } catch { /* try the next one */ }
    }
  }
  return null;
}

// ---- offscreen stage --------------------------------------------------------------------

/** A StaticCanvas copy of the design at width x height, ready to draw any moment of it. */
export async function buildStage(app, width, height, { readback = false } = {}) {
  const ed = app.editor;
  const doc = app.motion?.player ? app.motion.player.atRest(() => ed.toJSON()) : ed.toJSON();
  const { canvas: json } = sanitizeCanvas(doc.canvas);
  await ensureFontsFor(json.objects);
  const node = document.createElement("canvas");
  // GIF frames are read back every frame: say so before Fabric creates the context.
  if (readback) node.getContext("2d", { willReadFrequently: true });
  const sc = new StaticCanvas(node, {
    width, height, enableRetinaScaling: false, renderOnAddRemove: false, skipOffscreen: false, backgroundColor: "#000000",
  });
  await sc.loadFromJSON(json);
  const s = width / ed.width;
  sc.setViewportTransform([s, 0, 0, s, 0, 0]);
  for (const o of sc.getObjects()) {
    if (o.isPage) o.set({ strokeWidth: 0 });
    if (o.data?.guide) o.visible = false;
  }
  const pw = ed.width, ph = ed.height;
  const entries = sc.getObjects().filter((o) => !o.isPage && animOf(o)).map((o) => ({ o, base: captureBase(o, pw, ph) }));
  const duration = pageDuration(ed);
  return {
    sc, node, duration, width, height,
    draw(t) {
      for (const e of entries) applyState(e.o, e.base, stateAt(e.o, t, { duration, pw, ph, geo: e.base.geo }));
      sc.renderAll();
    },
    dispose() { sc.dispose(); },
  };
}

// ---- jobs (progress chip with Cancel) ---------------------------------------------------

let job = null;
export const exporting = () => Boolean(job);

function startJob(title) {
  if (job) throw new Error("Another video is still being made. Wait for it or cancel it.");
  const fill = el("i");
  const text = el("span.mo-job-text", {}, title);
  const cancel = el("button.btn.small.mo-job-cancel", { type: "button", title: "Stop making this file" }, icon("X", 14), "Cancel");
  const chip = el("div.mo-job", { role: "status", "aria-live": "polite" },
    icon("Clapperboard", 16), text, el("div.mo-job-bar", {}, fill), cancel);
  document.body.append(chip);
  const j = {
    cancelled: false,
    progress(f, label) {
      fill.style.width = `${Math.round(f * 100)}%`;
      if (label) text.textContent = label;
    },
    check() { if (j.cancelled) throw new Error("You cancelled the export."); },
    end() { chip.remove(); job = null; },
  };
  cancel.addEventListener("click", () => { j.cancelled = true; text.textContent = "Cancelling…"; });
  job = j;
  return j;
}

const pause = () => new Promise((r) => setTimeout(r, 0));

// ---- MP4 --------------------------------------------------------------------------------

/**
 * Render the design to an MP4 blob.
 * @returns {Promise<{ blob: Blob, width: number, height: number, fps: number, frames: number, hardware: boolean, codec: string, notes: string[] }>}
 */
export async function renderMp4(app, { long = 1920, fps = 30, onProgress = () => {} } = {}) {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
    throw new Error("This browser can't make videos (it has no WebCodecs). Use a recent Chrome or Edge.");
  }
  const ed = app.editor;
  const notes = [];
  let size = fitSize(ed.width, ed.height, long);
  let enc = await pickEncoder(size.width, size.height, fps);
  if (!enc && long > 1920) {
    size = fitSize(ed.width, ed.height, 1920);
    enc = await pickEncoder(size.width, size.height, fps);
    if (enc) notes.push("4K isn't supported by this video encoder, so the video is 1080p.");
  }
  if (!enc) throw new Error("This browser has no H.264 video encoder for this size.");
  if (!enc.hardware) {
    notes.push("Your graphics card's video encoder isn't available in this browser, so the processor made this video (slower).");
  }
  if (!hasAnimation(ed.objects())) notes.push("Nothing is animated yet, so the video is still. Open Animate to add motion.");

  const j = startJob("Getting the video ready…");
  const report = (f, label) => { j.progress(f, label); onProgress(f, label); };
  let stage = null, encoder = null;
  try {
    stage = await buildStage(app, size.width, size.height);
    const frames = Math.max(1, Math.round(stage.duration * fps));
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target, fastStart: "in-memory", firstTimestampBehavior: "offset",
      video: { codec: "avc", width: size.width, height: size.height, frameRate: fps },
    });
    let failure = null;
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { failure = e; },
    });
    encoder.configure(enc.config);
    const frameUs = 1e6 / fps;
    for (let i = 0; i < frames; i++) {
      j.check();
      if (failure) throw failure;
      stage.draw(i / fps);
      const frame = new VideoFrame(stage.node, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 6 && !failure) await new Promise((r) => setTimeout(r, 2));
      if (i % 3 === 0) {
        report((i / frames) * 0.95, `Making the video: frame ${i + 1} of ${frames}`);
        await pause();
      }
    }
    report(0.96, "Finishing the video…");
    await encoder.flush();
    if (failure) throw failure;
    encoder.close();
    encoder = null;
    muxer.finalize();
    const blob = new Blob([target.buffer], { type: "video/mp4" });
    report(1, "Done");
    return { blob, width: size.width, height: size.height, fps, frames, hardware: enc.hardware, codec: enc.config.codec, notes };
  } finally {
    if (encoder && encoder.state !== "closed") { try { encoder.close(); } catch { /* already closed */ } }
    stage?.dispose();
    j.end();
  }
}

// ---- GIF --------------------------------------------------------------------------------

/** Render the design to an animated GIF blob (loops forever). */
export async function renderGif(app, { long = 720, fps = 15, onProgress = () => {} } = {}) {
  const ed = app.editor;
  const size = fitSize(ed.width, ed.height, long);
  const j = startJob("Getting the GIF ready…");
  const report = (f, label) => { j.progress(f, label); onProgress(f, label); };
  let stage = null;
  try {
    stage = await buildStage(app, size.width, size.height, { readback: true });
    const ctx = stage.node.getContext("2d");
    const frames = Math.max(1, Math.round(stage.duration * fps));
    const gif = GIFEncoder();
    let shownMs = 0;
    for (let i = 0; i < frames; i++) {
      j.check();
      stage.draw(i / fps);
      const { data } = ctx.getImageData(0, 0, size.width, size.height);
      const palette = quantize(data, 256);
      const index = applyPalette(data, palette);
      // GIF delays are in 1/100 s: spread the rounding so the total length stays right.
      const endMs = Math.round(((i + 1) * 1000) / fps / 10) * 10;
      const delay = Math.max(20, endMs - shownMs);
      shownMs += delay;
      gif.writeFrame(index, size.width, size.height, { palette, delay, repeat: 0 });
      if (i % 2 === 0) {
        report((i / frames) * 0.97, `Making the GIF: frame ${i + 1} of ${frames}`);
        await pause();
      }
    }
    gif.finish();
    const blob = new Blob([gif.bytes()], { type: "image/gif" });
    report(1, "Done");
    return { blob, width: size.width, height: size.height, fps, frames };
  } finally {
    stage?.dispose();
    j.end();
  }
}

// ---- Download popover types -------------------------------------------------------------

function pick(label, value, options, onChange) {
  const s = el("select.sel.mo-sel", { "aria-label": label, on: { change: () => onChange(Number(s.value)) } },
    options.map((o) => el("option", { value: o.value ?? o, selected: Number(o.value ?? o) === Number(value) }, o.label ?? `${o} fps`)));
  return el("label.mo-field", {}, el("span", {}, label), s);
}

const lengthNote = (app) => el("p.fl-note.mo-note", {},
  `Length: ${pageDuration(app.editor)} s. Change it in Animate › Page length.`);

/** Register MP4 and GIF in the Download popover. */
export function registerExports(app) {
  const reg = app.files?.registerExportType;
  if (!reg) return;
  const name = () => sanitizeFilename(app.project?.name || "design");
  reg({
    id: "mp4", label: "MP4 video", icon: "Clapperboard", tag: "Motion",
    help: "A video of your animations, for Shorts, Reels and posts.",
    options: (prefs, persist) => [el("div.fl-sec.mo-opts", {},
      pick("Quality", prefs.moSize ?? 1920, MP4_SIZES, (v) => { prefs.moSize = v; persist(); }),
      pick("Smoothness", prefs.moFps ?? 30, MP4_FPS, (v) => { prefs.moFps = v; persist(); }),
      lengthNote(app),
      el("p.fl-note", {}, "Made on your graphics card when the browser allows it."))],
    run: async (a, prefs, onProgress) => {
      const res = await renderMp4(a, { long: prefs.moSize ?? 1920, fps: prefs.moFps ?? 30, onProgress });
      const filename = `${name()}.mp4`;
      downloadBlob(res.blob, filename);
      return { filename, bytes: res.blob.size, type: "mp4", notes: res.notes };
    },
  });
  reg({
    id: "gif", label: "GIF", icon: "Film",
    help: "A small looping animation, for chats and websites. No sound.",
    options: (prefs, persist) => [el("div.fl-sec.mo-opts", {},
      pick("Size", prefs.moGifSize ?? 720, GIF_SIZES, (v) => { prefs.moGifSize = v; persist(); }),
      pick("Smoothness", prefs.moGifFps ?? 15, GIF_FPS, (v) => { prefs.moGifFps = v; persist(); }),
      lengthNote(app))],
    run: async (a, prefs, onProgress) => {
      const res = await renderGif(a, { long: prefs.moGifSize ?? 720, fps: prefs.moGifFps ?? 15, onProgress });
      const filename = `${name()}.gif`;
      downloadBlob(res.blob, filename);
      return { filename, bytes: res.blob.size, type: "gif" };
    },
  });
}
