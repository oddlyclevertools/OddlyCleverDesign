// Bulk Create engine: link table columns to texts and pictures, build one variant of the open
// design per row (off-screen), auto-fit long text, flag problem rows with the design check, then
// save the variants as designs, pages or a ZIP of pictures.
import { FabricImage } from "fabric";
import { fillCell } from "../elements/grids.js";
import { fillWithSource } from "../elements/images.js";
import { runCheck } from "../studio/check.js";
import { downloadBlob, sanitizeFilename } from "../files/util.js";
import { setTextFitted } from "./fit.js";
import { allObjects, loadOffscreen, variantOf } from "./offscreen.js";
import { addPages, hasPages } from "./pages.js";
import { resolvePicture } from "./pictures.js";
import { fillPlaceholders, norm, placeholdersIn, replaceAllText } from "./textstyles.js";
import { createZip } from "./zip.js";

export const OUTPUTS = ["designs", "pages", "png", "jpg"];
const MAX_SIDE = 8000;
const isText = (o) => typeof o?.text === "string";
const isGrid = (o) => o?.type === "group" && o.data?.kind === "grid";
const snippet = (t) => {
  const s = String(t || "").replace(/\s+/g, " ").trim();
  return `“${s.length > 24 ? `${s.slice(0, 22)}…` : s}”`;
};

/**
 * Things a column can fill in the open design: texts, pictures/frames and photo-grid cells.
 * key is the object id, or "gridId#cell" for a grid cell.
 * @returns {{key: string, kind: "text"|"picture", label: string, obj: object, placeholders?: string[]}[]}
 */
export function linkTargets(app) {
  const out = [];
  const visit = (o) => {
    if (!o || o.isPage || o.data?.guide) return;
    if (isText(o)) {
      if (o.id) out.push({ key: o.id, kind: "text", obj: o, label: snippet(o.text), placeholders: placeholdersIn(o.text) });
      return;
    }
    if (isGrid(o) && o.id) {
      o.getObjects().forEach((c, i) => out.push({ key: `${o.id}#${i}`, kind: "picture", obj: c, label: `Grid cell ${i + 1}`, title: o.name || "Photo grid" }));
      return;
    }
    if (o instanceof FabricImage && o.id) {
      out.push({ key: o.id, kind: "picture", obj: o, label: o.isBg ? "Background picture" : o.data?.frame ? (o.name || "Frame") : (o.name || "Picture") });
      return;
    }
    if (Array.isArray(o._objects)) o._objects.forEach(visit);
  };
  app.editor.objects().forEach(visit);
  return out;
}

/** Columns used by {{placeholders}} in the open design's texts (as written in the table). */
export function placeholderColumns(targets, columns) {
  const wanted = new Set(targets.flatMap((t) => (t.placeholders || []).map(norm)));
  return columns.filter((c) => wanted.has(norm(c)));
}

/** Links worth making without asking: a picture named like a column ("Photo" -> column "photo"). */
export function autoLinks(targets, columns) {
  const links = {};
  const pics = targets.filter((t) => t.kind === "picture");
  for (const t of pics) {
    const col = columns.find((c) => norm(c) === norm(t.obj.name));
    if (col) links[t.key] = col;
  }
  const picCols = columns.filter((c) => /^(photo|picture|image|img|pic|avatar|logo|headshot)s?\b/i.test(c.trim()));
  const free = pics.filter((t) => !links[t.key]);
  if (picCols.length === 1 && free.length === 1 && !Object.values(links).includes(picCols[0])) links[free[0].key] = picCols[0];
  return links;
}

/** Accepts {key: column} or [{id, cell?, column}] and returns {key: column}. */
export function normalizeMapping(mapping) {
  if (!mapping) return {};
  if (Array.isArray(mapping)) {
    const out = {};
    for (const m of mapping) {
      if (!m || !m.id || !m.column) continue;
      out[m.cell != null ? `${m.id}#${m.cell}` : m.id] = String(m.column);
    }
    return out;
  }
  if (typeof mapping === "object") {
    return Object.fromEntries(Object.entries(mapping).filter(([, c]) => typeof c === "string" && c));
  }
  throw new Error("mapping must be {objectId: column} or a list of {id, column}.");
}

/** Rows as plain objects, from [{...}] or {columns, rows}. */
export function normalizeRows(input) {
  const rows = Array.isArray(input) ? input : input?.rows;
  if (!Array.isArray(rows) || !rows.length) throw new Error("There are no rows to make designs from.");
  const clean = rows.map((r) => {
    if (!r || typeof r !== "object" || Array.isArray(r)) throw new Error("Each row must be an object of column: value.");
    return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v)]));
  });
  const columns = Array.isArray(input?.columns) ? input.columns : [...new Set(clean.flatMap((r) => Object.keys(r)))];
  return { columns, rows: clean };
}

