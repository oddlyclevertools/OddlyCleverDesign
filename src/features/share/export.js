// Share as a file: every page of the design in one self-contained .html (view-only, or a review
// copy with comment pins). Pages that SVG can draw exactly become vector SVG with only the font
// subsets their letters need; pages with text effects, curves, sticker outlines or blend modes
// become a sharp picture (so they look exactly like the editor).
import { buildSVG, embeddedFontCSS } from "../files/svg.js";
import { downloadBlob, sanitizeFilename } from "../files/util.js";
import { allObjects, loadOffscreen } from "../bulk/offscreen.js";
import { pageDocs } from "../bulk/pages.js";
import { buildShareHtml, inlineSvg, scriptHashes } from "./html.js";

const RASTER_LONG_SIDE = 2400; // sharp on a 2x screen, still small
const SHAPES = new Set(["rect", "circle", "ellipse", "triangle", "polygon", "polyline", "path", "line"]);

/** Why a page can't be drawn as SVG exactly (null when it can). */
export function vectorBlocker(objects) {
  for (const o of allObjects(objects)) {
    const type = String(o.type || "").toLowerCase();
    if (o.globalCompositeOperation && o.globalCompositeOperation !== "source-over") return "blend mode";
    if (typeof o.text === "string") {
      const fx = o.data?.effect;
      if (fx && typeof fx === "object" && Object.values(fx).some(Boolean)) return "text effect";
      if (Number(o.data?.curve)) return "curved text";
      if (o.direction === "rtl") return "right-to-left text";
      continue;
    }
    if (type === "group") continue;
    if (type === "image" || type === "ocimage") {
      if (o.data?.outline?.width || o.data?.border?.width) return "picture outline";
      continue;
    }
    if (!SHAPES.has(type)) return type || "object";
  }
  return null;
}

async function pageMarkup(doc, format, fontRules) {
  const off = await loadOffscreen(doc);
  try {
    const blocker = format === "image" ? "picture" : vectorBlocker(off.objects());
    if (format === "vector" || !blocker) {
      // Ids land in the SVG markup: keep them to safe characters (this is an off-screen copy).
      for (const o of allObjects(off.objects())) if (o.id && /[^\w-]/.test(String(o.id))) o.id = String(o.id).replace(/[^\w-]/g, "_");
      const { svg } = await buildSVG(off, { embedFonts: false });
      const { css } = await embeddedFontCSS(off.objects());
      for (const rule of css.split("\n")) if (rule.trim()) fontRules.add(rule);
      return { width: off.width, height: off.height, markup: inlineSvg(svg), kind: "vector" };
    }
    const scale = Math.min(2, RASTER_LONG_SIDE / Math.max(off.width, off.height));
    const cv = off.renderPage({ scale });
    let src = cv.toDataURL("image/webp", 0.9);
    if (!src.startsWith("data:image/webp")) src = cv.toDataURL("image/png");
    return { width: off.width, height: off.height, markup: `<img src="${src}" alt="Page" draggable="false">`, kind: "picture" };
  } finally {
    off.dispose();
  }
}

/**
 * Make the shareable .html file of the open design (all pages).
 * @param {object} app
 * @param {{mode?: "view"|"review", format?: "auto"|"vector"|"image", download?: boolean, onProgress?: (f: number, t: string) => void}} opts
 * @returns {Promise<{blob: Blob, filename: string, bytes: number, pages: number, kinds: string[]}>}
 */
export async function exportShareFile(app, { mode = "view", format = "auto", download = true, onProgress } = {}) {
  if (!["view", "review"].includes(mode)) throw new Error('mode must be "view" or "review".');
  if (!["auto", "vector", "image"].includes(format)) throw new Error('format must be "auto", "vector" or "image".');
  const a = app.editor.active();
  if (a?.isEditing) a.exitEditing();
  const docs = await pageDocs(app);
  const fontRules = new Set();
  const pages = [];
  for (const [i, doc] of docs.entries()) {
    onProgress?.(i / docs.length, `Packing page ${i + 1} of ${docs.length}…`);
    pages.push(await pageMarkup(doc, format, fontRules));
  }
  const title = app.project?.name || "Untitled design";
  const exportId = `${app.project?.id || "design"}-${Date.now().toString(36)}`;
  const html = buildShareHtml({ title, mode, designId: app.project?.id || "", exportId, pages, fontCSS: [...fontRules].join("\n"),
    hashes: await scriptHashes(mode) });
  const blob = new Blob([html], { type: "text/html" });
  const filename = `${sanitizeFilename(title)}${mode === "review" ? " (review copy)" : ""}.html`;
  if (download) downloadBlob(blob, filename);
  onProgress?.(1, "Done");
  return { blob, filename, bytes: blob.size, pages: pages.length, kinds: pages.map((p) => p.kind) };
}
