// Right-click menu on the canvas: clipboard, duplicate, delete, layer order, align (to the page
// for one object, to each other for several), space evenly, tidy up, lock, group/ungroup, copy
// and paste style. Right-clicking a locked object offers Unlock.
import { el, icon, toast } from "../../ui/kit.js";
import { copy, cut, hasClip, pasteFromMenu, writeSystem, copyStyle, hasStyle, pasteStyle } from "./clipboard.js";
import { canReorder, isFixed } from "./geom.js";
import { isLockedTarget, unlockObject } from "./locked.js";
import { align, canGroup, canUngroup, distribute, duplicate, group, lock, order, tidy, ungroup } from "./ops.js";
import { menuItem } from "./toolbar.js";

let openMenu = null;

const ALIGN = [
  ["AlignStartVertical", "left", "Left"],
  ["AlignCenterVertical", "center", "Centre"],
  ["AlignEndVertical", "right", "Right"],
  ["AlignStartHorizontal", "top", "Top"],
  ["AlignCenterHorizontal", "middle", "Middle"],
  ["AlignEndHorizontal", "bottom", "Bottom"],
];

export function closeMenu() {
  const m = openMenu;
  openMenu = null;
  m?.close();
}

export function wireContextMenu(app) {
  const ed = app.editor, c = ed.canvas;
  c.on("mouse:down", (opt) => {
    const e = opt.e;
    if (!e || e.button !== 2) return;
    const t = opt.target;
    if (isLockedTarget(t)) {
      c.discardActiveObject();
      c.requestRenderAll();
      showLocked(app, t, e.clientX, e.clientY);
      return;
    }
    if (t && !isFixed(t) && t.selectable !== false && !ed.selection().includes(t) && t !== ed.active()) {
      ed.select([t]);
    } else if (!t || isFixed(t)) {
      c.discardActiveObject();
      c.requestRenderAll();
    }
    show(app, e.clientX, e.clientY);
  });
  app.shell.canvasHost.addEventListener("contextmenu", (e) => e.preventDefault());
}

/** A row of small icon buttons inside the menu (arrow keys move along it too). */
function iconRow(label, items) {
  return el("div.ar-mrow", { role: "group", "aria-label": label },
    el("span.ar-mrow-label", {}, label),
    el("div.ar-mrow-btns", {}, items.map(([ic, title, onClick, disabled]) => el("button.ar-mitem.ar-micon", {
      type: "button", title, "aria-label": title, disabled: Boolean(disabled), on: { click: onClick },
    }, icon(ic, 16)))));
}

function show(app, x, y) {
  closeMenu();
  const ed = app.editor, sel = ed.selection().filter((o) => !isFixed(o));
  const has = sel.length > 0, many = sel.length > 1;
  const movable = sel.filter((o) => !o.locked);
  const run = (fn) => () => { closeMenu(); Promise.resolve(fn()).catch((e) => toast(e.message, { error: true })); };
  const items = [];
  if (has) {
    items.push(
      menuItem("Copy", "Copy", run(() => { const j = copy(app); if (j) writeSystem(j); }), { keys: "Ctrl+C" }),
      menuItem("Scissors", "Cut", run(() => { const j = cut(app); if (j) writeSystem(j); }), { keys: "Ctrl+X" }),
    );
  }
  items.push(menuItem("ClipboardPaste", "Paste", run(() => pasteFromMenu(app)), { keys: "Ctrl+V", disabled: !hasClip() && !navigator.clipboard }));
  if (has) {
    items.push(
      menuItem("CopyPlus", many ? `Duplicate ${sel.length}` : "Duplicate", run(() => duplicate(app)), { keys: "Ctrl+D" }),
      menuItem("Trash2", many ? `Delete ${sel.length}` : "Delete", run(() => ed.remove()), { keys: "Delete" }),
      sep(),
    );
    if (!many) {
      items.push(
        menuItem("PaintRoller", "Copy style", run(() => { if (copyStyle(app)) toast("Style copied."); }), { keys: "Ctrl+Alt+C" }),
        menuItem("PaintRoller", "Paste style", run(() => pasteStyle(app)), { keys: "Ctrl+Alt+V", disabled: !hasStyle() }),
      );
    } else {
      items.push(menuItem("PaintRoller", "Paste style on all", run(() => pasteStyle(app)), { keys: "Ctrl+Alt+V", disabled: !hasStyle() }));
    }
    items.push(
      sep(),
      menuItem("ArrowUp", "Bring forward", run(() => order(app, "forward")), { keys: "Ctrl+]", disabled: !canReorder(ed.canvas, sel, "forward") }),
      menuItem("BringToFront", "Bring to front", run(() => order(app, "front")), { keys: "Ctrl+Shift+]", disabled: !canReorder(ed.canvas, sel, "front") }),
      menuItem("ArrowDown", "Send backward", run(() => order(app, "backward")), { keys: "Ctrl+[", disabled: !canReorder(ed.canvas, sel, "backward") }),
      menuItem("SendToBack", "Send to back", run(() => order(app, "back")), { keys: "Ctrl+Shift+[", disabled: !canReorder(ed.canvas, sel, "back") }),
      sep(),
      iconRow(many ? "Align" : "Align to page",
        ALIGN.map(([ic, how, label]) => [ic, many ? `Align ${label.toLowerCase()}` : `${label} of the page`, run(() => align(app, how)), !movable.length])),
    );
    if (many) {
      const three = movable.length >= 3;
      items.push(
        iconRow("Space evenly", [
          ["AlignHorizontalSpaceAround", three ? "Space evenly across" : "Space evenly across (needs 3 or more)", run(() => distribute(app, "x")), !three],
          ["AlignVerticalSpaceAround", three ? "Space evenly down" : "Space evenly down (needs 3 or more)", run(() => distribute(app, "y")), !three],
          ["LayoutGrid", "Tidy up into a grid (Alt+Shift+T)", run(() => tidy(app)), movable.length < 2],
        ]),
      );
    }
    items.push(sep());
    if (canGroup(sel)) items.push(menuItem("Group", "Group", run(() => group(app)), { keys: "Ctrl+G" }));
    if (canUngroup(sel)) items.push(menuItem("Ungroup", "Ungroup", run(() => ungroup(app)), { keys: "Ctrl+Shift+G" }));
    items.push(menuItem("Lock", many ? `Lock ${sel.length}` : "Lock", run(() => lock(app)), { keys: "Ctrl+Shift+L" }));
  } else {
    items.push(menuItem("Layers", "Show layers", run(() => app.openPanel("layers")), { keys: "Alt+1" }));
  }
  openAt(items, x, y, "Object menu");
}

