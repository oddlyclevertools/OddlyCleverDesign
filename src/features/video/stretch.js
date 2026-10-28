// Sped-up or slowed-down sound that keeps its pitch (so a 2x voice doesn't sound like a
// chipmunk): WSOLA, the classic overlap-add time stretch. Each short slice of sound is placed a
// little earlier or later, wherever it lines up best with what's already there, so there are
// no clicks. Browsers can keep the pitch only on <audio>/<video> playback (preservesPitch), not
// in the Web Audio mix the preview and the export share, so it's done here once per clip.

const N = 2048;        // slice length (43 ms at 48 kHz)
const HS = N / 2;      // slices overlap by half
const TOL = 512;       // how far a slice may move to line up

let hannCache = null;
function hann() {
  if (!hannCache) {
    hannCache = new Float32Array(N);
    for (let i = 0; i < N; i++) hannCache[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  }
  return hannCache;
}

/**
 * Stretch sound by 1/speed in length, same pitch.
 * @param {Float32Array[]} channels the samples of each channel (same length)
 * @param {number} speed 2 = twice as fast (half as long)
 * @returns {Float32Array[]}
 */
export function stretch(channels, speed) {
  const inLen = channels[0]?.length || 0;
  const outLen = Math.max(1, Math.round(inLen / speed));
  if (inLen < N * 2) return channels.map((c) => resample(c, outLen));
  const win = hann();
  const ha = HS * speed;
  const mono = new Float32Array(inLen);
  for (const c of channels) for (let i = 0; i < inLen; i++) mono[i] += c[i] / channels.length;
  const out = channels.map(() => new Float32Array(outLen + N));
  const norm = new Float32Array(outLen + N);
  let prev = 0;
  for (let k = 0, o = 0; o < outLen; k++, o += HS) {
    let pos = Math.min(Math.round(k * ha), inLen - N);
    if (k > 0) {
      // Where the last slice would naturally carry on; find the nearby slice most like it.
      const target = prev + HS;
      let best = -Infinity, bestPos = pos;
      const lo = Math.max(0, pos - TOL), hi = Math.min(inLen - N, pos + TOL);
      for (let p = lo; p <= hi; p += 2) {
        let c = 0;
        for (let i = 0; i < HS && target + i < inLen; i += 4) c += mono[target + i] * mono[p + i];
        if (c > best) { best = c; bestPos = p; }
      }
      pos = bestPos;
    }
    pos = Math.max(0, pos);
    for (let ch = 0; ch < channels.length; ch++) {
      const x = channels[ch], y = out[ch];
      for (let i = 0; i < N && pos + i < inLen; i++) y[o + i] += x[pos + i] * win[i];
    }
    for (let i = 0; i < N; i++) norm[o + i] += win[i];
    prev = pos;
  }
  return out.map((y) => {
    const r = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) r[i] = norm[i] > 1e-3 ? y[i] / norm[i] : y[i];
    return r;
  });
}

/** Plain resampling to `len` samples (for sounds too short to stretch). */
function resample(x, len) {
  const r = new Float32Array(len);
  const k = x.length / len;
  for (let i = 0; i < len; i++) r[i] = x[Math.min(x.length - 1, Math.floor(i * k))] || 0;
  return r;
}

const cache = new WeakMap(); // AudioBuffer -> Map(key -> AudioBuffer)

/**
 * The sound a clip really plays, when it differs from its file: backwards and/or stretched with
 * the pitch kept. Returns { buffer, rate } (play `buffer` from 0 at `rate`), or null to play the
 * file as it is. Made once per clip setting and kept.
 */
export function clipSound(buf, c) {
  const stretchIt = c.keepPitch && Math.abs(c.speed - 1) > 1e-3;
  if (!c.reverse && !stretchIt) return null;
  const key = `${c.in}|${c.out}|${c.speed}|${c.reverse}|${c.keepPitch}`;
  let m = cache.get(buf);
  if (!m) cache.set(buf, (m = new Map()));
  if (!m.has(key)) {
    const a = Math.max(0, Math.floor(c.in * buf.sampleRate)), b = Math.min(buf.length, Math.ceil(c.out * buf.sampleRate));
    let chans = Array.from({ length: buf.numberOfChannels }, (_, ch) => buf.getChannelData(ch).slice(a, Math.max(a + 1, b)));
    if (c.reverse) chans = chans.map((x) => x.reverse());
    if (stretchIt) chans = stretch(chans, c.speed);
    const out = new AudioBuffer({ length: chans[0].length, numberOfChannels: chans.length, sampleRate: buf.sampleRate });
    chans.forEach((x, ch) => out.copyToChannel(x, ch));
    m.set(key, out);
  }
  return { buffer: m.get(key), rate: stretchIt ? 1 : c.speed };
}
