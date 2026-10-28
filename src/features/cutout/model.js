// The cut-out model (IS-Net "general use", Apache-2.0, 170 MB) and the ONNX runtime that runs it
// on the GPU through WebGPU. (BiRefNet was tried first: its decoder needs more storage buffers per
// shader than Chrome allows on Windows, so it can't run on WebGPU there.)
// Where the model comes from, in order:
//   1. /models/isnet-general-use.onnx served by the app itself (`node tools/get_models.mjs`)
//   2. a copy already saved in this browser's private storage (OPFS)
//   3. a one-time download from Hugging Face, only after the user says yes
// Nothing is sent anywhere: pictures are cut out on this PC.
import * as ort from "onnxruntime-web/webgpu";

// The runtime's own files (its package doesn't export them, so they're found by path).
const RUNTIME = import.meta.glob("/node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.{wasm,mjs}", { query: "?url", import: "default", eager: true });
const runtimeUrl = (ext) => Object.entries(RUNTIME).find(([k]) => k.endsWith(`.${ext}`))?.[1];

export const MODEL = {
  file: "isnet-general-use.onnx",
  label: "IS-Net (Apache-2.0 licence)",
  size: 1024,
  bytes: 178_648_008,
  url: "https://huggingface.co/BritishWerewolf/IS-Net/resolve/main/onnx/model.onnx",
  mean: [0.485, 0.456, 0.406],
  std: [1, 1, 1],
};
const OPFS_DIR = "oddlyclever-models";

ort.env.wasm.wasmPaths = { wasm: runtimeUrl("wasm"), mjs: runtimeUrl("mjs") };
ort.env.wasm.numThreads = 1; // no cross-origin isolation, so no worker threads; the GPU does the work

let sessionP = null;
let gpuName = "";

async function fromApp() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}models/${MODEL.file}`);
    if (!res.ok || /text\/html/.test(res.headers.get("content-type") || "")) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch { return null; }
}

async function opfsDir() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_DIR, { create: true });
}

async function fromBrowser() {
  try {
    const f = await (await (await opfsDir()).getFileHandle(MODEL.file)).getFile();
    return f.size === MODEL.bytes ? new Uint8Array(await f.arrayBuffer()) : null;
  } catch { return null; }
}

/** Is the model on this PC already (served by the app or saved in the browser)? */
export async function modelReady() {
  try {
    const head = await fetch(`${import.meta.env.BASE_URL}models/${MODEL.file}`, { method: "HEAD" });
    if (head.ok && !/text\/html/.test(head.headers.get("content-type") || "")) return true;
  } catch { /* not served */ }
  try { return (await (await (await opfsDir()).getFileHandle(MODEL.file)).getFile()).size === MODEL.bytes; } catch { return false; }
}

/** Download the model once (after the user agreed), with progress 0..1, and keep it in the browser. */
export async function downloadModel(onProgress = () => {}, signal) {
  const res = await fetch(MODEL.url, { signal });
  if (!res.ok || !res.body) throw new Error(`The model download failed (${res.status}).`);
  const total = Number(res.headers.get("content-length")) || MODEL.bytes;
  const parts = [];
  let got = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onProgress(Math.min(1, got / total));
  }
  const bytes = new Uint8Array(got);
  let at = 0;
  for (const p of parts) { bytes.set(p, at); at += p.length; }
  if (bytes.length !== MODEL.bytes) throw new Error("The model file came down incomplete. Try again.");
  const w = await (await (await opfsDir()).getFileHandle(MODEL.file, { create: true })).createWritable();
  await w.write(bytes);
  await w.close();
  return bytes;
}

/** The fast GPU, or null. */
async function fastAdapter() {
  if (!navigator.gpu) return null;
  try {
    const a = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (a) gpuName = [a.info?.vendor, a.info?.description || a.info?.device].filter(Boolean).join(" ").trim();
    return a;
  } catch { return null; }
}

/** The ONNX session (made once). Throws "MODEL_MISSING" when the model must be downloaded first. */
export function getSession() {
  if (!sessionP) {
    sessionP = (async () => {
      const bytes = (await fromApp()) || (await fromBrowser());
      if (!bytes) throw Object.assign(new Error("The cut-out model isn't on this PC yet."), { code: "MODEL_MISSING" });
      const adapter = await fastAdapter();
      if (adapter) {
        // The default device allows 16 storage buffers per shader; this model needs 17. Ask for
        // what the card really has (and half precision when it has it).
        const want = ["maxStorageBuffersPerShaderStage", "maxBufferSize", "maxStorageBufferBindingSize",
          "maxComputeWorkgroupStorageSize", "maxComputeInvocationsPerWorkgroup", "maxComputeWorkgroupSizeX"];
        const requiredLimits = Object.fromEntries(want.filter((k) => adapter.limits[k]).map((k) => [k, adapter.limits[k]]));
        const requiredFeatures = ["shader-f16"].filter((f) => adapter.features.has(f));
        ort.env.webgpu.adapter = adapter;
        ort.env.webgpu.device = await adapter.requestDevice({ requiredLimits, requiredFeatures });
      }
      const providers = adapter ? ["webgpu", "wasm"] : ["wasm"];
      const session = await ort.InferenceSession.create(bytes, { executionProviders: providers, graphOptimizationLevel: "all" });
      return { session, onGPU: Boolean(adapter), gpuName };
    })();
    sessionP.catch(() => { sessionP = null; });
  }
  return sessionP;
}

export { ort };
