// The Text panel: "Add a text box", the heading / subheading / body buttons and the presets,
// grouped by mood (chips filter them). Tiles are live previews drawn with the real fonts and
// effects; hovering one shows it big beside the panel.
import { el, icon, toast } from "../../ui/kit.js";
import { BASICS, PRESETS, MOODS, addBasic, addPreset, presetPreview } from "./presets.js";

let lastMood = "All";

export function renderTextPanel(box, app) {
  let alive = true;
  let mood = lastMood;
  const safe = (fn) => async () => {
    try { await fn(); } catch (e) { toast(`Couldn't add the text: ${e.message}`, { error: true }); }
  };

  const addBox = el("button.btn.primary.tx-addbox", {
    type: "button", title: "Add a text box (T)", on: { click: safe(() => addBasic(app, "body", { edit: true })) },
  }, icon("Type", 17), "Add a text box");

  const basics = el("div.tx-basics", {}, BASICS.map((b) => el(`button.tx-basic.${b.cls}`, {
    type: "button", title: b.label, style: { fontFamily: `"${b.font}"`, fontWeight: b.weight },
    on: { click: safe(() => addBasic(app, b.id)) },
  }, b.label)));

  // ---- hover card: the preset shown big beside the panel ----
  const hoverCard = el("div.tx-hover-card", { "aria-hidden": "true" }, el("img", { alt: "" }), el("b"), el("small"));
  document.body.append(hoverCard);
  let hoverTimer = null;
  const showHover = (tile, p) => {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(async () => {
      let url;
      try { url = await presetPreview(p); } catch { return; }
      if (!alive || !tile.matches(":hover, :focus-visible")) return;
      hoverCard.className = `tx-hover-card tx-bg-${p.bg}`;
      hoverCard.querySelector("img").src = url;
      hoverCard.querySelector("b").textContent = p.label;
      hoverCard.querySelector("small").textContent = `${p.mood} · click to add`;
      const r = tile.getBoundingClientRect(), pr = box.getBoundingClientRect();
      const top = Math.max(8, Math.min(r.top + r.height / 2 - 120, innerHeight - 260));
      hoverCard.style.left = `${pr.right + 14}px`;
      hoverCard.style.top = `${top}px`;
      hoverCard.classList.add("show");
    }, 220);
  };
  const hideHover = () => {
    clearTimeout(hoverTimer);
    hoverCard.classList.remove("show");
  };

  const tile = (p) => {
    const img = el("img", { alt: "", draggable: false });
    const t = el(`button.tx-preset.tx-bg-${p.bg}`, {
      type: "button", title: p.label, "aria-label": `Add text style: ${p.label}`,
      on: {
        click: safe(async () => { hideHover(); await addPreset(app, p); }),
        mouseenter: () => showHover(t, p), mouseleave: hideHover,
        focus: () => showHover(t, p), blur: hideHover,
      },
    }, img, el("span.tx-preset-name", {}, p.label));
    presetPreview(p).then((url) => {
      if (!alive) return;
      img.src = url;
      t.classList.add("ready");
    }).catch(() => t.classList.add("ready"));
    return t;
  };

  const tiles = new Map(PRESETS.map((p) => [p.id, tile(p)]));
  const grid = el("div.tx-preset-groups");
  const chips = el("div.tx-mood-chips", { role: "tablist", "aria-label": "Text style moods" });

  const paint = () => {
    chips.replaceChildren(...["All", ...MOODS].map((m) => el("button.tx-mood-chip", {
      type: "button", role: "tab", "aria-selected": String(m === mood), class: m === mood ? "on" : null,
      on: { click: () => { mood = lastMood = m; paint(); } },
    }, m)));
    const moods = mood === "All" ? MOODS : [mood];
    grid.replaceChildren(...moods.map((m) => {
      const list = PRESETS.filter((p) => p.mood === m);
      if (!list.length) return null;
      return el("div.tx-preset-group", {}, mood === "All" ? el("h5", {}, m) : null, el("div.tx-presets", {}, list.map((p) => tiles.get(p.id))));
    }).filter(Boolean));
  };
  paint();

  box.append(
    addBox,
    el("h4.sec-title.tx-gap", {}, "Default text styles"),
    basics,
    el("h4.sec-title.tx-gap", {}, `Text styles (${PRESETS.length})`),
    el("p.tx-hint", {}, "One click adds a styled text. Every look stays editable in Effects."),
    chips,
    grid,
  );
  return () => {
    alive = false;
    hideHover();
    hoverCard.remove();
  };
}
