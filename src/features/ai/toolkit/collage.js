// Collages for the AI: a photo grid laid over the page (or a box on it) with every cell filled
// at once, each picture cover-cropped around its subject. A cell's picture can be one already on
// the page (moved in), one of the user's own pictures, or a new AI picture, which may be made
// "like" earlier pictures (the same person, the same shop) by sending those as references.
import { Point } from "fabric";
import { GRID_LAYOUTS, createGrid, fillCell } from "../../elements/grids.js";
import { loadElement } from "../../elements/images.js";
import { pictureFile } from "../pictures/folders.js";
import { generatePicture, pictureAllowance } from "../pictures/generate.js";
import { brief, editorOf, json, kindOf, step } from "./context.js";
import { pick } from "./rules.js";
import { ToolInputError } from "./validate.js";

const REF_SIDE = 1024;
const FOCUS = { top: [0.5, 0.15], bottom: [0.5, 0.85], left: [0.15, 0.5], right: [0.85, 0.5], center: [0.5, 0.5] };

/** A picture element drawn at most `side` px, as a data URL. */
export function pictureData(el, side = REF_SIDE, type = "image/jpeg") {
  const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
  const k = Math.min(1, side / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(el, 0, 0, c.width, c.height);
  return c.toDataURL(type, 0.88);
}

/**
 * The picture element behind a reference: an image id ("o12"), or a collage cell as
 * "<collage id>:<cell number>" (1-based, as make_collage lists them).
 */
export function pictureByRef(ed, ref) {
  const [id, cellNo] = String(ref).split(":");
  const o = ed.objects().find((x) => x.id === id);
  if (!o) throw new ToolInputError(`No picture with id "${id}". Call get_design for ids.`);
  if (cellNo !== undefined) {
    const cell = o.data?.kind === "grid" ? o.getObjects()[Number(cellNo) - 1] : null;
    if (!cell) throw new ToolInputError(`"${ref}": ${id} is a ${kindOf(o)}${o.data?.kind === "grid" ? ` with ${o.getObjects().length} cells` : ""}. Use <collage id>:<cell number>.`);
    if (cell.data?.empty) throw new ToolInputError(`Cell ${cellNo} of ${id} is still empty.`);
    return cell.getElement();
  }
  if (typeof o.getElement !== "function") throw new ToolInputError(`"${id}" is a ${kindOf(o)}, not a picture.`);
  return o.getElement();
}

/**
 * Where the subject of a picture is (0..1 each way): the centre of its detail (edges), pulled
 * towards skin tones, which is where faces and hands usually are. Cheap: a 64 px copy.
 */
export function subjectPoint(el) {
  const S = 64;
  const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
  const k = S / Math.max(w, h);
  const cw = Math.max(2, Math.round(w * k)), ch = Math.max(2, Math.round(h * k));
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(el, 0, 0, cw, ch);
  const d = ctx.getImageData(0, 0, cw, ch).data;
  const lum = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  let sx = 0, sy = 0, sw = 0;
  for (let y = 1; y < ch - 1; y++) {
    for (let x = 1; x < cw - 1; x++) {
      const i = (y * cw + x) * 4;
      const edge = Math.abs(lum(i + 4) - lum(i - 4)) + Math.abs(lum(i + cw * 4) - lum(i - cw * 4));
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const skin = r > 90 && r > g && g > b && r - b > 25 && r - g < 90 ? 1.6 : 1;
      const wgt = (edge * skin) ** 2;
      sx += x * wgt;
      sy += y * wgt;
      sw += wgt;
    }
  }
  if (!sw) return { x: 0.5, y: 0.5 };
  return { x: sx / sw / (cw - 1), y: sy / sw / (ch - 1) };
}

/** The crop offset (0..1, as grid cells store it) that keeps `point` as central as it can be. */
function offsetFor(point, el, cell) {
  const nw = el.naturalWidth || el.width, nh = el.naturalHeight || el.height;
  const bw = cell.width * cell.scaleX, bh = cell.height * cell.scaleY;
  const s = Math.max(bw / nw, bh / nh);
  const w = bw / s, h = bh / s;
  const along = (p, n, v) => (n - v < 1 ? 0.5 : Math.min(1, Math.max(0, (p * n - v / 2) / (n - v))));
  return { x: along(point.x, nw, w), y: along(point.y, nh, h) };
}

function focusPoint(focus, el) {
  if (focus && typeof focus === "object") return { x: focus.x, y: focus.y };
  if (FOCUS[focus]) return { x: FOCUS[focus][0], y: FOCUS[focus][1] };
  return subjectPoint(el);
}

/** Resolve one cell's picture to an element. New AI pictures are made here (in parallel). */
async function sourceOf(ed, spec, i, signal, aspect) {
  if (spec.id) return { el: pictureByRef(ed, spec.id), from: spec.id, moveId: spec.id.includes(":") ? null : spec.id };
  if (spec.picture) {
    let file;
    try { file = await pictureFile(spec.picture); } catch (e) { throw new ToolInputError(e.message); }
    const url = URL.createObjectURL(file);
    try { return { el: await loadElement(pictureData(await loadElement(url), 2048)), from: spec.picture }; } finally { URL.revokeObjectURL(url); }
  }
  if (spec.prompt) {
    const references = (spec.like || []).map((r) => pictureData(pictureByRef(ed, r)));
    const made = await generatePicture({ prompt: spec.prompt, aspect: spec.aspect || aspect, quality: spec.quality, references }, { signal });
    return { el: await loadElement(made.src), from: "generated", made };
  }
  throw new ToolInputError(`Cell ${i + 1}: give id, picture or prompt.`);
}

/** The shape a new picture should have for a cell of this size. */
const aspectFor = (w, h) => (w / h > 1.25 ? "landscape" : h / w > 1.25 ? "portrait" : "square");

export async function makeCollage(app, inp, { signal }) {
  const ed = editorOf(app);
  const layout = pick(GRID_LAYOUTS, inp.layout, (l) => l.key, { what: "collage layout", catalog: "photo_grids" });
  const cells = inp.cells || [];
  if (cells.length > layout.cells.length) throw new ToolInputError(`Layout ${layout.key} has ${layout.cells.length} cells; you gave ${cells.length}.`);
  const generating = cells.filter((c) => c.prompt).length;
  const allow = pictureAllowance();
  if (generating > allow.left) {
    throw new ToolInputError(`That needs ${generating} new pictures but only ${allow.left} of ${allow.max} are left in this ${allow.minutes}-minute window. Use pictures already made (id), the user's folders, or fewer prompts.`);
  }
  const W = inp.w ?? ed.width, H = inp.h ?? ed.height;
  const x = inp.x ?? (ed.width - W) / 2, y = inp.y ?? (ed.height - H) / 2;
  const short = Math.min(ed.width, ed.height);
  const gap = inp.gap ?? Math.round(short * 0.01);
  const radius = inp.radius ?? 0;

  // Pictures first (outside the undo step: making them takes a while and changes nothing).
  const unit = layout.cells;
  const settled = await Promise.allSettled(cells.map((spec, i) =>
    sourceOf(ed, spec, i, signal, aspectFor(unit[i][2] * W, unit[i][3] * H))));
  if (signal?.aborted) throw Object.assign(new Error("Stopped"), { name: "AbortError" });
  const bad = settled.map((r, i) => (r.status === "rejected" ? `cell ${i + 1}: ${r.reason?.message || r.reason}` : null)).filter(Boolean);
  if (settled.length && bad.length === settled.length) throw new ToolInputError(`No picture could be made or found. ${bad.join("; ")}`);

  return step(app, `Collage (${layout.label})`, async () => {
    const g = await createGrid(layout.key, app, { w: W, h: H, gap, radius });
    g.set({ name: inp.name || `Collage (${layout.label})` });
    const notes = [];
    const report = [];
    const moved = new Set();
    for (const [i, r] of settled.entries()) {
      if (r.status !== "fulfilled") { report.push({ cell: i + 1, empty: true }); continue; }
      const cell = g.getObjects()[i];
      const point = focusPoint(cells[i].focus, r.value.el);
      await fillCell(cell, r.value.el, offsetFor(point, r.value.el, cell));
      if (r.value.made?.model) cell.set("data", { ...cell.data, made_with: r.value.made.model }); // the upload kit's AI-content reminder
      if (r.value.moveId) moved.add(r.value.moveId);
      if (r.value.made?.note) notes.push(`cell ${i + 1}: ${r.value.made.note}`);
      report.push({ cell: i + 1, from: r.value.from, ...(cells[i].like?.length ? { like: cells[i].like, used_references: Boolean(r.value.made?.usedReferences) } : {}) });
    }
    g.setCoords();
    ed.add(g, { center: false, select: false, name: g.name });
    g.setPositionByOrigin(new Point(x + W / 2, y + H / 2), "center", "center");
    g.setCoords();
    if (inp.to_back !== false) { // a collage is the backdrop: everything else stays on top
      const all = ed.canvas.getObjects();
      const under = all.filter((o) => o !== g && (o.isPage || o.isBg)).length; // page and background stay below
      ed.canvas.moveObjectTo(g, under);
    }
    if (moved.size) ed.canvas.remove(...ed.objects().filter((o) => moved.has(o.id)));
    const left = pictureAllowance();
    return {
      text: json({
        added: brief(g), page: { w: ed.width, h: ed.height }, cells: report,
        ...(bad.length ? { failed: bad } : {}),
        ...(generating ? { pictures_left: `${left.left} of ${left.max} in the next ${left.minutes} minutes` } : {}),
        tip: `Refer to a cell's picture as "${g.id}:<cell number>" (generate_image like, or make_collage id). Put text and stickers on top; look_at_design to check.`,
        ...(notes.length ? { note: notes.join(" ") } : {}),
      }),
    };
  }, { signal });
}
