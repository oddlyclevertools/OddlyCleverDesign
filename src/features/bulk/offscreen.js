// Off-screen designs: load a saved design (editor.toJSON() format) into a hidden Fabric canvas,
// change it, check it, render it and save it again, without touching the open design.
// The returned object looks enough like the Editor for the studio's design check and the SVG
// export to run on it.
import { StaticCanvas } from "fabric";
import { CUSTOM_PROPS } from "../../core/editor.js";
import { ensureFontsFor } from "../../core/fonts.js";
import { sanitizeCanvas } from "../../core/sanitize.js";

/**
 * @typedef {object} Offscreen
 * @property {import("fabric").StaticCanvas} canvas
 * @property {number} width
 * @property {number} height
 * @property {object|null} page
 * @property {() => object[]} objects
 * @property {(o?: {scale?: number, transparent?: boolean}) => HTMLCanvasElement} renderPage
 * @property {() => object} toJSON
 * @property {() => void} dispose
 */

/** Load a design document into a hidden canvas. */
export async function loadOffscreen(doc) {
  if (!doc || doc.app !== "oddlyclever-design" || !doc.canvas) throw new Error("That isn't an OddlyClever design.");
  const width = Math.round(Number(doc.width)), height = Math.round(Number(doc.height));
  if (!(width >= 1 && height >= 1)) throw new Error("This design has no page size.");
  const { canvas: json } = sanitizeCanvas(doc.canvas);
  await ensureFontsFor(json.objects || []);
  const canvas = new StaticCanvas(undefined, { width, height, enableRetinaScaling: false, renderOnAddRemove: false });
  await canvas.loadFromJSON(json);
  const page = canvas.getObjects().find((o) => o.isPage) || null;
  return {
    canvas, width, height, page,
    objects: () => canvas.getObjects().filter((o) => !o.isPage),
    selection: () => [],
    active: () => null,
    select() {},
    commit() {},
    renderPage({ scale = 1, transparent = false } = {}) {
      const was = page?.strokeWidth;
      if (page) page.strokeWidth = 0; // no hairline round the page
      try {
        return canvas.toCanvasElement(scale, {
          left: 0, top: 0, width, height,
          filter: (o) => !(transparent && o.isPage) && o.visible !== false && !o.data?.guide,
        });
      } finally {
        if (page) page.strokeWidth = was;
      }
    },
    toJSON: () => ({ app: "oddlyclever-design", format: 1, width, height, canvas: canvas.toObject(CUSTOM_PROPS) }),
    dispose: () => { try { canvas.dispose(); } catch { /* already gone */ } },
  };
}

/** A small JPEG data URL of an off-screen page (for previews and the projects list). */
export function thumbOf(off, maxSide = 360) {
  const scale = Math.min(1, maxSide / Math.max(off.width, off.height));
  return off.renderPage({ scale }).toDataURL("image/jpeg", 0.8);
}

/**
 * Load `doc`, let `change(off)` edit it, and return the edited document and a thumbnail.
 * `change` may return extra data, passed back as `result`.
 */
export async function variantOf(doc, change, { thumbSide = 360 } = {}) {
  const off = await loadOffscreen(doc);
  try {
    const result = await change(off);
    off.canvas.renderAll();
    return { doc: off.toJSON(), thumb: thumbOf(off, thumbSide), result };
  } finally {
    off.dispose();
  }
}

/** Every object in an off-screen (or live) design, children of groups included. */
export function allObjects(objects) {
  const out = [];
  const visit = (o) => {
    if (!o || o.isPage) return;
    out.push(o);
    if (Array.isArray(o._objects) && typeof o.text !== "string") o._objects.forEach(visit);
  };
  objects.forEach(visit);
  return out;
}
