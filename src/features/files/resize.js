// Resize: change the page to a preset or custom size, in place (one undo step) or as a copy,
// for every page of the design. Three ways to treat the content:
//   smart  re-lays the design for the new shape (pages/smart.js): the default
//   scale  scales every element by min(sx, sy) and centres it; backgrounds cover the page
//   keep   leaves everything where it is
// "Many sizes" makes one new design per picked size (Smart resize each).
import { Point } from "fabric";
import { SIZES, MAX_SIDE, resolveSize } from "../../core/sizes.js";
import { el, icon, iconButton, closePopover, popover, toast } from "../../ui/kit.js";
import { popFrom } from "../../ui/popfrom.js";
import { resizeToMany, sizeName, smartResize } from "../pages/resize.js";
import { duplicateDesign } from "./projects.js";
import { loadPrefs, savePrefs } from "./util.js";

const PREFS_KEY = "fl-resize";
const MODES = [
  { id: "smart", label: "Smart", help: "Re-lays your design for the new shape: the main picture and headline stay big, words stay clear of the edges and the platform's buttons." },
  { id: "scale", label: "Scale", help: "Scales everything to fit and centres it. Backgrounds fill the page." },
  { id: "keep", label: "Keep", help: "Changes the page size only. Everything stays where it is." },
];
/** Quick picks for "Many sizes". */
export const CREATOR_PACK = ["yt-thumb", "shorts", "ig-post", "ig-story", "x-header"];

function moveScaled(obj, s, dx, dy) {
  const c = obj.getCenterPoint();
  // Uniform scale commutes with rotation, skew and flips, so those stay as they are.
  obj.set({ scaleX: obj.scaleX * s, scaleY: obj.scaleY * s });
  obj.setPositionByOrigin(new Point(c.x * s + dx, c.y * s + dy), "center", "center");
  obj.setCoords();
  const cp = obj.clipPath;
  if (cp?.absolutePositioned) moveScaled(cp, s, dx, dy);
}

/**
 * The same uniform scale on saved object JSON. A uniform scale plus a move maps every point,
 * including the object's origin point, the same way: p -> p*s + d.
 */
function scaledJSON(o, s, dx, dy) {
  const out = { ...o, left: (Number(o.left) || 0) * s + dx, top: (Number(o.top) || 0) * s + dy,
    scaleX: (o.scaleX ?? 1) * s, scaleY: (o.scaleY ?? 1) * s };
  if (o.clipPath?.absolutePositioned) out.clipPath = scaledJSON(o.clipPath, s, dx, dy);
  return out;
}

/**
 * Resize the open design in place, every page. One history step ("Resize page").
 * @param {import("../../core/editor.js").Editor} editor
 * @param {number} w @param {number} h
 * @param {{scaleContent?: boolean}} opts
 */
export function resizeDesign(editor, w, h, { scaleContent = true } = {}) {
  const { w: W, h: H } = resolveSize({ w, h });
  const ow = editor.width, oh = editor.height;
  if (W === ow && H === oh) return false;
  const selected = editor.selection();
  editor.canvas.discardActiveObject(); // objects in an ActiveSelection have relative coordinates
  if (scaleContent) {
    const fit = Math.min(W / ow, H / oh), cover = Math.max(W / ow, H / oh);
    const k = (o) => (o.isBg ? cover : fit);
    for (const o of editor.objects()) {
      const s = k(o);
      moveScaled(o, s, (W - ow * s) / 2, (H - oh * s) / 2);
    }
    editor.mapStoredPages((json) => ({
      ...json,
      objects: (json.objects || []).map((o) => (o?.isPage ? o : scaledJSON(o, k(o), (W - ow * k(o)) / 2, (H - oh * k(o)) / 2))),
    }));
  }
  editor.setPageSize(W, H); // commits once: the object changes above are in the same step
  if (selected.length) editor.select(selected);
  return true;
}

