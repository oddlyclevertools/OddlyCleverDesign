// The export pipeline behind Download and app.files.exportDesign(type, opts), plus "Copy as
// image" and the size estimate the Download popover shows before anything is saved.
// Every exporter returns { blob, filename, bytes, width, height, ... } and never touches
// the design itself. Multi-page designs: PNG/JPG/WebP export one page, chosen pages or every
// page (a .zip), PDF exports every page or the chosen ones, SVG/MP4/GIF use the page being
// edited, .ocd keeps every page.
import { ensureFontsFor } from "../../core/fonts.js";
import { stageRenderer } from "../pages/render.js";
import { makeZip } from "../pages/zip.js";
import { buildSVG } from "./svg.js";
import {
  KB, MAX_EXPORT_SIDE, canvasToBlob, clampScale, downloadBlob, nextFrame, outputSize, sanitizeFilename, withCrispPage,
} from "./util.js";

export const TYPES = {
  png: { ext: "png", mime: "image/png", label: "PNG" },
  jpg: { ext: "jpg", mime: "image/jpeg", label: "JPG" },
  webp: { ext: "webp", mime: "image/webp", label: "WebP" },
  pdf: { ext: "pdf", mime: "application/pdf", label: "PDF" },
  svg: { ext: "svg", mime: "image/svg+xml", label: "SVG" },
  ocd: { ext: "ocd", mime: "application/json", label: "Design file" },
};

const JPG_MIN_QUALITY = 0.3;   // below this JPEG/WebP fall apart: shrink the image instead
const SEARCH_STEPS = 7;        // quality binary search steps (~1% precision)
const MIN_SIDE = 40;           // smallest export we'll shrink to when fitting a size limit
const PDF_SCALE = 3;           // render scale for the image inside a PDF (2–3 = print sharp)
const PDF_PT_PER_PX = 0.75;    // 96 px per inch -> 72 pt per inch
const ESTIMATE_PIXELS = 4e6;   // the size estimate draws at most this many pixels, then scales up
const IMAGE_TYPES = ["png", "jpg", "webp"];

/** Prepare the editor for a faithful render: finish text editing, load every font. */
async function prepare(editor) {
  const a = editor.active();
  if (a?.isEditing) a.exitEditing();
  await ensureFontsFor(editor.objects());
}

/**
 * Render the page at exactly round(w*scale) x round(h*scale) pixels.
 * `matte` paints a solid colour under the page (JPG has no alpha).
 */
export function renderExact(editor, { scale = 1, transparent = false, matte = null } = {}) {
  const { width, height } = outputSize(editor.width, editor.height, scale);
  const src = withCrispPage(editor, () => editor.renderPage({ scale, transparent }));
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
}

function fileName(name, type) {
  return `${sanitizeFilename(name)}.${TYPES[type].ext}`;
}

/**
 * A renderer for page i: { width, height, render({scale, transparent, matte}), dispose() }.
 * The page being edited renders through the editor; other pages render offscreen.
 */
export async function pageRenderer(editor, i = editor.pageIndex) {
  const base = { width: editor.width, height: editor.height };
  if (i === editor.pageIndex) return { ...base, render: (o) => renderExact(editor, o), dispose() {} };
  return { ...base, ...(await stageRenderer(editor.pageJSON(i), editor.width, editor.height)) };
}

/** Which pages an export covers: "current" | "all" | [indices] -> sorted unique indices. */
export function pageIndices(editor, pages = "current") {
  const n = editor.pageCount;
  if (pages === "all") return [...Array(n).keys()];
  if (Array.isArray(pages)) {
    const list = [...new Set(pages.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < n))].sort((a, b) => a - b);
    if (!list.length) throw new Error("Pick at least one page.");
    return list;
  }
  return [editor.pageIndex];
}

/** Encode a canvas, refusing to silently hand back another format (some browsers lack WebP). */
async function encode(canvas, mime, quality) {
  const blob = await canvasToBlob(canvas, mime, quality);
  if (blob.type && blob.type !== mime) throw new Error(`This browser can't make ${mime === "image/webp" ? "WebP" : mime} files. Try PNG or JPG.`);
  return blob;
}

/** The scale that should bring `bytes` down to `maxBytes` (file size follows the pixel count). */
const shrinkScale = (s, bytes, maxBytes) => s * Math.sqrt(maxBytes / bytes) * 0.95;

