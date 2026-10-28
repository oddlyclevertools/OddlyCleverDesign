// "My library": save the open design as a template, or picked objects as an element, and use
// them again in any design. The AI uses the same calls (save_as_template, save_element), so
// everything it draws or designs can be kept and reused. Saved templates join the template
// list under "My templates"; saved elements show at the top of the Elements panel.
import { Gradient, Group, util } from "fabric";
import { CUSTOM_PROPS } from "../../core/editor.js";
import { sanitizeObjects } from "../../core/sanitize.js";
import { CATEGORIES, TEMPLATES, addTemplates } from "../templates/registry.js";
import { deleteLibraryItem, getLibraryItem, listLibrary, onLibraryChange, saveLibraryItem } from "./store.js";

const THUMB_SIDE = 360;

if (!CATEGORIES.some((c) => c.id === "mine")) CATEGORIES.splice(1, 0, { id: "mine", label: "My templates" });

const fillOf = (f) => (f && typeof f === "object" && (f.type === "linear" || f.type === "radial") ? new Gradient(f) : f);

/** A library template as a template definition (the same shape as the built-in ones). */
function asTemplate(rec) {
  return {
    id: rec.id, name: rec.name, size: { w: rec.w, h: rec.h }, category: "mine", tags: ["my", "saved", ...rec.tags],
    by: rec.by, mine: true,
    async build({ editor }) {
      const objs = await util.enlivenObjects(sanitizeObjects(rec.doc.objects).objects);
      if (rec.doc.background !== undefined) editor.setBackground(fillOf(rec.doc.background));
      for (const o of objs) editor.add(o, { center: false, select: false });
    },
  };
}

/** Put the saved templates into the template list (and keep it in step with the library). */
export async function syncTemplates() {
  let list = [];
  try { list = await listLibrary("template"); } catch { return; } // no IndexedDB: the built-ins still work
  for (let i = TEMPLATES.length - 1; i >= 0; i--) if (TEMPLATES[i].mine) TEMPLATES.splice(i, 1);
  addTemplates(list.map(asTemplate));
}

function pageThumb(ed) {
  const s = THUMB_SIDE / Math.max(ed.width, ed.height);
  const vpt = ed.canvas.viewportTransform.slice();
  const active = ed.canvas.getActiveObject();
  try {
    ed.canvas.discardActiveObject();
    ed.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    return ed.canvas.toDataURL({ format: "jpeg", quality: 0.8, left: 0, top: 0, width: ed.width, height: ed.height, multiplier: s });
  } finally {
    ed.canvas.setViewportTransform(vpt);
    if (active) ed.canvas.setActiveObject(active);
    ed.canvas.requestRenderAll();
  }
}

/** Save the open design as a template. */
export async function saveDesignAsTemplate(app, { name, tags = [], by = "you" }) {
  const ed = app.editor;
  const objects = ed.objects().map((o) => o.toObject(CUSTOM_PROPS));
  const background = ed.page?.toObject?.().fill ?? "#ffffff";
  const rec = await saveLibraryItem({ kind: "template", name, tags, w: ed.width, h: ed.height, objects, background, thumb: pageThumb(ed), by });
  await syncTemplates();
  return rec;
}

/** Save objects (kept together, in their order) as one reusable element. */
export async function saveElement(app, objs, { name, tags = [], by = "you" }) {
  if (!objs.length) throw new Error("Pick something to save first.");
  const ed = app.editor;
  const all = ed.canvas.getObjects();
  const ordered = [...objs].sort((a, b) => all.indexOf(a) - all.indexOf(b));
  const xs = ordered.map((o) => o.getBoundingRect());
  const x0 = Math.min(...xs.map((r) => r.left)), y0 = Math.min(...xs.map((r) => r.top));
  const x1 = Math.max(...xs.map((r) => r.left + r.width)), y1 = Math.max(...xs.map((r) => r.top + r.height));
  const objects = ordered.map((o) => ({ ...o.toObject(CUSTOM_PROPS), left: o.left - x0, top: o.top - y0 }));
  // Thumbnail: the objects drawn on their own.
  const copies = await util.enlivenObjects(sanitizeObjects(objects).objects);
  const c = document.createElement("canvas");
  const k = Math.min(1, THUMB_SIDE / Math.max(x1 - x0, y1 - y0, 1));
  c.width = Math.max(1, Math.round((x1 - x0) * k));
  c.height = Math.max(1, Math.round((y1 - y0) * k));
  const ctx = c.getContext("2d");
  ctx.scale(k, k);
  for (const o of copies) { o.setCoords(); o.render(ctx); }
  return saveLibraryItem({ kind: "element", name, tags, w: x1 - x0, h: y1 - y0, objects, thumb: c.toDataURL("image/png"), by });
}

/** A saved element's objects, ready to add (fresh ids, positioned from 0,0). */
export async function elementObjects(id) {
  const rec = await getLibraryItem(id);
  if (!rec || rec.kind !== "element") throw new Error(`There's no saved element "${id}".`);
  const objs = await util.enlivenObjects(sanitizeObjects(rec.doc.objects).objects);
  return { rec, objs };
}

export { deleteLibraryItem, listLibrary, onLibraryChange };

export function install() {
  syncTemplates();
  onLibraryChange(syncTemplates);
}

/** One object for a saved element: the object itself, or a group of its parts. */
export async function libraryObject(id) {
  const { rec, objs } = await elementObjects(id);
  const obj = objs.length === 1 ? objs[0] : new Group(objs, { subTargetCheck: false });
  obj.set({ name: rec.name, id: undefined });
  return obj;
}
