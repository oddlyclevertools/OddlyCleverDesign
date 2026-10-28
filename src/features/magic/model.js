// The free, offline Magic Eraser model: MI-GAN (Picsart AI Research, MIT licence, 30 MB), a
// small all-convolution inpainting network that runs on the GPU through WebGPU. (LaMa was the
// other choice: 200 MB, and its Fourier layers have no WebGPU kernels, so it runs half on the CPU.)
// Where the model comes from, in order (the same as the background remover's model):
//   1. /models/migan.onnx served by the app itself (`node tools/get_models.mjs`)
//   2. a copy already saved in this browser's private storage (OPFS)
//   3. a one-time download from Hugging Face, only after the user says yes
// Nothing is sent anywhere: pictures are filled in on this PC.
import { ort } from "../cutout/model.js"; // the same runtime (its file paths are set up there)

export const ERASER_MODEL = {
  file: "migan.onnx",
  label: "MI-GAN (MIT licence)",
  size: 512,
  bytes: 29_546_882,
  url: "https://huggingface.co/andraniksargsyan/migan/resolve/main/migan.onnx",
};
const OPFS_DIR = "oddlyclever-models";

let sessionP = null;

async function fromApp() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}models/${ERASER_MODEL.file}`);
    if (!res.ok || /text\/html/.test(res.headers.get("content-type") || "")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length === ERASER_MODEL.bytes ? bytes : null;
  } catch { return null; }
}

async function opfsDir() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_DIR, { create: true });
}

async function fromBrowser() {
  try {
    const f = await (await (await opfsDir()).getFileHandle(ERASER_MODEL.file)).getFile();
    return f.size === ERASER_MODEL.bytes ? new Uint8Array(await f.arrayBuffer()) : null;
  } catch { return null; }
}

/** Is the eraser model on this PC already (served by the app or saved in the browser)? */
export async function eraserReady() {
  try {
    const head = await fetch(`${import.meta.env.BASE_URL}models/${ERASER_MODEL.file}`, { method: "HEAD" });
    if (head.ok && !/text\/html/.test(head.headers.get("content-type") || "")) return true;
  } catch { /* not served */ }
  try { return (await (await (await opfsDir()).getFileHandle(ERASER_MODEL.file)).getFile()).size === ERASER_MODEL.bytes; } catch { return false; }
}

/** Download the model once (after the user agreed), with progress 0..1, and keep it in the browser. */
export async function downloadEraser(onProgress = () => {}, signal) {
  const res = await fetch(ERASER_MODEL.url, { signal });
  if (!res.ok || !res.body) throw new Error(`The eraser download failed (${res.status}).`);
  const total = Number(res.headers.get("content-length")) || ERASER_MODEL.bytes;
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
  if (bytes.length !== ERASER_MODEL.bytes) throw new Error("The eraser file came down incomplete. Try again.");
  const w = await (await (await opfsDir()).getFileHandle(ERASER_MODEL.file, { create: true })).createWritable();
  await w.write(bytes);
  await w.close();
  return bytes;
}

/** The fast GPU and a device with everything it can do, or null. */
async function gpuDevice() {
  if (!navigator.gpu) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return null;
    const name = [adapter.info?.vendor, adapter.info?.description || adapter.info?.device].filter(Boolean).join(" ").trim();
    const want = ["maxStorageBuffersPerShaderStage", "maxBufferSize", "maxStorageBufferBindingSize",
      "maxComputeWorkgroupStorageSize", "maxComputeInvocationsPerWorkgroup", "maxComputeWorkgroupSizeX"];
    const requiredLimits = Object.fromEntries(want.filter((k) => adapter.limits[k]).map((k) => [k, adapter.limits[k]]));
    const requiredFeatures = ["shader-f16"].filter((f) => adapter.features.has(f));
    const device = await adapter.requestDevice({ requiredLimits, requiredFeatures });
    return { device, name };
  } catch { return null; }
}

/** The ONNX session (made once). Throws code "MODEL_MISSING" when the model must be downloaded first. */
export function eraserSession() {
  if (!sessionP) {
    sessionP = (async () => {
      const bytes = (await fromApp()) || (await fromBrowser());
      if (!bytes) throw Object.assign(new Error("The Magic Eraser model isn't on this PC yet."), { code: "MODEL_MISSING" });
      const gpu = await gpuDevice();
      const providers = gpu ? [{ name: "webgpu", device: gpu.device }, "wasm"] : ["wasm"];
      const session = await ort.InferenceSession.create(bytes, { executionProviders: providers, graphOptimizationLevel: "all", logSeverityLevel: 3 });
      return { session, onGPU: Boolean(gpu), gpuName: gpu?.name || "" };
    })();
    sessionP.catch(() => { sessionP = null; });
  }
  return sessionP;
}

export { ort };
