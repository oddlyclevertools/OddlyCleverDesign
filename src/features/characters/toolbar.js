// The contextual toolbar for one selected character: who, face, eyes, facing, head/body and
// the sticker edge. Every change rebuilds the character in place as one undo step.
import { el, icon, iconButton, popover, closePopover } from "../../ui/kit.js";
import { registerTool } from "../../ui/shell.js";
import { CAST, EXPRS, LOOKS, castOf, characterDataURL, normalize } from "./cast.js";
import { changeCharacter, isCharacter } from "./character.js";

const sameLook = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;

const labelled = (iconName, label, title, onClick, { on = false, img = null } = {}) => el("button.btn.small.ghost.ch-tbtn", {
  type: "button", title, "aria-label": title, "aria-pressed": on ? "true" : null, class: on ? "on" : null, on: { click: onClick },
}, img ? el("img.ch-tface", { src: img, alt: "" }) : icon(iconName, 16), el("span", {}, label));

/** A popover grid of head thumbnails; picking one applies `patch(item)`. */
function facePicker(app, obj, anchor, items, isOn, toParams, patchOf, label) {
  const p = normalize(obj.data.character);
  const grid = el("div.ch-pick", { role: "listbox", "aria-label": label },
    items.map((it) => el("button.ch-pick-item", {
      type: "button", role: "option", title: it.label, "aria-selected": String(isOn(it, p)),
      class: isOn(it, p) ? "on" : null,
      on: {
        click: async () => {
          closePopover();
          await changeCharacter(app, obj, patchOf(it), label);
        },
      },
    }, el("img", { src: characterDataURL({ ...p, ...toParams(it), head: true, sticker: false }), alt: "" }),
    el("span", {}, it.label))));
  popover(anchor, el("div.ch-pop", {}, el("div.ch-pop-title", {}, label), grid), { cls: "ch-popover" });
}

function render(app, sel) {
  const obj = sel[0];
  const p = normalize(obj.data?.character);
  const c = castOf(p.who);
  const exprLabel = EXPRS.find((x) => x.id === p.expr)?.label || "Face";
  const lookLabel = LOOKS.find((l) => sameLook(l.look, p.look))?.label || "Eyes";

  const who = labelled(null, c.name, "Swap the character", () => facePicker(app, obj, who,
    CAST.map((x) => ({ ...x, label: x.name })), (it, q) => it.who === q.who,
    (it) => ({ who: it.who }), (it) => ({ who: it.who }), "Character"),
  { img: characterDataURL({ ...p, head: true, sticker: false }) });

  const face = labelled("Smile", exprLabel, "Expression", () => facePicker(app, obj, face, EXPRS,
    (it, q) => it.id === q.expr, (it) => ({ expr: it.id }), (it) => ({ expr: it.id }), "Expression"));

  const tools = [who, face];
  if (p.who !== "keeper") {
    // The Keeper's glowing eyes have no pupils to move.
    const eyes = labelled("Eye", lookLabel, "Where they look", () => facePicker(app, obj, eyes, LOOKS,
      (it, q) => sameLook(it.look, q.look), (it) => ({ look: it.look }), (it) => ({ look: it.look }), "Eyes"));
    tools.push(eyes);
  }
  tools.push(
    iconButton("FlipHorizontal2", p.dir === 1 ? "Face left" : "Face right",
      () => changeCharacter(app, obj, { dir: -p.dir }, "Flip character")),
    labelled(p.head ? "CircleUser" : "PersonStanding", p.head ? "Head" : "Full body",
      p.head ? "Showing the head only: click for the full body" : "Showing the full body: click for the head only",
      () => changeCharacter(app, obj, { head: !p.head }, p.head ? "Full body" : "Head only")),
    labelled("Sticker", "Sticker", p.sticker ? "Remove the sticker edge" : "Sticker: a white die-cut edge with a soft shadow",
      () => changeCharacter(app, obj, { sticker: !p.sticker }, "Sticker edge"), { on: p.sticker }),
  );
  return el("div.tgroup.ch-tools", {}, tools);
}

export function registerCharacterTool() {
  registerTool({
    id: "ch-character", order: 55,
    match: (sel) => sel.length === 1 && isCharacter(sel[0]) && !sel[0].locked,
    render,
  });
}
