// Planner storage: its own IndexedDB database `oddlyclever-planner` (posts, and settings such as
// the repeating slots). Nothing leaves the computer.
import { DEFAULT_SLOTS } from "./model.js";

const DB_NAME = "oddlyclever-planner";
const POSTS = "posts";
const META = "meta";

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) { reject(new Error("This browser can't store the planner.")); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        const s = d.createObjectStore(POSTS, { keyPath: "id" });
        s.createIndex("date", "date");
        d.createObjectStore(META);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("The planner couldn't open its storage."));
    });
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}

function tx(store, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error || new Error("The planner storage had a problem."));
    t.onabort = () => reject(t.error || new Error("The planner storage had a problem (is the disk full?)."));
  }));
}

const listeners = new Set();
/** Called after any change; returns an unsubscribe function. */
export const onPlanChanged = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => listeners.forEach((fn) => { try { fn(); } catch { /* a closed view */ } });

export const getAllPosts = () => tx(POSTS, "readonly", (s) => s.getAll());
export const getPost = (id) => tx(POSTS, "readonly", (s) => s.get(id));
export async function putPost(post) {
  await tx(POSTS, "readwrite", (s) => s.put(post));
  changed();
  return post;
}
export async function deletePost(id) {
  await tx(POSTS, "readwrite", (s) => s.delete(id));
  changed();
}

/** The repeating slots (the user's schedule on first use). */
export async function getSlots() {
  const v = await tx(META, "readonly", (s) => s.get("slots"));
  return Array.isArray(v) ? v : DEFAULT_SLOTS.map((s) => ({ ...s, weekdays: [...s.weekdays], platforms: [...s.platforms] }));
}
export async function putSlots(slots) {
  await tx(META, "readwrite", (s) => s.put(slots, "slots"));
  changed();
  return slots;
}
