// Speech to text for auto captions: OpenAI's Whisper (base, MIT licence; ONNX weights from
// onnx-community/whisper-base_timestamped) run by transformers.js (Apache-2.0) on this PC's
// graphics card through WebGPU, with a time for every word. Nothing is sent anywhere.
// Where the model comes from, in order (the same as the background remover):
//   1. /models/whisper-base/ served by the app itself (`node tools/vx_get_whisper.mjs`)
//   2. a copy already saved in this browser's private storage (OPFS)
//   3. a one-time download from Hugging Face, only after the user says yes
// transformers.js is loaded only when captions are made, so the editor stays light.

const REPO = "onnx-community/whisper-base_timestamped";
const DIR = "whisper-base";
const OPFS_DIR = "oddlyclever-models";
export const SAMPLE_RATE = 16000;

export const WHISPER = {
  label: "Whisper base (MIT licence)",
  files: [
    ["config.json", 2243], ["generation_config.json", 3832], ["preprocessor_config.json", 339],
    ["tokenizer.json", 2480466], ["tokenizer_config.json", 282682],
    ["onnx/encoder_model.onnx", 82451730], ["onnx/decoder_model_merged_q4.onnx", 123738327],
  ],
  // The encoder in full precision, the decoder in 4 bits: quick and accurate on WebGPU.
  dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
};
WHISPER.bytes = WHISPER.files.reduce((s, [, b]) => s + b, 0);
const SIZE = new Map(WHISPER.files);

// The runtime's own files, served from node_modules (never from a CDN). transformers.js brings
// its own onnxruntime-web; the app's copy is the fallback when npm puts only one.
const RUNTIME = import.meta.glob([
  "/node_modules/@huggingface/transformers/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.{wasm,mjs}",
  "/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.{wasm,mjs}",
], { query: "?url", import: "default", eager: true });
const runtimeUrl = (ext) => Object.entries(RUNTIME).find(([k]) => k.endsWith(`.${ext}`))?.[1];

// ---- where the files are ----------------------------------------------------------------

const opfsName = (file) => file.replaceAll("/", "__");
async function opfsDir(create = false) {
  const root = await navigator.storage.getDirectory();
  const top = await root.getDirectoryHandle(OPFS_DIR, { create: true });
  return top.getDirectoryHandle(DIR, { create });
}

