// Arrange operations on the current selection. Every change goes through the editor so it
// becomes one undo step and autosaves.
import { Group, Textbox, util } from "fabric";
import { newId } from "../../core/editor.js";
import { sanitizeObjects } from "../../core/sanitize.js";
import { toast } from "../../ui/kit.js";
import {
  box, isFixed, isMulti, moveBy, rectOf, reorder, setAngleKeepCenter, unionRect, withDetached,
} from "./geom.js";

const PASTE_OFFSET = 20;
const movable = (objs) => objs.filter((o) => !o.locked && !isFixed(o));

// ---- layer order ------------------------------------------------------------------------

const ORDER_LABEL = { front: "Bring to front", back: "Send to back", forward: "Bring forward", backward: "Send backward" };

export function order(app, mode) {
  const ed = app.editor, sel = movable(ed.selection());
  if (!sel.length) return;
  if (reorder(ed.canvas, sel, mode)) {
    ed.canvas.requestRenderAll();
    ed.commit(ORDER_LABEL[mode]);
  }
}

// ---- align, distribute, tidy -------------------------------------------------------------

/** how: left | center | right | top | middle | bottom. One object aligns to the page. */
export function align(app, how) {
  const ed = app.editor, sel = movable(ed.selection());
  if (!sel.length) return;
  withDetached(ed, (objs) => {
    const ref = objs.length === 1 ? box(0, 0, ed.width, ed.height) : unionRect(objs);
    for (const o of objs) {
      const r = rectOf(o);
      const dx = how === "left" ? ref.l - r.l : how === "center" ? ref.cx - r.cx : how === "right" ? ref.r - r.r : 0;
      const dy = how === "top" ? ref.t - r.t : how === "middle" ? ref.cy - r.cy : how === "bottom" ? ref.b - r.b : 0;
      moveBy(o, dx, dy);
    }
  }, sel);
  ed.canvas.requestRenderAll();
  ed.commit("Align");
}

/** Space 3+ objects evenly along x or y (the outer two stay put). */
export function distribute(app, axis) {
  const ed = app.editor, sel = movable(ed.selection());
  if (sel.length < 3) return;
  withDetached(ed, (objs) => {
    const items = objs.map((o) => ({ o, r: rectOf(o) }));
    const [start, end, size, c] = axis === "x" ? ["l", "r", "w", "cx"] : ["t", "b", "h", "cy"];
    items.sort((a, b) => a.r[c] - b.r[c]);
    const span = items.at(-1).r[end] - items[0].r[start];
    const total = items.reduce((s, it) => s + it.r[size], 0);
    const gap = (span - total) / (items.length - 1);
    let at = items[0].r[start];
    for (const it of items) {
      const d = at - it.r[start];
      moveBy(it.o, axis === "x" ? d : 0, axis === "y" ? d : 0);
      at += it.r[size] + gap;
    }
  }, sel);
  ed.canvas.requestRenderAll();
  ed.commit("Space evenly");
}

/** Tidy up: put the objects on an even grid in reading order, keeping the group's top-left. */
export function tidy(app) {
  const ed = app.editor, sel = movable(ed.selection());
  if (sel.length < 2) return;
  withDetached(ed, (objs) => {
    const items = objs.map((o) => ({ o, r: rectOf(o) }));
    const u = unionRect(objs);
    const n = items.length;
    const avgW = items.reduce((s, it) => s + it.r.w, 0) / n;
    const avgH = items.reduce((s, it) => s + it.r.h, 0) / n;
    // Columns from the current spread: a wide row stays a row, a tall column stays a column.
    const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt((n * (u.w / avgW)) / Math.max(0.01, u.h / avgH)))));
    const rows = Math.ceil(n / cols);
    items.sort((a, b) => a.r.cy - b.r.cy);
    const grid = [];
    for (let i = 0; i < rows; i++) grid.push(items.slice(i * cols, (i + 1) * cols).sort((a, b) => a.r.cx - b.r.cx));
    const colW = Array.from({ length: cols }, (_, c) => Math.max(0, ...grid.map((row) => row[c]?.r.w ?? 0)));
    const rowH = grid.map((row) => Math.max(...row.map((it) => it.r.h)));
    const sumW = colW.reduce((a, b) => a + b, 0), sumH = rowH.reduce((a, b) => a + b, 0);
    const gapX = cols > 1 ? Math.max(0, (u.w - sumW) / (cols - 1)) : 0;
    const gapY = rows > 1 ? Math.max(0, (u.h - sumH) / (rows - 1)) : 0;
    const gx = Math.min(gapX, Math.max(avgW, avgH)), gy = Math.min(gapY, Math.max(avgW, avgH));
    let y = u.t;
    grid.forEach((row, ri) => {
      let x = u.l;
      row.forEach((it, ci) => {
        const cx = x + colW[ci] / 2, cy = y + rowH[ri] / 2;
        moveBy(it.o, cx - it.r.cx, cy - it.r.cy);
        x += colW[ci] + gx;
      });
      y += rowH[ri] + gy;
    });
  }, sel);
  ed.canvas.requestRenderAll();
  ed.commit("Tidy up");
}

