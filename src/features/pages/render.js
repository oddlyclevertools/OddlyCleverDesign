// Offscreen rendering of any page from its canvas JSON: page thumbnails, "all pages" exports
// and the presenter. The page being edited is drawn by the editor itself; stored pages are
// loaded into a Fabric StaticCanvas that never touches the editor.
import { StaticCanvas } from "fabric";
import { ensureFontsFor } from "../../core/fonts.js";
import { sanitizeCanvas } from "../../core/sanitize.js";

/**
 * A StaticCanvas holding a page (cleaned first) at design size. The caller disposes it.
 * @param {object} json page canvas JSON
 * @param {number} W @param {number} H design size
 * edit: true keeps everything as saved (for changing the page rather than drawing it).
 */
export async function loadPageStage(json, W, H, { width = 16, height = 16, readback = false, edit = false } = {}) {
  const { canvas: clean } = sanitizeCanvas(json);
  await ensureFontsFor(clean.objects);
  const node = document.createElement("canvas");
  if (readback) node.getContext("2d", { willReadFrequently: true });
  const sc = new StaticCanvas(node, {
    width, height, enableRetinaScaling: false, renderOnAddRemove: false, skipOffscreen: false,
  });
  await sc.loadFromJSON(clean);
  if (!edit) { // drawing only: no page outline, no guides
    for (const o of sc.getObjects()) {
      if (o.isPage) o.set({ strokeWidth: 0, width: W, height: H });
      if (o.data?.guide) o.visible = false;
    }
  }
  return sc;
}

/** Draw a loaded stage to a new canvas of exactly round(W*scale) x round(H*scale). */
export function drawStage(sc, W, H, { scale = 1, transparent = false, matte = null } = {}) {
  const page = sc.getObjects().find((o) => o.isPage);
  const wasVisible = page?.visible;
  if (page && transparent) page.visible = false;
  try {
    const width = Math.max(1, Math.round(W * scale)), height = Math.max(1, Math.round(H * scale));
    const src = sc.toCanvasElement(scale, { left: 0, top: 0, width: W, height: H });
    if (src.width === width && src.height === height && !matte) return src;
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const ctx = out.getContext("2d");
    if (matte) {
      ctx.fillStyle = matte;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(src, 0, 0, width, height);
    return out;
  } finally {
    if (page) page.visible = wasVisible;
  }
}

/** A reusable renderer for stored page JSON: { render(opts) -> canvas, dispose() }. */
export async function stageRenderer(json, W, H) {
  const sc = await loadPageStage(json, W, H);
  return { render: (opts) => drawStage(sc, W, H, opts), dispose: () => sc.dispose() };
}

/** Render page JSON once to a canvas element. */
export async function renderPageJSON(json, W, H, opts = {}) {
  const r = await stageRenderer(json, W, H);
  try {
    return r.render(opts);
  } finally {
    r.dispose();
  }
}

// ---- thumbnails ---------------------------------------------------------------------------

const thumbCache = new WeakMap(); // stored page JSON object -> data URL
let queue = Promise.resolve();

/**
 * A small JPEG data URL of page i. Stored pages are cached until they change (their JSON
 * object is replaced on every change), and rendered one at a time.
 */
export function pageThumb(editor, i, maxSide = 240) {
  const scale = Math.min(1, maxSide / Math.max(editor.width, editor.height));
  if (i === editor.pageIndex) {
    return Promise.resolve(editor.renderPage({ scale }).toDataURL("image/jpeg", 0.8));
  }
  const json = editor.pages[i]?.canvas;
  if (!json) return Promise.resolve("");
  const hit = thumbCache.get(json);
  if (hit && hit.side >= maxSide) return Promise.resolve(hit.url);
  const W = editor.width, H = editor.height;
  const job = queue.then(async () => {
    const again = thumbCache.get(json);
    if (again && again.side >= maxSide) return again.url;
    const url = (await renderPageJSON(json, W, H, { scale, matte: "#ffffff" })).toDataURL("image/jpeg", 0.8);
    thumbCache.set(json, { url, side: maxSide });
    return url;
  });
  queue = job.catch(() => {});
  return job;
}
