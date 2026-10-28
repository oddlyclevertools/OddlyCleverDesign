// The uploads library: images kept in their own IndexedDB database, shared by every design.
// Record: { id, name, type, width, height, src (data URL, at most 4096 px), thumb, added }.
const DB_NAME = "oddlyclever-uploads";
const STORE = "uploads";

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const s = req.result.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("added", "added");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("The uploads library couldn't be opened."));
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
    t.onerror = () => reject(t.error || new Error("The uploads library had a problem."));
    t.onabort = () => reject(t.error || new Error("The uploads library had a problem (maybe it's full)."));
  }));
}

const listeners = new Set();
export const onUploadsChanged = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => listeners.forEach((fn) => fn());

/** Every upload, newest first, without the full image (src) to keep it light. */
export async function listUploads() {
  const all = await tx("readonly", (s) => s.getAll());
  return all.map(({ src, ...rest }) => rest).sort((a, b) => b.added - a.added);
}

export async function getUpload(id) {
  return tx("readonly", (s) => s.get(id));
}

export async function saveUpload(rec) {
  const full = { id: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, added: Date.now(), ...rec };
  await tx("readwrite", (s) => s.put(full));
  changed();
  return full;
}

export async function deleteUpload(id) {
  await tx("readwrite", (s) => s.delete(id));
  changed();
}
