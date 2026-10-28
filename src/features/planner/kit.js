// The upload kit: one zip per post with the thumbnail/cover for each platform at its size (YouTube
// kept under 2 MB), title.txt, description.txt (with stock credits), tags.txt and checklist.txt.
// Designs are rendered off screen from the saved project, so the open design is never touched.
import { StaticCanvas } from "fabric";
import { sanitizeCanvas } from "../../core/sanitize.js";
import { ensureFontsFor } from "../../core/fonts.js";
import { creditsInObjects, creditsText } from "../stock/sources.js";
import { aiPicturesIn, checklistText, descriptionText, platformById, slug, tagsText } from "./model.js";
import { makeZip } from "./zip.js";

const MAX_RENDER_SCALE = 4;

/** The saved document of a project (the open design's live state if it's the one open). */
async function docOf(app, id) {
  if (app.project?.id === id) return { name: app.project.name, doc: app.editor.toJSON() };
  const rec = await app.store.getProject(id);
  return { name: rec.name, doc: rec.doc };
}

/** Render a saved design to a canvas covering w x h (centre crop when the shapes differ). */
export async function renderDocAt(doc, w, h) {
  const W = Number(doc.width), H = Number(doc.height);
  if (!(W > 0 && H > 0)) throw new Error("That design has no page size.");
  const { canvas: json } = sanitizeCanvas(doc.canvas);
  await ensureFontsFor(json.objects);
  const scale = Math.min(MAX_RENDER_SCALE, Math.max(w / W, h / H));
  const host = document.createElement("canvas");
  const sc = new StaticCanvas(host, { width: W, height: H, renderOnAddRemove: false, enableRetinaScaling: false });
  let full;
  try {
    await sc.loadFromJSON(json);
    full = sc.toCanvasElement(scale, { left: 0, top: 0, width: W, height: H, filter: (o) => o.visible !== false && !o.data?.guide });
  } finally {
    sc.dispose();
  }
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const k = Math.max(w / full.width, h / full.height);
  const dw = full.width * k, dh = full.height * k;
  ctx.drawImage(full, (w - dw) / 2, (h - dh) / 2, dw, dh);
  const cropped = Math.abs(W / H - w / h) / (w / h) > 0.02;
  return { canvas: out, cropped };
}

const toBlob = (c, type, q) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("The picture couldn't be made."))), type, q));

/** PNG, or a JPEG small enough for `maxBytes` when the PNG is too big. */
export async function encodeThumb(canvas, maxBytes = 0) {
  const png = await toBlob(canvas, "image/png");
  if (!maxBytes || png.size <= maxBytes) return { blob: png, ext: "png" };
  for (let q = 0.92; q >= 0.5; q -= 0.07) {
    const jpg = await toBlob(canvas, "image/jpeg", q);
    if (jpg.size <= maxBytes) return { blob: jpg, ext: "jpg" };
  }
  throw new Error("The thumbnail couldn't be made small enough (2 MB). Simplify the design and try again.");
}

/**
 * Build a post's upload kit.
 * @returns {Promise<{bytes: Uint8Array, filename: string, files: string[], aiPictures: string[], credits: object[], notes: string[]}>}
 */
export async function buildKit(app, post, { onProgress } = {}) {
  const files = [], thumbs = [], notes = [], missing = [];
  const docs = new Map(); // project id -> {name, doc}
  const rendered = new Map(); // `${id}|${w}x${h}` -> file name
  const getDoc = async (id) => {
    if (!docs.has(id)) {
      try { docs.set(id, await docOf(app, id)); } catch { docs.set(id, null); notes.push("A linked design is no longer in this browser."); }
    }
    return docs.get(id);
  };
  let step = 0;
  for (const pid of post.platforms) {
    const p = platformById(pid);
    onProgress?.(++step / (post.platforms.length + 1), `Making the ${p.short} picture…`);
    const designId = post.designs?.[pid] || post.designId;
    const rec = designId ? await getDoc(designId) : null;
    if (!rec) { missing.push(pid); continue; }
    const { w, h, maxBytes = 0 } = p.thumb;
    const key = `${designId}|${w}x${h}|${maxBytes}`;
    if (rendered.has(key)) { thumbs.push({ ...rendered.get(key), platform: pid }); continue; }
    const { canvas, cropped } = await renderDocAt(rec.doc, w, h);
    const { blob, ext } = await encodeThumb(canvas, maxBytes);
    const file = `${pid === "youtube" || pid === "rumble" || pid === "facebook" ? "thumbnail" : "cover"}-${pid}-${w}x${h}.${ext}`;
    files.push({ name: file, data: new Uint8Array(await blob.arrayBuffer()) });
    const t = { platform: pid, file, w, h, bytes: blob.size, cropped };
    rendered.set(key, t);
    thumbs.push(t);
    if (ext === "jpg") notes.push(`${p.short}: saved as JPG to stay under ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`);
  }
  const objects = [...docs.values()].filter(Boolean).flatMap((r) => [r.doc?.canvas, ...(r.doc?.pages || []).map((p) => p?.canvas)].flatMap((c) => c?.objects || []));
  const credits = creditsInObjects(objects);
  const aiPictures = aiPicturesIn(objects);
  const block = creditsText(credits);
  files.push(
    { name: "title.txt", data: `${post.title}\n` },
    { name: "description.txt", data: descriptionText(post, block) },
    { name: "tags.txt", data: tagsText(post) },
    { name: "checklist.txt", data: checklistText(post, { thumbs, aiPictures, credits: credits.length, missing }) },
  );
  onProgress?.(1, "Packing the zip…");
  const bytes = makeZip(files);
  const filename = `${slug(post.title)}${post.date ? `-${post.date}` : ""}-upload-kit.zip`;
  return { bytes, filename, files: files.map((f) => f.name), aiPictures, credits, notes };
}

/** Save bytes as a file download. */
export function saveBytes(bytes, filename, type = "application/zip") {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
