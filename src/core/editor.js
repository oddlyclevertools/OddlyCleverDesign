// The editor core: one Fabric canvas that fills the work area, with the design "page" as a
// locked rect at (0,0). Zoom and pan move the viewport; objects keep page coordinates.
// Feature modules talk to it through this class and the bus (see main.js for the event list).
//
// Pages (v0.4): a design holds 1-100 pages of the same size. Only the page being edited lives on
// the Fabric canvas; the others are kept as canvas JSON in `editor.pages[i].canvas` (the current
// page's entry has canvas: null). Extra bus events: pages(list) after any page change,
// page(index) after switching pages.
import { ActiveSelection, Canvas, FabricObject, Rect, util } from "fabric";
import { History } from "./history.js";
import { ensureFontsFor } from "./fonts.js";
import { sanitizeCanvas } from "./sanitize.js";

// Extra properties every object keeps when saved. Features store their own data in `data`.
export const CUSTOM_PROPS = ["id", "name", "locked", "isPage", "isBg", "data"];
FabricObject.customProperties = CUSTOM_PROPS;

const ACCENT = "#ff2e7e"; // Oddly Clever hot pink
// Selection handles in the app's style.
Object.assign(FabricObject.ownDefaults, {
  transparentCorners: false,
  cornerColor: "#ffffff",
  cornerStrokeColor: ACCENT,
  borderColor: ACCENT,
  cornerStyle: "circle",
  cornerSize: 11,
  borderScaleFactor: 1.6,
  padding: 0,
});

let seq = 0;
export const newId = () => `o${Date.now().toString(36)}${(seq++).toString(36)}`;

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 8;

export const APP_ID = "oddlyclever-design";
/** The newest file format this build writes. One-page designs are still saved as format 1. */
export const FORMAT = 2;
export const MAX_PAGES = 100;
const MAX_PAGE_NAME = 80;
const MAX_NOTES = 20000;

let pageSeq = 0;
export const newPageId = () => `p${Date.now().toString(36)}${(pageSeq++).toString(36)}`;
const cleanText = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Undo/redo whose snapshots hold every page and ignore which page is showing, so switching
 * pages is never an undo step and undo jumps to the page the step changed.
 */
class PagedHistory extends History {
  reset() { this._snap(() => super.reset()); }
  record(label, opts) { this._snap(() => super.record(label, opts)); }
  _snap(fn) {
    const ed = this.editor;
    ed._historySnap = true;
    try { fn(); } finally { ed._historySnap = false; }
  }
}

/** The page list of a saved doc: [{ id, name, notes, canvas }]. Throws when it's damaged. */
function readPages(doc) {
  const current = Number.isInteger(doc.page) ? doc.page : 0;
  if (Array.isArray(doc.pages) && doc.pages.length) {
    const seen = new Set();
    const list = doc.pages.slice(0, MAX_PAGES).map((p, i) => {
      const own = p && typeof p.canvas === "object" && p.canvas ? p.canvas : null;
      let id = typeof p?.id === "string" && /^[\w-]{1,40}$/.test(p.id) ? p.id : newPageId();
      if (seen.has(id)) id = newPageId();
      seen.add(id);
      return {
        id, name: cleanText(p?.name, MAX_PAGE_NAME), notes: cleanText(p?.notes, MAX_NOTES),
        canvas: own || (i === current && doc.canvas && typeof doc.canvas === "object" ? doc.canvas : null),
      };
    });
    if (list.some((p) => !p.canvas)) throw new Error("This design file is damaged (a page is missing).");
    return list;
  }
  if (!doc.canvas || typeof doc.canvas !== "object") throw new Error("This isn't an OddlyClever Design file.");
  return [{ id: newPageId(), name: "", notes: "", canvas: doc.canvas }];
}

/** A copy of a page's canvas JSON with the page rect set to w x h. */
function withPageSize(json, w, h) {
  if (!json || !Array.isArray(json.objects)) return json;
  return { ...json, objects: json.objects.map((o) => (o?.isPage ? { ...o, width: w, height: h } : o)) };
}

