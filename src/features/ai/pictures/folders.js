// "My folders": picture folders on this PC the user lets the app read, so the AI can find and
// place their own art and photos. Uses the browser's folder access (Chrome and Edge): the user
// picks each folder once; the app may only READ it, and Chrome asks again in each new session
// ("Allow" in the panel). The remembered folder handles live in IndexedDB `oddlyclever-folders`.
// Nothing is uploaded: a picture leaves the PC only if it is placed in a design that the user
// then sends to a cloud AI.

const DB_NAME = "oddlyclever-folders";
const STORE = "folders";
const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;
const SKIP_DIR = /^(\.|node_modules$|__pycache__$|\$recycle\.bin$|system volume information$)/i;
const MAX_DEPTH = 8;
const MAX_FILES = 12000;     // per folder
const SCAN_MS = 20000;       // give up walking a huge tree after this long

export const canUseFolders = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

// ---- remembered folders ---------------------------------------------------------------------

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Couldn't open the folder list."));
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const out = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(out?.result ?? out);
      t.onerror = () => reject(t.error || new Error("The folder list couldn't be changed."));
    });
  } finally {
    db.close();
  }
}

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
export function onFoldersChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

const indexes = new Map(); // folder id -> { files, truncated, at }

/** Remembered folders with their permission state ("granted" or "prompt"). */
export async function listFolders() {
  const all = (await tx("readonly", (s) => s.getAll())) || [];
  return Promise.all(all.map(async (f) => {
    let state = "prompt";
    try { state = await f.handle.queryPermission({ mode: "read" }); } catch { /* handle gone */ }
    return { id: f.id, name: f.name, added: f.added, state, count: indexes.get(f.id)?.files.length ?? null };
  }));
}

/** Ask the user to pick a folder (must run from a click). Returns the folder, or null if cancelled. */
export async function addFolder() {
  if (!canUseFolders()) throw new Error("This browser can't open folders. Use Chrome or Edge.");
  let handle;
  try {
    handle = await window.showDirectoryPicker({ id: "oc-pictures", mode: "read" });
  } catch (e) {
    if (e?.name === "AbortError") return null;
    throw new Error("Couldn't open that folder.");
  }
  return addFolderHandle(handle);
}

/** Remember a folder handle (from the picker; tests pass a private-storage folder). */
export async function addFolderHandle(handle) {
  const all = (await tx("readonly", (s) => s.getAll())) || [];
  for (const f of all) {
    try { if (await f.handle.isSameEntry(handle)) return { id: f.id, name: f.name }; } catch { /* stale */ }
  }
  const folder = { id: `fold${Date.now().toString(36)}`, name: handle.name, handle, added: Date.now() };
  await tx("readwrite", (s) => s.put(folder));
  emit();
  return { id: folder.id, name: folder.name };
}

/** Forget a folder (the app stops reading it; nothing on disk changes). */
export async function removeFolder(id) {
  await tx("readwrite", (s) => s.delete(id));
  indexes.delete(id);
  emit();
}

/** Re-grant read access to every remembered folder (must run from a click). */
export async function allowFolders() {
  const all = (await tx("readonly", (s) => s.getAll())) || [];
  let ok = 0;
  for (const f of all) {
    try { if ((await f.handle.requestPermission({ mode: "read" })) === "granted") ok++; } catch { /* skipped */ }
  }
  emit();
  return ok;
}

// ---- reading -----------------------------------------------------------------------------------

async function grantedHandles() {
  const all = (await tx("readonly", (s) => s.getAll())) || [];
  if (!all.length) throw new Error("No picture folders yet. Ask the user to add one under “My folders” in the Ask AI panel.");
  const out = [];
  for (const f of all) {
    try { if ((await f.handle.queryPermission({ mode: "read" })) === "granted") out.push(f); } catch { /* stale */ }
  }
  if (!out.length) throw new Error("The user's picture folders need permission again: ask them to click “Allow” under My folders in the Ask AI panel.");
  return out;
}

async function scan(folder) {
  const have = indexes.get(folder.id);
  if (have) return have;
  const files = [];
  const t0 = performance.now();
  let truncated = false;
  async function walk(dir, path, depth) {
    for await (const [name, h] of dir.entries()) {
      if (files.length >= MAX_FILES || performance.now() - t0 > SCAN_MS) { truncated = true; return; }
      if (h.kind === "directory") {
        if (depth < MAX_DEPTH && !SKIP_DIR.test(name)) await walk(h, `${path}${name}/`, depth + 1);
      } else if (IMAGE_EXT.test(name)) {
        files.push({ folderId: folder.id, folder: folder.name, path: `${path}${name}`, name, handle: h });
      }
    }
  }
  await walk(folder.handle, "", 0);
  const index = { files, truncated, at: Date.now() };
  indexes.set(folder.id, index);
  emit();
  return index;
}

/** Forget the cached file lists (after the user adds pictures on disk). */
export function rescan() { indexes.clear(); emit(); }

const words = (s) => String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Pictures whose folder path or file name match the search words, best first.
 * @returns {Promise<{ results: object[], total: number, truncated: boolean, folders: string[] }>}
 */
export async function findPictures(search, { folder = "", limit = 12 } = {}) {
  const folders = (await grantedHandles()).filter((f) => !folder || f.name.toLowerCase() === folder.toLowerCase());
  if (!folders.length) throw new Error(`No allowed folder called "${folder}".`);
  const want = words(search);
  const scored = [];
  let truncated = false;
  for (const f of folders) {
    const idx = await scan(f);
    truncated ||= idx.truncated;
    for (const file of idx.files) {
      const hay = file.path.toLowerCase();
      const hits = want.filter((w) => hay.includes(w)).length;
      if (want.length && !hits) continue;
      const nameHits = want.filter((w) => file.name.toLowerCase().includes(w)).length;
      scored.push({ file, score: hits * 2 + nameHits });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.file.path.length - b.file.path.length);
  return { results: scored.slice(0, limit).map((s) => s.file), total: scored.length, truncated, folders: folders.map((f) => f.name) };
}

/** The file for "folder/path" (as find_my_pictures lists it). */
export async function pictureFile(ref) {
  const clean = String(ref || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const slash = clean.indexOf("/");
  const folderName = slash > 0 ? clean.slice(0, slash) : "";
  const path = slash > 0 ? clean.slice(slash + 1) : clean;
  for (const f of await grantedHandles()) {
    if (folderName && f.name.toLowerCase() !== folderName.toLowerCase()) continue;
    const hit = (await scan(f)).files.find((x) => x.path.toLowerCase() === path.toLowerCase());
    if (hit) return hit.handle.getFile();
  }
  throw new Error(`No picture "${ref}" in the allowed folders. Use a path exactly as find_my_pictures listed it.`);
}
