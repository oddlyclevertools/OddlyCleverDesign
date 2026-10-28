// The Effects side panel (opened from the text toolbar). Style tiles: Shadow, Neon, Outline and
// Background stack with each other; Lift, Hollow, Splice, Echo and Glitch are "looks" (one at a
// time). Each effect on the text shows its own sliders. Shape: Curve.
import { ensureFont } from "../../core/fonts.js";
import { el, icon, iconButton, slider, colorButton, toHex } from "../../ui/kit.js";
import { EFFECTS, ORDER, normalizeEffect, withEffect } from "./effects.js";
import { OcText, solidOf } from "./octext.js";
import { applyToTexts, setData, targets } from "./helpers.js";

const TILE_FILL = "#6d5df5";
const tileCache = new Map();

/** A small "Ag" drawn with the effect itself, for the tile. */
function tilePreview(id, curve = 0) {
  const key = `${id}:${curve}`;
  if (!tileCache.has(key)) tileCache.set(key, ensureFont("Montserrat", 800).then(() => drawTile(id, curve)));
  return tileCache.get(key);
}

/** An <img> that shows the tile preview once it's drawn. */
function thumbImg(id, curve = 0) {
  const img = el("img", { alt: "" });
  tilePreview(id, curve).then((url) => { img.src = url; }).catch(() => {});
  return img;
}

function drawTile(id, curve) {
  const W = 92, H = 64, dpr = Math.min(2, window.devicePixelRatio || 1);
  const t = new OcText(curve ? "Curved" : "Ag", {
    fontFamily: "Montserrat", fontWeight: 800, fontSize: curve ? 22 : 38, fill: TILE_FILL, width: curve ? 110 : 80,
    textAlign: "center", data: { effect: id && id !== "none" ? { [id]: {} } : null, curve },
  });
  const c = document.createElement("canvas");
  c.width = W * dpr;
  c.height = H * dpr;
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.translate(W / 2, H / 2 + (curve ? 4 : 0));
  t.setPositionByOrigin({ x: 0, y: 0 }, "center", "center");
  t.render(ctx);
  return c.toDataURL("image/png");
}

const effectOf = (t) => normalizeEffect(t.data?.effect);

/** Set one param of effect `id` on every selected text. */
function setParam(app, id, key, value, merge) {
  applyToTexts(app, (t) => {
    const fx = effectOf(t);
    if (!fx?.[id]) return;
    setData(t, { effect: withEffect(fx, id, { [key]: value }) });
  }, `Effect ${id}`, { merge });
}

function toggleEffect(app, id, on) {
  applyToTexts(app, (t) => setData(t, { effect: withEffect(effectOf(t), id, on ? {} : null) }),
    on ? `Add ${id}` : `Remove ${id}`);
}

function clearEffects(app) {
  applyToTexts(app, (t) => setData(t, { effect: null }), "Remove effects");
}

function setCurve(app, v, merge) {
  applyToTexts(app, (t) => setData(t, { curve: v }), "Curve", { merge, keepCenter: true });
}

function controlFor(app, id, ctrl, p, base) {
  if (ctrl.type === "color") {
    const value = p[ctrl.key] || base;
    const btn = colorButton({
      value, title: ctrl.label,
      onChange: (v, done) => setParam(app, id, ctrl.key, toHex(v) || v, !done),
    });
    return el("div.tx-fx-color", {}, el("span.slider-label", {}, ctrl.label), btn,
      ctrl.auto && !p[ctrl.key] ? el("small.tx-auto", {}, "Matches the text") : null);
  }
  return slider({
    label: ctrl.label, min: ctrl.min, max: ctrl.max, step: ctrl.step || 1, unit: ctrl.unit || "", value: p[ctrl.key],
    onInput: (v) => setParam(app, id, ctrl.key, v, true),
    onChange: (v) => setParam(app, id, ctrl.key, v, false),
  });
}

export function renderEffectsPanel(box, app) {
  const body = el("div.tx-fx");
  box.append(body);

  const paint = () => {
    const list = targets(app);
    if (!list.length) {
      body.replaceChildren(el("div.tx-fx-empty", {}, icon("Type", 28),
        el("p", {}, "Select a text to add effects."),
        el("button.btn.small", { type: "button", on: { click: () => app.openPanel("text") } }, "Open Text")));
      return;
    }
    const t = list[0];
    const fx = effectOf(t) || {};
    const base = toHex(solidOf(t.fill, "#000000")) || "#000000";
    const curve = Number(t.data?.curve) || 0;

    const tile = (id, label, on, click) => el("button.tx-fx-tile", {
      type: "button", class: on ? "on" : null, "aria-pressed": String(on), title: id === "none" ? "Remove all effects" : EFFECTS[id]?.hint || label,
      on: { click },
    }, el("span.tx-fx-thumb", {}, thumbImg(id), on && id !== "none" ? el("i.tx-fx-check", {}, icon("Check", 12)) : null),
    el("span.tx-fx-label", {}, label));

    const tiles = [tile("none", "None", !Object.keys(fx).length, () => { clearEffects(app); paint(); })];
    for (const id of ORDER) {
      tiles.push(tile(id, EFFECTS[id].label, Boolean(fx[id]), () => { toggleEffect(app, id, !fx[id]); paint(); }));
    }

    const cards = ORDER.filter((id) => fx[id]).map((id) => el("div.tx-fx-card", {},
      el("div.tx-fx-card-head", {},
        el("b", {}, EFFECTS[id].label),
        el("small", {}, EFFECTS[id].kind === "look" ? "Look" : "Layer"),
        el("span.grow"),
        iconButton("X", `Remove ${EFFECTS[id].label.toLowerCase()}`, () => { toggleEffect(app, id, false); paint(); })),
      EFFECTS[id].controls.map((c) => controlFor(app, id, c, fx[id], base))));

    const curveTiles = el("div.tx-fx-grid", {},
      el("button.tx-fx-tile", { type: "button", class: curve ? null : "on", "aria-pressed": String(!curve), title: "Straight text",
        on: { click: () => { setCurve(app, 0, false); paint(); } } },
      el("span.tx-fx-thumb", {}, thumbImg("none")), el("span.tx-fx-label", {}, "None")),
      el("button.tx-fx-tile", { type: "button", class: curve ? "on" : null, "aria-pressed": String(Boolean(curve)), title: "Bend the text on an arc",
        on: { click: () => { if (!curve) { setCurve(app, 50, false); paint(); } } } },
      el("span.tx-fx-thumb", {}, thumbImg("none", 60)), el("span.tx-fx-label", {}, "Curve")));

    body.replaceChildren(...[ // replaceChildren would print null as text, so drop the empty parts
      el("section.sec", {}, el("h4.sec-title", {}, "Style"),
        el("p.tx-hint", {}, "Shadow, Neon, Chrome, Sticker, Outline and Background stack. The other styles are one at a time."),
        el("div.tx-fx-grid", {}, tiles)),
      cards.length ? el("div.tx-fx-cards", {}, cards) : null,
      el("section.sec", {}, el("h4.sec-title", {}, "Shape"), curveTiles,
        curve ? slider({
          label: "Curve", min: -100, max: 100, step: 1, value: curve,
          onInput: (v) => setCurve(app, v, true),
          onChange: (v) => setCurve(app, v, false),
        }) : null),
      list.length > 1 ? el("p.tx-hint", {}, `Changes apply to all ${list.length} selected texts.`) : null,
    ].filter(Boolean));
  };

  paint();
  const offs = [app.bus.on("selection", paint), app.bus.on("doc", paint)];
  return () => offs.forEach((off) => off());
}
