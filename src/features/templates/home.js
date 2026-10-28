// The home screen: a hero with search, size cards (plus a custom size), your designs, and the
// template gallery. It is rebuilt every time the home view opens; filters live in `state`.
import { SIZES, MAX_SIDE, resolveSize } from "../../core/sizes.js";
import { BRAND, logo, modKey, openPalette, registerCommands, wordmark } from "../../ui/shell.js";
import { el, icon, toast } from "../../ui/kit.js";
import { homeTemplateCard, startFromTemplate } from "./cards.js";
import { CATEGORIES, TEMPLATES, categoryOf, matchWords, matchesTemplate, sizeLabel } from "./registry.js";
import { renderDesigns } from "./designs.js";

const state = { query: "", sizeGroup: "all", category: "all", custom: { w: 1280, h: 720 }, allSizes: false };
const COLLAPSED_SIZES = 13; // two rows on a laptop screen, with the custom size card

const GROUP_ICON = { Video: "Play", Social: "Heart", "Print & slides": "FileText" };
const QUICK = ["yt-thumb", "shorts", "ig-post", "yt-banner", "poster"];
const QUICK_LABEL = { "yt-thumb": "YouTube thumbnail", shorts: "Short / Reel", "ig-post": "Square post", "yt-banner": "Channel banner", poster: "Poster" };

// Templates and your designs in the command palette (Ctrl+K).
registerCommands(() => TEMPLATES.map((t) => ({
  id: `tpl:${t.id}`, label: t.name, hint: `${sizeLabel(t).name} · new design`, group: "Template", icon: "LayoutTemplate",
  keywords: `template ${(t.tags || []).join(" ")} ${categoryOf(t)}`, run: (a) => startFromTemplate(a, t),
})));
registerCommands(async (app) => {
  try {
    return (await app.store.listProjects()).slice(0, 30).map((r) => ({
      id: `design:${r.id}`, label: `Open “${r.name || "Untitled design"}”`, hint: `${r.width} × ${r.height}`, group: "Design", icon: "Image",
      keywords: "open my design recent saved", run: () => { location.hash = `#/d/${r.id}`; },
    }));
  } catch { return []; } // the store is unavailable: the palette still works without designs
});

const words = (q) => q.trim().toLowerCase();

/** A small shape with the size's aspect ratio, for size cards. */
function shapeOf(w, h, group, max = 52) {
  const k = max / Math.max(w, h), min = max / 4;
  return el("span.tp-shape", { dataset: { group }, style: { width: `${Math.max(min, w * k)}px`, height: `${Math.max(min, h * k)}px` } },
    max >= 40 ? icon(GROUP_ICON[group] || "Square", 14) : null);
}

function sizeCard(s, app, i) {
  const hay = `${s.name} ${s.group} ${s.w}x${s.h} ${s.w} × ${s.h}`.toLowerCase();
  return el("button.tp-size", {
    type: "button", title: `New ${s.name} (${s.w} × ${s.h} px)`, dataset: { hay, group: s.group }, style: { "--i": i },
    on: { click: () => app.newDesign({ size: s.id }).catch((e) => toast(e.message, { error: true })) },
  }, el("span.tp-shape-box", {}, shapeOf(s.w, s.h, s.group)),
  el("span.tp-size-name", {}, s.name), el("span.tp-size-dims", {}, `${s.w} × ${s.h} px`));
}

function customCard(app) {
  const err = el("span.tp-custom-err", { role: "alert" });
  const num = (key, label) => el("input.tp-num", {
    type: "number", min: 16, max: MAX_SIDE, step: 1, value: state.custom[key], "aria-label": label, title: label,
    on: { input: (e) => { state.custom = { ...state.custom, [key]: e.target.value }; err.textContent = ""; card.classList.remove("tp-bad"); },
      keydown: (e) => { if (e.key === "Enter") create(); } },
  });
  const create = () => {
    try {
      const { w, h } = resolveSize({ w: state.custom.w, h: state.custom.h });
      app.newDesign({ size: { w, h } }).catch((e) => toast(e.message, { error: true }));
    } catch (e) {
      err.textContent = e.message;
      card.classList.add("tp-bad");
    }
  };
  const card = el("div.tp-size.tp-custom", { dataset: { hay: "custom size width height any" } },
    el("span.tp-custom-head", {}, icon("Ruler", 16), "Custom size"),
    el("span.tp-custom-row", {}, num("w", "Width in pixels"), el("span.tp-x", {}, "×"), num("h", "Height in pixels"), el("small", {}, "px")),
    el("button.btn.small.primary", { type: "button", on: { click: create } }, "Create"),
    err);
  return card;
}

