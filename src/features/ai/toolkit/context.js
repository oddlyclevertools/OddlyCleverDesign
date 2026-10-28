// Shared plumbing for the tools: one undo step per call ("AI: ..."), rollback on failure,
// object lookup by id, object kinds and boxes, and placing/resizing in page pixels.
import { FabricImage, Group, Textbox } from "fabric";
import { ToolInputError } from "./validate.js";
import { applyMask } from "../../elements/images.js";
import { toFabricFill } from "../../elements/fill.js";

// State shared across hot-reloaded copies of this module (a test's dynamic import can be a fresh
// instance): the call queue and which history snapshots the AI made.
const SHARED = (globalThis[Symbol.for("oddlyclever.ai.toolkit")] ??= { queue: Promise.resolve(), aiSnaps: new WeakMap() });

/** Run tool calls one at a time, so two AIs (panel + connector) never interleave edits. */
export function enqueue(fn) {
  const run = SHARED.queue.then(fn, fn);
  SHARED.queue = run.catch(() => {});
  return run;
}

/** Snapshots (history strings) the AI produced, per history object. */
export function aiSnaps(history) {
  let set = SHARED.aiSnaps.get(history);
  if (!set) SHARED.aiSnaps.set(history, set = new Set());
  return set;
}

export function throwIfAborted(signal) {
  if (signal?.aborted) throw new Error("Stopped: the run was cancelled.");
}

/** The editor, when a design is open. */
export function editorOf(app) {
  if (!app?.editor) throw new Error("The design editor isn't available.");
  if (app.view !== "editor" || !app.project) throw new Error("No design is open. Call new_design first, or ask the user to open a design.");
  return app.editor;
}

const tick = () => new Promise((r) => setTimeout(r, 16));

/**
 * Run `fn` as one undo step labelled "AI: <label>". If it throws, the design goes back to how
 * it was before the call (the last history snapshot), so a failed call never leaves half a change.
 */
export async function step(app, label, fn, { signal } = {}) {
  const ed = editorOf(app);
  for (let i = 0; ed.history.busy && i < 200; i++) await tick(); // an undo/redo still loading
  throwIfAborted(signal);
  app.motion?.player?.playing && app.motion.stop();
  const h = ed.history;
  h.pause();
  let out;
  try {
    out = await fn(ed);
    throwIfAborted(signal);
  } catch (e) {
    h.resume();
    await rollback(app);
    throw e;
  }
  h.resume();
  ed.canvas.requestRenderAll();
  const before = h.stack[h.index];
  ed.commit(`AI: ${label}`);
  if (h.stack[h.index] !== before) aiSnaps(h).add(h.stack[h.index]);
  app.refreshToolbar?.();
  return out;
}

async function rollback(app) {
  const ed = app.editor, h = ed.history;
  const snap = h.stack[h.index];
  if (!snap || JSON.stringify(ed.toJSON()) === snap) return;
  const vpt = ed.canvas.viewportTransform.slice();
  try {
    await ed.loadJSON(JSON.parse(snap), { keepHistory: true });
    ed.canvas.setViewportTransform(vpt);
  } catch { /* the half-change stays; the next undo step still records it honestly */ }
}

// ---- finding objects --------------------------------------------------------------------

/** Top-level design objects by id. Throws a friendly error for an unknown id. */
export function findObjects(ed, ids) {
  const all = ed.objects();
  return ids.map((id) => {
    const o = all.find((x) => x.id === id);
    if (!o) {
      if (id === "page") throw new ToolInputError("\"page\" is the page itself: use set_background to change it.");
      throw new ToolInputError(`No object with id "${id}". Call get_design for ids.`);
    }
    return o;
  });
}

export const isText = (o) => o instanceof Textbox;
// Type names, not instanceof: after a hot reload a fresh copy of a feature module has its own
// class, while the objects on the page were made by the old one.
export const isCharacter = (o) => o?.constructor?.type === "OcCharacter";
const isLine = (o) => o?.constructor?.type === "OcLine";