const valueOf = (row, col) => {
  if (col in row) return row[col];
  const k = Object.keys(row).find((c) => norm(c) === norm(col));
  return k ? row[k] : "";
};

/** Turn studio check findings into row flags, only for things this row changed. */
async function checkFlags(off, changedIds, picturesChanged) {
  const findings = await runCheck({ editor: off, files: null }, { kind: null, zones: null });
  const flags = [];
  for (const f of findings) {
    const [kind, ...rest] = f.id.split("-");
    const id = rest.join("-");
    const mine = changedIds.has(id);
    if (kind === "cut" && mine) flags.push({ kind: "overflow", text: f.text });
    else if (kind === "contrast" && (mine || picturesChanged)) flags.push({ kind: "contrast", text: f.text });
    else if (kind === "size" && mine && f.severity === "fix") flags.push({ kind: "small", text: f.text });
  }
  return flags;
}

/**
 * One row's version of a design document.
 * @returns {Promise<{doc: object, thumb: string, flags: {kind: string, text: string}[]}>}
 */
export async function buildVariant(doc, row, links, { fit = true, check = true, thumbSide = 320 } = {}) {
  const { doc: out, thumb, result } = await variantOf(doc, async (off) => {
    const flags = [];
    const changedIds = new Set();
    let picturesChanged = false;
    const objs = allObjects(off.objects());
    const byId = new Map(objs.filter((o) => o.id).map((o) => [o.id, o]));
    for (const o of objs) {
      if (!isText(o)) continue;
      const col = o.id ? links[o.id] : null;
      let next = null;
      if (col) next = replaceAllText(o.text, o.styles, valueOf(row, col));
      else if (placeholdersIn(o.text).length) {
        next = fillPlaceholders(o.text, o.styles, row);
        for (const u of next.unknown) flags.push({ kind: "unknown", text: `There's no column called “${u}”.` });
      }
      if (!next || next.text === o.text) continue;
      const res = setTextFitted(o, next, { fit });
      if (o.id) changedIds.add(o.id);
      if (res.overflow) flags.push({ kind: "overflow", text: `${snippet(o.text)} doesn't fit its box, even made small.` });
      else if (res.scale < 0.995) flags.push({ kind: "shrunk", text: `${snippet(o.text)} was shrunk to ${Math.round(res.scale * 100)}% to fit.` });
    }
    for (const [key, col] of Object.entries(links)) {
      const [id, cell] = key.split("#");
      const host = byId.get(id);
      if (!host || isText(host)) continue;
      const target = cell != null ? host.getObjects?.()[Number(cell)] : host;
      if (!target || typeof target.setElement !== "function") continue;
      try {
        const src = await resolvePicture(valueOf(row, col));
        if (!src) continue;
        if (cell != null) await fillCell(target, src);
        else await fillWithSource(target, src);
        host.set("dirty", true);
        picturesChanged = true;
      } catch (e) {
        flags.push({ kind: "picture", text: e.message });
      }
    }
    if (check && (changedIds.size || picturesChanged)) flags.push(...await checkFlags(off, changedIds, picturesChanged));
    return flags;
  }, { thumbSide });
  return { doc: out, thumb, flags: result };
}

/** The open design, ready to be copied (text editing finished first). */
export function templateDoc(app) {
  const a = app.editor.active();
  if (a?.isEditing) a.exitEditing();
  return app.editor.toJSON();
}

/** A short label for a row: its first filled linked value. */
export function rowLabel(row, usedColumns, i) {
  for (const c of usedColumns) {
    const v = String(valueOf(row, c) || "").trim();
    if (v && !/^data:/i.test(v)) return v.length > 40 ? `${v.slice(0, 38)}…` : v;
  }
  return `Row ${i + 1}`;
}

/**
 * Build every row's variant (for the preview grid and for bulkCreate).
 * @returns {Promise<{index: number, label: string, doc: object, thumb: string, flags: object[]}[]>}
 */
