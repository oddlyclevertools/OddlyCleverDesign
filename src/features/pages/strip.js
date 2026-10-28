// The page strip under the canvas: a thumbnail of every page, add, duplicate, delete (with a
// confirm), rename, speaker notes, and drag to reorder. Collapses to a slim bar.
import { closePopover, confirmDialog, el, icon, iconButton, popover, toast } from "../../ui/kit.js";
import { stagger } from "../../ui/motion.js";
import { MAX_PAGES } from "../../core/editor.js";
import { pageThumb } from "./render.js";
import { addPage, deletePage, duplicatePage, goToPage, movePage, renamePage } from "./actions.js";

const PREF = "pg-strip-open";
const THUMB_H = 60;

const readOpen = () => {
  try { const v = localStorage.getItem(PREF); return v === null ? null : v === "1"; } catch { return null; }
};
const writeOpen = (on) => { try { localStorage.setItem(PREF, on ? "1" : "0"); } catch { /* storage blocked */ } };

/** Ask, then delete page i. */
export async function confirmDeletePage(app, i) {
  const ed = app.editor;
  if (ed.pageCount === 1) {
    toast("A design needs at least one page.", { error: true });
    return false;
  }
  const p = ed.listPages()[i];
  const n = ed.objects().length;
  const ok = await confirmDialog("Delete this page?", `“${p.name}” and everything on it will be deleted. You can undo this with ${navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}+Z.${i === ed.pageIndex && n ? ` It has ${n} item${n > 1 ? "s" : ""}.` : ""}`, "Delete page");
  if (!ok) return false;
  try {
    await deletePage(app, i);
    return true;
  } catch (e) {
    toast(`Couldn't delete the page: ${e.message}`, { error: true });
    return false;
  }
}

/** The speaker notes editor for page i (a popover body). */
export function notesEditor(app, i) {
  const ed = app.editor;
  const p = ed.listPages()[i];
  const ta = el("textarea.pg-notes-input", {
    rows: 7, placeholder: "What you want to say on this page. Only you see these, in the presenter view.",
    "aria-label": `Speaker notes for ${p.name}`, value: p.notes,
  });
  ta.addEventListener("input", () => {
    try { ed.setPageNotes(i, ta.value, { merge: true }); } catch (e) { toast(e.message, { error: true }); }
  });
  ta.addEventListener("change", () => {
    try { ed.setPageNotes(i, ta.value); } catch { /* the page went away */ }
  });
  requestAnimationFrame(() => ta.focus());
  return el("div.pg-notes", {}, el("div.pg-pop-head", {}, icon("NotebookPen", 15), el("b", {}, `Notes · ${p.name}`)), ta,
    el("p.pg-hint", {}, "Present with notes to see them beside the next page and a timer."));
}

function renameInline(app, i, nameEl) {
  const ed = app.editor;
  const p = ed.listPages()[i];
  const input = el("input.pg-rename", { value: p.customName ? p.name : "", placeholder: `Page ${i + 1}`, "aria-label": "Page name", maxlength: 80 });
  let done = false;
  const finish = (keep) => {
    if (done) return;
    done = true;
    if (keep) {
      try { renamePage(app, i, input.value); } catch (e) { toast(e.message, { error: true }); }
    }
    input.replaceWith(nameEl);
  };
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true));
  nameEl.replaceWith(input);
  input.focus();
  input.select();
}

function pageMenu(app, i, anchor, nameEl) {
  const ed = app.editor;
  const n = ed.pageCount;
  const item = (ic, label, run, { danger = false, disabled = false } = {}) => el("button.pg-item", {
    type: "button", class: danger ? "danger" : null, disabled,
    on: { click: async () => { closePopover(); try { await run(); } catch (e) { toast(e.message, { error: true }); } } },
  }, icon(ic, 15), label);
  popover(anchor, el("div.pg-menu", { role: "menu" },
    item("Plus", "Add a page after", () => addPage(app, { at: i + 1 }), { disabled: n >= MAX_PAGES }),
    item("Copy", "Duplicate", () => duplicatePage(app, i), { disabled: n >= MAX_PAGES }),
    item("PencilLine", "Rename", () => renameInline(app, i, nameEl)),
    item("NotebookPen", "Speaker notes", async () => {
      await goToPage(app, i);
      requestAnimationFrame(() => {
        const card = document.querySelector(`.pg-thumb[data-index="${i}"]`) || anchor;
        popover(card, notesEditor(app, i), { cls: "pg-pop" });
      });
    }),
    item("ArrowLeft", "Move earlier", () => movePage(app, i, i - 1), { disabled: i === 0 }),
    item("ArrowRight", "Move later", () => movePage(app, i, i + 1), { disabled: i === n - 1 }),
    el("hr"),
    item("Trash2", "Delete page", () => confirmDeletePage(app, i), { danger: true, disabled: n === 1 })), { cls: "pg-pop" });
}