/** A short word for what an object is. */
export function kindOf(o) {
  const d = o.data || {};
  if (o.isBg) return "background";
  if (isCharacter(o)) return "character";
  if (isText(o)) return "text";
  if (isLine(o)) return "line";
  if (d.chart) return "chart";
  if (d.kind === "grid") return "photo_grid";
  if (d.kind === "badge") return "badge";
  if (d.kind === "illustration") return "illustration";
  if (d.kind === "decor") return "decoration";
  if (d.kind === "sticker") return "sticker";
  if (d.kind === "icon") return "icon";
  if (d.textCombo) return "text_group";
  if (o instanceof FabricImage) return d.frame ? "frame" : "image";
  if (o instanceof Group) return "group";
  if (d.kind === "shape" || /^(rect|circle|ellipse|path|polygon|triangle)$/i.test(o.type)) return "shape";
  return String(o.type || "object").toLowerCase();
}

// ---- geometry (page pixels, axis-aligned box) ---------------------------------------------

const r1 = (v) => Math.round(v * 10) / 10;

export function boxOf(o) {
  o.setCoords();
  const r = o.getBoundingRect();
  return { x: r1(r.left), y: r1(r.top), w: r1(r.width), h: r1(r.height) };
}

/** Move so the box's left/top (x, y) or centre (cx, cy) lands where asked. */
export function moveTo(o, { x, y, cx, cy }) {
  if (x === undefined && y === undefined && cx === undefined && cy === undefined) return;
  const b = boxOf(o);
  const dx = x !== undefined ? x - b.x : cx !== undefined ? cx - (b.x + b.w / 2) : 0;
  const dy = y !== undefined ? y - b.y : cy !== undefined ? cy - (b.y + b.h / 2) : 0;
  o.set({ left: o.left + dx, top: o.top + dy });
  o.setCoords();
}

/** True for objects that may stretch when both w and h are given. */
const stretchy = (o) => ["shape", "line", "image", "frame"].includes(kindOf(o));

/**
 * Resize to a box width/height (page px). Text: w sets the wrap width (h is ignored, the
 * height follows the words). One of w/h keeps proportions; both stretch shapes, and fit other
 * objects inside w x h. The centre stays put.
 */
export function resizeTo(o, { w, h }) {
  if (w === undefined && h === undefined) return;
  const c = o.getCenterPoint();
  const b = boxOf(o);
  if (isText(o)) {
    if (w !== undefined) {
      o.set({ width: Math.max(10, w / (o.scaleX || 1)) });
      o.initDimensions();
    }
  } else {
    let kx = w !== undefined ? w / Math.max(1e-6, b.w) : null;
    let ky = h !== undefined ? h / Math.max(1e-6, b.h) : null;
    if (kx === null) kx = ky;
    if (ky === null) ky = kx;
    if (kx !== ky && !stretchy(o)) kx = ky = Math.min(kx, ky);
    o.set({ scaleX: o.scaleX * kx, scaleY: o.scaleY * ky });
    afterScale(o);
  }
  o.setPositionByOrigin(c, "center", "center");
  o.setCoords();
}

/** Keep rounded corners, masks and line ends true after a scale (as the elements feature does). */
export function afterScale(o) {
  if (o.type === "rect" && o.data?.kind === "shape" && o.data.radius) o.set({ rx: o.data.radius / o.scaleX, ry: o.data.radius / o.scaleY });
  if (o instanceof FabricImage && o.data?.mask) applyMask(o);
  if (isLine(o)) o.bakeScale?.();
}

/**
 * Apply the shared placement fields of an add_* call: rotate, then size and position the box,
 * then keep it on the page (unless bleed). Returns what keepOnPage fixed, or "".
 */
export function place(o, inp, ed) {
  if (inp.angle !== undefined) o.rotate(inp.angle);
  resizeTo(o, inp);
  moveTo(o, inp);
  if (inp.opacity !== undefined) o.set("opacity", inp.opacity);
  if (inp.name) o.set("name", inp.name);
  o.setCoords();
  return ed ? keepOnPage(ed, o, inp) : "";
}

const px = (v) => `${Math.round(Math.abs(v))} px`;

