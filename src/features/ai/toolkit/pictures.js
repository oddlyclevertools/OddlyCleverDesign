// Real pictures for the AI: find and place the user's own pictures from "My folders", make new
// pictures with the user's image AI, and give any picture a photo look (polaroid, split light,
// black and white with grain). Placed pictures are kept at most 2048 px on the long side.
import { Shadow } from "fabric";
import { OcImage, loadElement } from "../../elements/images.js";
import { findPictures, pictureFile } from "../pictures/folders.js";
import { generatePicture, pictureAllowance } from "../pictures/generate.js";
import { bakeLook } from "../pictures/looks.js";
import { brief, collisionNote, editorOf, findObjects, json, keepOnPage, kindOf, overlapWarning, place, step } from "./context.js";
import { ToolInputError } from "./validate.js";
import { pictureByRef, pictureData } from "./collage.js";

const LONG_SIDE = 2048;
const SHEET_CELL = { w: 240, h: 150, cols: 4 };

const result = (ed, o, extra = {}, fix = "") => {
  const note = [fix || overlapWarning(ed, o), collisionNote(ed, o)].filter(Boolean).join(" ");
  return { text: json({ added: brief(o), page: { w: ed.width, h: ed.height }, ...extra, ...(note ? { note } : {}) }) };
};

/** A picture source drawn at most LONG_SIDE, as a data URL (PNG keeps transparency). */
async function shrink(blobOrUrl, keepAlpha) {
  const src = typeof blobOrUrl === "string" ? await loadElement(blobOrUrl) : await createImageBitmap(blobOrUrl);
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
  const k = Math.min(1, LONG_SIDE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  src.close?.();
  return keepAlpha ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.9);
}

/** Bake a look into the picture of an image object, keeping the photo's size and centre. */
async function applyLook(o, look, { caption, line } = {}) {
  const shownW = o.getScaledWidth();
  const centre = o.getCenterPoint();
  const baked = await bakeLook(o._element, look, { caption, line });
  const el = await loadElement(baked.toDataURL("image/jpeg", 0.9));
  o.setElement(el);
  // The photo keeps its size on the page; a polaroid's paper grows around it.
  const k = shownW / (baked.photoWidth || baked.width);
  o.set({ scaleX: k, scaleY: k, data: { ...(o.data || {}), look } });
  if (look === "polaroid") {
    if (!o.angle) o.rotate(-4);
    o.set("shadow", new Shadow({ color: "rgba(0,0,0,0.55)", blur: 28, offsetX: 0, offsetY: 14 }));
  }
  o.setPositionByOrigin(centre, "center", "center");
  o.setCoords();
  o.dirty = true;
}

async function addPicture(app, src, inp, label, extra, { signal }) {
  const ed = editorOf(app);
  const el = await loadElement(src);
  const o = new OcImage(el, { name: inp.name || label, data: { kind: "image", ...(extra?.made_with ? { made_with: extra.made_with } : {}) } });
  o.scale(Math.min(1, (ed.width * 0.62) / o.width, (ed.height * 0.62) / o.height));
  return step(app, `Add ${label.slice(0, 30)}`, async () => {
    ed.add(o, { center: true, select: false, name: inp.name || label });
    let fix = place(o, inp, ed);
    if (inp.look) { // a polaroid's paper grows past the photo: check the border again
      await applyLook(o, inp.look, inp);
      fix = keepOnPage(ed, o, inp) || fix;
    }
    return result(ed, o, extra, fix);
  }, { signal });
}

// ---- find_my_pictures -------------------------------------------------------------------------

async function contactSheet(files) {
  const { w, h, cols } = SHEET_CELL;
  const rows = Math.ceil(files.length / cols);
  const c = document.createElement("canvas");
  c.width = cols * w;
  c.height = rows * h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = "bold 22px Inter, Arial, sans-serif";
  for (const [i, f] of files.entries()) {
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    try {
      const bmp = await createImageBitmap(await f.handle.getFile());
      const k = Math.min((w - 8) / bmp.width, (h - 8) / bmp.height);
      ctx.drawImage(bmp, x + (w - bmp.width * k) / 2, y + (h - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
      bmp.close();
    } catch { ctx.fillStyle = "#555"; ctx.fillRect(x + 4, y + 4, w - 8, h - 8); }
    ctx.fillStyle = "#ff2e7e";
    ctx.fillRect(x + 4, y + 4, 34, 30);
    ctx.fillStyle = "#fff";
    ctx.fillText(String(i + 1), x + 10, y + 27);
  }
  return c.toDataURL("image/jpeg", 0.8).split(",")[1];
}

export async function findMyPictures(app, inp) {
  let found;
  try { found = await findPictures(inp.search || "", { folder: inp.folder || "", limit: inp.limit || 12 }); } catch (e) { throw new ToolInputError(e.message); }
  if (!found.results.length) {
    return { text: `No pictures match "${inp.search}" in ${found.folders.join(", ")}. Try other words (file and folder names), or generate_image.` };
  }
  const list = found.results.map((f, i) => `${i + 1}. ${f.folder}/${f.path}`);
  const head = `${found.total} match${found.total === 1 ? "" : "es"}${found.truncated ? " (folder too big: only part was searched)" : ""}; showing ${found.results.length}. The picture shows them numbered. Place one with add_my_picture and its path:`;
  return { text: [head, ...list].join("\n"), image: { mediaType: "image/jpeg", data: await contactSheet(found.results) } };
}

// ---- add_my_picture -----------------------------------------------------------------------------

export async function addMyPicture(app, inp, opts) {
  let file;
  try { file = await pictureFile(inp.picture); } catch (e) { throw new ToolInputError(e.message); }
  const src = await shrink(file, /png|webp|gif/i.test(file.type));
  return addPicture(app, src, inp, file.name.replace(/\.[^.]+$/, ""), { from: inp.picture }, opts);
}

// ---- generate_image ---------------------------------------------------------------------------

export async function generateImage(app, inp, opts) {
  const ed = editorOf(app);
  const references = (inp.like || []).map((r) => pictureData(pictureByRef(ed, r)));
  let made;
  try { made = await generatePicture({ prompt: inp.prompt, aspect: inp.aspect, quality: inp.quality, references }, opts); } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new ToolInputError(e.message);
  }
  const src = await shrink(made.src, false);
  const left = pictureAllowance();
  const extra = { made_with: made.model, pictures_left: `${left.left} of ${left.max} in the next ${left.minutes} minutes`,
    ...(references.length ? { used_references: made.usedReferences } : {}), ...(made.note ? { reference_note: made.note } : {}) };
  return addPicture(app, src, inp, inp.name || "AI picture", extra, opts);
}

// ---- photo_look ---------------------------------------------------------------------------------

export async function photoLook(app, inp, { signal }) {
  const ed = editorOf(app);
  const [o] = findObjects(ed, [inp.id]);
  if (!["image", "frame"].includes(kindOf(o)) || !o._element) throw new ToolInputError(`"${inp.id}" is a ${kindOf(o)}. photo_look works on pictures (image objects).`);
  return step(app, `Photo look: ${inp.look.replace(/_/g, " ")}`, async () => {
    await applyLook(o, inp.look, inp);
    const fix = keepOnPage(ed, o, {});
    return { text: json({ updated: brief(o), look: inp.look, ...(fix ? { note: fix } : {}) }) };
  }, { signal });
}