/** Resize a copy: the original stays as it is; the copy opens. */
export async function copyAndResize(app, w, h, opts) {
  const { w: W, h: H } = resolveSize({ w, h });
  await duplicateDesign(app, `${app.project?.name || "Untitled design"} (${sizeName(W, H)})`);
  resizeDesign(app.editor, W, H, opts);
  app.editor.history.reset(); // the copy starts at its new size
  await app.save();
}

/**
 * Resize the open design with a mode. Returns a short message for a toast.
 * @param {"smart"|"scale"|"keep"} mode
 */
export async function resizeWithMode(app, w, h, mode = "smart", { copy = false } = {}) {
  if (mode === "smart") {
    await smartResize(app, { w, h }, { asNewDesign: copy });
  } else if (copy) {
    await copyAndResize(app, w, h, { scaleContent: mode === "scale" });
  } else {
    resizeDesign(app.editor, w, h, { scaleContent: mode === "scale" });
  }
  return copy ? `Made a resized copy: ${w} × ${h} px.` : `Resized to ${w} × ${h} px. Undo (Ctrl+Z) to go back.`;
}

function readPrefs() {
  const p = loadPrefs(PREFS_KEY, { lock: false, many: CREATOR_PACK });
  if (!MODES.some((m) => m.id === p.mode)) p.mode = p.scaleContent === false ? "keep" : "smart";
  if (!Array.isArray(p.many)) p.many = CREATOR_PACK;
  return p;
}

/** A segmented control: items [{id, label, help?}], value, onPick(id). */
function segmented(items, value, onPick, label, cls = "") {
  const box = el(`div.fl-seg${cls ? "." + cls : ""}`, { role: "radiogroup", "aria-label": label });
  const draw = (v) => box.replaceChildren(...items.map((m) => el("button.fl-seg-btn", {
    type: "button", role: "radio", "aria-checked": m.id === v, class: m.id === v ? "on" : null, title: m.help || null,
    on: { click: () => { draw(m.id); onPick(m.id); } },
  }, m.label)));
  draw(value);
  return box;
}