// ---- size, position, rotation -------------------------------------------------------------

/** The numbers the Position panel shows for the selection. */
export function boxOf(app) {
  const a = app.editor.active();
  if (!a) return null;
  const r = rectOf(a);
  return { x: r.l, y: r.t, w: a.getScaledWidth(), h: a.getScaledHeight(), angle: a.angle || 0, text: a instanceof Textbox };
}

/** Set any of x, y, w, h, angle on the selection (as one block when several are selected). */
export function setBox(app, vals, { merge = false } = {}) {
  const ed = app.editor, a = ed.active();
  if (!a || (!isMulti(a) && a.locked)) return;
  if (vals.angle != null && Number.isFinite(vals.angle)) setAngleKeepCenter(a, ((vals.angle % 360) + 360) % 360);
  if (vals.w != null || vals.h != null) {
    const before = rectOf(a);
    if (vals.w != null && vals.w > 0) {
      if (a instanceof Textbox) a.set("width", Math.max(1, vals.w / (a.scaleX || 1) - (a.strokeWidth || 0)));
      else a.set("scaleX", (a.scaleX * vals.w) / a.getScaledWidth());
    }
    if (vals.h != null && vals.h > 0 && a.type !== "textbox") a.set("scaleY", (a.scaleY * vals.h) / a.getScaledHeight());
    a.initDimensions?.();
    a.setCoords();
    const after = rectOf(a);
    moveBy(a, before.l - after.l, before.t - after.t);
  }
  if (vals.x != null || vals.y != null) {
    const r = rectOf(a);
    moveBy(a, vals.x != null ? vals.x - r.l : 0, vals.y != null ? vals.y - r.t : 0);
  }
  ed.canvas.requestRenderAll();
  ed.commit("Position", { merge });
  app.bus.emit("objects:changed", ed.selection());
}

export function nudge(app, dx, dy) {
  const ed = app.editor, a = ed.active();
  if (!a || (!isMulti(a) && a.locked)) return;
  moveBy(a, dx, dy);
  ed.canvas.requestRenderAll();
  ed.commit("Nudge", { merge: true });
  app.bus.emit("objects:changed", ed.selection());
}

// ---- transparency, flip ------------------------------------------------------------------

export function setOpacity(app, pct, { merge = false } = {}) {
  const ed = app.editor, sel = movable(ed.selection());
  if (!sel.length) return;
  ed.update({ opacity: Math.max(0, Math.min(100, pct)) / 100 }, sel, "Transparency", { merge });
}

/** Flip each object; a multi-selection also mirrors positions, like flipping it as a whole. */
export function flip(app, axis) {
  const ed = app.editor, sel = movable(ed.selection());
  if (!sel.length) return;
  const key = axis === "x" ? "flipX" : "flipY";
  if (sel.length === 1) {
    ed.update({ [key]: !sel[0][key] }, sel, axis === "x" ? "Flip horizontal" : "Flip vertical");
    return;
  }
  withDetached(ed, (objs) => {
    const u = unionRect(objs);
    for (const o of objs) {
      const r = rectOf(o);
      if (axis === "x") moveBy(o, 2 * u.cx - r.cx - r.cx, 0);
      else moveBy(o, 0, 2 * u.cy - r.cy - r.cy);
      o.set(key, !o[key]);
      if (o.angle) setAngleKeepCenter(o, (360 - o.angle) % 360);
    }
  }, sel);
  ed.canvas.requestRenderAll();
  ed.commit(axis === "x" ? "Flip horizontal" : "Flip vertical");
}