/** A deep copy of canvas JSON where every object gets a new id (the page keeps "page"). */
function withNewIds(json) {
  const walk = (o) => {
    if (!o || typeof o !== "object") return o;
    const out = { ...o };
    if (Array.isArray(o.objects)) out.objects = o.objects.map(walk);
    if (o.clipPath) out.clipPath = walk(o.clipPath);
    if (typeof o.id === "string" && !o.isPage) out.id = newId();
    return out;
  };
  const copy = JSON.parse(JSON.stringify(json));
  return { ...copy, objects: (copy.objects || []).map(walk) };
}

export class Editor {
  /**
   * @param {HTMLElement} host the element the canvas fills
   * @param {{emit: Function, on: Function}} bus
   */
  constructor(host, bus) {
    this.host = host;
    this.bus = bus;
    const el = document.createElement("canvas");
    host.append(el);
    this.canvas = new Canvas(el, {
      width: host.clientWidth,
      height: host.clientHeight,
      preserveObjectStacking: true,
      selectionColor: "rgba(255, 46, 126, 0.12)",
      selectionBorderColor: ACCENT,
      selectionLineWidth: 1.2,
      backgroundColor: "transparent",
      fireRightClick: true,
      stopContextMenu: true,
      controlsAboveOverlay: true,
    });
    this.width = 1280;
    this.height = 720;
    this.page = null;
    /** @type {{id: string, name: string, notes: string, canvas: object|null}[]} */
    this.pages = [{ id: newPageId(), name: "", notes: "", canvas: null }];
    this.pageIndex = 0;
    this._historySnap = false;
    this.history = new PagedHistory(this);
    this._wireEvents();
    this._wireViewport();
    new ResizeObserver(() => this._fitHost()).observe(host);
  }

  // ---- document -------------------------------------------------------------------------

  /** Start an empty design of w x h with a white page. */
  async newDocument(w, h, fill = "#ffffff") {
    this.history.pause();
    this.canvas.clear();
    this.width = w;
    this.height = h;
    this._makePage(fill);
    this.pages = [{ id: newPageId(), name: "", notes: "", canvas: null }];
    this.pageIndex = 0;
    this.history.resume();
    this.history.reset();
    this.zoomToFit();
    this.bus.emit("doc", this);
  }

  _pageRect(fill) {
    return new Rect({
      left: 0, top: 0, width: this.width, height: this.height, fill, strokeWidth: 0,
      originX: "left", originY: "top",
      selectable: false, evented: false, hasControls: false, hoverCursor: "default",
      excludeFromExport: false, isPage: true, name: "Page", id: "page",
    });
  }

  _makePage(fill) {
    const page = this._pageRect(fill);
    this.canvas.insertAt(0, page);
    this.page = page;
    this._applyClip();
    return page;
  }

  _applyClip() {
    // Everything outside the page is hidden, like a real artboard.
    this.canvas.clipPath = new Rect({
      left: 0, top: 0, width: this.width, height: this.height, strokeWidth: 0,
      originX: "left", originY: "top", absolutePositioned: true,
    });
  }

  /**
   * The design as plain JSON (what autosave and .ocd files store).
   * One page: format 1 ({ canvas }), readable by older builds; `pages` is added only when the
   * page has a name or notes. Several pages: format 2, where `canvas` is the page being edited
   * (what single-page tools such as MP4 export read), `page` its index, and every other entry
   * of `pages` carries its own canvas.
   */
  toJSON() {
    const live = this._liveJSON();
    const head = { app: APP_ID, format: 1, width: this.width, height: this.height };
    const meta = (p) => ({ id: p.id, name: p.name || "", notes: p.notes || "" });
    if (this._historySnap) {
      return { ...head, format: 2, pages: this.pages.map((p, i) => ({ ...meta(p), canvas: i === this.pageIndex ? live : p.canvas })) };
    }
    if (this.pages.length === 1) {
      const p = this.pages[0];
      return p.name || p.notes ? { ...head, canvas: live, pages: [meta(p)] } : { ...head, canvas: live };
    }
    return {
      ...head, format: 2, page: this.pageIndex, canvas: live,
      pages: this.pages.map((p, i) => (i === this.pageIndex ? meta(p) : { ...meta(p), canvas: p.canvas })),
    };
  }

