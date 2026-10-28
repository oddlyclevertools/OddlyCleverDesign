// Projects live in the browser's IndexedDB (nothing leaves the PC). One record per design:
// { id, name, width, height, pages (count), updated, thumb (JPEG data URL), doc (editor.toJSON()) }.
const DB_NAME = "oddlyclever-design";
const STORE = "projects";
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const s = req.result.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("updated", "updated");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Your browser blocked local storage."));
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("Saving was cancelled (is the disk full?)."));
  }));
}

/** All projects, newest first, without their full documents. */
export async function listProjects() {
  const all = await tx("readonly", (s) => s.getAll());
  return all
    .map(({ doc, ...meta }) => meta)
    .sort((a, b) => b.updated - a.updated);
}

export async function getProject(id) {
  const rec = await tx("readonly", (s) => s.get(id));
  if (!rec) throw new Error("That design isn't in this browser any more.");
  return rec;
}

/** Insert or replace a project record. */
export async function saveProject(rec) {
  if (!rec?.id || !rec.doc) throw new Error("A project needs an id and a document.");
  const pages = Array.isArray(rec.doc.pages) && rec.doc.pages.length ? rec.doc.pages.length : 1;
  const clean = { ...rec, pages, updated: Date.now() };
  await tx("readwrite", (s) => s.put(clean));
  return clean;
}

export async function deleteProject(id) {
  await tx("readwrite", (s) => s.delete(id));
}

export const newProjectId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
