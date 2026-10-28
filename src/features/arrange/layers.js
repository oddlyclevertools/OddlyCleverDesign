// The Layers panel: every object top to bottom with a preview and its name. Click selects
// (Shift/Ctrl adds), double-click renames, drag reorders, eye hides, padlock locks, groups
// open to show their children. It follows changes, selection and undo live.
import { el, icon, iconButton, toast } from "../../ui/kit.js";
import { stagger } from "../../ui/motion.js";
import { applyOrder, isFixed } from "./geom.js";
import { lock } from "./ops.js";
import { live } from "./state.js";

const THUMB = 36;          // css px
const DRAG_START_PX = 4;
const TYPE_ICON = {
  textbox: "Type", "i-text": "Type", text: "Type", image: "Image", group: "Group", rect: "Square",
  circle: "Circle", ellipse: "Circle", triangle: "Triangle", path: "Spline", polygon: "Pentagon",
  polyline: "Spline", line: "Minus",
};
const nameOf = (o) => o.name || (o.isBg ? "Background image" : (o.type || "Object"));

export function registerLayers(app, registerPanel, overlay) {
  registerPanel({
    id: "layers", icon: "Layers", label: "Layers", order: 60,
    render: (box) => mountLayers(app, box, overlay),
  });
}

function mountLayers(app, box, overlay) {
  const ed = app.editor;
  const expanded = new Set();
  const thumbs = new WeakMap(); // object -> { sig, canvas }
  const rows = new Map();       // object -> row element
  const list = el("div.ar-layers", { role: "listbox", "aria-label": "Layers", "aria-multiselectable": "true" });
  const empty = el("div.ar-empty", {}, el("span.ar-empty-ico", {}, icon("Layers", 26)),
    el("p", {}, "Nothing here yet. Add text, shapes or photos and they show up here, top layer first."));
  const hint = el("p.ar-hint.ar-lhint", {}, "Drag to reorder. Double-click a name to rename it.");
  box.append(hint, list, empty);
  let dragging = null, rebuildPending = false, firstBuild = true;

  // ---- building -------------------------------------------------------------------------
  function rebuild() {
    if (dragging) { rebuildPending = true; return; }
    rows.clear();
    const top = ed.objects().slice().reverse();
    list.replaceChildren(...top.map((o) => rowFor(o, 0)));
    empty.hidden = top.length > 0;
    hint.hidden = top.length < 2;
    paintSelection(false);
    if (firstBuild && top.length) {
      // Rows reveal one by one when the panel opens; later rebuilds (every edit) must not replay it.
      firstBuild = false;
      stagger(list, { max: 10 });
      setTimeout(() => list.classList.remove("oc-stagger"), 700);
    }
  }

  /** Slide rows from where they were to where they are now (after a drop). */
  function glide(before) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    for (const [o, r] of rows) {
      const was = before.get(o);
      if (was == null) continue;
      const dy = was - r.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) r.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    }
  }

  function rowFor(o, depth, parent = null) {
    const isGroup = o.type === "group" && o._objects?.length;
    const open = isGroup && expanded.has(o.id);
    const name = el("span.ar-lname", { title: nameOf(o) }, nameOf(o));
    const acts = el("div.ar-lacts", {});
    const eye = iconButton(o.visible === false ? "EyeOff" : "Eye", o.visible === false ? "Show" : "Hide", (e) => {
      e.stopPropagation();
      toggleVisible(o);
    });
    acts.append(eye);
    if (!parent && !o.isBg) {
      acts.append(iconButton(o.locked ? "Lock" : "LockOpen", o.locked ? "Unlock" : "Lock", (e) => {
        e.stopPropagation();
        lock(app, [o], !o.locked);
      }, { active: Boolean(o.locked) }));
    }
    if (!o.isBg) {
      acts.append(iconButton("Trash2", "Delete", (e) => {
        e.stopPropagation();
        removeOne(o, parent);
      }));
    }
    const exp = isGroup
      ? el("button.ar-lexp", {
        type: "button", title: open ? "Close group" : "Open group", "aria-label": open ? "Close group" : "Open group",
        "aria-expanded": String(open),
        on: { click: (e) => { e.stopPropagation(); open ? expanded.delete(o.id) : expanded.add(o.id); rebuild(); } },
      }, icon(open ? "ChevronDown" : "ChevronRight", 15))
      : el("span.ar-lexp.ar-lexp-none");
    const row = el("div.ar-lrow", {
      role: "option", tabindex: "0", "aria-label": nameOf(o),
      class: [o.visible === false ? "ar-hidden" : "", o.locked ? "ar-locked" : "", parent ? "ar-child" : "", o.isBg ? "ar-bg" : ""].join(" "),
      style: { paddingLeft: `${6 + depth * 18}px` },
    }, exp, thumbFor(o), name, o.locked ? el("span.ar-lbadge", { title: "Locked" }, icon("Lock", 13)) : null, acts);
    row.obj = o;
    row.parentObj = parent;
    rows.set(o, row);
    wireRow(row, o, parent, name);
    if (!open) return row;
    const kids = o._objects.slice().reverse().map((k) => rowFor(k, depth + 1, o));
    return el("div.ar-lgroup", {}, row, ...kids);
  }

  function thumbFor(o) {
    const wrap = el("span.ar-lthumb", { "aria-hidden": "true" });
    const sig = signature(o);
    let t = thumbs.get(o);
    if (!t || t.sig !== sig) {
      t = { sig, canvas: renderThumb(o) };
      thumbs.set(o, t);
    }
    if (t.canvas) {
      const c = el("canvas", { width: t.canvas.width, height: t.canvas.height });
      c.getContext("2d").drawImage(t.canvas, 0, 0);
      wrap.append(c);
    } else wrap.append(icon(TYPE_ICON[o.type] || "Shapes", 16));
    return wrap;
  }

  // ---- selection highlight ----------------------------------------------------------------
  function paintSelection(scroll = true) {
    const sel = new Set(ed.selection());
    let first = null;
    for (const [o, row] of rows) {
      const on = sel.has(o);
      const inSel = !on && row.parentObj && sel.has(row.parentObj);
      row.classList.toggle("ar-sel", on);
      row.classList.toggle("ar-insel", Boolean(inSel));
      row.setAttribute("aria-selected", String(on));
      if (on && !first) first = row;
    }
    if (scroll && first) first.scrollIntoView({ block: "nearest" });
  }

  // ---- row interaction --------------------------------------------------------------------
  function wireRow(row, o, parent, name) {
    const target = parent || o;
    row.addEventListener("click", (e) => {
      if (row.dataset.dragged) { delete row.dataset.dragged; return; }
      if (target.isBg) { app.bgPhoto?.select?.(); return; }
      if (target.locked) { toast("This layer is locked. Click its padlock to unlock it."); return; }
      const sel = ed.selection();
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        const next = sel.includes(target) ? sel.filter((x) => x !== target) : [...sel, target];
        ed.select(next);
      } else ed.select([target]);
    });
    row.addEventListener("keydown", (e) => {
      if (e.target !== row) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.click(); }
      if (e.key === "F2") { e.preventDefault(); startRename(o, name); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const all = [...list.querySelectorAll(".ar-lrow")];
        all[all.indexOf(row) + (e.key === "ArrowDown" ? 1 : -1)]?.focus();
      }
    });
    name.addEventListener("dblclick", (e) => { e.stopPropagation(); startRename(o, name); });
    row.addEventListener("pointerenter", () => { live.hover = o; overlay.request(); });
    row.addEventListener("pointerleave", () => { if (live.hover === o) { live.hover = null; overlay.request(); } });
    if (!parent && !o.isBg) row.addEventListener("pointerdown", (e) => startDrag(e, row, o));
  }

  function startRename(o, name) {
    const input = el("input.ar-lrename", { value: nameOf(o), "aria-label": "Layer name", maxlength: 80 });
    name.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (save && v && v !== o.name) {
        o.set("name", v);
        if (typeof o.text === "string") o.set("data", { ...(o.data || {}), keepName: true });
        ed.commit("Rename");
      }
      rebuild();
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") finish(true);
      if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  function toggleVisible(o) {
    const show = o.visible === false;
    if (!show && ed.selection().includes(o)) ed.canvas.discardActiveObject();
    o.set("visible", show);
    if (o.group) o.group.set("dirty", true);
    ed.canvas.requestRenderAll();
    ed.commit(show ? "Show" : "Hide");
    app.bus.emit("objects:changed", [o]);
  }

  function removeOne(o, parent) {
    if (!parent) {
      if (o.locked) { o.set("locked", false); ed._applyLock(o); }
      ed.remove([o]);
      return;
    }
    if (parent.locked) return;
    ed.canvas.discardActiveObject();
    parent.remove(o);
    if (!parent._objects.length) ed.canvas.remove(parent);
    else parent.setCoords();
    ed.canvas.requestRenderAll();
    ed.commit("Delete");
  }

  // ---- drag to reorder (top-level rows) ----------------------------------------------------
  function startDrag(e, row, o) {
    if (e.button !== 0 || e.target.closest("button, input")) return;
    const startY = e.clientY;
    let started = false, line = null, slots = [], moving = [];
    const sel = ed.selection();
    const onMove = (ev) => {
      const dy = ev.clientY - startY;
      if (!started) {
        if (Math.abs(dy) < DRAG_START_PX) return;
        started = true;
        dragging = true;
        row.setPointerCapture(e.pointerId);
        moving = sel.includes(o) ? sel.filter((x) => !isFixed(x) && rows.has(x) && !rows.get(x).parentObj) : [o];
        for (const m of moving) rows.get(m)?.classList.add("ar-moving");
        row.classList.add("ar-drag");
        line = el("div.ar-dropline");
        list.append(line);
        slots = topRows().filter((r) => !moving.includes(r.obj));
      }
      row.style.transform = `translateY(${dy}px)`;
      const at = slotIndex(ev.clientY, slots);
      const lr = list.getBoundingClientRect();
      const ref = slots[at] ? blockOf(slots[at]).getBoundingClientRect().top : (slots.length ? blockOf(slots.at(-1)).getBoundingClientRect().bottom : lr.top);
      line.style.top = `${ref - lr.top + list.scrollTop - 1}px`;
      line.dataset.at = String(at);
    };
    const onUp = (ev) => {
      row.removeEventListener("pointermove", onMove);
      row.removeEventListener("pointerup", onUp);
      row.removeEventListener("pointercancel", onUp);
      if (!started) return;
      row.dataset.dragged = "1";
      setTimeout(() => delete row.dataset.dragged, 0);
      const at = ev.type === "pointercancel" ? -1 : Number(line?.dataset.at ?? -1);
      line?.remove();
      dragging = false;
      const before = new Map([...rows].map(([obj, r]) => [obj, r.getBoundingClientRect().top]));
      if (at >= 0) applyDrop(moving, slots.map((r) => r.obj), at);
      rebuild();
      rebuildPending = false;
      glide(before);
      for (const m of moving) rows.get(m)?.classList.add("ar-dropped");
      setTimeout(() => { for (const m of moving) rows.get(m)?.classList.remove("ar-dropped"); }, 700);
    };
    row.addEventListener("pointermove", onMove);
    row.addEventListener("pointerup", onUp);
    row.addEventListener("pointercancel", onUp);
  }

  const topRows = () => [...rows.values()].filter((r) => !r.parentObj);
  const blockOf = (r) => (r.parentElement?.classList.contains("ar-lgroup") && r.parentElement.firstChild === r ? r.parentElement : r);

  function slotIndex(y, slots) {
    for (let i = 0; i < slots.length; i++) {
      const b = blockOf(slots[i]).getBoundingClientRect();
      if (y < b.top + Math.min(b.height, 44) / 2) return i;
    }
    return slots.length;
  }

  /** displayOthers: top-level objects (top first) without the moving ones; at = insert index. */
  function applyDrop(moving, displayOthers, at) {
    const all = ed.canvas.getObjects();
    const fixedObjs = all.filter((x) => isFixed(x));
    // Never drop below the background image.
    const firstBg = displayOthers.findIndex((x) => x.isBg);
    if (firstBg >= 0) at = Math.min(at, firstBg);
    const movingTopFirst = moving.slice().sort((a, b) => all.indexOf(b) - all.indexOf(a));
    const display = [...displayOthers.slice(0, at), ...movingTopFirst, ...displayOthers.slice(at)].filter((x) => !isFixed(x));
    const order = [...fixedObjs, ...display.reverse()];
    if (order.every((x, i) => x === all[i])) return;
    applyOrder(ed.canvas, order);
    ed.canvas.requestRenderAll();
    ed.commit("Reorder layers");
  }

  // ---- live updates -----------------------------------------------------------------------
  let raf = 0, selRaf = 0;
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; rebuild(); });
  };
  const scheduleSel = () => {
    if (selRaf) return;
    selRaf = requestAnimationFrame(() => { selRaf = 0; paintSelection(); });
  };
  const invalidate = (objs) => { for (const o of objs || []) thumbs.delete(o); schedule(); };
  const offs = [
    app.bus.on("change", () => invalidate(ed.selection())),
    app.bus.on("history", schedule),
    app.bus.on("doc", schedule),
    app.bus.on("objects:changed", invalidate),
    app.bus.on("selection", scheduleSel),
  ];
  rebuild();
  return () => {
    offs.forEach((f) => f());
    if (live.hover) { live.hover = null; overlay.request(); }
  };
}

