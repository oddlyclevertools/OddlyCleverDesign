// IndexedDB for the brand kit and uploaded fonts (database "oddlyclever-brand").
//   kit:   one record { id: "kit", colors: [hex], head: {family, weight}, body: {family, weight}, logos: [{id, name, src}] }
//   fonts: { id, family, fileName, type, data: ArrayBuffer, size, added }
const DB_NAME = "oddlyclever-brand";
const VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("This browser can't store a brand kit."));
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kit")) db.createObjectStore("kit", { keyPath: "id" });
      if (!db.objectStoreNames.contains("fonts")) db.createObjectStore("fonts", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Couldn't open the brand kit storage."));
    req.onblocked = () => reject(new Error("The brand kit storage is busy in another tab."));
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    const req = fn(s);
    if (req) req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error || new Error("Brand kit storage failed."));
    t.onabort = () => reject(t.error || new Error("Brand kit storage was interrupted (is the disk full?)."));
  });
}

export const EMPTY_KIT = Object.freeze({ id: "kit", colors: [], head: null, body: null, logos: [] });

export async function getKit() {
  const k = await tx("kit", "readonly", (s) => s.get("kit"));
  return k ? { ...EMPTY_KIT, ...k } : { ...EMPTY_KIT };
}

export async function saveKit(kit) {
  const clean = {
    id: "kit",
    colors: (kit.colors || []).slice(0, 16),
    head: kit.head || null,
    body: kit.body || null,
    logos: (kit.logos || []).slice(0, 12),
  };
  await tx("kit", "readwrite", (s) => s.put(clean));
  for (const fn of kitListeners) fn(clean);
  return clean;
}

const kitListeners = new Set();
/** Call fn(kit) after every save of the kit. Returns an unsubscribe function. */
export function onKitChanged(fn) {
  kitListeners.add(fn);
  return () => kitListeners.delete(fn);
}

export const listFonts = () => tx("fonts", "readonly", (s) => s.getAll()).then((r) => r || []);
export const putFont = (rec) => tx("fonts", "readwrite", (s) => s.put(rec));
export const deleteFont = (id) => tx("fonts", "readwrite", (s) => s.delete(id));
