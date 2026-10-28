// The Position popover: layer order, align, space evenly / tidy up, and exact size,
// position and rotation. It stays live while open (moving the object updates the numbers).
import { closePopover, el, icon } from "../../ui/kit.js";
import { canReorder, round } from "./geom.js";
import { align, boxOf, distribute, order, setBox, tidy } from "./ops.js";

const ORDER = [
  { mode: "forward", label: "Forward", icon: "ArrowUp", keys: "Ctrl+]" },
  { mode: "backward", label: "Backward", icon: "ArrowDown", keys: "Ctrl+[" },
  { mode: "front", label: "To front", icon: "BringToFront", keys: "Ctrl+Shift+]" },
  { mode: "back", label: "To back", icon: "SendToBack", keys: "Ctrl+Shift+[" },
];
const ALIGN = [
  { how: "top", label: "Top", icon: "AlignStartHorizontal" },
  { how: "left", label: "Left", icon: "AlignStartVertical" },
  { how: "middle", label: "Middle", icon: "AlignCenterHorizontal" },
  { how: "center", label: "Centre", icon: "AlignCenterVertical" },
  { how: "bottom", label: "Bottom", icon: "AlignEndHorizontal" },
  { how: "right", label: "Right", icon: "AlignEndVertical" },
];

const tile = (label, iconName, title, onClick) => el("button.ar-tile", { type: "button", title, "aria-label": title, on: { click: onClick } },
  icon(iconName, 17), el("span", {}, label));

export function positionPanel(app) {
  const ed = app.editor;
  let ratio = true;
  const orderBtns = ORDER.map((o) => {
    const b = tile(o.label, o.icon, `${o.label} (${o.keys})`, () => order(app, o.mode));
    b.dataset.mode = o.mode;
    return b;
  });
  const alignTitle = el("h4.sec-title", {}, "Align to page");
  const alignBtns = ALIGN.map((a) => tile(a.label, a.icon, `Align ${a.label.toLowerCase()}`, () => align(app, a.how)));
  const spaceH = tile("Horizontally", "AlignHorizontalSpaceAround", "Space evenly across (3 or more objects)", () => distribute(app, "x"));
  const spaceV = tile("Vertically", "AlignVerticalSpaceAround", "Space evenly down (3 or more objects)", () => distribute(app, "y"));
  const tidyBtn = tile("Tidy up", "LayoutGrid", "Tidy up: even spacing on a grid (Alt+Shift+T)", () => tidy(app));
  const spaceSec = el("section.sec.ar-space", {}, el("h4.sec-title", {}, "Space evenly"), el("div.ar-grid3", {}, spaceH, spaceV, tidyBtn));

  const num = (label, key, unit) => {
    const input = el("input.ar-num", { type: "number", step: key === "angle" ? 1 : 1, "aria-label": label });
    input.addEventListener("change", () => commitNum(key, Number(input.value)));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
    const field = el("label.ar-field", {}, el("span", {}, label), input, unit ? el("small", {}, unit) : null);
    field.input = input;
    return field;
  };
  const fW = num("W", "w", "px"), fH = num("H", "h", "px"), fX = num("X", "x", "px"), fY = num("Y", "y", "px"), fA = num("Rotate", "angle", "°");
  const ratioBtn = el("button.ibtn.ar-ratio", {
    type: "button", title: "Keep the ratio", "aria-label": "Keep the ratio", "aria-pressed": "true",
    on: { click: () => { ratio = !ratio; paintRatio(); } },
  });
  const paintRatio = () => {
    ratioBtn.replaceChildren(icon(ratio ? "Link2" : "Link2Off", 16));
    ratioBtn.classList.toggle("on", ratio);
    ratioBtn.setAttribute("aria-pressed", String(ratio));
  };
  paintRatio();

  function commitNum(key, v) {
    const b = boxOf(app);
    if (!b || !Number.isFinite(v)) return update();
    if (key === "w" || key === "h") {
      if (v < 1) return update();
      const vals = { [key]: v };
      if (ratio && !b.text) {
        if (key === "w") vals.h = (b.h * v) / b.w;
        else vals.w = (b.w * v) / b.h;
      }
      setBox(app, vals);
    } else setBox(app, { [key]: v });
    update();
  }

  const root = el("div.ar-pos", {},
    el("section.sec", {}, el("h4.sec-title", {}, "Layer order"), el("div.ar-grid2", {}, orderBtns)),
    el("section.sec", {}, alignTitle, el("div.ar-grid2", {}, alignBtns)),
    spaceSec,
    el("section.sec", {}, el("h4.sec-title", {}, "Size and position"),
      el("div.ar-fields", {}, fW, ratioBtn, fH, fX, el("span"), fY, fA)),
    el("button.btn.small.ghost.ar-open-layers", {
      type: "button", on: { click: () => { closePopover(); app.openPanel("layers"); } },
    }, icon("Layers", 15), "Show all layers"));

  function update() {
    const sel = ed.selection();
    const n = sel.length;
    for (const b of orderBtns) b.disabled = !canReorder(ed.canvas, sel, b.dataset.mode);
    alignTitle.textContent = n > 1 ? "Align objects" : "Align to page";
    spaceSec.hidden = n < 2;
    spaceH.disabled = spaceV.disabled = n < 3;
    const b = boxOf(app);
    if (!b) return;
    const set = (f, v) => { if (document.activeElement !== f.input) f.input.value = round(v, 1); };
    set(fW, b.w); set(fH, b.h); set(fX, b.x); set(fY, b.y); set(fA, b.angle);
    fH.input.disabled = b.text;
    fH.title = b.text ? "Text boxes grow to fit their text" : "";
  }
  update();

  // Stay live while open.
  let raf = 0;
  const later = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!root.isConnected) return;
      if (!ed.selection().length) closePopover();
      else update();
    });
  };
  const offs = ["selection", "history", "change", "objects:changed"].map((ev) => app.bus.on(ev, later));
  for (const ev of ["object:moving", "object:scaling", "object:rotating", "object:resizing"]) ed.canvas.on(ev, later);
  const cleanup = () => {
    offs.forEach((f) => f());
    for (const ev of ["object:moving", "object:scaling", "object:rotating", "object:resizing"]) ed.canvas.off(ev, later);
  };
  return { node: root, cleanup };
}
