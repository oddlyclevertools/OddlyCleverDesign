// Your own fonts: upload a .ttf / .otf / .woff / .woff2, keep it in IndexedDB and register it
// with document.fonts (FontFace) on every start, before any design opens, so designs that use
// it measure and render with it after a reload. The text feature's font picker lists them.
import { FONTS } from "../../core/fonts.js";
import { toast } from "../../ui/kit.js";
import { listFonts, putFont, deleteFont } from "./brand-db.js";

const MAX_BYTES = 15 * 1024 * 1024;
const EXT = /\.(ttf|otf|woff2?)$/i;

let fonts = []; // [{ id, family, fileName, size }]
const faces = new Map(); // id -> FontFace
const listeners = new Set();
let ready = null;

export const userFonts = () => fonts.slice();
export const isUserFont = (family) => fonts.some((f) => f.family === family);
export function onUserFontsChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach((fn) => { try { fn(userFonts()); } catch { /* a listener's own problem */ } });

async function register(rec) {
  const face = new FontFace(rec.family, rec.data, { display: "block" });
  await face.load();
  document.fonts.add(face);
  faces.set(rec.id, face);
}

/** Load every stored font once. Never rejects (a broken font is skipped). */
export function loadUserFonts() {
  if (ready) return ready;
  ready = (async () => {
    let recs = [];
    try { recs = await listFonts(); } catch { return []; }
    const ok = [];
    await Promise.all(recs.map(async (r) => {
      try {
        await register(r);
        ok.push({ id: r.id, family: r.family, fileName: r.fileName, size: r.size, added: r.added });
      } catch { /* damaged font data: leave it out */ }
    }));
    fonts = ok.sort((a, b) => (a.added || 0) - (b.added || 0));
    emit();
    return userFonts();
  })();
  return ready;
}

/** Resolves once stored fonts are registered (or after `ms`, so a slow disk never blocks). */
export function userFontsReady(ms = 4000) {
  return Promise.race([loadUserFonts(), new Promise((r) => setTimeout(r, ms))]);
}

/** Read the family name from a font file (TTF/OTF, and WOFF via DecompressionStream). */
async function nameFromFile(buf) {
  try {
    const v = new DataView(buf);
    const sig = v.getUint32(0);
    let name = null;
    if (sig === 0x774f4646) name = await woffNameTable(buf); // "wOFF"
    else if (sig === 0x00010000 || sig === 0x4f54544f || sig === 0x74727565) name = sfntNameTable(buf);
    return name ? readNames(name) : null;
  } catch {
    return null;
  }
}

function sfntNameTable(buf) {
  const v = new DataView(buf);
  const n = v.getUint16(4);
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    if (v.getUint32(o) === 0x6e616d65) return new DataView(buf, v.getUint32(o + 8), v.getUint32(o + 12)); // "name"
  }
  return null;
}

async function woffNameTable(buf) {
  const v = new DataView(buf);
  const n = v.getUint16(12);
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20;
    if (v.getUint32(o) !== 0x6e616d65) continue;
    const off = v.getUint32(o + 4), comp = v.getUint32(o + 8), orig = v.getUint32(o + 12);
    const slice = buf.slice(off, off + comp);
    if (comp === orig) return new DataView(slice);
    if (typeof DecompressionStream !== "function") return null;
    const out = await new Response(new Blob([slice]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer();
    return new DataView(out);
  }
  return null;
}

function readNames(t) {
  const count = t.getUint16(2), strOff = t.getUint16(4);
  const got = {};
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 12;
    const platform = t.getUint16(o), id = t.getUint16(o + 6), len = t.getUint16(o + 8), off = t.getUint16(o + 10);
    if (![1, 2, 16, 17].includes(id)) continue;
    let s = "";
    if (platform === 3 || platform === 0) {
      for (let k = 0; k < len; k += 2) s += String.fromCharCode(t.getUint16(strOff + off + k));
      got[id] = s; // Windows / Unicode names win
    } else if (platform === 1 && !got[id]) {
      for (let k = 0; k < len; k++) s += String.fromCharCode(t.getUint8(strOff + off + k));
      got[id] = s;
    }
  }
  const family = (got[16] || got[1] || "").trim();
  const sub = (got[17] || got[2] || "").trim();
  if (!family) return null;
  return sub && !/^(regular|normal|book|roman)$/i.test(sub) ? `${family} ${sub}` : family;
}

const NOISE = /^(latin|ext|cyrillic|greek|vietnamese|hebrew|arabic|normal|regular|webfont|subset|variable|vf|\d{3})$/i;

/** "black-ops-one-latin-400-normal.woff2" -> "Black Ops One". */
function nameFromFileName(fileName) {
  const words = fileName.replace(EXT, "").replace(/([a-z])([A-Z])/g, "$1 $2").split(/[-_\s]+/).filter((w) => w && !NOISE.test(w));
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ").trim() || "My font";
}

/** A family name nobody else uses (bundled fonts and your other fonts). */
function uniqueFamily(name) {
  const clean = name.replace(/["\\;{}<>]/g, "").slice(0, 60).trim() || "My font";
  const taken = (n) => Boolean(FONTS[n]) || fonts.some((f) => f.family === n);
  if (!taken(clean)) return clean;
  if (!taken(`${clean} (yours)`)) return `${clean} (yours)`;
  for (let i = 2; ; i++) if (!taken(`${clean} ${i}`)) return `${clean} ${i}`;
}

/** Add a font file. Resolves to the new font's record. Throws a friendly Error. */
export async function addFontFile(file) {
  if (!file) throw new Error("No file chosen.");
  if (!EXT.test(file.name)) throw new Error(`${file.name} isn't a font. Use a .ttf, .otf, .woff or .woff2 file.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is too big (over 15 MB).`);
  await loadUserFonts();
  const data = await file.arrayBuffer();
  const family = uniqueFamily((await nameFromFile(data)) || nameFromFileName(file.name));
  const rec = { id: `uf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, family, fileName: file.name, type: file.type, data, size: file.size, added: Date.now() };
  try {
    await register(rec);
  } catch {
    throw new Error(`${file.name} couldn't be read as a font. It may be damaged.`);
  }
  try {
    await putFont(rec);
  } catch (e) {
    document.fonts.delete(faces.get(rec.id));
    faces.delete(rec.id);
    throw new Error(`Couldn't keep the font in this browser: ${e.message}`);
  }
  fonts = [...fonts, { id: rec.id, family, fileName: file.name, size: file.size, added: rec.added }];
  emit();
  return fonts[fonts.length - 1];
}

export async function removeFont(id) {
  await deleteFont(id);
  const face = faces.get(id);
  if (face) document.fonts.delete(face);
  faces.delete(id);
  fonts = fonts.filter((f) => f.id !== id);
  emit();
}

/** Open the file chooser for font files. Resolves to the chosen files (maybe none). */
export function chooseFontFiles() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2";
    input.multiple = true;
    input.addEventListener("change", () => resolve([...(input.files || [])]));
    input.addEventListener("cancel", () => resolve([]));
    input.click();
  });
}

/** Upload font files with toasts. Shared with the font picker. */
export async function uploadFonts(files) {
  const added = [];
  for (const f of files) {
    try {
      added.push(await addFontFile(f));
    } catch (e) {
      toast(e.message, { error: true, ms: 5000 });
    }
  }
  if (added.length) toast(added.length === 1 ? `Added the font "${added[0].family}".` : `Added ${added.length} fonts.`);
  return added;
}