export async function previewBulk(app, { rows, mapping, fit = true, skip = [], onProgress, signal } = {}) {
  const table = normalizeRows(rows);
  const targets = linkTargets(app);
  const links = mapping === undefined ? autoLinks(targets, table.columns) : normalizeMapping(mapping);
  const used = [...new Set([...placeholderColumns(targets, table.columns), ...Object.values(links)])];
  if (!used.length) throw new Error("Link a column to a text or picture first (or type {{column name}} in a text).");
  const doc = templateDoc(app);
  const skipSet = new Set(skip);
  const out = [];
  const todo = table.rows.map((r, i) => i).filter((i) => !skipSet.has(i));
  for (const [n, i] of todo.entries()) {
    if (signal?.aborted) throw new Error("Stopped.");
    onProgress?.(n / todo.length, `Making ${n + 1} of ${todo.length}…`);
    const v = await buildVariant(doc, table.rows[i], links, { fit });
    out.push({ index: i, label: rowLabel(table.rows[i], used, i), ...v });
  }
  onProgress?.(1, "Done");
  return out;
}

async function renderBlob(doc, type) {
  const off = await loadOffscreen(doc);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(off.width, off.height));
    let cv = off.renderPage({ scale });
    if (type === "jpg") {
      const m = document.createElement("canvas");
      m.width = cv.width;
      m.height = cv.height;
      const ctx = m.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, m.width, m.height);
      ctx.drawImage(cv, 0, 0);
      cv = m;
    }
    return await new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw a picture."))),
      type === "jpg" ? "image/jpeg" : "image/png", 0.92));
  } finally {
    off.dispose();
  }
}

/**
 * Save built variants. output: "designs" (one design each), "pages" (pages added to the open
 * design; falls back to designs without page support), "png" or "jpg" (a ZIP download).
 */
export async function outputVariants(app, variants, { output = "designs", name, download = true, onProgress } = {}) {
  const kind = String(output).replace(/^zip-/, "");
  if (!OUTPUTS.includes(kind)) throw new Error(`output must be one of ${OUTPUTS.join(", ")}.`);
  if (!variants.length) throw new Error("Every row is unticked: tick at least one.");
  const base = name || app.project?.name || "Untitled design";
  if (kind === "pages" && hasPages(app)) {
    await addPages(app, variants.map((v) => v.doc));
    return { output: "pages", made: variants.length };
  }
  if (kind === "png" || kind === "jpg") {
    const files = [];
    for (const [n, v] of variants.entries()) {
      onProgress?.(n / variants.length, `Drawing ${n + 1} of ${variants.length}…`);
      const blob = await renderBlob(v.doc, kind);
      files.push({ name: `${String(v.index + 1).padStart(3, "0")} ${sanitizeFilename(v.label, "design")}.${kind}`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    const zip = createZip(files);
    const filename = `${sanitizeFilename(base)} bulk ${kind.toUpperCase()}.zip`;
    if (download) downloadBlob(zip, filename);
    onProgress?.(1, "Done");
    return { output: kind, made: files.length, filename, bytes: zip.size, blob: zip };
  }
  const ids = [];
  for (const [n, v] of variants.entries()) {
    onProgress?.(n / variants.length, `Saving ${n + 1} of ${variants.length}…`);
    const rec = await app.store.saveProject({
      id: app.store.newProjectId(), name: `${base} · ${v.label}`,
      width: v.doc.width, height: v.doc.height, thumb: v.thumb, doc: v.doc,
    });
    ids.push(rec.id);
  }
  onProgress?.(1, "Done");
  return { output: "designs", made: ids.length, ids, note: kind === "pages" ? "Pages aren't available here, so each row became its own design." : undefined };
}

/**
 * Make one design (or page, or picture) per table row from the open design.
 * @param {object} app
 * @param {{rows: object[]|{columns: string[], rows: object[]}, mapping?: object|object[],
 *   output?: "designs"|"pages"|"png"|"jpg", skip?: number[], fit?: boolean, download?: boolean}} opts
 * @returns {Promise<{output: string, made: number, ids?: string[], filename?: string, flagged: {row: number, flags: object[]}[]}>}
 */
export async function bulkCreate(app, { rows, mapping, output = "designs", skip = [], fit = true, download = true, onProgress } = {}) {
  const variants = await previewBulk(app, { rows, mapping, fit, skip, onProgress: (f, t) => onProgress?.(f * 0.6, t) });
  const res = await outputVariants(app, variants, { output, download, onProgress: (f, t) => onProgress?.(0.6 + f * 0.4, t) });
  const flagged = variants.filter((v) => v.flags.some((f) => f.kind !== "shrunk")).map((v) => ({ row: v.index, flags: v.flags }));
  const { blob, ...rest } = res;
  return { ...rest, flagged, ...(download ? {} : { blob }) };
}