  /**
   * Load a design saved by toJSON() (any format). On failure the open design is left exactly
   * as it was. Returns how many objects were dropped as unsafe or unknown.
   * With keepHistory (undo, redo, restores) it shows the page the load changed.
   */
  loadJSON(doc, opts) { return this._exclusive(() => this._loadJSON(doc, opts)); }

  /**
   * Page switches and loads (undo, redo, opening) each read the page list, wait for the canvas,
   * then write the list back: run them one at a time so one can't overwrite the other's pages.
   */
  _exclusive(fn) {
    const run = (this._lock || Promise.resolve()).then(fn, fn);
    this._lock = run.catch(() => {});
    return run;
  }

  async _loadJSON(doc, { keepHistory = false } = {}) {
    if (!doc || doc.app !== APP_ID || (!doc.canvas && !Array.isArray(doc.pages))) {
      throw new Error("This isn't an OddlyClever Design file.");
    }
    const w = Math.round(Number(doc.width)), h = Math.round(Number(doc.height));
    if (!(w >= 1 && h >= 1)) throw new Error("This design file is damaged (no page size).");
    let list = readPages(doc);
    let dropped = 0;
    if (!keepHistory) {
      // Outside data: clean every page now (canvas clips and canvas-level images are dropped).
      list = list.map((p) => {
        const r = sanitizeCanvas(p.canvas);
        dropped += r.dropped;
        return { ...p, canvas: withPageSize(r.canvas, w, h) };
      });
    }
    const target = keepHistory ? this._pageAfter(list)
      : Math.max(0, Math.min(list.length - 1, Number.isInteger(doc.page) ? doc.page : 0));
    const { canvas: canvasJSON } = keepHistory ? sanitizeCanvas(list[target].canvas) : { canvas: list[target].canvas };
    this.history.pause();
    try {
      await this._loadCanvas(canvasJSON, w, h);
      this.pages = list.map((p, i) => (i === target ? { ...p, canvas: null } : p));
      this.pageIndex = target;
    } finally {
      this.history.resume();
    }
    if (!keepHistory) this.history.reset();
    this.bus.emit("doc", this);
    this.bus.emit("pages", this.listPages());
    return dropped;
  }

  /** The canvas being edited as JSON, without the artboard clip (the editor rebuilds that). */
  _liveJSON() {
    const { clipPath: _clip, ...json } = this.canvas.toObject(CUSTOM_PROPS);
    return json;
  }

  /** Put clean canvas JSON on the Fabric canvas. Fabric builds everything before clearing. */
  async _loadCanvas(canvasJSON, w = this.width, h = this.height) {
    await ensureFontsFor(canvasJSON.objects);
    await this.canvas.loadFromJSON(canvasJSON);
    this.width = w;
    this.height = h;
    this.page = this.canvas.getObjects().find((o) => o.isPage) || this._makePage("#ffffff");
    this.page.set({ selectable: false, evented: false, hasControls: false, hoverCursor: "default", strokeWidth: 0 });
    this._applyClip();
    for (const o of this.canvas.getObjects()) this._applyLock(o);
    this.canvas.requestRenderAll();
  }

  /** After undo/redo: the page whose content the step changed, else the page being edited. */
  _pageAfter(list) {
    const cur = this.pages[this.pageIndex];
    const before = new Map(this.pages.map((p, i) => [p.id,
      JSON.stringify(i === this.pageIndex ? this._liveJSON() : p.canvas)]));
    const differs = (p) => before.get(p.id) !== JSON.stringify(p.canvas);
    const here = list.findIndex((p) => p.id === cur?.id);
    const changed = list.findIndex(differs);
    if (here >= 0 && (changed < 0 || differs(list[here]))) return here;
    if (changed >= 0) return changed;
    return Math.max(0, Math.min(list.length - 1, this.pageIndex - (here < 0 ? 1 : 0)));
  }

