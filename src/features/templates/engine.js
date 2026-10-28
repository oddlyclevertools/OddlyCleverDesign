// Template engine: run a template's builder into an offscreen collector, then either render a
// preview image (cached) or place the objects into the real editor, scaled to fit its page.
//
// A builder only uses `app.editor.add(obj, opts)`, `app.editor.setBackground(fill)` and
// `app.editor.width/height`, so the same code works on the collector and on the real editor.
// Objects with `data.tpBleed` are full-bleed: they stretch to cover a page of another size.
import { Rect, StaticCanvas } from "fabric";
import { CUSTOM_PROPS, newId } from "../../core/editor.js";
import { ensureFont, ensureFontsFor } from "../../core/fonts.js";
import { resolveSize } from "../../core/sizes.js";

const PREVIEW_LONG_SIDE = 720;
const CACHE_PREFIX = "tp-prev:";

/** The template's page size in px. */
export function sizeOf(tpl) {
  const { w, h } = resolveSize(tpl.size);
  return { w, h };
}

/** Run a builder offscreen. Resolves to { width, height, background, objects }. */
export async function collect(tpl) {
  const { w, h } = sizeOf(tpl);
  await Promise.all((tpl.fonts || []).map(([family, weight = 400, style = "normal"]) => ensureFont(family, weight, style)));
  const out = { width: w, height: h, background: "#ffffff", objects: [] };
  const editor = {
    width: w,
    height: h,
    add(obj, { name } = {}) {
      if (name) obj.set("name", name);
      out.objects.push(obj);
      return obj;
    },
    setBackground(fill) { out.background = fill; },
  };
  await tpl.build({ editor });
  await ensureFontsFor(out.objects);
  return out;
}

/** Map every collected object from the template page onto a W x H page (fit, centred). */
function fitObjects(objects, from, W, H) {
  const s = Math.min(W / from.width, H / from.height);
  const ox = (W - from.width * s) / 2, oy = (H - from.height * s) / 2;
  const sx = W / from.width, sy = H / from.height;
  for (const o of objects) {
    const bleed = Boolean(o.data?.tpBleed);
    const kx = bleed ? sx : s, ky = bleed ? sy : s;
    o.set({
      left: o.left * kx + (bleed ? 0 : ox),
      top: o.top * ky + (bleed ? 0 : oy),
      scaleX: (o.scaleX || 1) * kx,
      scaleY: (o.scaleY || 1) * ky,
    });
    o.setCoords();
  }
}

/**
 * Replace everything on the editor's page with the template, as one undo step.
 * @param {object} editor the app editor
 * @param {object} tpl a template definition
 * @param {{ record?: boolean }} opts record=false when the caller resets history itself
 */
export async function applyTemplate(editor, tpl, { record = true } = {}) {
  const built = await collect(tpl);
  const W = editor.width, H = editor.height;
  if (W !== built.width || H !== built.height) fitObjects(built.objects, built, W, H);
  editor.canvas.discardActiveObject();
  editor.history.pause();
  try {
    const old = editor.objects();
    if (old.length) editor.canvas.remove(...old);
    for (const o of built.objects) editor.add(o, { center: false, select: false });
    editor.setBackground(built.background);
  } finally {
    editor.history.resume();
  }
  editor.canvas.requestRenderAll();
  if (record) editor.commit("Apply template");
}

/**
 * The template as one page's canvas JSON at the editor's size, for adding it as a new page.
 * Nothing on the open page changes.
 */
export async function templatePageJSON(editor, tpl) {
  const built = await collect(tpl);
  const W = editor.width, H = editor.height;
  if (W !== built.width || H !== built.height) fitObjects(built.objects, built, W, H);
  const page = editor.blankPageJSON(built.background);
  const objects = built.objects.map((o) => {
    o.set({ id: newId(), name: o.name || tpl.name });
    return o.toObject(CUSTOM_PROPS);
  });
  return { ...page, objects: [...page.objects, ...objects] };
}

/**
 * Add the template as a new page right after the one being edited (one undo step) and go to it.
 * Resolves to the new page's index.
 */
export async function addTemplatePage(app, tpl) {
  const ed = app.editor;
  const canvas = await templatePageJSON(ed, tpl);
  const i = ed.addPage({ at: ed.pageIndex + 1, canvas, name: tpl.name, label: "Add template page" });
  await ed.goToPage(i);
  return i;
}

// ---- previews ----------------------------------------------------------------------------

const memo = new Map(); // id -> Promise<dataURL>
let queue = Promise.resolve();

/** A short hash of the builder's source, so an edited template gets a fresh preview. */
function versionOf(tpl) {
  const src = `${tpl.build}${tpl.size}`;
  let h = 0;
  for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function readCache(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function writeCache(key, url) {
  try { sessionStorage.setItem(key, url); } catch { /* full or blocked: memory cache is enough */ }
}

async function renderPreview(tpl) {
  const built = await collect(tpl);
  const s = PREVIEW_LONG_SIDE / Math.max(built.width, built.height);
  const el = document.createElement("canvas");
  const sc = new StaticCanvas(el, {
    width: Math.round(built.width * s), height: Math.round(built.height * s),
    enableRetinaScaling: false, renderOnAddRemove: false,
  });
  try {
    sc.add(new Rect({ originX: "left", originY: "top", left: 0, top: 0, width: built.width, height: built.height,
      fill: built.background, strokeWidth: 0 }));
    for (const o of built.objects) if (!o.data?.guide) sc.add(o);
    sc.setZoom(s);
    sc.renderAll();
    return el.toDataURL("image/jpeg", 0.86);
  } finally {
    sc.dispose();
  }
}

/** A preview image (data URL) for a template: rendered once, then cached. */
export function previewOf(tpl) {
  const key = `${CACHE_PREFIX}${tpl.id}:${versionOf(tpl)}`;
  if (memo.has(key)) return memo.get(key);
  const cached = readCache(key);
  const job = cached ? Promise.resolve(cached) : (queue = queue.then(() => renderPreview(tpl)).then((url) => {
    writeCache(key, url);
    return url;
  }));
  // Keep the queue alive after a failure; the caller sees the error.
  queue = queue.catch(() => null);
  job.catch(() => memo.delete(key));
  memo.set(key, job);
  return job;
}