function chips(list, current, onPick, cls = "tp-chips") {
  const row = el(`div.${cls}`, { role: "tablist" });
  for (const c of list) {
    row.append(el("button.tp-chip", {
      type: "button", role: "tab", "aria-selected": String(c.id === current), class: c.id === current ? "on" : null,
      on: { click: (e) => {
        for (const btn of row.children) {
          btn.classList.toggle("on", btn === e.currentTarget);
          btn.setAttribute("aria-selected", String(btn === e.currentTarget));
        }
        onPick(c.id);
      } },
    }, c.label));
  }
  return row;
}

function hero(app, onSearch) {
  const input = el("input.tp-search-input", {
    type: "search", placeholder: "Search sizes, templates and your designs", value: state.query, "aria-label": "Search sizes, templates and your designs",
    spellcheck: false, on: { input: () => onSearch(input.value) },
  });
  const quick = el("div.tp-quick", {}, QUICK.map((id, i) => {
    const s = SIZES.find((x) => x.id === id);
    return el("button.tp-quick-btn", { type: "button", style: { "--i": i }, title: `New ${s.name} (${s.w} × ${s.h} px)`,
      on: { click: () => app.newDesign({ size: id }).catch((e) => toast(e.message, { error: true })) } },
    shapeOf(s.w, s.h, s.group, 18), QUICK_LABEL[id] || s.name.split(" (")[0]);
  }));
  const set = el("div.tp-set", { "aria-hidden": "true" },
    el("i.tp-rain"),
    el("span.tp-side-sign", {}, "FREE · OFFLINE · NO ACCOUNT"),
    el("span.tp-side-sign.tp-left-sign", {}, "OPEN ALL NIGHT"),
    el("img.tp-hero-sparks", { src: BRAND.sparks, alt: "", draggable: false }),
    el("div.tp-sign", {},
      el("b.tp-sign-odd", {}, "ODDLY"),
      el("i.tp-sign-clever", {}, "clever"),
      el("span.tp-sign-label", {}, "We found the loophole. You didn't.")),
    el("i.tp-street"));
  return el("section.tp-hero", {},
    set,
    el("div.tp-ask", {},
      el("h1.tp-hero-title", {}, "What are you making today?"),
      el("p.tp-hero-sub", {}, "Thumbnails, Shorts covers, posts and posters. Free, offline, and saved in this browser."),
      el("label.tp-search", {}, icon("Search", 18), input, el("kbd", { title: "Search every tool and action" }, `${modKey} K`)),
      quick));
}

function nav(app, fileInput) {
  const help = el("button.help-btn", { type: "button", "aria-label": "Help and tips", "data-tip": "Help and tips",
    on: { click: () => app.onboard?.showHelp(help) } }, "?");
  return el("header.tp-nav", {},
    el("a.brand", { href: "#/", title: "Home" }, logo(), wordmark()),
    el("span.grow"),
    el("button.cmd-pill.tp-cmd", { type: "button", "aria-label": "Search everything", on: { click: () => openPalette(app) } },
      icon("Search", 16), el("span", {}, "What do you want to do?"), el("kbd", {}, `${modKey} K`)),
    el("span.grow"),
    el("button.btn", { type: "button", title: "Plan your posts and make upload kits", on: { click: () => app.planner?.open() } }, icon("CalendarDays", 16), "Content planner"),
    el("button.btn", { type: "button", title: "Open an .ocd design file", on: { click: () => fileInput.click() } }, icon("FolderOpen", 16), "Open a design file"),
    el("button.btn.primary", { type: "button", on: { click: () => app.newDesign({ size: "yt-thumb" }) } }, icon("Plus", 16), "New thumbnail"),
    help);
}