/** PNG, optionally under a byte limit. PNG has no quality setting, so a limit uses fewer pixels. */
async function exportPNG(r, { scale, transparent, maxBytes }, progress) {
  let s = scale;
  for (let round = 0; round < 8; round++) {
    progress(0.2 + round * 0.08, round ? "Making it smaller…" : "Drawing your design…");
    await nextFrame();
    const canvas = r.render({ scale: s, transparent });
    progress(0.6, maxBytes ? `Fitting under ${Math.round(maxBytes / KB)} KB…` : "Saving the PNG…");
    const blob = await encode(canvas, "image/png");
    const done = (fitted = true) => ({ blob, width: canvas.width, height: canvas.height, scale: s, fitted });
    if (!maxBytes || blob.size <= maxBytes) return done();
    const next = shrinkScale(s, blob.size, maxBytes);
    if (next < MIN_SIDE / Math.min(r.width, r.height) || round === 7) return done(false);
    s = next;
  }
  throw new Error("Couldn't make the PNG.");
}

/**
 * JPG or WebP, optionally under a byte limit: binary-search the quality first; when even the
 * lowest acceptable quality is too big, shrink the image and search again. WebP can keep a
 * transparent background; JPG always gets a white one.
 */
async function exportLossy(r, { mime = "image/jpeg", scale, quality, maxBytes, transparent = false }, progress) {
  let s = scale;
  const q = Math.max(0.05, Math.min(1, quality));
  const clear = transparent && mime === "image/webp";
  const label = mime === "image/webp" ? "WebP" : "JPG";
  for (let round = 0; round < 8; round++) {
    progress(0.1 + round * 0.1, round ? "Making it smaller…" : "Drawing your design…");
    await nextFrame();
    const canvas = r.render({ scale: s, transparent: clear, matte: clear ? null : "#ffffff" });
    const done = (blob, qq, fitted = true) => ({ blob, width: canvas.width, height: canvas.height, scale: s, quality: qq, fitted });
    const first = await encode(canvas, mime, q);
    if (!maxBytes || first.size <= maxBytes) return done(first, q);

    progress(0.3 + round * 0.1, `Fitting under ${Math.round(maxBytes / KB)} KB…`);
    const floorQ = Math.min(q, JPG_MIN_QUALITY);
    const atFloor = await encode(canvas, mime, floorQ);
    if (atFloor.size <= maxBytes) {
      let lo = floorQ, hi = q, best = { blob: atFloor, q: floorQ };
      for (let i = 0; i < SEARCH_STEPS; i++) {
        const mid = (lo + hi) / 2;
        const b = await encode(canvas, mime, mid);
        if (b.size <= maxBytes) { best = { blob: b, q: mid }; lo = mid; } else hi = mid;
      }
      return done(best.blob, best.q);
    }
    // Too big even at the lowest quality: shrink (file size ~ pixel count) and retry.
    const next = shrinkScale(s, atFloor.size, maxBytes);
    const minScale = MIN_SIDE / Math.min(r.width, r.height);
    if (next < minScale || round === 7) return done(atFloor, floorQ, false);
    s = next;
  }
  throw new Error(`Couldn't make the ${label}.`);
}

async function exportPDF(editor, { lossless, title, indices }, progress) {
  progress(0.05, "Loading the PDF maker…");
  const { PDFDocument } = await import("pdf-lib");
  const scale = Math.min(PDF_SCALE, MAX_EXPORT_SIDE / Math.max(editor.width, editor.height));
  const pdf = await PDFDocument.create();
  pdf.setTitle(title || "Design");
  pdf.setCreator("OddlyClever Design");
  pdf.setProducer("OddlyClever Design with pdf-lib");
  const pw = editor.width * PDF_PT_PER_PX, ph = editor.height * PDF_PT_PER_PX;
  for (const [k, i] of indices.entries()) {
    const f = (x) => 0.1 + ((k + x) / indices.length) * 0.8;
    const of = indices.length > 1 ? ` (page ${k + 1} of ${indices.length})` : "";
    progress(f(0), `Drawing your design…${of}`);
    await nextFrame();
    const r = await pageRenderer(editor, i);
    let canvas;
    try { canvas = r.render({ scale, matte: lossless ? null : "#ffffff" }); } finally { r.dispose(); }
    progress(f(0.5), `Packing the image…${of}`);
    const img = await canvasToBlob(canvas, lossless ? "image/png" : "image/jpeg", lossless ? undefined : 0.92);
    const bytes = new Uint8Array(await img.arrayBuffer());
    const embedded = lossless ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    pdf.addPage([pw, ph]).drawImage(embedded, { x: 0, y: 0, width: pw, height: ph });
  }
  progress(0.92, "Writing the PDF…");
  await nextFrame();
  const out = await pdf.save();
  return {
    blob: new Blob([out], { type: "application/pdf" }),
    width: editor.width, height: editor.height, scale, pages: indices.length,
    pageSize: { width: pw, height: ph },
    notes: ["Text in the PDF is part of the picture, so it can't be selected."],
  };
}

