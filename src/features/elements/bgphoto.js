// The page background photo stays "the background" (isBg, locked at the bottom, never dragged by
// accident), but it can be picked to edit: double-click an empty part of the page, use the
// Background panel's "Edit background photo", or call app.bgPhoto.select(). While it is the
// selection it takes clicks (so its toolbar stays up); once something else is picked it goes
// back to ignoring the pointer.
// Also hangs the photo tools on the app (app.photoTools) for the AI and for tests.
import { toast } from "../../ui/kit.js";
import { backgroundImage, detachBackground, isBgPhoto, isImage } from "./images.js";
import { cropState, finishCrop, setCropRatio, setStraighten, setZoom, startCrop } from "./crop.js";
import { applyFilterSpec, filterSpec, showOriginal } from "./filters.js";
import { autoEnhance } from "./toolbar-image.js";
import { replacePhoto } from "./actions.js";

/** Let the background photo be the selection (or stop letting it). Not a history step. */
function setPickable(img, on) {
  img.set({
    selectable: on, evented: on, hasControls: false, hasBorders: on, hoverCursor: "default",
    lockMovementX: true, lockMovementY: true, lockRotation: true, lockScalingX: true, lockScalingY: true,
  });
}

/**
 * Select the background photo so its toolbar shows. Returns it, or null when the page has none.
 * @param {*} app
 */
export function selectBackground(app) {
  const img = backgroundImage(app);
  if (!isBgPhoto(img)) return null;
  setPickable(img, true);
  app.editor.canvas.setActiveObject(img);
  app.editor.canvas.requestRenderAll();
  app.bus.emit("selection", app.editor.selection(), app.editor.active());
  return img;
}

export function installBgPhoto(app) {
  const ed = app.editor, c = ed.canvas;
  const sync = () => {
    const sel = ed.selection();
    for (const o of ed.objects()) if (isBgPhoto(o)) setPickable(o, sel.includes(o));
  };
  c.on("selection:created", sync);
  c.on("selection:updated", sync);
  c.on("selection:cleared", sync);
  // Double-click on the page where nothing else is: pick the background photo. Double-click it
  // again to move and zoom it inside the page.
  c.on("mouse:dblclick", (opt) => {
    if (cropState() || app.view !== "editor") return;
    if (isBgPhoto(opt.target)) { startCrop(app, opt.target); return; }
    if (opt.target) return;
    const p = c.getScenePoint(opt.e);
    if (p.x < 0 || p.y < 0 || p.x > ed.width || p.y > ed.height) return;
    if (selectBackground(app)) toast("Background photo picked. Blur, darken, filter or move it from the toolbar.");
  });
  app.bgPhoto = {
    select: () => selectBackground(app),
    detach: () => detachBackground(app),
  };
  const photo = (img) => {
    const o = img || ed.selection()[0];
    if (!isImage(o)) throw new Error("Select a photo first.");
    return o;
  };
  app.photoTools = {
    /** Merge adjust settings ({exposure: 20, blur: 30, ...}, -100..100) into a photo; one undo step. */
    adjust(adjust, img) {
      const o = photo(img), spec = filterSpec(o);
      applyFilterSpec(o, { ...spec, adjust: { ...spec.adjust, ...adjust } });
      c.requestRenderAll();
      ed.commit("Adjust");
      return filterSpec(o).adjust;
    },
    autoEnhance: (img) => autoEnhance(app, photo(img)),
    showOriginal: (on, img) => { showOriginal(photo(img), on); c.requestRenderAll(); },
    replace: (src, img) => replacePhoto(app, photo(img), src),
    /** Crop in one go: ratio (w/h, "original" or null), straighten (degrees), zoom (reposition only). */
    crop(img, { ratio, label, straighten, zoom } = {}) {
      if (!startCrop(app, photo(img))) throw new Error("This photo can't be cropped.");
      if (ratio !== undefined) setCropRatio(ratio, label);
      if (straighten !== undefined) setStraighten(straighten);
      if (zoom !== undefined) setZoom(zoom);
      finishCrop(true);
    },
    cropState,
  };
}