/**
 * The AI's guard rail for the page border: unless it asked for bleed (or the object is the
 * background or a page overlay), shrink anything bigger than the page (text rewraps instead),
 * then slide it back inside with a small margin. Returns a plain note of what changed, or "".
 */
export function keepOnPage(ed, o, inp = {}) {
  if (inp.bleed || o.isBg || o.data?.overlay) return "";
  const W = ed.width, H = ed.height, m = Math.round(Math.min(W, H) * 0.03);
  const inside = (b) => b.x >= -1 && b.y >= -1 && b.x + b.w <= W + 1 && b.y + b.h <= H + 1;
  let b = boxOf(o);
  if (inside(b)) return "";
  const notes = [];
  const maxW = W - 2 * m, maxH = H - 2 * m;
  if (isText(o)) {
    if (b.w > maxW && !o.angle) {
      resizeTo(o, { w: maxW });
      notes.push(`rewrapped it to ${Math.round(maxW)} px wide`);
    }
  } else if (b.w > maxW || b.h > maxH) {
    const k = Math.min(maxW / b.w, maxH / b.h);
    resizeTo(o, { w: b.w * k });
    notes.push(`shrank it to ${Math.round(k * 100)}%`);
  }
  b = boxOf(o);
  const fit = (pos, size, page) => (size > page - 2 * m ? (page - size) / 2 - pos // too big: centre it
    : pos < m ? m - pos : pos + size > page - m ? page - m - (pos + size) : 0);
  const dx = fit(b.x, b.w, W), dy = fit(b.y, b.h, H);
  if (dx || dy) {
    o.set({ left: o.left + dx, top: o.top + dy });
    o.setCoords();
    const moves = [dx && `${px(dx)} ${dx < 0 ? "left" : "right"}`, dy && `${px(dy)} ${dy < 0 ? "up" : "down"}`].filter(Boolean);
    notes.push(`moved it ${moves.join(" and ")}`);
  }
  b = boxOf(o);
  if (b.h > H + 1) notes.push("it is still taller than the page: use a smaller font_size or less text");
  if (!notes.length) return "";
  return `It went past the ${W}x${H} page edge, so I ${notes.join(", ")}. Now at x ${b.x}, y ${b.y}, ${b.w}x${b.h}. Send bleed: true to let it run off the edge on purpose.`;
}

/** A gradient input to the kit's value format and then to a Fabric fill. */
export function gradientFill(g) {
  const value = { type: g.type, angle: g.angle ?? 90, stops: [...g.stops].sort((a, b) => a.offset - b.offset) };
  return { value, fill: toFabricFill(value) };
}

/** A compact result: id, kind, name and box. */
export function brief(o) {
  return { id: o.id, kind: kindOf(o), name: o.name, ...boxOf(o) };
}

/**
 * Other objects this one covers a real part of (over 15% of the smaller box), as a note for
 * the AI, or "". The background and full-page overlays don't count.
 */
export function collisionNote(ed, o) {
  const a = boxOf(o);
  const hits = ed.objects().filter((p) => p !== o && !p.isBg && !p.data?.overlay && p.visible !== false).filter((p) => {
    const b = boxOf(p);
    const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return ix > 0 && iy > 0 && ix * iy > 0.15 * Math.min(a.w * a.h, b.w * b.h);
  });
  if (!hits.length) return "";
  const names = hits.slice(0, 4).map((p) => `${p.name || kindOf(p)} (${p.id})`).join(", ");
  return `It overlaps ${names}. Fine if layered on purpose; otherwise move or resize one of them.`;
}

export function overlapWarning(ed, o) {
  const b = boxOf(o);
  const off = b.x + b.w < 0 || b.y + b.h < 0 || b.x > ed.width || b.y > ed.height;
  const part = !off && (b.x < -1 || b.y < -1 || b.x + b.w > ed.width + 1 || b.y + b.h > ed.height + 1);
  return off ? "Note: it is completely off the page." : part ? "Note: part of it is past the page edge." : "";
}

export const json = (v) => JSON.stringify(v);
