// Magic photo edits: Magic Eraser (free, on this PC's GPU), Magic Edit and Magic Expand (the
// user's image AI, one AI picture each) and Magic Grab (free). Each says up front what it costs,
// shows a before/after slider when done, is one undo step, and keeps the original for
// "Restore original".
import "./magic.css";
import { closePopover, el, icon, popover, toast } from "../../ui/kit.js";
import { registerTool } from "../../ui/shell.js";
import { tbtn } from "../elements/controls.js";
import { brushMode } from "./brush.js";
import { closeCompare, showCompare, working } from "./compare.js";
import { aiStatus, costLabel } from "./engines.js";
import { expandChooser } from "./expand-ui.js";
import { eraserReady } from "./model.js";
import { modelReady as cutoutReady } from "../cutout/model.js";
import { isPhoto, lastEdit, magicEdit, magicErase, magicExpand, magicGrab, restoreOriginal } from "./ops.js";

export { magicErase, magicEdit, magicExpand, magicGrab, restoreOriginal } from "./ops.js";

let modeOpen = false;

const gpuNote = (r) => (r.engine === "local"
  ? ` ${(r.ms / 1000).toFixed(1)} s on ${r.onGPU ? r.gpuName || "your graphics card" : "the CPU (no WebGPU here, so it's slower)"}, free.`
  : " Used 1 AI picture.");

/** Run one edit with the shimmer, then offer the before/after slider. */
async function run(app, img, text, fn, doneText) {
  const stop = working(app, img, text);
  try {
    const r = await fn();
    stop();
    toast(`${doneText}${r ? gpuNote(r) : ""}`);
    const l = lastEdit(img);
    if (l) await showCompare(app, img, { before: l.before, rect: l.rect, onUndo: () => app.editor.history.undo() });
    return r;
  } catch (e) {
    stop();
    if (e?.name !== "AbortError") toast(e.message, { error: true });
    return null;
  }
}

async function withMode(fn) {
  if (modeOpen) return;
  modeOpen = true;
  closeCompare();
  try { await fn(); } finally { modeOpen = false; }
}

/** Toolbar: Magic Eraser. */
export function startEraser(app, img) {
  return withMode(async () => {
    const cost = (await eraserReady()) ? costLabel("local")
      : el("span.mg-cost.free", { title: "The free eraser model is downloaded once (30 MB), then it runs offline on this PC." }, "Free after a 30 MB download");
    const r = await brushMode(app, img, { mode: "erase", cost });
    if (!r) return;
    await run(app, img, "Erasing…", () => magicErase(app, img, r.mask), "Erased.");
  });
}

/** Toolbar: Magic Edit. */
export function startEdit(app, img) {
  return withMode(async () => {
    const a = aiStatus();
    if (!a.ready) { toast(`Magic Edit uses your image AI. ${a.reason}`, { error: true, ms: 6000 }); return; }
    const r = await brushMode(app, img, { mode: "edit", cost: costLabel("ai") });
    if (!r) return;
    await run(app, img, "Editing with your image AI…", () => magicEdit(app, img, r.prompt, r.mask), r.painted ? "Edited the painted area." : "Edited the picture.");
  });
}

/** Toolbar: Magic Expand. */
export function startExpand(app, img) {
  return withMode(async () => {
    const a = aiStatus();
    if (!a.ready) { toast(`Magic Expand uses your image AI. ${a.reason}`, { error: true, ms: 6000 }); return; }
    const opts = await expandChooser(app, img, { cost: costLabel("ai") });
    if (!opts) return;
    await run(app, img, "Expanding with your image AI…", () => magicExpand(app, img, opts), "Expanded.");
  });
}

/** Toolbar: Magic Grab. */
export function startGrab(app, img) {
  return withMode(async () => {
    const stop = working(app, img, "Lifting the subject out…");
    try {
      const r = await magicGrab(app, img);
      stop();
      toast(`The subject is its own layer now: drag it anywhere. The gap behind it is filled.${r.engine === "ai" ? " Used 1 AI picture." : ""}`, { ms: 5000 });
    } catch (e) {
      stop();
      toast(e.message, { error: true });
    }
  });
}

function menuItem(iconName, title, sub, badge, onClick, { disabled = false } = {}) {
  return el("button.mg-item", { type: "button", disabled, on: { click: () => { closePopover(); onClick(); } } },
    el("span.mg-item-icon", {}, icon(iconName, 18)),
    el("span.mg-item-text", {}, el("b", {}, title), el("small", {}, sub)),
    badge);
}

async function openMenu(app, img, anchor) {
  const [local, cutReady] = await Promise.all([eraserReady(), cutoutReady()]);
  const a = aiStatus();
  const free = (t) => el("span.mg-badge.free", {}, t);
  const paid = el("span.mg-badge.paid", { title: a.ready ? `Every edit counts as one AI picture (${a.left} of ${a.max} left in ${a.minutes} min).` : a.reason },
    a.ready ? `1 AI picture` : "Needs AI pictures");
  const m = img.data?.magic;
  const l = lastEdit(img);
  const list = el("div.mg-menu", { role: "menu", "aria-label": "Magic photo edits" },
    el("p.mg-menu-head", {}, "Magic photo edits"),
    menuItem("Eraser", "Magic eraser", "Paint over something to remove it", local ? free("Free · on this PC") : free("Free after a 30 MB download"), () => startEraser(app, img)),
    menuItem("Hand", "Magic grab", "Lift the subject onto its own layer", free(local && cutReady ? "Free · on this PC" : "Free after a one-time download"), () => startGrab(app, img), { disabled: Boolean(img.data?.cutout) }),
    menuItem("Sparkles", "Magic edit", "Paint an area, say what it becomes", paid.cloneNode(true), () => startEdit(app, img)),
    menuItem("Expand", "Magic expand", "Grow the photo to a new shape", paid.cloneNode(true), () => startExpand(app, img), { disabled: Boolean(img.data?.frame) }),
    a.ready ? null : el("p.mg-menu-note", {}, a.reason),
    m || l ? el("div.mg-menu-sep") : null,
    l ? menuItem("SplitSquareHorizontal", "Compare last edit", "Before and after slider", null, () => showCompare(app, img, { before: l.before, rect: l.rect })) : null,
    m ? menuItem("SplitSquareHorizontal", "Compare with original", "See every magic edit at once", null,
      () => showCompare(app, img, { before: m.original.src, rect: m.originRect, title: "Original and now" })) : null,
    m ? menuItem("Undo2", "Restore original", "Back to the photo before any magic", null,
      () => restoreOriginal(app, img).then(() => toast("Original photo restored.")).catch((e) => toast(e.message, { error: true }))) : null);
  popover(anchor, list, { cls: "mg-pop" });
}

let installed = false;

export function install(app) {
  if (installed) return;
  installed = true;
  app.magic = { magicErase, magicEdit, magicExpand, magicGrab, restoreOriginal };
  registerTool({
    id: "magic", order: 39,
    match: (sel) => sel.length === 1 && isPhoto(sel[0]),
    render(_app, [img]) {
      const btn = tbtn("WandSparkles", "Magic edits: eraser, grab, edit, expand", (e) => openMenu(app, img, e.currentTarget), { text: true });
      btn.querySelector("span").textContent = "Magic";
      btn.classList.add("mg-tbtn");
      if (img.data?.magic) btn.classList.add("edited");
      return el("div.tgroup", {}, btn);
    },
  });
}