// ---- lock, delete, duplicate ---------------------------------------------------------------

export function lock(app, objs = app.editor.selection(), locked = true) {
  const ed = app.editor, list = objs.filter((o) => !isFixed(o));
  if (!list.length) return;
  ed.history.pause();
  try {
    for (const o of list) ed.setLocked(o, locked);
  } finally {
    ed.history.resume();
  }
  ed.commit(locked ? "Lock" : "Unlock");
  if (locked) toast(list.length > 1 ? "Locked. To unlock one, click its lock badge or right-click it." : "Locked. To unlock it, click its lock badge or right-click it.");
}

export function remove(app) {
  app.editor.remove();
}

/** Plain JSON for objects (absolute coordinates). */
export function serialize(app, objs) {
  return withDetached(app.editor, (list) => list.map((o) => o.toObject()), objs);
}

/**
 * Add objects from serialised JSON, offset by `offset`, on top of the stack, and select them.
 * `above` puts them right above that object instead.
 */
export async function insertSerialized(app, items, { offset = PASTE_OFFSET, label = "Paste", above = null } = {}) {
  const ed = app.editor;
  let objs;
  try {
    // Clipboard JSON can come from anywhere: only known types and data: images get through.
    objs = await util.enlivenObjects(sanitizeObjects(items).objects);
  } catch (e) {
    toast(`Couldn't paste: ${e.message}`, { error: true });
    return [];
  }
  objs = objs.filter((o) => o && !o.isPage);
  if (!objs.length) return [];
  const all = ed.canvas.getObjects();
  let at = above ? all.indexOf(above) + 1 : all.length;
  for (const o of objs) {
    reId(o);
    o.set({ left: o.left + offset, top: o.top + offset, isBg: false, locked: false });
    ed._applyLock(o);
    ed.canvas.insertAt(at++, o);
    o.setCoords();
  }
  ed.select(objs);
  ed.canvas.requestRenderAll();
  ed.commit(label);
  return objs;
}

function reId(o) {
  o.set("id", newId());
  o._objects?.forEach(reId);
}

export async function duplicate(app) {
  const ed = app.editor, sel = ed.selection().filter((o) => !isFixed(o));
  if (!sel.length) return;
  const all = ed.canvas.getObjects();
  const top = sel.reduce((a, b) => (all.indexOf(b) > all.indexOf(a) ? b : a));
  const items = serialize(app, sel.sort((a, b) => all.indexOf(a) - all.indexOf(b)));
  await insertSerialized(app, items, { label: "Duplicate", above: top });
}

// ---- group, ungroup ------------------------------------------------------------------------

export const canGroup = (sel) => movable(sel).length > 1;
export const canUngroup = (sel) => sel.length === 1 && sel[0].type === "group" && !sel[0].locked;

export function group(app) {
  const ed = app.editor, c = ed.canvas;
  const all = c.getObjects();
  const sel = movable(ed.selection()).sort((a, b) => all.indexOf(a) - all.indexOf(b));
  if (sel.length < 2) return;
  const topIndex = all.indexOf(sel.at(-1));
  c.discardActiveObject();
  c.remove(...sel);
  const g = new Group(sel, { id: newId(), name: "Group" });
  c.insertAt(Math.min(topIndex - sel.length + 1, c.getObjects().length), g);
  g.setCoords();
  c.setActiveObject(g);
  c.requestRenderAll();
  ed.commit("Group");
}

export function ungroup(app) {
  const ed = app.editor, c = ed.canvas, [g] = ed.selection();
  if (!g || !canUngroup([g])) return;
  const at = c.getObjects().indexOf(g);
  c.discardActiveObject();
  const items = g.removeAll();
  c.remove(g);
  items.forEach((o, i) => {
    c.insertAt(at + i, o);
    ed._applyLock(o);
    o.setCoords();
  });
  ed.select(items);
  c.requestRenderAll();
  ed.commit("Ungroup");
}
