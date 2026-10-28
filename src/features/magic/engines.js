// The two engines behind the magic edits, and what each costs:
//   - local: MI-GAN on this PC's GPU. Free, offline, private. Eraser only.
//   - ai:    the user's image AI (images/edits) with their key. Spends one AI picture.
import { el, confirmDialog, modal, toast } from "../../ui/kit.js";
import { editPicture, pictureAllowance } from "../ai/pictures/generate.js";
import { imageSettings } from "../ai/settings.js";
import { getKey } from "../ai/keys.js";
import { providerById } from "../ai/presets.js";
import { loadElement } from "../elements/images.js";
import { ERASER_MODEL, downloadEraser, eraserReady } from "./model.js";
import { aiMaskPng, canvasOf, resized } from "./mask.js";

const AI_SIDE = 1536; // the image AI's largest side

/** Can the image AI edit pictures right now, and how many are left? */
export function aiStatus() {
  const s = imageSettings();
  const allow = pictureAllowance();
  if (s.provider === "off") return { ready: false, reason: "Turn on AI pictures in Ask AI settings to use this.", ...allow };
  const p = providerById(s.provider);
  if (!getKey(p.id)) return { ready: false, reason: `Paste your ${p.name} key in Ask AI settings to use this.`, ...allow };
  if (allow.left <= 0) return { ready: false, reason: `AI picture limit reached (${allow.max} per ${allow.minutes} min). Try again soon.`, ...allow };
  return { ready: true, reason: "", name: p.name, ...allow };
}

/** The cost line shown up front: free on this PC, or one AI picture. */
export function costLabel(engine) {
  if (engine === "local") return el("span.mg-cost.free", { title: "Runs on this PC's graphics card. Free, and the photo never leaves this PC." }, "Free · on this PC");
  const a = aiStatus();
  return el("span.mg-cost.paid", { title: a.ready ? `Sent to ${a.name} with your key. Every edit counts as one AI picture.` : a.reason },
    a.ready ? `1 AI picture · ${a.left} of ${a.max} left` : "Needs AI pictures");
}

/** Ask once, then download the eraser model with a progress box. Resolves true when it's ready. */
export async function ensureEraser({ ask = true } = {}) {
  if (await eraserReady()) return true;
  if (!ask) return false;
  const mb = Math.round(ERASER_MODEL.bytes / 1e6);
  const ok = await confirmDialog("Get the free Magic Eraser?",
    `It needs a ${mb} MB model (${ERASER_MODEL.label}), downloaded once from huggingface.co and kept in this browser. After that it erases offline on your graphics card, free, and your photos never leave this PC.`,
    `Download ${mb} MB`);
  if (!ok) return false;
  const bar = el("div.mg-dl-bar", {}, el("i"));
  const label = el("p.mg-note", {}, "Starting…");
  const ctl = new AbortController();
  let closeBox = () => {};
  modal("Downloading the Magic Eraser", (close) => {
    closeBox = close;
    return el("div.mg-dl", {}, bar, label,
      el("div.row.end", {}, el("button.btn", { type: "button", on: { click: () => { ctl.abort(); close(); } } }, "Cancel")));
  });
  try {
    await downloadEraser((p) => {
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

/** The closest shape the image AI makes for a width/height. */
export function aiAspect(w, h) {
  const r = w / h;
  return r > 1.2 ? "landscape" : r < 1 / 1.2 ? "portrait" : "square";
}

/**
 * Send a picture (and optionally a hole mask) to the image AI and get the result back at the
 * picture's own size.
 * @param {HTMLCanvasElement|HTMLImageElement} src
 * @param {HTMLCanvasElement|null} hole opaque = the area to change; null = the whole picture
 * @returns {Promise<{ canvas: HTMLCanvasElement, model: string, host: string, form: string }>}
 */
export async function aiEdit(src, hole, prompt, { signal } = {}) {
  const W = src.naturalWidth || src.width, H = src.naturalHeight || src.height;
  const k = Math.min(1, AI_SIDE / Math.max(W, H));
  const sw = Math.max(16, Math.round(W * k)), sh = Math.max(16, Math.round(H * k));
  const small = resized(src, sw, sh);
  const r = await editPicture({
    image: small.toDataURL("image/png"),
    mask: hole ? aiMaskPng(hole, sw, sh) : null,
    prompt,
    aspect: aiAspect(W, H),
  }, { signal });
  const back = await loadElement(r.src);
  const canvas = canvasOf(W, H);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(back, 0, 0, W, H);
  return { canvas, model: r.model, host: r.host, form: r.form };
}
