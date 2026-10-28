// "Your designs" on the home screen: cards from the project store with Open, Rename,
// Make a copy and Delete, plus an empty state for first use.
import { closePopover, confirmDialog, el, icon, modal, popover, toast } from "../../ui/kit.js";
import { BRAND } from "../../ui/brand.js";
import { editedAgo } from "./cards.js";
import { matchWords } from "./registry.js";

const open = (id) => { location.hash = `#/d/${id}`; };

function askName(current) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v, close) => { if (!done) { done = true; close(); resolve(v); } };
    modal("Rename design", (close) => {
      const input = el("input.tp-rename", { type: "text", value: current, maxlength: 120, "aria-label": "Design name", spellcheck: false });
      const save = () => {
        const v = input.value.trim();
        if (!v) { input.focus(); return; }
        finish(v, close);
      };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
      setTimeout(() => { input.focus(); input.select(); }, 30);
      return el("div.tp-rename-box", {}, input, el("div.row.end", {},
        el("button.btn", { type: "button", on: { click: () => finish(null, close) } }, "Cancel"),
        el("button.btn.primary", { type: "button", on: { click: save } }, "Save")));
    }, { onClose: () => { if (!done) { done = true; resolve(null); } } });
    // Closing with Esc or the X just leaves the promise pending: nothing waits on it.
  });
}

function emptyState({ onEmptyCreate, onOpenFile }) {
  return el("div.tp-empty", {},
    el("div.tp-empty-art", { "aria-hidden": "true" }, el("i"), el("i"), el("i"), el("img.tp-empty-sparks", { src: BRAND.sparksGrin, alt: "", draggable: false })),
    el("div", {},
      el("h3", {}, "No designs yet"),
      el("p", {}, "Pick a size or a template to start. Everything you make is saved here, in this browser, so it works offline."),
      el("div.row", {},
        el("button.btn.primary", { type: "button", on: { click: onEmptyCreate } }, icon("Plus", 16), "Create a thumbnail"),
        el("button.btn", { type: "button", on: { click: onOpenFile } }, icon("FolderOpen", 16), "Open a design file"))));
}

/**
 * Fill `box` with the user's designs. Returns { filter(query), reload() }.
 * @param {HTMLElement} box
 */
export function renderDesigns(box, app, handlers) {
  let query = "";
  let cards = [];
  const grid = el("div.tp-dgrid");
  const none = el("p.tp-none", { hidden: true });

  async function act(kind, rec) {
    closePopover();
    try {
      if (kind === "open") return open(rec.id);
      if (kind === "rename") {
        const name = await askName(rec.name);
        if (!name || name === rec.name) return;
        const full = await app.store.getProject(rec.id);
        await app.store.saveProject({ ...full, name });
        toast("Renamed.");
      } else if (kind === "copy") {
        const full = await app.store.getProject(rec.id);
        await app.store.saveProject({ ...full, id: app.store.newProjectId(), name: `${full.name} (copy)` });
        toast("Copy made.");
      } else if (kind === "delete") {
        const ok = await confirmDialog("Delete this design?", `"${rec.name}" will be removed from this browser. This can't be undone.`, "Delete");
        if (!ok) return;
        await app.store.deleteProject(rec.id);
        toast("Design deleted.");
      }
      await reload();
    } catch (e) {
      toast(e.message, { error: true });
    }
  }

  function menu(anchor, rec) {
    const item = (ic, label, kind, cls = "") => el(`button.tp-menu-item${cls}`, { type: "button", role: "menuitem", on: { click: () => act(kind, rec) } }, icon(ic, 16), label);
    popover(anchor, el("div.tp-menu", { role: "menu", "aria-label": `${rec.name} options` },
      item("ExternalLink", "Open", "open"),
      item("Pencil", "Rename", "rename"),
      item("Copy", "Make a copy", "copy"),
      el("hr"),
      item("Trash2", "Delete", "delete", ".danger")), { align: "end", cls: "tp-pop" });
  }

  function card(rec, i) {
    const more = el("button.ibtn.tp-more", { type: "button", title: "More options", "aria-label": `More options for ${rec.name}`, "aria-haspopup": "menu",
      on: { click: (e) => { e.stopPropagation(); menu(more, rec); } } }, icon("Ellipsis", 18));
    const ratio = rec.width && rec.height ? `${rec.width} / ${rec.height}` : "16 / 9";
    const c = el("article.tp-design", { style: { "--i": i }, dataset: { hay: `${rec.name} ${rec.width}x${rec.height}`.toLowerCase() } },
      el("button.tp-design-open", { type: "button", title: `Open ${rec.name}`, on: { click: () => open(rec.id) } },
        el("span.tp-design-thumb", {}, rec.thumb
          ? el("img", { src: rec.thumb, alt: "", draggable: false })
          : el("span.tp-design-blank", { style: { aspectRatio: ratio } })),
        el("span.tp-design-meta", {},
          el("b", {}, rec.name || "Untitled design"),
          el("small", {}, `${rec.width} × ${rec.height}`, el("i", {}, "·"), editedAgo(rec.updated)))),
      more);
    return c;
  }

  function applyFilter() {
    let n = 0;
    for (const c of cards) {
      c.hidden = !matchWords(c.dataset.hay, query);
      if (!c.hidden) n++;
    }
    none.hidden = !cards.length || n > 0;
    none.textContent = `None of your designs match "${query}".`;
  }

  async function reload() {
    let list = [];
    try {
      list = await app.store.listProjects();
    } catch (e) {
      box.replaceChildren(el("p.tp-none", {}, `Couldn't read your designs: ${e.message}`));
      return;
    }
    if (!list.length) {
      cards = [];
      box.replaceChildren(emptyState(handlers));
      return;
    }
    cards = list.map(card);
    grid.replaceChildren(...cards);
    box.replaceChildren(grid, none);
    applyFilter();
  }

  box.append(el("div.tp-dgrid.tp-skeleton", {}, [0, 1, 2, 3].map(() => el("span.tp-design-ghost"))));
  reload();
  return {
    filter(q) { query = q; applyFilter(); },
    reload,
  };
}
