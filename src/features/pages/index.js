// Pages feature (v0.4): multi-page designs, Present (slideshow + presenter view + laser) and
// Smart resize (re-lay for a new shape, or many sizes at once).
//   actions.js  add / duplicate / delete / move / rename / notes / go to (AI-ready)
//   strip.js    the page strip under the canvas
//   present.js  the full-screen show, the presenter view window and the Present popover
//   smart.js    the smart layout engine;  resize.js  smartResize + resizeToMany
//   render.js   offscreen page rendering (thumbnails, exports);  zip.js  "all pages" .zip
// The page model itself lives in core/editor.js (editor.pages, goToPage, toJSON format 2).
import "./pages.css";
import { el, icon, popover, closePopover, toast } from "../../ui/kit.js";
import { registerCommands, registerShortcut, registerTopAction } from "../../ui/shell.js";
import * as actions from "./actions.js";
import { present, presentPanel, presenting } from "./present.js";
import { resizeToMany, smartResize } from "./resize.js";
import { confirmDeletePage, mountStrip } from "./strip.js";

export { addPage, deletePage, duplicatePage, goToPage, listPages, movePage, renamePage, setPageNotes } from "./actions.js";
export { smartResize, resizeToMany } from "./resize.js";
export { present } from "./present.js";

const inEditor = (app) => app.view === "editor" && !presenting();
const fail = (e) => toast(e.message, { error: true });

export function install(app) {
  const ed = app.editor;
  const startShow = () => {
    try { present(app); } catch (e) { fail(e); }
  };

  // One page of the design as a one-page document (editor.toJSON format), for Bulk create,
  // Translate, Share and the video scenes.
  const pageDoc = (i) => {
    const { pages: _p, page: _i, format: _f, ...head } = ed.toJSON();
    return { ...head, canvas: ed.pageJSON(i) };
  };
  app.pages = {
    list: () => actions.listPages(app),
    /** The open page's id and index. */
    current: () => ed.pages[ed.pageIndex]?.id,
    get index() { return ed.pageIndex; },
    /** Every page as a one-page document; getJSON(id) one of them. */
    docs: () => ed.pages.map((_, i) => pageDoc(i)),
    getJSON: (id) => { const i = ed.pages.findIndex((p) => p.id === id); return i < 0 ? null : pageDoc(i); },
    /** Append a page built from a document (one undo step). Returns its index. */
    addFromJSON: (doc) => ed.addPage({ at: ed.pageCount, canvas: doc?.canvas || doc, name: doc?.name || "" }),
    add: (opts) => actions.addPage(app, opts),
    duplicate: (i, opts) => actions.duplicatePage(app, i, opts),
    remove: (i) => actions.deletePage(app, i),
    goTo: (i) => actions.goToPage(app, i),
    move: (from, to) => actions.movePage(app, from, to),
    rename: (i, name) => actions.renamePage(app, i, name),
    setNotes: (i, notes) => actions.setPageNotes(app, i, notes),
    present: (opts) => present(app, opts),
    smartResize: (target, opts) => smartResize(app, target, opts),
    resizeToMany: (targets, opts) => resizeToMany(app, targets, opts),
  };

  mountStrip(app, { onPresent: startShow });

  registerTopAction({
    id: "present", order: 84,
    render: (a) => {
      const btn = el("button.btn.pg-top-btn", { type: "button", title: "Present full screen (Ctrl+Alt+P)", "aria-label": "Present" },
        icon("Presentation", 17), el("span", {}, "Present"));
      btn.addEventListener("click", () => popover(btn, presentPanel(a, closePopover), { align: "end", cls: "pg-pop" }));
      return btn;
    },
  });

  const step = (d) => () => {
    const i = ed.pageIndex + d;
    if (i >= 0 && i < ed.pageCount) actions.goToPage(app, i).catch(fail);
  };
  registerShortcut({ keys: "mod+enter", label: "Add a page", group: "Pages", when: inEditor, run: () => actions.addPage(app).catch(fail) });
  registerShortcut({ keys: "pagedown", label: "Next page", group: "Pages", when: inEditor, run: step(1) });
  registerShortcut({ keys: "pageup", label: "Previous page", group: "Pages", when: inEditor, run: step(-1) });
  registerShortcut({ keys: "mod+alt+p", label: "Present full screen", group: "Pages", when: inEditor, run: startShow });

  // Shortcuts already show in the command palette; these add the page-menu actions.
  registerCommands((a) => (a.view !== "editor" ? [] : [
    { id: "pages:duplicate", label: "Duplicate this page", group: "Pages", icon: "Copy", keywords: "copy page slide", run: () => actions.duplicatePage(app).catch(fail) },
    { id: "pages:delete", label: "Delete this page", group: "Pages", icon: "Trash2", keywords: "remove page slide", run: () => confirmDeletePage(app, ed.pageIndex) },
    { id: "pages:notes", label: "Speaker notes for this page", group: "Pages", icon: "NotebookPen", keywords: "notes presenter", run: () => document.querySelector(".pg-notes-btn")?.click() },
  ]));
}