  // ---- pages ----------------------------------------------------------------------------

  get pageCount() { return this.pages.length; }

  /** Every page: [{ index, number, id, name, customName, notes, current }]. */
  listPages() {
    return this.pages.map((p, i) => ({
      index: i, number: i + 1, id: p.id, name: p.name || `Page ${i + 1}`, customName: Boolean(p.name),
      notes: p.notes || "", current: i === this.pageIndex,
    }));
  }

  /** The canvas JSON of page i (the page being edited is serialised at rest). */
  pageJSON(i = this.pageIndex) {
    this._checkIndex(i);
    return i === this.pageIndex ? this.toJSON().canvas : this.pages[i].canvas;
  }

  _checkIndex(i) {
    if (!Number.isInteger(i) || i < 0 || i >= this.pages.length) {
      throw new Error(`There's no page ${Number.isFinite(i) ? i + 1 : i}. This design has ${this.pages.length}.`);
    }
  }

  _pagesChanged(label, opts) {
    this.commit(label, opts);
    this.bus.emit("pages", this.listPages());
  }

  /** Show page i on the canvas. Not an undo step. */
  goToPage(i) { return this._exclusive(() => this._goToPage(i)); }

  async _goToPage(i) {
    this._checkIndex(i);
    const from = this.pageIndex;
    if (i === from) return i;
    const a = this.canvas.getActiveObject();
    if (a?.isEditing) a.exitEditing();
    this.canvas.discardActiveObject();
    const live = this.toJSON().canvas; // at rest, even while an animation preview plays
    const fromId = this.pages[from].id, toId = this.pages[i].id;
    const { canvas: json } = sanitizeCanvas(this.pages[i].canvas);
    this.history.pause();
    try {
      await this._loadCanvas(json);
    } finally {
      this.history.resume();
    }
    this.pages = this.pages.map((p) => (p.id === fromId ? { ...p, canvas: live } : p.id === toId ? { ...p, canvas: null } : p));
    this.pageIndex = this.pages.findIndex((p) => p.id === toId);
    this.bus.emit("doc", this);
    this.bus.emit("page", this.pageIndex);
    this.bus.emit("pages", this.listPages());
    return this.pageIndex;
  }

  /** A blank page's canvas JSON (white, or `fill`). */
  blankPageJSON(fill = "#ffffff") {
    return { objects: [this._pageRect(fill).toObject(CUSTOM_PROPS)] };
  }

  /**
   * Insert a page (blank unless `canvas` is given) at `at` (default: after the current page).
   * One undo step. Doesn't switch to it. Returns its index.
   */
  addPage({ at = this.pageIndex + 1, canvas = null, name = "", notes = "", label = "Add page" } = {}) {
    if (this.pages.length >= MAX_PAGES) throw new Error(`A design can have up to ${MAX_PAGES} pages.`);
    const k = Math.max(0, Math.min(this.pages.length, Math.round(Number(at)) || 0));
    const page = {
      id: newPageId(), name: cleanText(name, MAX_PAGE_NAME), notes: cleanText(notes, MAX_NOTES),
      canvas: canvas ? withPageSize(sanitizeCanvas(canvas).canvas, this.width, this.height) : this.blankPageJSON(),
    };
    this.pages = [...this.pages.slice(0, k), page, ...this.pages.slice(k)];
    if (k <= this.pageIndex) this.pageIndex++;
    this._pagesChanged(label);
    return k;
  }

  /** Copy page i (new object ids) right after it. One undo step. Returns the copy's index. */
  duplicatePage(i = this.pageIndex) {
    this._checkIndex(i);
    const src = this.pages[i];
    return this.addPage({
      at: i + 1, canvas: withNewIds(this.pageJSON(i)), notes: src.notes,
      name: src.name ? `${src.name} (copy)` : "", label: "Duplicate page",
    });
  }

