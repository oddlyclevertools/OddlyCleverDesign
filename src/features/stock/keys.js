// Free Pexels and Pixabay keys. By default a key lives only in this module's memory and is gone on
// reload. If the user opts in ("Remember on this computer") it is also kept in IndexedDB
// `oddlyclever-stock`. Keys never go into designs, autosave, history, logs or the app's URL.
const DB_NAME = "oddlyclever-stock";
const STORE = "keys";

const memory = new Map(); // sourceId -> key
const remembered = new Set();
let loaded = null;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("This browser can't store keys.")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Couldn't open the key store."));
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error || new Error("The key store failed."));
      t.onabort = () => reject(t.error || new Error("The key store failed."));
    });
  } finally {
    db.close();
  }
}

/** Load remembered keys into memory once. Never throws. */
export function loadStockKeys() {
  if (!loaded) {
    loaded = (async () => {
      try {
        const db = await openDb();
        const entries = await new Promise((resolve, reject) => {
          const out = [];
          const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
          req.onsuccess = () => {
            const c = req.result;
            if (!c) { resolve(out); return; }
            out.push([String(c.key), c.value]);
            c.continue();
          };
          req.onerror = () => reject(req.error);
        });
        db.close();
        for (const [id, key] of entries) {
          if (typeof key !== "string" || !key) continue;
          remembered.add(id);
          if (!memory.has(id)) memory.set(id, key);
        }
      } catch { /* private mode: keys stay in memory only */ }
    })();
  }
  return loaded;
}

export const getStockKey = (id) => memory.get(id) || "";
export const hasStockKey = (id) => Boolean(memory.get(id));
export const isStockKeyRemembered = (id) => remembered.has(id);

/** Set a source's key. `remember` also keeps it in IndexedDB (off removes the stored copy). */
export async function setStockKey(id, key, { remember = false } = {}) {
  const clean = String(key || "").trim();
  if (clean && !/^[\w-]{8,200}$/.test(clean)) throw new Error("That doesn't look like a key. Copy it again from the site.");
  if (clean) memory.set(id, clean);
  else memory.delete(id);
  if (remember && clean) {
    await tx("readwrite", (s) => s.put(clean, id));
    remembered.add(id);
  } else if (remembered.has(id)) {
    await tx("readwrite", (s) => s.delete(id));
    remembered.delete(id);
  }
}

/** Remove the key from memory and from this computer. */
export async function forgetStockKey(id) {
  memory.delete(id);
  remembered.delete(id);
  try { await tx("readwrite", (s) => s.delete(id)); } catch { /* nothing stored */ }
}