/** The menu for a locked object: unlock it, or find it in the layers. */
function showLocked(app, obj, x, y) {
  closeMenu();
  const run = (fn) => () => { closeMenu(); Promise.resolve(fn()).catch((e) => toast(e.message, { error: true })); };
  openAt([
    el("div.ar-mhead", {}, icon("Lock", 14), el("span", {}, obj.name ? `${obj.name} is locked` : "This is locked")),
    menuItem("LockOpen", "Unlock", run(() => unlockObject(app, obj)), { keys: "Click the badge" }),
    menuItem("ClipboardPaste", "Paste", run(() => pasteFromMenu(app)), { keys: "Ctrl+V", disabled: !hasClip() && !navigator.clipboard }),
    sep(),
    menuItem("Layers", "Show layers", run(() => app.openPanel("layers")), { keys: "Alt+1" }),
  ], x, y, "Locked object menu");
}

function openAt(items, x, y, label) {
  const menu = el("div.ar-ctx.ar-menu", { role: "menu", "aria-label": label }, items);
  menu.querySelectorAll(".ar-mitem").forEach((b) => b.setAttribute("role", "menuitem"));
  document.body.append(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  requestAnimationFrame(() => menu.classList.add("show"));
  menu.querySelector(".ar-mitem:not([disabled])")?.focus({ preventScroll: true });

  const away = (e) => { if (!menu.contains(e.target)) closeMenu(); };
  const key = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); closeMenu(); }
    const btns = [...menu.querySelectorAll(".ar-mitem:not([disabled])")];
    const i = btns.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      // Down/Up jump between rows: icon rows count as one stop.
      const rowOf = (b) => b?.closest(".ar-mrow") || b;
      const stops = btns.filter((b, k) => k === 0 || rowOf(b) !== rowOf(btns[k - 1]));
      const at = stops.indexOf(stops.find((b) => rowOf(b) === rowOf(btns[i])));
      stops[(at + (e.key === "ArrowDown" ? 1 : -1) + stops.length) % stops.length]?.focus();
    }
    if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && document.activeElement?.classList.contains("ar-micon")) {
      e.preventDefault();
      const row = [...document.activeElement.parentElement.querySelectorAll(".ar-mitem:not([disabled])")];
      const k = row.indexOf(document.activeElement);
      row[(k + (e.key === "ArrowRight" ? 1 : -1) + row.length) % row.length]?.focus();
    }
  };
  setTimeout(() => {
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("blur", closeMenu);
  });
  openMenu = {
    el: menu,
    close() {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", closeMenu);
      menu.remove();
    },
  };
}

const sep = () => el("div.ar-msep", { role: "separator" });