  /** Delete page i (the last page can't go). One undo step. */
  async deletePage(i = this.pageIndex) {
    this._checkIndex(i);
    if (this.pages.length === 1) throw new Error("A design needs at least one page.");
    const id = this.pages[i].id;
    if (i === this.pageIndex) await this.goToPage(i < this.pages.length - 1 ? i + 1 : i - 1);
    const curId = this.pages[this.pageIndex].id;
    this.pages = this.pages.filter((p) => p.id !== id);
    this.pageIndex = this.pages.findIndex((p) => p.id === curId);
    this._pagesChanged("Delete page");
    this.bus.emit("page", this.pageIndex);
  }

  /** Move page `from` to position `to`. One undo step. Returns the new position. */
  movePage(from, to) {
    this._checkIndex(from);
    const k = Math.max(0, Math.min(this.pages.length - 1, Math.round(Number(to)) || 0));
    if (k === from) return k;
    const curId = this.pages[this.pageIndex].id;
    const list = this.pages.slice();
    const [p] = list.splice(from, 1);
    list.splice(k, 0, p);
    this.pages = list;
    this.pageIndex = list.findIndex((x) => x.id === curId);
    this._pagesChanged("Move page");
    this.bus.emit("page", this.pageIndex);
    return k;
  }

  /** Rename page i ("" goes back to "Page N"). One undo step. */
  renamePage(i, name) {
    this._checkIndex(i);
    const clean = cleanText(String(name ?? "").trim(), MAX_PAGE_NAME);
    if (clean === this.pages[i].name) return;
    this.pages = this.pages.map((p, k) => (k === i ? { ...p, name: clean } : p));
    this._pagesChanged("Rename page");
  }

  /** Set page i's speaker notes. Pass { merge: true } while typing. */
  setPageNotes(i, notes, { merge = false } = {}) {
    this._checkIndex(i);
    const clean = cleanText(String(notes ?? ""), MAX_NOTES);
    if (clean === this.pages[i].notes) return;
    this.pages = this.pages.map((p, k) => (k === i ? { ...p, notes: clean } : p));
    this._pagesChanged("Speaker notes", { merge });
  }

  /** Replace the stored (not current) pages' canvas JSON: fn(json, index) -> json. No commit. */
  mapStoredPages(fn) {
    this.pages = this.pages.map((p, i) => (i === this.pageIndex ? p : { ...p, canvas: fn(p.canvas, i) }));
  }

  /** Change the page size. Objects stay where they are (magic resize is a separate feature). */
  setPageSize(w, h) {
    this.width = w;
    this.height = h;
    this.page.set({ width: w, height: h });
    this.mapStoredPages((json) => withPageSize(json, w, h)); // every page has the same size
    this._applyClip();
    this.zoomToFit();
    this.commit("Resize page");
    this.bus.emit("doc", this);
  }

  setBackground(fill) {
    this.page.set("fill", fill);
    this.canvas.requestRenderAll();
    this.commit("Background");
  }

  // ---- objects --------------------------------------------------------------------------

  /** Every design object (not the page), bottom to top. */
  objects() {
    return this.canvas.getObjects().filter((o) => !o.isPage);
  }

  /**
   * Add an object. By default it's centred on the page and selected.
   * @param {FabricObject} obj
   */
  add(obj, { center = true, select = true, name } = {}) {
    obj.set({ id: obj.id || newId(), name: name || obj.name || this._defaultName(obj) });
    this.canvas.add(obj);
    if (center) {
      obj.setPositionByOrigin({ x: this.width / 2, y: this.height / 2 }, "center", "center");
      obj.setCoords();
    }
    if (select) this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
    this.commit("Add");
    return obj;
  }

