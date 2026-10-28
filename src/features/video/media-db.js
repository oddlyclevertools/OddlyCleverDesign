// The media library: video and sound files kept in their own IndexedDB database, shared by every
// design (like the image uploads). Designs only store a media id, never the file itself.
// Record: { id, name, type, kind: "video"|"audio", size, blob, duration, width?, height?,
//           hasAudio, thumb? (small data URL), peaks? (Float32Array: min,max pairs), peakRate,
//           beats? ({ bpm, beats: number[] }), added }
const DB_NAME = "oddlyclever-media";
const STORE = "media";

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
      req.onerror = () => reject(req.error || new Error("The media library couldn't be opened."));
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
    t.onerror = () => reject(t.error || new Error("The media library had a problem."));
    t.onabort = () => reject(t.error || new Error("The media library had a problem (maybe the disk is full)."));
  }));
}

const listeners = new Set();
/** Call fn whenever the library changes. Returns an unsubscribe function. */
export const onMediaChanged = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => listeners.forEach((fn) => { try { fn(); } catch { /* a listener's own problem */ } });

/** Every media file, newest first, without the file and the analysis (light). */
export async function listMedia() {
  const all = await tx("readonly", (s) => s.getAll());
  return all.map(({ blob, peaks, ...rest }) => rest).sort((a, b) => b.added - a.added);
}

/** One full record (with its blob), or null. */
export async function getMedia(id) {
  return (await tx("readonly", (s) => s.get(id))) || null;
}

/** Store a new media record; returns it with its id. */
export async function saveMedia(rec) {
  const full = { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, added: Date.now(), ...rec };
  await tx("readwrite", (s) => s.put(full));
  changed();
  return full;
}

/** Merge fields into a record (analysis results). The stored record is replaced, not edited. */
export async function patchMedia(id, patch) {
  const cur = await getMedia(id);
  if (!cur) return null;
  const next = { ...cur, ...patch };
  await tx("readwrite", (s) => s.put(next));
  changed();
  return next;
}

export async function deleteMedia(id) {
  await tx("readwrite", (s) => s.delete(id));
  changed();
}