async function fromApp(file, method = "GET") {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}models/${DIR}/${file}`, { method });
    if (!res.ok || /text\/html/.test(res.headers.get("content-type") || "")) return null;
    return res;
  } catch { return null; }
}

async function fromBrowser(file) {
  try {
    const f = await (await (await opfsDir()).getFileHandle(opfsName(file))).getFile();
    if (f.size !== SIZE.get(file)) return null;
    return new Response(f, { headers: { "content-length": String(f.size), "content-type": "application/octet-stream" } });
  } catch { return null; }
}

/** The model file a transformers.js cache key (a Hugging Face URL) points at, or null. */
function fileOf(key) {
  const url = typeof key === "string" ? key : key?.url || "";
  const at = url.indexOf(`${REPO}/resolve/`);
  if (at < 0) return null;
  const file = url.slice(at + REPO.length + "/resolve/".length).split("/").slice(1).join("/");
  return SIZE.has(file) ? file : null;
}

// transformers.js asks this cache first: app files, then the browser copy; downloads land here.
const cache = {
  async match(key) {
    const file = fileOf(key);
    if (!file) return undefined;
    return (await fromApp(file)) || (await fromBrowser(file)) || undefined;
  },
  async put(key, response) {
    const file = fileOf(key);
    if (!file) return;
    const blob = await response.blob();
    if (blob.size !== SIZE.get(file)) throw new Error("A caption model file came down incomplete. Try again.");
    const w = await (await (await opfsDir(true)).getFileHandle(opfsName(file), { create: true })).createWritable();
    await w.write(blob);
    await w.close();
  },
};

/** Is the whole model on this PC already (served by the app or saved in the browser)? */
export async function whisperReady() {
  for (const [file] of WHISPER.files) {
    const head = await fromApp(file, "HEAD");
    if (head) continue;
    if (!(await fromBrowser(file))) return false;
  }
  return true;
}

// ---- the runtime -----------------------------------------------------------------------

let libP = null;
function lib() {
  if (!libP) {
    libP = import("@huggingface/transformers").then((T) => {
      const { env } = T;
      // The cache below finds the app's and the browser's copies; transformers.js's own "local"
      // look-up must just miss (the dev server answers unknown paths with the app page).
      env.allowLocalModels = true;
      env.localModelPath = `${import.meta.env.BASE_URL}models/`;
      env.fetch = async (url, init) => {
        const res = await fetch(url, init);
        return res.ok && /text\/html/.test(res.headers.get("content-type") || "") ? new Response(null, { status: 404 }) : res;
      };
      env.allowRemoteModels = false; // turned on only for a download the user agreed to
      env.useBrowserCache = false;
      env.useWasmCache = false;
      env.useCustomCache = true;
      env.customCache = cache;
      const onnx = env.backends.onnx;
      if (onnx?.wasm) {
        if (runtimeUrl("wasm")) onnx.wasm.wasmPaths = { wasm: runtimeUrl("wasm"), mjs: runtimeUrl("mjs") };
        onnx.wasm.numThreads = 1; // no cross-origin isolation, so no worker threads; the GPU does the work
      }
      if (onnx?.webgpu) onnx.webgpu.powerPreference = "high-performance";
      return T;
    });
    libP.catch(() => { libP = null; });
  }
  return libP;
}

/** The fast GPU's name, or "" when this browser has no WebGPU. */
async function fastGpu() {
  if (!navigator.gpu) return null;
  try {
    const a = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!a) return null;
    return [a.info?.vendor, a.info?.description || a.info?.device].filter(Boolean).join(" ").trim() || "graphics card";
  } catch { return null; }
}

let asrP = null, ready = false;
/** True once the model is loaded on the graphics card (captions start straight away). */
export const whisperLoaded = () => ready;

/**
 * Load the model (downloading it first when `download` is true: the user agreed).
 * @param {{ download?: boolean, onProgress?: (f: number, label: string) => void }} opts
 * @returns {Promise<{ asr: Function, onGPU: boolean, gpuName: string }>}
 */
export function loadWhisper({ download = false, onProgress = () => {} } = {}) {
  if (!asrP) {
    asrP = (async () => {
      const T = await lib();
      T.env.allowRemoteModels = download;
      const gpuName = await fastGpu();
      const loaded = new Map();
      const progress_callback = (e) => {
        if (e.status !== "progress" || !SIZE.has(e.file)) return;
        loaded.set(e.file, e.loaded || 0);
        const got = [...loaded.values()].reduce((a, b) => a + b, 0);
        onProgress(Math.min(1, got / WHISPER.bytes), download ? "Downloading" : "Loading");
      };
      try {
        const asr = await T.pipeline("automatic-speech-recognition", REPO, {
          device: gpuName ? "webgpu" : "wasm", dtype: WHISPER.dtype, progress_callback,
        });
        ready = true;
        return { asr, onGPU: Boolean(gpuName), gpuName: gpuName || "" };
      } finally {
        T.env.allowRemoteModels = false;
      }
    })();
    asrP.catch(() => { asrP = null; });
  }
  return asrP;
}

/**
 * Words with times from 16 kHz mono sound.
 * @param {Float32Array} samples
 * @param {{ language?: string, onProgress?: (f: number) => void }} opts language: "" finds it
 * @returns {Promise<{ text: string, words: { text: string, start: number, end: number }[], onGPU: boolean, gpuName: string, ms: number }>}
 */
export async function transcribe(samples, { language = "", onProgress = () => {} } = {}) {
  const { asr, onGPU, gpuName } = await loadWhisper();
  const t0 = performance.now();
  const words = [];
  let text = "";
  // Windows of up to 30 s one after another (Whisper hears 30 s at a time), each cut in the
  // quietest moment near its end so no word is cut in half; long voice-overs show progress.
  for (let at = 0, next; at < samples.length; at = next) {
    next = quietCut(samples, at);
    const part = samples.subarray(at, next);
    if (part.length < SAMPLE_RATE * 0.3) break;
    const off = at / SAMPLE_RATE;
    const out = await asr(part, {
      return_timestamps: "word",
      ...(language ? { language, task: "transcribe" } : {}),
    });
    text += out.text || "";
    for (const c of out.chunks || []) {
      const w = String(c.text || "").trim();
      const [s, e] = c.timestamp || [];
      if (!w || !Number.isFinite(s)) continue;
      words.push({ text: w, start: round(off + s), end: round(off + (Number.isFinite(e) ? e : s + 0.3)) });
    }
    onProgress(Math.min(1, next / samples.length));
  }
  return { text: text.trim(), words, onGPU, gpuName, ms: Math.round(performance.now() - t0) };
}

const round = (v) => Math.round(v * 1000) / 1000;

/** Where the window starting at `at` should end: the quietest 50 ms in its last 4 s (or the end). */
export function quietCut(samples, at, rate = SAMPLE_RATE) {
  const end = at + 29 * rate;
  if (end >= samples.length) return samples.length;
  const step = Math.round(rate * 0.05);
  let best = end, bestE = Infinity;
  for (let s = end - 4 * rate; s + step <= end; s += step) {
    let e = 0;
    for (let i = s; i < s + step; i++) e += samples[i] * samples[i];
    if (e < bestE) { bestE = e; best = s + (step >> 1); }
  }
  return best;
}
