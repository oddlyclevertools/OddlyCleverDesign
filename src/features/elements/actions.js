// Adding things to the design: from a panel click, a drag onto the canvas, a file drop or a paste.
// With one photo selected, dropping a picture on the page or clicking one in the Uploads or Photos
// panel replaces that photo (same box, crop, turn and effects). Holding Shift adds a new one.
import { toast } from "../../ui/kit.js";
import { libraryObject } from "../library/index.js";
import { createShape } from "./shapes.js";
import { createLine } from "./lines.js";
import { createIcon } from "./vector.js";
import { createSticker } from "./stickers.js";
import { addImage, createFrame, fillWithSource, frameAt, isFrame, isEmptyFrame, isImage, prepareImageFile } from "./images.js";
import { getUpload, saveUpload } from "./uploads-db.js";
import { createIllustration } from "./illustrations.js";
import { createBadge } from "./badges.js";
import { createDecor } from "./decor.js";
import { createChart } from "./charts.js";
import { createGrid, fillCell } from "./grids.js";
import { applyScene } from "./scene-apply.js";

export const DRAG_TYPE = "application/x-oddlyclever-element";

// ---- replace or add? --------------------------------------------------------------------------
// The panels and the drop handlers don't pass the pointer event down, so the last user gesture is
// noted here (capture phase, before anything else sees it). Only a drop on the canvas or a click
// or key on a picture tile in a panel may replace; the AI, pastes and menus always add.
const TILES = ".sk-tile, .el-up";
const GESTURE_MS = 60000;
let gesture = null;
const note = (e) => {
  const t = e.target instanceof Element ? e.target : null;
  if (e.type === "keydown" && !["Enter", " "].includes(e.key)) return;
  const pick = e.type === "drop" ? Boolean(t?.closest(".canvas-host"))
    : e.type !== "paste" && Boolean(t?.closest(TILES)) && !t.closest(".sk-more, .el-up-act");
  gesture = { shift: Boolean(e.shiftKey), pick, at: performance.now() };
};
if (typeof window !== "undefined") for (const type of ["pointerdown", "drop", "keydown", "paste"]) window.addEventListener(type, note, true);

/** The selected photo a just-placed picture should replace, or null to add a new one. Used once per gesture. */
function replaceTarget(app) {
  const g = gesture;
  if (!g || !g.pick || g.shift || performance.now() - g.at > GESTURE_MS) return null;
  const sel = app.editor.selection();
  const img = sel.length === 1 ? sel[0] : null;
  if (!isImage(img) || isFrame(img) || img.data?.cropUI || (img.locked && !img.isBg)) return null;
  gesture = null; // a multi-file drop replaces with the first and adds the rest
  return img;
}

let replaceTips = 0;

/** Build the object for a panel item. */
async function build(item, app) {
  switch (item.kind) {
    case "illustration": return createIllustration(item.key, app);
    case "badge": return createBadge(item.key, app);
    case "decor": return createDecor(item.key, app);
    case "chart": return createChart(item.key, app);
    case "grid": return createGrid(item.key, app);
    case "shape": return createShape(item.key);
    case "line": return createLine(item.key);
    case "icon": return createIcon(item.key);
    case "sticker": return createSticker(item.key);
    case "frame": return createFrame(item.key);
    default: throw new Error("Unknown element.");
  }
}

/**
 * Add a panel item. `at` is a page point (from a drop); otherwise it goes in the centre.
 * @param {*} app
 * @param {{kind: string, key: string}} item
 * @param {{x: number, y: number}|null} at
 */
export async function insertItem(app, item, at = null) {
  try {
    if (item.kind === "upload") return await insertUpload(app, item.key, at);
    if (item.kind === "scene") return await applyScene(app, item.key);
    const obj = item.kind === "mine" ? await libraryObject(item.key) : await build(item, app);
    const ed = app.editor;
    // Full-page overlays and light leaks bring their own spot.
    const spot = obj._place || at;
    delete obj._place;
    ed.add(obj, { center: !spot, name: obj.name });
    if (spot) {
      obj.setPositionByOrigin(spot, "center", "center");
      obj.setCoords();
      ed.canvas.requestRenderAll();
      ed.commit("Add", { merge: true });
    }
    if (obj.data?.overlay) {
      // A full-page overlay would catch every click: it stays selectable from the Layers panel.
      obj.set({ evented: false });
      toast(`${obj.name} added over the page. Change or remove it from Layers.`);
    }
    return obj;
  } catch (e) {
    toast(`Couldn't add that: ${e.message}`, { error: true });
    return null;
  }
}