/** The Resize popover. */
export function resizePanel(app) {
  const ed = app.editor;
  const prefs = readPrefs();
  const save = () => savePrefs(PREFS_KEY, { lock: prefs.lock, mode: prefs.mode, many: prefs.many });
  let w = ed.width, h = ed.height, lock = prefs.lock, ratio = w / h, tab = "one", busy = false;
  const many = new Set(prefs.many.filter((id) => SIZES.some((s) => s.id === id)));

  const wIn = el("input.fl-num", { type: "number", min: 16, max: MAX_SIDE, value: w, "aria-label": "Width in pixels" });
  const hIn = el("input.fl-num", { type: "number", min: 16, max: MAX_SIDE, value: h, "aria-label": "Height in pixels" });
  const lockBtn = iconButton(lock ? "Lock" : "LockOpen", "Keep the aspect ratio", () => {
    lock = !lock;
    ratio = w / h;
    lockBtn.replaceChildren(icon(lock ? "Lock" : "LockOpen"));
    lockBtn.classList.toggle("on", lock);
    prefs.lock = lock;
    save();
  }, { active: lock });
  const search = el("input.fl-search", { type: "search", placeholder: "Search sizes", "aria-label": "Search sizes" });
  const list = el("div.fl-size-list", { role: "listbox", "aria-label": "Sizes" });
  const resizeBtn = el("button.btn.primary.fl-grow", { type: "button" }, "Resize this design");
  const copyBtn = el("button.btn.fl-grow", { type: "button" }, icon("Copy", 15), "Copy and resize");
  const manyBtn = el("button.btn.primary.fl-grow", { type: "button" }, icon("LayoutGrid", 15), el("span", {}, "Make designs"));
  const warn = el("div.fl-warn");
  const modeHelp = el("p.fl-note");
  const results = el("div.fl-many-done");
  const pagesNote = ed.pageCount > 1 ? el("p.fl-note.fl-page-note", {}, icon("Files", 13), `All ${ed.pageCount} pages are resized.`) : null;

  const valid = () => w >= 16 && h >= 16 && w <= MAX_SIDE && h <= MAX_SIDE;
  const refresh = () => {
    const same = w === ed.width && h === ed.height;
    warn.textContent = tab === "one" && !valid() ? `Sizes must be between 16 and ${MAX_SIDE} px.` : "";
    resizeBtn.disabled = copyBtn.disabled = busy || !valid() || same;
    manyBtn.disabled = busy || !many.size;
    manyBtn.lastChild.textContent = many.size ? `Make ${many.size} design${many.size > 1 ? "s" : ""}` : "Pick some sizes";
    for (const b of list.querySelectorAll(".fl-size")) {
      const on = tab === "one" ? Number(b.dataset.w) === w && Number(b.dataset.h) === h : many.has(b.dataset.id);
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on);
      const box = b.querySelector(".fl-check");
      if (box) box.replaceChildren(on ? icon("Check", 13) : "");
    }
  };
  const setSize = (nw, nh) => {
    w = Math.round(nw); h = Math.round(nh);
    wIn.value = w; hIn.value = h;
    refresh();
  };
  wIn.addEventListener("input", () => {
    const v = Number(wIn.value);
    w = Math.round(v);
    if (lock && v > 0) { h = Math.round(v / ratio); hIn.value = h; }
    refresh();
  });
  hIn.addEventListener("input", () => {
    const v = Number(hIn.value);
    h = Math.round(v);
    if (lock && v > 0) { w = Math.round(v * ratio); wIn.value = w; }
    refresh();
  });

  const pick = (s) => {
    if (tab === "one") { ratio = s.w / s.h; setSize(s.w, s.h); return; }
    if (many.has(s.id)) many.delete(s.id); else many.add(s.id);
    prefs.many = [...many];
    save();
    refresh();
  };
  const renderList = () => {
    const q = search.value.trim().toLowerCase();
    const groups = new Map();
    for (const s of SIZES) {
      if (q && !`${s.name} ${s.group} ${s.w}x${s.h} ${s.w}×${s.h}`.toLowerCase().includes(q)) continue;
      if (!groups.has(s.group)) groups.set(s.group, []);
      groups.get(s.group).push(s);
    }
    const nodes = [];
    for (const [g, items] of groups) {
      nodes.push(el("div.fl-size-group", {}, g));
      for (const s of items) {
        const current = s.w === ed.width && s.h === ed.height;
        nodes.push(el("button.fl-size", {
          type: "button", role: "option", dataset: { w: s.w, h: s.h, id: s.id },
          on: { click: () => pick(s) },
        }, tab === "many" ? el("span.fl-check", { "aria-hidden": "true" }) : null,
        shapeIcon(s.w, s.h), el("span.fl-size-name", {}, s.name),
        current ? el("span.fl-badge", {}, "Current") : null,
        el("span.fl-size-px", {}, `${s.w} × ${s.h}`)));
      }
    }
    if (!nodes.length) nodes.push(el("div.fl-empty", {}, icon("SearchX", 22), el("span", {}, tab === "one" ? "No sizes match. Type a custom size above." : "No sizes match. Try another name.")));
    list.replaceChildren(...nodes);
    list.classList.toggle("fl-multi", tab === "many");
    refresh();
  };
  search.addEventListener("input", renderList);

  const setBusy = (on) => { busy = on; refresh(); };
  const run = async (copy) => {
    if (!valid() || busy) return;
    setBusy(true);
    try {
      const msg = await resizeWithMode(app, w, h, prefs.mode, { copy });
      closePopover();
      toast(msg);
    } catch (e) {
      toast(`Couldn't resize: ${e.message}`, { error: true });
    } finally {
      setBusy(false);
    }
  };
  resizeBtn.addEventListener("click", () => run(false));
  copyBtn.addEventListener("click", () => run(true));
  manyBtn.addEventListener("click", async () => {
    if (busy || !many.size) return;
    setBusy(true);
    results.replaceChildren();
    try {
      const made = await resizeToMany(app, [...many], {
        onProgress: (done, total) => { manyBtn.lastChild.textContent = done < total ? `Making ${done + 1} of ${total}…` : "Done"; },
      });
      results.replaceChildren(el("div.fl-label", {}, `Made ${made.length} new design${made.length > 1 ? "s" : ""}. Your design is unchanged.`),
        ...made.map((m) => el("button.fl-many-item", {
          type: "button", title: `Open ${m.name}`,
          on: { click: async () => { closePopover(); try { await app.openDesign(m.id); location.hash = `#/d/${m.id}`; } catch (e) { toast(e.message, { error: true }); } } },
        }, shapeIcon(m.width, m.height), el("span.fl-size-name", {}, m.label), el("span.fl-size-px", {}, "Open"), icon("ArrowRight", 14))));
      toast(`Made ${made.length} resized design${made.length > 1 ? "s" : ""}. Find them on the home screen too.`);
    } catch (e) {
      toast(`Couldn't make the sizes: ${e.message}`, { error: true });
    } finally {
      setBusy(false);
    }
  });

  const showMode = () => { modeHelp.textContent = MODES.find((m) => m.id === prefs.mode).help; };
  showMode();
  const modeSeg = segmented(MODES, prefs.mode, (id) => { prefs.mode = id; save(); showMode(); }, "How to treat the content", "fl-mode");

  const oneBox = el("div.fl-tab-one", {},
    el("div.fl-custom", {}, el("label", {}, el("span", {}, "Width"), wIn), lockBtn,
      el("label", {}, el("span", {}, "Height"), hIn), el("span.fl-unit", {}, "px")),
    warn);
  const oneFoot = el("div.fl-tab-one", {},
    el("div.fl-sec", {}, el("div.fl-label", {}, "Content"), modeSeg, modeHelp, pagesNote),
    el("div.fl-actions", {}, copyBtn, resizeBtn));
  const manyHead = el("div.fl-tab-many", {},
    el("p.fl-note", {}, "Pick the sizes you want. Each one becomes a new design, smartly re-laid", ed.pageCount > 1 ? ", with every page." : "."),
    el("div.fl-row", {},
      el("button.btn.small", { type: "button", on: { click: () => { many.clear(); CREATOR_PACK.forEach((id) => many.add(id)); prefs.many = [...many]; save(); refresh(); } } }, icon("Sparkles", 14), "Creator pack"),
      el("button.btn.small.ghost", { type: "button", on: { click: () => { many.clear(); prefs.many = []; save(); refresh(); } } }, "Clear")));
  const manyFoot = el("div.fl-tab-many", {}, el("div.fl-actions", {}, manyBtn), results);
  const tabs = segmented([{ id: "one", label: "One size" }, { id: "many", label: "Many sizes at once" }], tab, (id) => {
    tab = id;
    root.dataset.tab = id;
    renderList();
  }, "Resize to one or many sizes");

  renderList();
  const root = el("div.fl-resize", { dataset: { tab } },
    el("div.fl-head", {}, el("h4", {}, "Resize"), el("span.fl-muted", {}, `Now ${ed.width} × ${ed.height} px`)),
    tabs, oneBox, manyHead, search, list, oneFoot, manyFoot);
  return root;
}

/** A little rectangle with the preset's aspect ratio. */
function shapeIcon(w, h) {
  const k = 18 / Math.max(w, h);
  return el("span.fl-shape", {}, el("i", { style: { width: `${Math.max(4, w * k)}px`, height: `${Math.max(4, h * k)}px` } }));
}

export function resizeButton(app) {
  const btn = el("button.btn.fl-top-btn", { type: "button", title: "Resize the design", "aria-label": "Resize" },
    icon("Scaling", 17), el("span", {}, "Resize"));
  btn.addEventListener("click", () => popFrom(popover(btn, resizePanel(app), { align: "end", cls: "fl-pop" }), btn));
  return btn;
}