function fileOpener(app) {
  const input = el("input", { type: "file", accept: ".ocd,.json,application/json", hidden: true, "aria-hidden": "true" });
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!app.files?.importDesignFile) {
      toast("Opening design files isn't available yet.", { error: true });
      return;
    }
    try {
      await app.files.importDesignFile(file);
    } catch (e) {
      toast(`Couldn't open ${file.name}: ${e.message}`, { error: true });
    }
  });
  return input;
}

/** Show or hide cards by the search query and filters; returns how many are visible. */
function filterCards(cards, test) {
  let n = 0;
  for (const c of cards) {
    const ok = test(c);
    c.hidden = !ok;
    if (ok) n++;
  }
  return n;
}

export function renderHome(box, app) {
  const fileInput = fileOpener(app);

  // Sizes.
  const groups = [...new Set(SIZES.map((s) => s.group))];
  const sizeCards = SIZES.map((s, i) => sizeCard(s, app, i + 1));
  const custom = customCard(app);
  const sizeGrid = el("div.tp-size-grid", {}, custom, sizeCards);
  const sizeEmpty = el("p.tp-none", { hidden: true });
  const moreSizes = el("button.btn.small.ghost.tp-more-sizes", { type: "button", on: { click: () => { state.allSizes = !state.allSizes; refilter(); } } });
  const sizeChips = chips([{ id: "all", label: "All sizes" }, ...groups.map((g) => ({ id: g, label: g }))], state.sizeGroup,
    (id) => { state.sizeGroup = id; refilter(); });

  // Templates.
  const tplCards = TEMPLATES.map((t, i) => {
    const c = homeTemplateCard(t, app, i);
    c.tpl = t;
    return c;
  });
  const tplGrid = el("div.tp-tgrid", {}, tplCards);
  const tplEmpty = el("p.tp-none", { hidden: true });
  const tplChips = chips(CATEGORIES, state.category, (id) => { state.category = id; refilter(); });

  // Your designs.
  const designsBox = el("div.tp-designs-box");
  const designs = renderDesigns(designsBox, app, { onEmptyCreate: () => app.newDesign({ size: "yt-thumb" }), onOpenFile: () => fileInput.click() });

  function refilter() {
    const q = words(state.query);
    const collapsed = !state.allSizes && !q && state.sizeGroup === "all";
    const nSizes = filterCards(sizeCards, (c) => (state.sizeGroup === "all" || c.dataset.group === state.sizeGroup)
      && matchWords(c.dataset.hay, q) && !(collapsed && sizeCards.indexOf(c) >= COLLAPSED_SIZES));
    moreSizes.hidden = Boolean(q) || state.sizeGroup !== "all";
    moreSizes.replaceChildren(icon(state.allSizes ? "ChevronUp" : "ChevronDown", 15),
      state.allSizes ? "Show fewer sizes" : `Show all ${sizeCards.length} sizes`);
    custom.hidden = Boolean(q) && !matchWords(custom.dataset.hay, q) && nSizes > 0;
    sizeEmpty.hidden = nSizes > 0 || !custom.hidden;
    sizeEmpty.textContent = `No sizes match "${state.query.trim()}".`;
    const nT = filterCards(tplCards, (c) => (state.category === "all" || categoryOf(c.tpl) === state.category) && matchesTemplate(c.tpl, q));
    tplEmpty.hidden = nT > 0;
    tplEmpty.textContent = q ? `No templates match "${state.query.trim()}".` : "No templates in this group yet.";
    designs.filter(q);
  }

  const main = el("div.tp-main", {},
    el("section.tp-sec", { id: "tp-sizes" },
      el("div.tp-sec-head", {}, el("h2", {}, "Start a design"), sizeChips),
      sizeGrid, sizeEmpty, moreSizes),
    el("section.tp-sec", { id: "tp-designs" },
      el("div.tp-sec-head", {}, el("h2", {}, "Your designs"), el("span.tp-sec-note", {}, "Saved in this browser")),
      designsBox),
    el("section.tp-sec", { id: "tp-templates" },
      el("div.tp-sec-head", {}, el("h2", {}, "Templates"), tplChips),
      tplGrid, tplEmpty));

  const root = el("div.tp-home", {}, nav(app, fileInput), hero(app, (v) => { state.query = v; refilter(); }), main, fileInput);
  box.replaceChildren(root);
  refilter();
}
