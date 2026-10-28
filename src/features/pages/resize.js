// Smart resize for whole designs (every page): in place (one undo step), as a new design, or
// to many sizes at once (one new design per size, each with every page).
import { CUSTOM_PROPS, APP_ID } from "../../core/editor.js";
import { SIZES, resolveSize } from "../../core/sizes.js";
import { loadPageStage, renderPageJSON } from "./render.js";
import { smartLayout } from "./smart.js";

/** A preset's friendly name, or "W × H". */
export function sizeName(W, H) {
  const p = SIZES.find((s) => s.w === W && s.h === H);
  return p ? p.name : `${W} × ${H}`;
}

/** Re-lay one page's canvas JSON from ow x oh to W x H (offscreen). */
export async function relayoutPageJSON(json, ow, oh, W, H) {
  const sc = await loadPageStage(json, ow, oh, { edit: true });
  try {
    const objs = sc.getObjects();
    const report = smartLayout(objs.filter((o) => !o.isPage), ow, oh, W, H);
    objs.find((o) => o.isPage)?.set({ width: W, height: H });
    const { clipPath: _clip, ...out } = sc.toObject(CUSTOM_PROPS);
    return { json: out, report };
  } finally {
    sc.dispose();
  }
}

/** A saved doc (same shapes as editor.toJSON) from a page list. */
function docOf(pages, W, H, current = 0) {
  const meta = (p) => ({ id: p.id, name: p.name || "", notes: p.notes || "" });
  const head = { app: APP_ID, format: 1, width: W, height: H };
  if (pages.length === 1) {
    const p = pages[0];
    return p.name || p.notes ? { ...head, canvas: p.canvas, pages: [meta(p)] } : { ...head, canvas: p.canvas };
  }
  const at = Math.max(0, Math.min(pages.length - 1, current));
  return {
    ...head, format: 2, page: at, canvas: pages[at].canvas,
    pages: pages.map((p, i) => (i === at ? meta(p) : { ...meta(p), canvas: p.canvas })),
  };
}

/** Every page of the open design re-laid for W x H, as a new doc (the design isn't changed). */
async function relaidDoc(app, W, H) {
  const ed = app.editor;
  const ow = ed.width, oh = ed.height;
  const pages = [];
  for (let i = 0; i < ed.pageCount; i++) {
    const p = ed.pages[i];
    const { json } = await relayoutPageJSON(ed.pageJSON(i), ow, oh, W, H);
    pages.push({ id: p.id, name: p.name, notes: p.notes, canvas: json });
  }
  return { doc: docOf(pages, W, H, ed.pageIndex), first: pages[0].canvas };
}

/** Save a doc as a new project (with a thumbnail of page 1). Returns { id, name }. */
async function saveAsProject(app, doc, first, name) {
  const scale = Math.min(1, 360 / Math.max(doc.width, doc.height));
  const thumb = (await renderPageJSON(first, doc.width, doc.height, { scale, matte: "#ffffff" })).toDataURL("image/jpeg", 0.78);
  const id = app.store.newProjectId();
  await app.store.saveProject({ id, name, width: doc.width, height: doc.height, thumb, doc });
  return { id, name };
}

async function openProject(app, id) {
  await app.openDesign(id);
  location.hash = `#/d/${id}`;
}

/**
 * Smart resize: re-lay every page for a new size (hero and headline stay big, text stays in
 * the safe area, backgrounds fill the page).
 * @param {object} app
 * @param {{w: number, h: number}|string} target a size or a preset id from core/sizes.js
 * @param {{asNewDesign?: boolean, open?: boolean, name?: string}} opts asNewDesign keeps the
 *   original and makes (and by default opens) a resized copy
 * @returns {Promise<{width: number, height: number, pages: number, id?: string, name?: string, changed: boolean}>}
 */
export async function smartResize(app, target, { asNewDesign = false, open = true, name } = {}) {
  const ed = app.editor;
  if (!app.project) throw new Error("Open a design first.");
  const { w: W, h: H } = resolveSize(target);
  app.motion?.stop?.();
  if (asNewDesign) {
    await app.save();
    const { doc, first } = await relaidDoc(app, W, H);
    const res = await saveAsProject(app, doc, first, name || `${app.project.name} (${sizeName(W, H)})`);
    if (open) await openProject(app, res.id);
    return { width: W, height: H, pages: ed.pageCount, changed: true, ...res };
  }
  const ow = ed.width, oh = ed.height;
  if (W === ow && H === oh) return { width: W, height: H, pages: ed.pageCount, changed: false };
  // Other pages first (offscreen, async); then the open page, synchronously, in one undo step.
  let relaid = null;
  if (ed.pageCount > 1) {
    relaid = new Map();
    for (const [i, p] of ed.pages.entries()) {
      if (i !== ed.pageIndex) relaid.set(p.id, (await relayoutPageJSON(p.canvas, ow, oh, W, H)).json);
    }
    if (ed.width !== ow || ed.height !== oh) throw new Error("The design changed size meanwhile. Try again.");
  }
  ed.canvas.discardActiveObject();
  if (relaid) ed.mapStoredPages((json, i) => relaid.get(ed.pages[i].id) || json);
  const report = smartLayout(ed.objects(), ow, oh, W, H);
  ed.setPageSize(W, H); // commits once: the whole re-layout is one undo step
  return { width: W, height: H, pages: ed.pageCount, changed: true, ...report };
}

/**
 * Resize to many sizes at once: one new design per size, each with every page re-laid.
 * The open design stays open and unchanged.
 * @param {object} app
 * @param {Array<{w: number, h: number}|string>} targets sizes or preset ids
 * @param {{onProgress?: (done: number, total: number, name: string) => void}} opts
 * @returns {Promise<Array<{id: string, name: string, width: number, height: number}>>}
 */
export async function resizeToMany(app, targets, { onProgress } = {}) {
  if (!app.project) throw new Error("Open a design first.");
  const list = (Array.isArray(targets) ? targets : [targets]).map((t) => {
    const r = resolveSize(t);
    return { ...r, label: r.preset ? SIZES.find((s) => s.id === r.preset).name : sizeName(r.w, r.h) };
  });
  if (!list.length) throw new Error("Pick at least one size.");
  if (list.length > 20) throw new Error("Pick up to 20 sizes at a time.");
  app.motion?.stop?.();
  await app.save();
  const base = app.project.name;
  const out = [];
  for (const [k, { w, h, label }] of list.entries()) {
    const name = `${base} (${label})`;
    onProgress?.(k, list.length, name);
    const { doc, first } = await relaidDoc(app, w, h);
    out.push({ ...(await saveAsProject(app, doc, first, name)), width: w, height: h, label });
  }
  onProgress?.(list.length, list.length, "");
  return out;
}