  _defaultName(obj) {
    if (typeof obj.text === "string") return (obj.text || "Text").slice(0, 24); // any text class
    const t = obj.type || "object";
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  remove(objs = this.selection()) {
    const list = objs.filter((o) => !o.isPage && !o.locked);
    if (!list.length) return;
    this.canvas.discardActiveObject();
    this.canvas.remove(...list);
    this.canvas.requestRenderAll();
    this.commit("Delete");
  }

  /** The selected objects (an ActiveSelection is unpacked). */
  selection() {
    const a = this.canvas.getActiveObject();
    if (!a) return [];
    return a instanceof ActiveSelection ? a.getObjects() : [a];
  }

  /** The active object itself (an ActiveSelection when several are selected). */
  active() {
    return this.canvas.getActiveObject() || null;
  }

  select(objs) {
    this.canvas.discardActiveObject();
    const list = objs.filter((o) => o && !o.isPage && o.selectable !== false);
    if (list.length === 1) this.canvas.setActiveObject(list[0]);
    else if (list.length > 1) this.canvas.setActiveObject(new ActiveSelection(list, { canvas: this.canvas }));
    this.canvas.requestRenderAll();
  }

  selectAll() {
    this.select(this.objects().filter((o) => !o.locked && o.visible !== false));
  }

  /** Lock or unlock an object: locked objects can't be selected on the canvas or moved, but the
   *  pointer still finds them, so they can be unlocked from the canvas (badge, right-click). */
  setLocked(obj, locked) {
    obj.set("locked", locked);
    this._applyLock(obj);
    if (locked && this.selection().includes(obj)) this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.commit(locked ? "Lock" : "Unlock");
  }

  _applyLock(obj) {
    if (obj.isPage) return;
    const locked = Boolean(obj.locked);
    obj.set({
      // A locked page background stays out of the pointer's way entirely.
      selectable: !locked, evented: !locked || !obj.isBg,
      lockMovementX: locked, lockMovementY: locked, lockRotation: locked,
      lockScalingX: locked, lockScalingY: locked,
      hoverCursor: locked ? "default" : null,
    });
  }

  /** Change properties of the selected objects and record one history step.
   *  Pass { merge: true } while a slider is being dragged so the drag becomes one undo step. */
  update(props, objs = this.selection(), label = "Edit", { merge = false } = {}) {
    for (const o of objs) {
      o.set(props);
      o.setCoords();
    }
    this.canvas.requestRenderAll();
    this.commit(label, { merge });
    this.bus.emit("objects:changed", objs);
  }

  /** Record a history step after a change made directly on objects. */
  commit(label = "Edit", { merge = false } = {}) {
    this.history.record(label, { merge });
    this.bus.emit("change", label);
  }

  // ---- rendering ------------------------------------------------------------------------

  /**
   * Render the page (only) to a new canvas element at `scale` x the design size.
   * @param {{scale?: number, transparent?: boolean}} opts
   */
  renderPage({ scale = 1, transparent = false } = {}) {
    const c = this.canvas;
    const active = c.getActiveObject();
    const vpt = c.viewportTransform.slice();
    c.viewportTransform = [1, 0, 0, 1, 0, 0];
    try {
      return c.toCanvasElement(scale, {
        left: 0, top: 0, width: this.width, height: this.height,
        filter: (o) => !(transparent && o.isPage) && o.visible !== false && !o.data?.guide,
      });
    } finally {
      c.viewportTransform = vpt;
      if (active) c.setActiveObject(active);
      c.calcViewportBoundaries?.();
      c.requestRenderAll();
    }
  }

  /** A small JPEG data URL of the page, for the projects list. */
  thumbnail(maxSide = 360) {
    const scale = Math.min(1, maxSide / Math.max(this.width, this.height));
    return this.renderPage({ scale }).toDataURL("image/jpeg", 0.78);
  }

  // ---- viewport -------------------------------------------------------------------------

  get zoom() {
    return this.canvas.getZoom();
  }

  /** Fit the whole page in the work area with some margin. */
  zoomToFit(margin = 56) {
    const c = this.canvas;
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX,
      Math.min((c.width - margin * 2) / this.width, (c.height - margin * 2) / this.height)));
    c.setViewportTransform([z, 0, 0, z, (c.width - this.width * z) / 2, (c.height - this.height * z) / 2]);
    this.fitMode = true; // keep fitting on window resize until the user zooms or pans
    this.bus.emit("zoom", z);
  }

  /** Zoom to `z`, keeping the screen point `at` (default: the work area centre) still. */
  setZoom(z, at) {
    const c = this.canvas;
    z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    const p = at || { x: c.width / 2, y: c.height / 2 };
    c.zoomToPoint(p, z);
    this.fitMode = false;
    this.bus.emit("zoom", z);
  }

  /** Screen (canvas element) point to page coordinates. */
  toPage(x, y) {
    const inv = util.invertTransform(this.canvas.viewportTransform);
    return util.transformPoint({ x, y }, inv);
  }

  _fitHost() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    if (w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.setDimensions({ width: w, height: h });
    if (this.fitMode !== false) this.zoomToFit();
    this.canvas.requestRenderAll();
  }

  _wireViewport() {
    const c = this.canvas;
    // Ctrl/Cmd + wheel (or pinch) zooms at the pointer; plain wheel scrolls; Shift scrolls sideways.
    c.on("mouse:wheel", (opt) => {
      const e = opt.e;
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        const p = c.getViewportPoint(e);
        this.setZoom(this.zoom * Math.pow(0.999, e.deltaY * (e.deltaMode === 1 ? 30 : 1)), p);
      } else {
        const v = c.viewportTransform;
        const dx = e.shiftKey ? e.deltaY : e.deltaX, dy = e.shiftKey ? 0 : e.deltaY;
        v[4] -= dx;
        v[5] -= dy;
        c.setViewportTransform(v);
        this.fitMode = false;
        this.bus.emit("pan");
      }
    });
    // Hold Space (or use the middle button) and drag to pan, or drag the empty area around the
    // page (dragging on the page itself still draws a selection box).
    let spaceDown = false, panning = null;
    const offPage = (e) => {
      if (c.findTarget(e)?.target) return false;
      const p = c.getScenePoint(e);
      return p.x < 0 || p.y < 0 || p.x > this.width || p.y > this.height;
    };
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !isTyping(e) && !spaceDown) {
        spaceDown = true;
        c.defaultCursor = "grab";
        c.selection = false;
        c.setCursor("grab");
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space" && spaceDown) {
        spaceDown = false;
        c.defaultCursor = "default";
        c.selection = true;
        c.setCursor("default");
      }
    });
    c.on("mouse:down:before", (opt) => {
      const e = opt.e;
      if (spaceDown || e.button === 1 || (e.button === 0 && !e.shiftKey && offPage(e))) {
        panning = { x: e.clientX, y: e.clientY, selection: c.selection };
        c.selection = false; // no selection box while panning
        c.discardActiveObject?.();
        c.setCursor("grabbing");
      }
    });
    c.on("mouse:move", (opt) => {
      if (!panning) return;
      const e = opt.e, v = c.viewportTransform;
      v[4] += e.clientX - panning.x;
      v[5] += e.clientY - panning.y;
      panning = { ...panning, x: e.clientX, y: e.clientY };
      c.setViewportTransform(v);
      this.fitMode = false;
      this.bus.emit("pan");
    });
    c.on("mouse:up", () => {
      if (!panning) return;
      c.selection = spaceDown ? false : panning.selection;
      panning = null;
      c.setCursor(spaceDown ? "grab" : "default");
    });
  }

  _wireEvents() {
    const c = this.canvas;
    const sel = () => this.bus.emit("selection", this.selection(), this.active());
    c.on("selection:created", sel);
    c.on("selection:updated", sel);
    c.on("selection:cleared", sel);
    c.on("object:modified", (e) => {
      this.commit("Transform");
      this.bus.emit("objects:changed", this.selection(), e);
    });
    c.on("text:changed", () => {
      this.bus.emit("objects:changed", this.selection());
      this.bus.emit("change", "Typing"); // autosave while typing; the undo step lands on exit
    });
    c.on("text:editing:exited", (e) => {
      const t = e.target;
      if (t && !t.data?.keepName) t.set("name", (t.text || "Text").slice(0, 24));
      this.commit("Text");
    });
  }
}

/** True when a key event belongs to a text field or text being edited on the canvas. */
export function isTyping(e) {
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return true;
  return Boolean(document.querySelector(".canvas-host textarea[data-fabric='textarea']:focus"));
}
