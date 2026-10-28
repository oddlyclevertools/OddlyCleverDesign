// The Styles panel: the beginner's one-click restyle. Brand kit first, then colour palettes
// (with Shuffle) and font pairings. Hovering a card previews it on the design; a click applies
// it as one undo step.
import { el, icon } from "../../ui/kit.js";
import { PALETTES, PAIRINGS } from "./palettes.js";
import { createApplier, paletteJob, pairingJob } from "./apply.js";
import { VARIATIONS, resolvePalette } from "./recolor.js";
import { hexOf } from "./color.js";
import { renderBrand } from "./brand-ui.js";

/** Remembered across panel opens: the last palette and its Shuffle variation. */
const state = { palette: null, variation: 0 };

export function renderStylesPanel(box, app) {
  const applier = createApplier(app);
  box.classList.add("st-panel");

  const shuffleBtn = el("button.btn.small.st-shuffle", {
    type: "button", title: "Try another mix of the palette's colours", on: { click: () => shuffle() },
  }, icon("Shuffle", 15), "Shuffle");
  const shuffleInfo = el("small.st-faint");

  const markOn = () => {
    for (const c of box.querySelectorAll(".st-pal")) c.classList.toggle("on", c.dataset.id === state.palette?.id);
    shuffleInfo.textContent = state.palette ? `${state.palette.name} · look ${state.variation + 1} of ${VARIATIONS}` : "";
  };

  const applyPalette = async (p, variation = 0) => {
    const out = await applier.apply(paletteJob(app, p, variation, { remember: true }), "Colour palette");
    if (!out) return;
    state.palette = p;
    state.variation = variation;
    markOn();
  };

  const shuffle = () => {
    if (!state.palette) {
      const p = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      return applyPalette(p, 0);
    }
    return applyPalette(state.palette, (state.variation + 1) % VARIATIONS);
  };

  const paletteCard = (p) => {
    const P = resolvePalette(p, 0);
    const stripes = [P.bg, P.main, P.a1, P.a2, P.ink].map((c) => el("i", { style: { background: hexOf(c) } }));
    return el("button.st-pal", {
      type: "button", dataset: { id: p.id }, title: `${p.name}: ${p.mood}. Hover to preview, click to apply.`,
      "aria-label": `Colour palette ${p.name}`,
      on: {
        click: () => applyPalette(p, 0),
        mouseenter: () => applier.hover(`pal:${p.id}`, paletteJob(app, p, 0)),
        mouseleave: () => applier.leave(),
        focus: () => applier.hover(`pal:${p.id}`, paletteJob(app, p, 0)),
        blur: () => applier.leave(),
      },
    }, el("span.st-stripes", {}, stripes), el("span.st-pal-name", {}, p.name), el("small", {}, p.mood));
  };

  const pairCard = (pr) => el("button.st-pair", {
    type: "button", title: `${pr.name}: ${pr.head.family} + ${pr.body.family}. Hover to preview, click to apply.`,
    "aria-label": `Font pairing ${pr.name}: ${pr.head.family} and ${pr.body.family}`,
    on: {
      click: () => applier.apply(pairingJob(app, pr), "Font pairing"),
      mouseenter: () => applier.hover(`pair:${pr.id}`, pairingJob(app, pr)),
      mouseleave: () => applier.leave(),
      focus: () => applier.hover(`pair:${pr.id}`, pairingJob(app, pr)),
      blur: () => applier.leave(),
    },
  },
  el("span.st-pair-head", { style: { fontFamily: `"${pr.head.family}"`, fontWeight: pr.head.weight, fontStyle: pr.head.style } }, pr.name),
  el("span.st-pair-body", { style: { fontFamily: `"${pr.body.family}"`, fontWeight: pr.body.weight } }, `${pr.head.family} + ${pr.body.family}`));

  const brandBox = el("section.st-sec.st-brand");
  const cleanupBrand = renderBrand(brandBox, app, applier, { onPalette: (p) => applyPalette(p, 0) });

  const search = el("input.st-search", { type: "search", placeholder: "Find a palette or mood", "aria-label": "Find a palette or mood" });
  const palGrid = el("div.st-pal-grid", {}, PALETTES.map(paletteCard));
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    for (const c of palGrid.children) {
      const p = PALETTES.find((x) => x.id === c.dataset.id);
      c.hidden = Boolean(q) && !`${p.name} ${p.mood}`.toLowerCase().includes(q);
    }
  });

  box.append(
    el("p.st-lead", {}, icon("Wand2", 16), el("span", {}, "One click restyles the whole design. Hover to preview. Undo with Ctrl+Z.")),
    brandBox,
    el("section.st-sec", {},
      el("div.st-sec-head", {}, el("h4.sec-title", {}, "Colour palettes"), el("span.grow"), shuffleBtn),
      shuffleInfo,
      search,
      palGrid),
    el("section.st-sec", {},
      el("div.st-sec-head", {}, el("h4.sec-title", {}, "Font pairings")),
      el("p.st-hint", {}, "Big text gets the heading font, small text the body font."),
      el("div.st-pair-grid", {}, PAIRINGS.map(pairCard))),
  );
  markOn();

  const offs = [
    app.bus.on("doc", () => applier.end()),
    app.bus.on("view", (v) => { if (v !== "editor") applier.end(); }),
  ];
  return () => {
    applier.end();
    cleanupBrand?.();
    offs.forEach((off) => off?.());
  };
}