/** PNG, JPG or WebP of one page, or a .zip with one image per page. */
async function exportImages(editor, type, indices, opts, name, progress) {
  const one = (r, sub) => (type === "png"
    ? exportPNG(r, { scale: opts.scale, transparent: opts.transparent, maxBytes: opts.maxBytes }, sub)
    : exportLossy(r, { mime: TYPES[type].mime, scale: opts.scale, quality: opts.quality, maxBytes: opts.maxBytes, transparent: opts.transparent }, sub));
  if (indices.length === 1) {
    const r = await pageRenderer(editor, indices[0]);
    try { return await one(r, progress); } finally { r.dispose(); }
  }
  const files = [], digits = String(editor.pageCount).length;
  let last = null, fitted = true;
  for (const [k, i] of indices.entries()) {
    const sub = (f, t) => progress(((k + f) / indices.length) * 0.92, `Page ${k + 1} of ${indices.length}: ${t}`);
    const r = await pageRenderer(editor, i);
    try { last = await one(r, sub); } finally { r.dispose(); }
    if (last.fitted === false) fitted = false;
    const label = editor.pages[i]?.name ? ` ${sanitizeFilename(editor.pages[i].name)}` : "";
    files.push({
      name: `${sanitizeFilename(name)} - ${String(i + 1).padStart(digits, "0")}${label}.${TYPES[type].ext}`,
      data: new Uint8Array(await last.blob.arrayBuffer()),
    });
  }
  progress(0.95, "Packing the .zip…");
  return { ...last, blob: makeZip(files), fitted, pages: indices.length, zip: true };
}

async function exportSVG(editor, { transparent, embedFonts }, progress) {
  progress(0.3, embedFonts ? "Embedding fonts…" : "Writing the SVG…");
  const { svg, notes } = await buildSVG(editor, { transparent, embedFonts });
  if (editor.pageCount > 1) notes.push(`The SVG has page ${editor.pageIndex + 1}, the page you're on.`);
  return { blob: new Blob([svg], { type: "image/svg+xml" }), width: editor.width, height: editor.height, scale: 1, notes };
}

function exportOCD(editor, { name }) {
  const doc = { ...editor.toJSON(), name: name || "Untitled design", exported: new Date().toISOString() };
  return {
    blob: new Blob([JSON.stringify(doc)], { type: "application/json" }),
    width: editor.width, height: editor.height, scale: 1,
  };
}

/**
 * Export the open design.
 * @param {object} app
 * @param {"png"|"jpg"|"webp"|"pdf"|"svg"|"ocd"} type
 * @param {{scale?: number, transparent?: boolean, quality?: number, limitKB?: number|null,
 *   lossless?: boolean, embedFonts?: boolean, download?: boolean, name?: string,
 *   pages?: "current"|"all"|number[], onProgress?: (fraction: number, text: string) => void}} opts
 *   pages: PNG/JPG/WebP default "current" (several pages make a .zip); PDF default "all". A list
 *   of 0-based page indices ([1, 3] = pages 2 and 4) picks pages. limitKB: PNG, JPG and WebP.
 */
export async function exportDesign(app, type, opts = {}) {
  if (!TYPES[type]) throw new Error(`Unknown file type "${type}".`);
  const editor = app.editor;
  const name = opts.name || app.project?.name || "Untitled design";
  const progress = (f, t) => opts.onProgress?.(f, t);
  const scale = clampScale(opts.scale ?? 1, editor.width, editor.height);
  await prepare(editor);
  let res;
  if (IMAGE_TYPES.includes(type)) {
    const limit = Number(opts.limitKB);
    res = await exportImages(editor, type, pageIndices(editor, opts.pages ?? "current"), {
      scale, transparent: Boolean(opts.transparent), quality: opts.quality ?? 0.9,
      maxBytes: limit > 0 ? Math.round(limit * KB) : null,
    }, name, progress);
  } else if (type === "pdf") {
    res = await exportPDF(editor, { lossless: Boolean(opts.lossless), title: name, indices: pageIndices(editor, opts.pages ?? "all") }, progress);
  }
  else if (type === "svg") res = await exportSVG(editor, { transparent: Boolean(opts.transparent), embedFonts: opts.embedFonts !== false }, progress);
  else res = exportOCD(editor, { name });
  progress(1, "Done");
  const filename = res.zip ? `${sanitizeFilename(name)}.zip` : fileName(name, type);
  const out = { type, notes: [], ...res, filename, bytes: res.blob.size };
  if (opts.download !== false) downloadBlob(out.blob, out.filename);
  return out;
}

// ---- copy as image and size estimates -----------------------------------------------------

/** True when this browser can put a picture on the clipboard. */
export const canCopyImage = () => Boolean(navigator.clipboard?.write && typeof ClipboardItem === "function");

/** Most pixels a copied picture may have (several pages stack into one tall image). */
const COPY_MAX_PIXELS = 40e6;
const COPY_MAX_SIDE = 16000;