function signature(o) {
  const parts = [o.type, o.width, o.height, o.scaleX, o.scaleY, o.angle, o.flipX, o.flipY, o.opacity, o.visible,
    typeof o.fill === "string" ? o.fill : o.fill?.type, o.stroke, o.strokeWidth, o.text, o.fontFamily, o.filters?.length,
    o._objects?.length, o.cropX, o.cropY];
  return parts.join("|");
}

/** The object drawn small onto its own canvas (null if it can't be drawn). */
function renderThumb(o) {
  try {
    const dpr = Math.min(2, window.devicePixelRatio || 1), size = THUMB * dpr;
    const w = o.getScaledWidth(), h = o.getScaledHeight();
    if (!(w > 0 && h > 0)) return null;
    const mult = Math.min(1, (size * 1.6) / Math.max(w, h));
    const wasVisible = o.visible;
    o.visible = true;
    let src;
    try { src = o.toCanvasElement({ multiplier: mult, withoutShadow: true }); } finally { o.visible = wasVisible; }
    const out = document.createElement("canvas");
    out.width = out.height = size;
    const k = Math.min(size / src.width, size / src.height) * 0.9;
    const dw = src.width * k, dh = src.height * k;
    out.getContext("2d").drawImage(src, (size - dw) / 2, (size - dh) / 2, dw, dh);
    return out;
  } catch {
    return null;
  }
}
