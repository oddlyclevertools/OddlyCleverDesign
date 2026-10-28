// Review comments: read the .json a viewer saved from a review copy, keep the comments per design
// in this browser (IndexedDB "oddlyclever-comments"; they're notes about the design, not part
// of it, so they never change the design or its undo history) and mark them resolved.
import { COMMENTS_KIND } from "./html.js";

const DB_NAME = "oddlyclever-comments";
const STORE = "comments";
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_COMMENTS = 500;
const MAX_TEXT = 2000;

/**
 * Check and clean a comments file's text. Throws a friendly error when it isn't one.
 * @returns {{design: {id: string, name: string, exportId: string}, reviewer: string, savedAt: string,
 *   comments: {page: number, x: number, y: number, text: string, at: string}[]}}
 */
export function parseComments(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("That file is empty.");
  if (text.length > MAX_BYTES) throw new Error("That comments file is too big.");
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("That isn't a comments file (it isn't JSON)."); }
  if (!data || typeof data !== "object" || data.kind !== COMMENTS_KIND) {
    throw new Error("That isn't a comments file from a review copy.");
  }
  if (!Array.isArray(data.comments)) throw new Error("That comments file has no comments.");
  const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const comments = [];
  for (const c of data.comments.slice(0, MAX_COMMENTS)) {
    if (!c || typeof c !== "object") continue;
    const x = Number(c.x), y = Number(c.y), page = Number(c.page);
    const t = str(c.text, MAX_TEXT);
    if (!t || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isInteger(page) || page < 0 || page > 999) continue;
    comments.push({ page, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)), text: t, at: str(c.at, 40) });
  }
  const d = data.design && typeof data.design === "object" ? data.design : {};
  return {
    design: { id: str(d.id, 80), name: str(d.name, 200), exportId: str(d.exportId, 120) },
    reviewer: str(data.reviewer, 80),
    savedAt: str(data.savedAt, 40),
    comments,
  };
}

// ---- storage -------------------------------------------------------------------------------------

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "designId" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbp = null; reject(req.error || new Error("The browser blocked local storage.")); };
    });
  }
  return dbp;
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

const listeners = new Set();
export function onComments(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = (designId) => listeners.forEach((fn) => fn(designId));

/** The comments kept for a design (oldest first). */
export async function listComments(designId) {
  if (!designId) return [];
  const rec = await tx("readonly", (s) => s.get(designId));
  return Array.isArray(rec?.list) ? rec.list : [];
}

async function saveList(designId, list) {
  await tx("readwrite", (s) => s.put({ designId, list, updated: Date.now() }));
  emit(designId);
}

const keyOf = (c) => `${c.reviewer}|${c.page}|${c.x.toFixed(3)}|${c.y.toFixed(3)}|${c.text}`;

/**
 * Add a parsed comments file to a design's comments (repeats are skipped).
 * @returns {Promise<{added: number, skipped: number, total: number}>}
 */
export async function addComments(designId, parsed) {
  const old = await listComments(designId);
  const seen = new Set(old.map(keyOf));
  const fresh = [];
  for (const c of parsed.comments) {
    const item = { id: `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, ...c, reviewer: parsed.reviewer, resolved: false };
    if (seen.has(keyOf(item))) continue;
    seen.add(keyOf(item));
    fresh.push(item);
  }
  const list = [...old, ...fresh];
  if (fresh.length) await saveList(designId, list);
  return { added: fresh.length, skipped: parsed.comments.length - fresh.length, total: list.length };
}

/** Mark one comment resolved (or open again). */
export async function setResolved(designId, id, resolved = true) {
  const list = (await listComments(designId)).map((c) => (c.id === id ? { ...c, resolved: Boolean(resolved) } : c));
  await saveList(designId, list);
  return list.find((c) => c.id === id) || null;
}

/**
 * Import a comments .json (from a review copy) into the open design.
 * @param {object} app
 * @param {File|Blob|string} file
 * @returns {Promise<{added: number, skipped: number, total: number, otherDesign: string|null}>}
 */
export async function importComments(app, file) {
  if (!app.project?.id) throw new Error("Open the design the comments are about first.");
  if (file && typeof file === "object" && file.size > MAX_BYTES) throw new Error("That comments file is too big.");
  const text = typeof file === "string" ? file : await file.text();
  const parsed = parseComments(text);
  if (!parsed.comments.length) throw new Error("That file has no comments in it.");
  const res = await addComments(app.project.id, parsed);
  const otherDesign = parsed.design.id && parsed.design.id !== app.project.id ? parsed.design.name || "another design" : null;
  return { ...res, otherDesign };
}
