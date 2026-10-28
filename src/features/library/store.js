// "My library": templates and elements saved by the user or made by their AI, kept in this
// browser (IndexedDB "oddlyclever-library") and shared by every design.
// Record: { id, kind: "template"|"element", name, tags: string[], w, h, doc (objects JSON;
// templates also keep the page background), thumb (small JPEG data URL), by: "you"|"ai", added }.
import { sanitizeObjects } from "../../core/sanitize.js";

const DB_NAME = "oddlyclever-library";
const STORE = "items";
const MAX_DOC_CHARS = 30_000_000;

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Your library couldn't be opened."));
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error || new Error("Your library had a problem."));
    t.onabort = () => reject(t.error || new Error("Your library had a problem (maybe the disk is full)."));
  }));
}

const listeners = new Set();
export const onLibraryChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => listeners.forEach((fn) => fn());

/** Every item of a kind, newest first. */
export async function listLibrary(kind) {
  const all = await tx("readonly", (s) => s.getAll());
  return all.filter((r) => !kind || r.kind === kind).sort((a, b) => b.added - a.added);
}

export async function getLibraryItem(id) {
  return tx("readonly", (s) => s.get(id));
}

/** Save a new item; returns it. The objects are cleaned the same way an opened file is. */
export async function saveLibraryItem({ kind, name, tags = [], w, h, objects, background, thumb, by = "you" }) {
  if (!["template", "element"].includes(kind)) throw new Error("Only templates and elements go in the library.");
  const clean = sanitizeObjects(objects).objects;
  if (!clean.length) throw new Error("There's nothing to save.");
  const doc = { objects: clean, ...(typeof background === "string" || (background && typeof background === "object") ? { background } : {}) };
  if (JSON.stringify(doc).length > MAX_DOC_CHARS) throw new Error("That's too big to save in the library (over 30 MB).");
  const rec = {
    id: `${kind === "template" ? "my-" : "mye-"}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    kind, name: String(name || "Untitled").trim().slice(0, 80) || "Untitled",
    tags: tags.map((t) => String(t).trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 12),
    w: Math.round(w), h: Math.round(h), doc, thumb, by, added: Date.now(),
  };
  await tx("readwrite", (s) => s.put(rec));
  changed();
  return rec;
}

/** Remove an item from the library (designs that already use it keep their copy). */
export async function deleteLibraryItem(id) {
  await tx("readwrite", (s) => s.delete(id));
  changed();
}