/** Put an upload from the library into the design (or into the frame under `at`). */
export async function insertUpload(app, id, at = null) {
  const rec = await getUpload(id);
  if (!rec) throw new Error("That upload is no longer in the library.");
  return placeImage(app, rec.src, rec.name, at);
}

/**
 * Place an image source: fill a frame under the drop point or a selected empty frame; replace the
 * selected photo when the user dropped or clicked a picture with one selected (Shift adds); else add it.
 * `replace`: "auto" (that rule), true (replace the selected photo if there is one) or false (never).
 */
export async function placeImage(app, src, name = "Image", at = null, { replace = "auto" } = {}) {
  const ed = app.editor;
  const target = at ? frameAt(app, at) : ed.selection().find((o) => isEmptyFrame(o));
  const swap = !(target && isFrame(target)) && replace !== false ? replaceTarget(app) || (replace === true ? selectedPhoto(app) : null) : null;
  if (swap) return replacePhoto(app, swap, src);
  if (target && isFrame(target)) {
    const grid = target.parent?.data?.kind === "grid" ? target.parent : null;
    if (grid) await fillCell(target, src);
    else await fillWithSource(target, src);
    if (grid) { ed.canvas.setActiveObject(grid); ed.canvas.requestRenderAll(); ed.commit("Fill grid cell"); app.refreshToolbar?.(); return grid; }
    ed.canvas.setActiveObject(target);
    ed.canvas.requestRenderAll();
    ed.commit("Fill frame");
    app.refreshToolbar?.();
    return target;
  }
  return addImage(app, src, { at, name: name.replace(/\.[a-z0-9]+$/i, "").slice(0, 40) || "Image" });
}

function selectedPhoto(app) {
  const sel = app.editor.selection();
  return sel.length === 1 && isImage(sel[0]) && !isFrame(sel[0]) && !sel[0].data?.cropUI ? sel[0] : null;
}

/**
 * Put a new picture into a photo, keeping its box, crop shape, turn, mask, border and effects.
 * One undo step.
 */
export async function replacePhoto(app, img, src) {
  const ed = app.editor;
  await fillWithSource(img, src);
  ed.canvas.setActiveObject(img);
  ed.canvas.requestRenderAll();
  ed.commit(img.isBg ? "Replace background photo" : "Replace image");
  app.refreshToolbar?.();
  if (replaceTips++ < 2) toast("Replaced the selected photo. Hold Shift while you drop or click to add a new one instead.", { ms: 4500 });
  return img;
}

/**
 * Upload image files: add them to the library and (optionally) place them in the design.
 * @param {*} app
 * @param {File[]} files
 * @param {{place?: boolean, at?: {x:number,y:number}|null}} opts
 */
export async function uploadFiles(app, files, { place = true, at = null } = {}) {
  const images = [...files].filter((f) => /^image\//.test(f.type));
  if (!images.length) {
    if (files.length) toast("Only image files can be uploaded.", { error: true });
    return [];
  }
  const out = [];
  for (const [i, f] of images.entries()) {
    try {
      const prep = await prepareImageFile(f);
      const rec = await saveUpload({ name: prep.name, type: prep.type, width: prep.width, height: prep.height, src: prep.src, thumb: prep.thumb })
        .catch((e) => { toast(`Saved in the design, but not in your uploads: ${e.message}`, { error: true }); return null; });
      out.push(rec);
      if (place && app.view === "editor") {
        const p = at && i ? { x: at.x + i * 40, y: at.y + i * 40 } : at;
        await placeImage(app, prep.src, prep.name, p);
      }
    } catch (e) {
      toast(e.message, { error: true });
    }
  }
  return out;
}
