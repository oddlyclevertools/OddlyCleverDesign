// The Characters panel: a card per cast member with their full body (or head), the four
// expressions, and options for the next one you add (full body or head, facing, sticker edge).
// Click to add in the centre, or drag onto the design.
import { el, icon, toast } from "../../ui/kit.js";
import { CAST, EXPRS, characterDataURL } from "./cast.js";
import { addCharacter } from "./character.js";

export const DRAG_TYPE = "application/x-oc-character";

// What the next added character looks like (kept while the app is open).
const opts = { head: false, dir: 1, sticker: false };

async function add(app, params, at) {
  try {
    await addCharacter(app, { ...params, head: params.head ?? opts.head, dir: opts.dir, sticker: opts.sticker }, at);
  } catch (e) {
    toast(`Couldn't add the character: ${e.message}`, { error: true });
  }
}

/** A button that adds `params` on click and can be dragged onto the canvas. */
function addButton(app, cls, params, title, ...children) {
  const b = el(`button.${cls}`, {
    type: "button", title, "aria-label": title, draggable: "true",
    on: {
      click: () => add(app, params),
      dragstart: (e) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(params));
        e.dataTransfer.effectAllowed = "copy";
        const img = b.querySelector("img");
        if (img) e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
      },
    },
  }, ...children);
  return b;
}

function segmented(items, value, onPick, label) {
  const box = el("div.ch-seg", { role: "radiogroup", "aria-label": label });
  for (const it of items) {
    box.append(el("button", {
      type: "button", role: "radio", title: it.title, "aria-checked": String(it.value === value),
      class: it.value === value ? "on" : null,
      on: { click: () => onPick(it.value) },
    }, it.icon ? icon(it.icon, 15) : null, el("span", {}, it.label)));
  }
  return box;
}

function card(app, c) {
  const head = opts.head;
  const hero = { who: c.who, expr: c.expr, head };
  const style = `--ch-a: ${c.a}; --ch-b: ${c.b}; --ch-acc: ${c.acc};`; // custom properties need a style string
  const big = addButton(app, "ch-hero", hero, `Add ${c.name}`,
    el("img", { src: characterDataURL({ ...hero, dir: opts.dir, sticker: opts.sticker }), alt: "", draggable: "false",
      class: head ? "ch-hero-head" : null }));
  const faces = el("div.ch-faces", { role: "group", "aria-label": `${c.name}'s expressions` },
    EXPRS.map((x) => addButton(app, "ch-face", { who: c.who, expr: x.id, head }, `Add ${c.name}, ${x.label.toLowerCase()}`,
      el("img", { src: characterDataURL({ who: c.who, expr: x.id, head: true, dir: opts.dir }), alt: "", draggable: "false" }),
      el("span", {}, x.label))));
  return el("article.ch-card", { style },
    el("div.ch-name", {}, el("b", {}, c.name.toUpperCase()), el("i"), el("span", {}, c.line)),
    big, faces);
}

export function renderPanel(box, app) {
  const body = el("div.ch-panel");
  const draw = () => {
    body.replaceChildren(
      el("p.ch-intro", {}, "Our cast. Click to add one, or drag it onto your design. Select it later to change the face."),
      el("div.ch-opts", {},
        segmented([
          { value: false, label: "Full body", icon: "PersonStanding", title: "Add the whole character" },
          { value: true, label: "Head", icon: "CircleUser", title: "Add just the head (close-ups, stickers)" },
        ], opts.head, (v) => { opts.head = v; draw(); }, "Body or head"),
        segmented([
          { value: -1, label: "", icon: "ArrowLeft", title: "Face left" },
          { value: 1, label: "", icon: "ArrowRight", title: "Face right" },
        ], opts.dir, (v) => { opts.dir = v; draw(); }, "Facing"),
        el("button.ch-chip", {
          type: "button", title: "Sticker: a white die-cut edge with a soft shadow", "aria-pressed": String(opts.sticker),
          class: opts.sticker ? "on" : null, on: { click: () => { opts.sticker = !opts.sticker; draw(); } },
        }, icon("Sticker", 15), el("span", {}, "Sticker"))),
      ...CAST.map((c) => card(app, c)),
      el("p.ch-note", {}, "Sparks, Brick, Milo, Rae and the Keeper are the Oddly Clever cast. All rights reserved."),
    );
  };
  draw();
  box.append(body);
}

/** Drops from the panel onto the canvas: add the character there. */
export function wireDrop(app) {
  const host = app.shell.canvasHost;
  const ours = (e) => [...(e.dataTransfer?.types || [])].includes(DRAG_TYPE);
  host.addEventListener("dragover", (e) => {
    if (!ours(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  host.addEventListener("drop", (e) => {
    if (!ours(e)) return;
    e.preventDefault();
    let params;
    try { params = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)); } catch { return; }
    const r = app.editor.canvas.upperCanvasEl.getBoundingClientRect();
    add(app, params, app.editor.toPage(e.clientX - r.left, e.clientY - r.top));
  });
}
