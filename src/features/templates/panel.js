// The editor's Templates panel: templates that fit the page come first. Clicking one opens a
// large preview first; nothing changes until they pick "Use on this page" (replaces the page),
// "Add as a new page" or "Open as a new design". Each is a single undo step.
import { el, icon, modal, toast } from "../../ui/kit.js";
import { stagger } from "../../ui/motion.js";
import { addTemplatePage, applyTemplate, sizeOf } from "./engine.js";
import { previewBox, startFromTemplate } from "./cards.js";
import { CATEGORIES, TEMPLATES, categoryOf, matchesTemplate, sizeLabel } from "./registry.js";
import { askSaveTemplate, removeTemplateButton } from "../library/panel.js";
import { onLibraryChange } from "../library/store.js";

const state = { query: "", category: "all" };

/** 2 = same size, 1 = same shape (aspect ratio), 0 = different. */
function fitScore(tpl, W, H) {
  const { w, h } = sizeOf(tpl);
  if (w === W && h === H) return 2;
  return Math.abs(w / h - W / H) < 0.01 ? 1 : 0;
}

export function renderTemplatesPanel(box, app) {
  const ed = app.editor;
  let busy = false;
  let shownSize = "";

  /** Run one of the preview's actions with the card marked busy. */
  async function act(card, fn, failText) {
    if (busy) return;
    busy = true;
    card?.classList.add("tp-busy");
    try {
      await fn();
    } catch (e) {
      toast(`${failText}: ${e.message}`, { error: true });
    } finally {
      busy = false;
      card?.classList.remove("tp-busy");
    }
  }

  const apply = (tpl, card) => act(card, async () => {
    const fits = fitScore(tpl, ed.width, ed.height) > 0;
    await applyTemplate(ed, tpl);
    toast(fits ? `${tpl.name} applied. Ctrl+Z undoes it.` : `${tpl.name} applied, scaled to fit this page. Ctrl+Z undoes it.`);
  }, "Couldn't apply that template");

  const addPage = (tpl, card) => act(card, async () => {
    const i = await addTemplatePage(app, tpl);
    toast(`${tpl.name} added as page ${i + 1}. Ctrl+Z undoes it.`);
  }, "Couldn't add that page");

  /** The large preview with the three choices. Nothing changes until one is picked. */
  function openPreview(tpl, card) {
    const { dims } = sizeLabel(tpl);
    const fits = fitScore(tpl, ed.width, ed.height);
    const hasStuff = ed.objects().length > 0;
    const fitNote = fits === 2 ? `Same size as your page (${dims} px).`
      : fits === 1 ? `Same shape as your page, made ${ed.width} × ${ed.height} px.`
        : `Made for ${dims} px. On this page it's scaled to fit; Open as a new design keeps its own size.`;
    modal(tpl.name, (close) => {
      const go = (fn) => () => { close(); fn(); };
      const useBtn = el("button.btn.primary", { type: "button", on: { click: go(() => apply(tpl, card)) } },
        icon("Replace", 16), "Use on this page");
      setTimeout(() => useBtn.focus(), 30);
      return el("div.tp-big", {},
        previewBox(tpl, "tp-big-prev"),
        el("p.tp-big-note", {}, icon(fits ? "Check" : "Scaling", 14), fitNote),
        hasStuff ? el("p.tp-big-warn", {}, icon("TriangleAlert", 14), "Use on this page replaces everything on it. Ctrl+Z brings it back.") : null,
        el("div.tp-big-actions", {},
          useBtn,
          el("button.btn", { type: "button", title: `Keep this page and add ${tpl.name} after it`, on: { click: go(() => addPage(tpl, card)) } },
            icon("FilePlus2", 16), "Add as a new page"),
          el("button.btn", { type: "button", title: "Start a separate design at the template's own size", on: { click: go(() => startFromTemplate(app, tpl)) } },
            icon("SquarePlus", 16), "Open as a new design")));
    }, { wide: true });
  }

  function card(tpl) {
    const { dims } = sizeLabel(tpl);
    const c = el("div.tp-pcard", {},
      el("button.tp-pcard-main", { type: "button", title: `Preview ${tpl.name} (${dims} px)`, "aria-haspopup": "dialog", on: { click: () => openPreview(tpl, c) } },
        previewBox(tpl, "tp-prev"),
        el("span.tp-pcard-name", {}, tpl.name, el("small", {}, dims))),
      el("button.tp-pcard-new", { type: "button", title: "Open in a new design at its own size", "aria-label": `Open ${tpl.name} in a new design`,
        on: { click: () => startFromTemplate(app, tpl) } }, icon("SquarePlus", 15)),
      tpl.mine ? removeTemplateButton(tpl) : null);
    return c;
  }

  const search = el("input.tp-psearch-input", {
    type: "search", placeholder: "Search templates", value: state.query, "aria-label": "Search templates", spellcheck: false,
    on: { input: () => { state.query = search.value; list(); } },
  });
  const chipRow = el("div.tp-chips.tp-pchips", {}, CATEGORIES.map((c) => el("button.tp-chip", {
    type: "button", class: c.id === state.category ? "on" : null, "aria-pressed": String(c.id === state.category),
    on: { click: (e) => {
      state.category = c.id;
      for (const b of chipRow.children) { b.classList.toggle("on", b === e.currentTarget); b.setAttribute("aria-pressed", String(b === e.currentTarget)); }
      list();
    } },
  }, c.label)));
  const results = el("div.tp-presults");

  function list() {
    const W = ed.width, H = ed.height;
    shownSize = `${W}x${H}`;
    const q = state.query.trim().toLowerCase();
    const shown = TEMPLATES
      .filter((t) => (state.category === "all" || categoryOf(t) === state.category) && matchesTemplate(t, q))
      .map((t) => ({ t, score: fitScore(t, W, H) }))
      .sort((a, b) => b.score - a.score);
    const fit = shown.filter((x) => x.score > 0), other = shown.filter((x) => x.score === 0);
    const block = (title, note, items) => (items.length ? el("section.tp-pblock", {},
      el("h4.sec-title", {}, title, note ? el("span.tp-pnote", {}, note) : null),
      el("div.tp-pgrid", {}, items.map((x) => card(x.t)))) : null);
    results.replaceChildren(...[
      block(`Fits this page`, `${W} × ${H}`, fit),
      block(fit.length ? "Other sizes" : "Templates", "scaled to fit", other),
      shown.length ? null : emptyNote(q)].filter(Boolean)); // replaceChildren(null) would print "null"
    results.querySelectorAll(".tp-pgrid").forEach((g) => stagger(g, { max: 12 }));
  }

  /** A friendly empty state, with a way out when a search found nothing. */
  function emptyNote(q) {
    const clear = q || state.category !== "all" ? el("button.btn.small", { type: "button", on: { click: () => {
      state.query = ""; search.value = ""; state.category = "all";
      for (const b of chipRow.children) { const on = b === chipRow.firstElementChild; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }
      list();
      search.focus();
    } } }, icon("RotateCcw", 14), "Show all templates") : null;
    return el("div.tp-none.tp-pempty.oc-enter", {},
      el("span.tp-pempty-ic", {}, icon(q ? "SearchX" : "LayoutTemplate", 22)),
      el("p", {}, q ? `No templates match "${state.query.trim()}".` : "No templates here yet."),
      el("small", {}, q ? "Try a shorter word, or another category." : "Pick another category, or save this design as a template."),
      clear);
  }

  const saveBtn = el("button.btn.small.tp-save-tpl", { type: "button", title: "Keep this design as a template for later",
    on: { click: () => askSaveTemplate(app) } }, icon("BookmarkPlus", 15), "Save this design as a template");
  box.append(el("label.tp-psearch", {}, icon("Search", 16), search), saveBtn, chipRow, results);
  list();
  const off = app.bus.on("doc", () => { if (`${ed.width}x${ed.height}` !== shownSize) list(); });
  // The library syncs TEMPLATES first; repaint once it has.
  const offLib = onLibraryChange(() => setTimeout(list, 50));
  return () => { off(); offLib(); };
}
