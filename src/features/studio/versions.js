// Version history: snapshots of a design in their own IndexedDB database, so they never
// touch the projects store. Record: { id, designId, at, label, auto, width, height, thumb, doc }.
const DB_NAME = "oddlyclever-versions";
const STORE = "versions";
export const MAX_PER_DESIGN = 40;
export const AUTO_EVERY_MS = 3 * 60 * 1000;

let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const s = req.result.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("designId", "designId");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error || new Error("Your browser blocked local storage."));
      };
    });
  }
  return dbPromise;
}

function run(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("Saving the version was cancelled (is the disk full?)."));
  }));
}

/** Versions of one design, newest first (with their documents). */
export async function listVersions(designId) {
  const all = await run("readonly", (s) => s.index("designId").getAll(designId));
  return (all || []).sort((a, b) => b.at - a.at);
}

export function getVersion(id) {
  return run("readonly", (s) => s.get(id));
}

/**
 * Store a snapshot, unless it's identical to the newest one. Keeps at most MAX_PER_DESIGN
 * versions per design, dropping the oldest automatic ones first.
 * @returns {Promise<object|null>} the stored record, or null when nothing changed
 */
export async function addVersion({ designId, label, auto, width, height, thumb, doc, at = Date.now() }) {
  if (!designId || !doc) throw new Error("A version needs a design and a document.");
  const docText = typeof doc === "string" ? doc : JSON.stringify(doc);
  const list = await listVersions(designId);
  if (list[0] && list[0].doc === docText) return null;
  const rec = {
    id: `v${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    designId, at, label, auto: Boolean(auto), width, height, thumb, doc: docText,
  };
  const extra = list.length + 1 - MAX_PER_DESIGN;
  // Over the cap: drop the oldest automatic versions first (list is newest first).
  const autosOldest = list.filter((v) => v.auto).reverse();
  const manualOldest = list.filter((v) => !v.auto).reverse();
  const victims = extra > 0 ? [...autosOldest, ...manualOldest].slice(0, extra) : [];
  await run("readwrite", (s) => {
    for (const v of victims) s.delete(v.id);
    return s.put(rec);
  });
  return rec;
}
