// Sound: decoding, waveform peaks, beat detection, and the one mixing graph that both the live
// preview (AudioContext) and the export (OfflineAudioContext) build, so what you hear while
// editing is exactly what the MP4 gets.
import { clipEnd, clipGainPoints, duckPoints, sourceTime, valueAt } from "./model.js";
import { clipSound } from "./stretch.js";

export const MIX_RATE = 48000;
export const PEAK_RATE = 100; // waveform min/max pairs per second

/** Decode the sound of an audio or video file. Resolves null when the file has no sound. */
export async function decodeAudio(blob) {
  const buf = await blob.arrayBuffer();
  try {
    // An OfflineAudioContext decodes without needing a click first, and resamples to 48 kHz.
    return await new OfflineAudioContext(2, 1, MIX_RATE).decodeAudioData(buf);
  } catch {
    return null;
  }
}

/** One channel: the average of all channels. */
export function mono(buffer) {
  const n = buffer.length, ch = buffer.numberOfChannels;
  if (ch === 1) return buffer.getChannelData(0);
  const out = new Float32Array(n);
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / ch;
  }
  return out;
}

/** Waveform: min/max pairs at PEAK_RATE per second. */
export function computePeaks(samples, sampleRate, rate = PEAK_RATE) {
  const step = Math.max(1, Math.round(sampleRate / rate));
  const bins = Math.ceil(samples.length / step);
  const out = new Float32Array(bins * 2);
  for (let b = 0; b < bins; b++) {
    let lo = 0, hi = 0;
    const end = Math.min(samples.length, (b + 1) * step);
    for (let i = b * step; i < end; i++) {
      const v = samples[i];
      if (v < lo) lo = v;
      else if (v > hi) hi = v;
    }
    out[b * 2] = lo;
    out[b * 2 + 1] = hi;
  }
  return out;
}

// ---- beat detection ---------------------------------------------------------------------

/**
 * Find the beats of a music track with an onset (energy flux) detector and a tempo estimate.
 * @param {Float32Array} samples mono
 * @param {number} sampleRate
 * @returns {{ bpm: number, beats: number[], onsets: number[] }} times in seconds
 */
export function detectBeats(samples, sampleRate, { minBpm = 60, maxBpm = 190 } = {}) {
  const hop = Math.round(sampleRate / 100); // 10 ms frames
  const win = hop * 2;
  const frames = Math.floor((samples.length - win) / hop);
  if (frames < 50) return { bpm: 0, beats: [], onsets: [] };
  // Energy in a low band (kick drums) and in the full signal, per frame.
  const low = new Float32Array(frames), full = new Float32Array(frames);
  const a = Math.exp((-2 * Math.PI * 150) / sampleRate);
  // One pass: energy per hop, low-passed and full; a frame is two neighbouring hops.
  const hops = frames + 1;
  const hl = new Float32Array(hops), hf = new Float32Array(hops);
  let lp = 0;
  for (let h = 0; h < hops; h++) {
    let el = 0, ef = 0;
    for (let i = h * hop, end = i + hop; i < end; i++) {
      const v = samples[i];
      lp = (1 - a) * v + a * lp;
      el += lp * lp;
      ef += v * v;
    }
    hl[h] = el;
    hf[h] = ef;
  }
  let meanE = 0;
  for (let f = 0; f < frames; f++) {
    low[f] = (hl[f] + hl[f + 1]) / win;
    full[f] = (hf[f] + hf[f + 1]) / win;
    meanE += full[f];
  }
  meanE /= frames;
  const eps = meanE * 1e-3 + 1e-12;
  // Onset strength: how much the (log) energy rises from one frame to the next.
  const on = new Float32Array(frames);
  for (let f = 1; f < frames; f++) {
    on[f] = Math.max(0, Math.log(low[f] + eps) - Math.log(low[f - 1] + eps))
      + Math.max(0, Math.log(full[f] + eps) - Math.log(full[f - 1] + eps));
  }
  // Onsets: local peaks clearly above the local average.
  const onsets = [];
  const W = 50, minGap = 10;
  let last = -Infinity;
  for (let f = 2; f < frames - 2; f++) {
    let sum = 0, cnt = 0;
    for (let k = Math.max(0, f - W); k < Math.min(frames, f + W); k++) { sum += on[k]; cnt++; }
    const thr = (sum / cnt) * 1.5 + 0.05;
    if (on[f] > thr && on[f] >= on[f - 1] && on[f] >= on[f + 1] && on[f] >= on[f - 2] && on[f] >= on[f + 2] && f - last >= minGap) {
      onsets.push(f);
      last = f;
    }
  }
  // Tempo: the period (in frames) where the onset curve best lines up with itself.
  const lagMin = Math.round((60 / maxBpm) * 100), lagMax = Math.round((60 / minBpm) * 100);
  let bestLag = 0, bestScore = -Infinity;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0;
    for (let f = 0; f + lag < frames; f++) s += on[f] * on[f + lag];
    s /= frames - lag;
    // A gentle preference for usual tempos (around 120 BPM) avoids half/double-speed picks.
    const bpm = 6000 / lag;
    const w = Math.exp(-0.5 * (Math.log2(bpm / 120) / 1.2) ** 2);
    if (s * w > bestScore) { bestScore = s * w; bestLag = lag; }
  }
  if (!bestLag || bestScore <= 0) return { bpm: 0, beats: [], onsets: onsets.map((f) => f / 100) };
  // Refine the period to sub-frame precision with the neighbouring scores (parabola).
  const acf = (lag) => {
    let s = 0;
    for (let f = 0; f + lag < frames; f++) s += on[f] * on[f + lag];
    return s / (frames - lag);
  };
  const y0 = acf(bestLag - 1), y1 = acf(bestLag), y2 = acf(bestLag + 1);
  const den = y0 - 2 * y1 + y2;
  const period = bestLag + (den !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / den)) : 0);
  // Phase: the offset whose beat grid lands on the most onset strength.
  let bestPhase = 0, bestSum = -Infinity;
  for (let ph = 0; ph < period; ph++) {
    let s = 0;
    for (let x = ph; x < frames; x += period) {
      const i = Math.round(x);
      s += Math.max(on[i] || 0, on[i - 1] || 0, on[i + 1] || 0);
    }
    if (s > bestSum) { bestSum = s; bestPhase = ph; }
  }
  const beats = [];
  for (let x = bestPhase; x < frames; x += period) {
    // Nudge each beat onto the strongest onset close by (within 3 frames).
    let i = Math.round(x), best = i;
    for (let k = i - 3; k <= i + 3; k++) if ((on[k] || 0) > (on[best] || 0)) best = k;
    beats.push(Math.round(((on[best] > 0.05 ? best : x) * hop / sampleRate) * 1000) / 1000);
  }
  return { bpm: Math.round((6000 / period) * 10) / 10, beats, onsets: onsets.map((f) => (f * hop) / sampleRate) };
}

