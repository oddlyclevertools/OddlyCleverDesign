// Toolbar groups for any selection (right side): group/ungroup and copy style, Position,
// then transparency, flip, lock, duplicate, delete.
import { el, icon, iconButton, popover, slider } from "../../ui/kit.js";
import { registerTool } from "../../ui/shell.js";
import { isFixed } from "./geom.js";
import {
  canGroup, canUngroup, duplicate, flip, group, lock, remove, setOpacity, ungroup,
} from "./ops.js";
import { positionPanel } from "./position.js";
import { paintMode } from "./paint.js";

const any = (sel) => sel.some((o) => !isFixed(o));
const isText = (o) => typeof o.text === "string"; // Textbox, OcText and friends

const textBtn = (iconName, label, title, onClick, cls = "") => el(`button.btn.small.ghost.ar-tbtn${cls}`, {
  type: "button", title, "aria-label": title, on: { click: onClick },
}, icon(iconName, 16), el("span", {}, label));

export function registerToolbar(app) {
  registerTool({
    id: "ar-group", order: 70,
    match: (sel) => sel.length > 0 && any(sel),
    render: (app2, sel) => {
      const nodes = [];
      if (canGroup(sel)) nodes.push(textBtn("Group", "Group", "Group (Ctrl+G)", () => group(app2)));
      if (canUngroup(sel)) nodes.push(textBtn("Ungroup", "Ungroup", "Ungroup (Ctrl+Shift+G)", () => ungroup(app2)));
      if (sel.length === 1) {
        const b = iconButton("PaintRoller", "Copy style: then click another object (Ctrl+Alt+C / Ctrl+Alt+V)",
          () => paintMode.toggle(app2), { active: paintMode.active });
        b.classList.add("ar-roller");
        b.dataset.fold = "4"; // folds into "More tools" first when the bar is too narrow
        nodes.push(b);
      }
      return nodes.length ? el("div.tgroup", {}, nodes) : null;
    },
  });

  registerTool({
    id: "ar-position", order: 80,
    match: (sel) => sel.length > 0 && any(sel),
    render: (app2) => {
      const b = textBtn("Move", "Position", "Position: layer order, align, size", () => {
        const panel = positionPanel(app2);
        popover(b, panel.node, { align: "end", cls: "ar-pop", onClose: panel.cleanup });
      });
      b.dataset.fold = "2";
      return el("div.tgroup", {}, b);
    },
  });

  registerTool({
    id: "ar-actions", order: 90,
    match: (sel) => sel.length > 0 && any(sel),
    render: (app2, sel) => {
      const op = Math.round((sel.length === 1 ? sel[0].opacity ?? 1 : Math.max(...sel.map((o) => o.opacity ?? 1))) * 100);
      const tBtn = iconButton("Blend", "Transparency", () => {
        popover(tBtn, el("div.ar-transp", {}, slider({
          label: "Transparency", min: 0, max: 100, step: 1, value: op, unit: "%",
          onInput: (v) => setOpacity(app2, v, { merge: true }),
          onChange: (v) => setOpacity(app2, v),
        })), { align: "end", cls: "ar-pop" });
      });
      tBtn.dataset.fold = "4";
      const nodes = [tBtn];
      if (!sel.every(isText)) {
        const fBtn = textBtn("FlipHorizontal2", "Flip", "Flip", () => {
          popover(fBtn, el("div.ar-menu", {},
            menuItem("FlipHorizontal2", "Flip horizontal", () => flip(app2, "x")),
            menuItem("FlipVertical2", "Flip vertical", () => flip(app2, "y"))), { align: "end", cls: "ar-pop" });
        });
        fBtn.dataset.fold = "4";
        nodes.push(fBtn);
      }
      const folds = (b, n) => { b.dataset.fold = String(n); return b; };
      nodes.push(
        folds(iconButton("Lock", "Lock (Ctrl+Shift+L)", () => lock(app2)), 4),
        folds(iconButton("CopyPlus", "Duplicate (Ctrl+D)", () => duplicate(app2)), 3),
        folds(iconButton("Trash2", "Delete (Delete)", () => remove(app2), { cls: "ar-del" }), 2),
      );
      return el("div.tgroup", {}, nodes);
    },
  });
}

export function menuItem(iconName, label, onClick, { keys = "", disabled = false } = {}) {
  return el("button.ar-mitem", { type: "button", disabled, on: { click: onClick } },
    icon(iconName, 16), el("span", {}, label), keys ? el("kbd", {}, keys) : null);
}