/**
 * Copy pages to the clipboard as one PNG, to paste into chats, docs or other apps. One page is
 * copied as it is; several pages stack top to bottom with a thin white gap (scaled down if the
 * stack would be too big for a picture). Call it straight from a click: browsers only allow
 * clipboard writes during a user action.
 * @param {object} app
 * @param {{scale?: number, transparent?: boolean, pages?: "current"|"all"|number[]}} [opts]
 * @returns {Promise<{width: number, height: number, bytes: number, pages: number}>}
 */
export async function copyDesignImage(app, { scale = 1, transparent = false, pages = "current" } = {}) {
  if (!canCopyImage()) throw new Error("This browser can't copy pictures. Use Download instead.");
  const editor = app.editor;
  const indices = pageIndices(editor, pages);
  let info = null;
  // ClipboardItem takes a promise, so the write starts inside the click while the pages draw.
  const png = (async () => {
    await prepare(editor);
    const canvas = indices.length === 1 && indices[0] === editor.pageIndex
      ? renderExact(editor, { scale: clampScale(scale, editor.width, editor.height), transparent })
      : await stackPages(editor, indices, { scale, transparent });
    const blob = await encode(canvas, "image/png");
    info = { width: canvas.width, height: canvas.height, bytes: blob.size, pages: indices.length };
    return blob;
  })();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
  await png;
  return info;
}

/** The chosen pages drawn top to bottom on one canvas, within the copy size limits. */
async function stackPages(editor, indices, { scale, transparent }) {
  const n = indices.length, w = editor.width, h = editor.height, gap = n > 1 ? Math.round(w * 0.02) : 0;
  const fullH = h * n + gap * (n - 1);
  const s = Math.min(clampScale(scale, w, h), COPY_MAX_SIDE / fullH, COPY_MAX_SIDE / w, Math.sqrt(COPY_MAX_PIXELS / (w * fullH)));
  const { width, height } = outputSize(w, h, s);
  const g = Math.round(gap * s);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height * n + g * (n - 1);
  const ctx = out.getContext("2d");
  if (!transparent) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
  }
  for (const [k, i] of indices.entries()) {
    const r = await pageRenderer(editor, i);
    try {
      ctx.drawImage(r.render({ scale: s, transparent }), 0, k * (height + g), width, height);
    } finally {
      r.dispose();
    }
  }
  return out;
}

/**
 * About how big a download will be, before it's made: up to three of the chosen pages are drawn
 * (at most 4 megapixels each), encoded the same way, then scaled up by the pixel count; more
 * pages count as the average of those.
 * @param {object} app
 * @param {string} type
 * @param {{scale?: number, transparent?: boolean, quality?: number, limitKB?: number|null,
 *   lossless?: boolean, pages?: "current"|"all"|number[]}} opts
 * @returns {Promise<{bytes: number, exact: boolean, capped: boolean}|null>} null when it can't tell
 */
export async function estimateExport(app, type, opts = {}) {
  const editor = app.editor;
  if (type === "ocd") return { bytes: JSON.stringify(editor.toJSON()).length + 60, exact: true, capped: false };
  const image = IMAGE_TYPES.includes(type);
  if (!image && type !== "pdf") return null;
  const indices = pageIndices(editor, opts.pages ?? (type === "pdf" ? "all" : "current"));
  const scale = type === "pdf"
    ? Math.min(PDF_SCALE, MAX_EXPORT_SIDE / Math.max(editor.width, editor.height))
    : clampScale(opts.scale ?? 1, editor.width, editor.height);
  const probe = Math.min(scale, Math.sqrt(ESTIMATE_PIXELS / (editor.width * editor.height)));
  const mime = type === "pdf" ? (opts.lossless ? "image/png" : "image/jpeg") : TYPES[type].mime;
  const clear = Boolean(opts.transparent) && (type === "png" || type === "webp");
  const full = outputSize(editor.width, editor.height, scale);
  const limit = image && Number(opts.limitKB) > 0 ? opts.limitKB * KB : 0;
  await ensureFontsFor(editor.objects());
  const sizes = [];
  for (const i of indices.slice(0, 3)) {
    const r = await pageRenderer(editor, i);
    try {
      const canvas = r.render({ scale: probe, transparent: clear, matte: clear || mime === "image/png" ? null : "#ffffff" });
      const blob = await encode(canvas, mime, mime === "image/png" ? undefined : (type === "pdf" ? 0.92 : opts.quality ?? 0.9));
      sizes.push(blob.size * ((full.width * full.height) / (canvas.width * canvas.height)));
    } finally {
      r.dispose();
    }
  }
  const each = sizes.map((b) => (limit ? Math.min(b, limit) : b));
  const capped = Boolean(limit) && sizes.some((b) => b > limit);
  const bytes = (each.reduce((a, b) => a + b, 0) / each.length) * indices.length;
  return { bytes: Math.round(bytes), exact: false, capped };
}