// ---- the mixing graph -------------------------------------------------------------------

/** Ramp an AudioParam through [time, value] points, starting at timeline time `from`. */
function applyEnvelope(param, points, from, when) {
  param.cancelScheduledValues(0);
  param.setValueAtTime(valueAt(points, from), when);
  for (const [t, v] of points) {
    if (t > from) param.linearRampToValueAtTime(v, when + (t - from));
  }
}

/**
 * Build the mix in `ctx` and start it: every audio clip (and every video clip's own sound) with
 * its volume, fades, speed (pitch kept when asked), direction and mute, the music ducked under
 * the voice. Freeze frames are silent.
 * @param {BaseAudioContext} ctx
 * @param {object} tl the timeline
 * @param {Map<string, AudioBuffer|null>} buffers decoded sound by media id
 * @param {{ from?: number, when?: number, destination?: AudioNode }} opts
 * @returns {{ stop(): void }}
 */
export function scheduleMix(ctx, tl, buffers, { from = 0, when = ctx.currentTime, destination = ctx.destination } = {}) {
  const master = ctx.createGain();
  master.connect(destination);
  const buses = {};
  for (const id of ["video", "voice", "music", "sfx"]) {
    const g = ctx.createGain();
    g.connect(master);
    buses[id] = g;
  }
  const duck = duckPoints(tl);
  if (duck.length) applyEnvelope(buses.music.gain, duck, from, when);
  const sources = [];
  for (const c of tl.clips) {
    const buf = buffers.get(c.mediaId);
    if (!buf || c.muted || c.freeze || c.volume <= 0) continue;
    const end = clipEnd(c);
    if (end <= from) continue;
    const t0 = Math.max(c.start, from);
    // Backwards or pitch-kept clips play a made copy from its start; others play the file.
    const made = clipSound(buf, c);
    const offset = made ? (t0 - c.start) * made.rate : sourceTime(c, t0);
    if (made ? offset >= made.buffer.duration : offset >= buf.duration || offset >= c.out) continue;
    const src = ctx.createBufferSource();
    src.buffer = made ? made.buffer : buf;
    src.playbackRate.value = made ? made.rate : c.speed;
    const g = ctx.createGain();
    applyEnvelope(g.gain, clipGainPoints(c), t0, when + (t0 - from));
    src.connect(g);
    g.connect(buses[c.track] || buses.sfx);
    src.start(when + (t0 - from), offset);
    src.stop(when + (end - from));
    sources.push(src);
  }
  return {
    stop() {
      for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } }
      try { master.disconnect(); } catch { /* already gone */ }
    },
  };
}

/** Mix the whole timeline to one stereo AudioBuffer of `duration` seconds. */
export async function renderMix(tl, buffers, duration) {
  const frames = Math.max(1, Math.ceil(duration * MIX_RATE));
  const off = new OfflineAudioContext(2, frames, MIX_RATE);
  scheduleMix(off, tl, buffers, { from: 0, when: 0 });
  return off.startRendering();
}

// ---- WAV --------------------------------------------------------------------------------

/** A 16-bit PCM WAV file of an AudioBuffer. */
export function encodeWav(buffer) {
  const ch = buffer.numberOfChannels, n = buffer.length, rate = buffer.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); data.setUint32(4, 36 + n * ch * 2, true); str(8, "WAVE");
  str(12, "fmt "); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  str(36, "data"); data.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([data], { type: "audio/wav" });
}