/**
 * Build the strip and put it under the canvas. Returns { el, refresh }.
 * @param {object} app
 * @param {{ onPresent: () => void }} hooks
 */
export function mountStrip(app, { onPresent }) {
  const ed = app.editor;
  const list = el("div.pg-list", { role: "listbox", "aria-label": "Pages", "aria-orientation": "horizontal" });
  const count = el("span.pg-count", { "aria-live": "polite" });
  const toggleBtn = el("button.pg-toggle", { type: "button", "aria-expanded": "false" });
  const prev = iconButton("ChevronLeft", "Previous page (Page Up)", () => step(-1));
  const next = iconButton("ChevronRight", "Next page (Page Down)", () => step(1));
  const notesBtn = el("button.btn.small.ghost.pg-notes-btn", { type: "button", title: "Speaker notes for this page" }, icon("NotebookPen", 15), el("span", {}, "Notes"));
  const presentBtn = el("button.btn.small.pg-present-btn", { type: "button", title: "Present full screen (Ctrl+Alt+P)" }, icon("Presentation", 15), el("span", {}, "Present"));
  const addBtn = el("button.btn.small.pg-add-btn", { type: "button", title: "Add a page (Ctrl+Enter)" }, icon("Plus", 15), el("span", {}, "Add page"));
  const addTile = el("button.pg-add-tile", { type: "button", title: "Add a page (Ctrl+Enter)", "aria-label": "Add a page" }, icon("Plus", 22));
  const bar = el("div.pg-bar", {}, toggleBtn, prev, count, next, el("span.pg-gap"), notesBtn, presentBtn, addBtn);
  const strip = el("section.pg-strip", { "aria-label": "Pages" }, bar, el("div.pg-rail", {}, list, addTile));

  let open = readOpen();
  const isOpen = () => (open === null ? ed.pageCount > 1 : open);
  const step = (d) => {
    const i = ed.pageIndex + d;
    if (i >= 0 && i < ed.pageCount) goToPage(app, i).catch((e) => toast(e.message, { error: true }));
  };
  const add = () => addPage(app).catch((e) => toast(e.message, { error: true }));
  addBtn.addEventListener("click", add);
  addTile.addEventListener("click", add);
  presentBtn.addEventListener("click", () => onPresent());
  notesBtn.addEventListener("click", () => popover(notesBtn, notesEditor(app, ed.pageIndex), { cls: "pg-pop", align: "end" }));
  toggleBtn.addEventListener("click", () => {
    open = !isOpen();
    writeOpen(open);
    render();
  });

  // Drag to reorder.
  let dragFrom = -1;
  const clearMarks = () => list.querySelectorAll(".drop-before, .drop-after").forEach((n) => n.classList.remove("drop-before", "drop-after"));
  const dropIndex = (e, card) => {
    const r = card.getBoundingClientRect();
    const i = Number(card.dataset.index);
    return e.clientX < r.left + r.width / 2 ? i : i + 1;
  };

  let thumbSeq = 0;
  let seen = null; // page ids shown last time, so only new pages pop in
  let wasOpen = false;
  let dragId = null, landedId = null; // the page just dropped somewhere new settles in with a bounce
  function render() {
    const pages = ed.listPages();
    const on = isOpen();
    strip.classList.toggle("open", on);
    toggleBtn.setAttribute("aria-expanded", String(on));
    toggleBtn.replaceChildren(icon(on ? "ChevronDown" : "ChevronUp", 15), el("span", {}, on ? "Hide pages" : `Pages (${pages.length})`));
    toggleBtn.title = on ? "Hide the page strip" : "Show every page";
    count.textContent = `Page ${ed.pageIndex + 1} of ${pages.length}`;
    prev.disabled = ed.pageIndex === 0;
    next.disabled = ed.pageIndex >= pages.length - 1;
    notesBtn.classList.toggle("has", Boolean(pages[ed.pageIndex]?.notes));
    addBtn.disabled = addTile.disabled = pages.length >= MAX_PAGES;
    if (!on) {
      list.replaceChildren();
      seen = null;
      wasOpen = false;
      return;
    }
    const before = seen;
    seen = new Set(pages.map((p) => p.id));
    const tw = Math.round(Math.max(34, Math.min(140, (THUMB_H * ed.width) / ed.height)));
    const seq = ++thumbSeq;
    list.replaceChildren(...pages.map((p) => {
      const img = el("img", { alt: "", draggable: false, width: tw, height: THUMB_H });
      const name = el("span.pg-name", { title: "Double-click to rename" }, p.name);
      const more = el("button.pg-more", { type: "button", title: `More for ${p.name}`, "aria-label": `More for ${p.name}` }, icon("Ellipsis", 15));
      const card = el("div.pg-thumb", {
        role: "option", tabindex: 0, draggable: true, "aria-selected": String(p.current), class: p.current ? "on" : null,
        "aria-label": `${p.name}${p.current ? " (open)" : ""}`, dataset: { index: p.index, id: p.id },
        style: { "--tw": `${tw}px` },
      }, el("div.pg-frame.pg-loading", {}, img, el("span.pg-num", {}, String(p.number)), p.notes ? el("span.pg-has-notes", { title: "Has speaker notes" }, icon("NotebookPen", 11)) : null, more), name);
      card.addEventListener("click", (e) => {
        if (e.target.closest(".pg-more, .pg-rename")) return;
        if (!p.current) goToPage(app, p.index).catch((err) => toast(err.message, { error: true }));
      });
      card.addEventListener("keydown", (e) => {
        if (e.target !== card) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); }
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const to = p.index + (e.key === "ArrowRight" ? 1 : -1);
          if (e.altKey) movePage(app, p.index, to).catch(() => {});
          else list.querySelector(`.pg-thumb[data-index="${to}"]`)?.focus();
        }
        if (e.key === "Delete") { e.preventDefault(); e.stopPropagation(); confirmDeletePage(app, p.index); }
      });
      name.addEventListener("dblclick", () => renameInline(app, p.index, name));
      more.addEventListener("click", (e) => { e.stopPropagation(); pageMenu(app, p.index, more, name); });
      if (before && !before.has(p.id)) card.classList.add("pg-new");
      if (p.id === landedId) card.classList.add("pg-landed");
      img.addEventListener("load", () => img.parentElement?.classList.remove("pg-loading"), { once: true });
      card.addEventListener("dragstart", (e) => {
        dragFrom = p.index;
        dragId = p.id;
        card.classList.add("dragging");
        list.classList.add("pg-sorting");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/x-oc-page", String(p.index));
      });
      card.addEventListener("dragend", () => { dragFrom = -1; card.classList.remove("dragging"); list.classList.remove("pg-sorting"); clearMarks(); });
      card.addEventListener("dragover", (e) => {
        if (dragFrom < 0) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        clearMarks();
        card.classList.add(dropIndex(e, card) > p.index ? "drop-after" : "drop-before");
      });
      card.addEventListener("drop", (e) => {
        if (dragFrom < 0) return;
        e.preventDefault();
        e.stopPropagation();
        let to = dropIndex(e, card);
        if (to > dragFrom) to--;
        const from = dragFrom;
        dragFrom = -1;
        clearMarks();
        list.classList.remove("pg-sorting");
        if (to !== from) {
          landedId = p.id === dragId ? null : dragId;
          movePage(app, from, to).catch((err) => toast(err.message, { error: true }));
        }
      });
      pageThumb(ed, p.index).then((url) => { if (seq === thumbSeq && url) img.src = url; }).catch(() => {});
      return card;
    }));
    if (!wasOpen) stagger(list, { max: 12 });
    landedId = null;
    wasOpen = true;
    list.querySelector(".pg-thumb.on")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  // Keep the open page's thumbnail fresh while editing.
  let liveTimer = 0;
  const refreshLive = () => {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => {
      if (!isOpen() || app.view !== "editor") return;
      const img = list.querySelector(`.pg-thumb[data-index="${ed.pageIndex}"] img`);
      if (img) pageThumb(ed, ed.pageIndex).then((url) => { img.src = url; }).catch(() => {});
    }, 450);
  };

  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
  };
  for (const ev of ["pages", "page", "doc"]) app.bus.on(ev, schedule);
  app.bus.on("change", (label) => (label === "History" ? schedule() : refreshLive()));
  app.bus.on("objects:changed", refreshLive);

  app.shell.canvasHost.after(strip);
  render();
  return { el: strip, refresh: schedule };
}
