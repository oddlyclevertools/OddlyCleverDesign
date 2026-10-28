// Background remover: one click cuts the subject out of a photo, on this PC's GPU. The original
// is kept in the object, so "Restore background" brings it back; "Subject on its own layer"
// keeps the photo and puts a cut-out copy on top, so text can sit between them (the
// "text behind the subject" thumbnail look). Every change is one undo step.
import "./cutout.css";
import { FabricImage } from "fabric";
import { confirmDialog, el, modal, toast } from "../../ui/kit.js";
import { registerTool } from "../../ui/shell.js";
import { tbtn } from "../elements/controls.js";
import { KEEP, OcImage, isEmptyFrame, loadElement } from "../elements/images.js";
import { MODEL, downloadModel, getSession, modelReady } from "./model.js";
import { cutOut } from "./segment.js";
import { refineCutout } from "./refine.js";

export { refineCutout };

const isPhoto = (o) => o instanceof FabricImage && !o.isBg && !o.data?.cropUI && !isEmptyFrame(o);
let busy = false;

/** Ask once, then download the model with a progress box. Resolves true when it's ready. */
export async function ensureModel({ ask = true } = {}) {
  if (await modelReady()) return true;
  if (!ask) return false;
  const mb = Math.round(MODEL.bytes / 1e6);
  const ok = await confirmDialog("Get the background remover?",
    `It needs a ${mb} MB model (${MODEL.label}), downloaded once from huggingface.co and kept in this browser. After that it works offline, and your pictures never leave this PC.`,
    `Download ${mb} MB`);
  if (!ok) return false;
  const bar = el("div.co-bar", {}, el("i"));
  const label = el("p.co-note", {}, "Starting…");
  const ctl = new AbortController();
  let closeBox = () => {};
  modal("Downloading the background remover", (close) => {
    closeBox = close;
    return el("div.co-dl", {}, bar, label,
      el("div.row.end", {}, el("button.btn", { type: "button", on: { click: () => { ctl.abort(); close(); } } }, "Cancel")));
  });
  try {
    await downloadModel((p) => {
      bar.firstChild.style.width = `${Math.round(p * 100)}%`;
      label.textContent = `${Math.round(p * mb)} of ${mb} MB`;
    }, ctl.signal);
    closeBox();
    return true;
  } catch (e) {
    closeBox();
    if (!ctl.signal.aborted) toast(e.message, { error: true });
    return false;
  }
}

/** The untouched picture behind an image (before filters, before any earlier cut-out). */
const sourceOf = (img) => img.data?.cutout?.original || img.getSrc();

async function cutInto(img, src) {
  const el0 = await loadElement(src);
  const { canvas, ms, onGPU, gpuName } = await cutOut(el0);
  const cut = await loadElement(canvas.toDataURL("image/png"));
  await img.setElement(cut);
  if (img.filters?.length) img.applyFilters();
  img.set({ data: { ...(img.data || {}), cutout: { original: src } }, dirty: true });
  return { ms, onGPU, gpuName };
}

/**
 * Remove the background of a picture.
 * @param {object} app
 * @param {object} img an image on the page
 * @param {{ layer?: boolean, ask?: boolean }} [opts] layer: keep the photo and add the cut-out on top
 * @returns {Promise<{ id: string, layer: boolean, ms: number, onGPU: boolean, gpuName: string }>}
 */
export async function removeBackground(app, img, { layer = false, ask = true } = {}) {
  if (!isPhoto(img)) throw new Error("Pick a photo first (an empty frame or the page background can't be cut out).");
  if (busy) throw new Error("Already cutting out a picture. One at a time.");
  if (!(await ensureModel({ ask }))) throw new Error("The background remover isn't downloaded yet. Say yes to the download to use it.");
  busy = true;
  const ed = app.editor;
  try {
    await getSession();
    const src = sourceOf(img);
    let target = img;
    if (layer) {
      target = await OcImage.fromObject(img.toObject(KEEP));
      target.set({ id: undefined, name: `${img.name || "Photo"} (cut out)`, shadow: null });
    }
    const info = await cutInto(target, src);
    if (layer) {
      const i = ed.canvas.getObjects().indexOf(img);
      ed.canvas.insertAt(i + 1, target);
      target.set("id", target.id || `o${Date.now().toString(36)}c`);
    }
    target.setCoords();
    ed.canvas.setActiveObject(target);
    ed.canvas.requestRenderAll();
    ed.commit(layer ? "Subject on its own layer" : "Remove background");
    app.refreshToolbar?.();
    return { id: target.id, layer, ...info };
  } finally {
    busy = false;
  }
}

/** Put the original picture back. */
export async function restoreBackground(app, img) {
  const original = img.data?.cutout?.original;
  if (!original) throw new Error("This picture still has its background.");
  await img.setElement(await loadElement(original));
  if (img.filters?.length) img.applyFilters();
  const { cutout: _c, ...rest } = img.data;
  img.set({ data: rest, dirty: true });
  app.editor.canvas.requestRenderAll();
  app.editor.commit("Restore background");
  app.refreshToolbar?.();
}

async function run(app, img, layer) {
  const t = toast(layer ? "Cutting out the subject…" : "Removing the background…", { ms: 60000 });
  try {
    const r = await removeBackground(app, img, { layer });
    t?.remove?.();
    toast(`${layer ? "Subject is on its own layer: put text between the two." : "Background removed."} ${(r.ms / 1000).toFixed(1)} s on ${r.onGPU ? r.gpuName || "the GPU" : "the CPU (no WebGPU here, so it's slower)"}.`);
    // Chrome on Windows ignores "use the fast GPU" (crbug.com/369219127): Windows picks the GPU per app.
    if (r.onGPU && /intel/i.test(r.gpuName) && !sessionStorage.getItem("co-gpu-tip")) {
      sessionStorage.setItem("co-gpu-tip", "1");
      toast("Tip: this ran on the built-in Intel graphics. For your faster graphics card, open Windows Settings > System > Display > Graphics, pick your browser, choose High performance, then restart the browser.", { ms: 12000 });
    }
  } catch (e) {
    t?.remove?.();
    toast(e.message, { error: true });
  }
}

export function install(app) {
  registerTool({
    id: "cutout", order: 38,
    match: (sel) => sel.length === 1 && isPhoto(sel[0]),
    render(_app, [img]) {
      const cut = Boolean(img.data?.cutout);
      return el("div.tgroup", {},
        cut ? tbtn("Undo2", "Restore background", () => restoreBackground(app, img).catch((e) => toast(e.message, { error: true })), { text: true })
          : tbtn("Eraser", "Remove background", () => run(app, img, false), { text: true, cls: "accent" }),
        tbtn("Wand2", cut ? "Touch up: erase or restore by hand, or draw a line around what to keep" : "Remove the background by hand (brush or draw a line around)",
          () => refineCutout(app, img).catch((e) => toast(e.message, { error: true }))),
        !cut ? tbtn("Layers2", "Subject on its own layer (put text behind the subject)", () => run(app, img, true)) : null);
    },
  });
}
