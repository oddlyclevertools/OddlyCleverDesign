// Library UI bits: the "My elements" shelf at the top of the Elements panel (with Save
// selection and "See all"), and the Save as template button and the remove button on
// "My templates" cards.
import "./library.css";
import { confirmDialog, el, icon, modal, toast } from "../../ui/kit.js";
import { DRAG_TYPE, insertItem } from "../elements/actions.js";
import { deleteLibraryItem, listLibrary, saveDesignAsTemplate, saveElement } from "./index.js";

const SHELF_LIMIT = 24; // the shelf shows this many until "See all"
let shelfOpen = false;  // "See all" stays open while the panel repaints (this session)

/** Ask for a name and tags. Resolves to { name, tags } or null. */
function askNameTags(title, placeholder) {
  return new Promise((resolve) => {
    modal(title, (close) => {
      const name = el("input.tp-rename", { type: "text", maxlength: 80, placeholder, "aria-label": "Name", spellcheck: false });
      const tags = el("input.tp-rename", { type: "text", maxlength: 200, placeholder: "Tags, e.g. money, collage (optional)", "aria-label": "Tags", spellcheck: false });
      const save = () => {
        const n = name.value.trim();
        if (!n) { name.focus(); return; }
        close();
        resolve({ name: n, tags: tags.value.split(",").map((t) => t.trim()).filter(Boolean) });
      };
      for (const i of [name, tags]) i.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
      setTimeout(() => name.focus(), 30);
      return el("div.tp-rename-box.lib-ask", {}, name, tags, el("div.row.end", {},
        el("button.btn", { type: "button", on: { click: () => { close(); resolve(null); } } }, "Cancel"),
        el("button.btn.primary", { type: "button", on: { click: save } }, "Save")));
    }, { onClose: () => resolve(null) }); // Esc, X or the backdrop: nothing saved
  });
}

export async function askSaveTemplate(app) {
  const got = await askNameTags("Save as template", app.project?.name || "Template name");
  if (!got) return;
  try {
    await saveDesignAsTemplate(app, got);
    toast(`“${got.name}” is in Templates → My templates.`);
  } catch (e) { toast(`Couldn't save the template: ${e.message}`, { error: true }); }
}

async function askSaveSelection(app) {
  const objs = app.editor.selection().filter((o) => !o.isBg);
  if (!objs.length) { toast("Select what to keep first (one thing, or several together).", { error: true }); return; }
  const got = await askNameTags("Save to My elements", objs.length === 1 ? objs[0].name || "Element name" : "Element name");
  if (!got) return;
  try {
    await saveElement(app, objs, got);
    toast(`“${got.name}” is in Elements → My elements.`);
  } catch (e) { toast(`Couldn't save it: ${e.message}`, { error: true }); }
}

function shelfTile(app, rec) {
  const b = el("button.el-tile.el-tile-mine", {
    type: "button", draggable: "true", "aria-label": `Add ${rec.name}`, title: `${rec.name}${rec.by === "ai" ? " (made by your AI)" : ""}`,
    on: {
      click: () => insertItem(app, { kind: "mine", key: rec.id, label: rec.name }),
      dragstart: (e) => { e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind: "mine", key: rec.id })); e.dataTransfer.effectAllowed = "copy"; },
    },
  }, el("img", { src: rec.thumb, alt: "", draggable: false, loading: "lazy" }));
  const del = el("button.el-up-act.lib-del", { type: "button", title: "Remove from My elements", "aria-label": `Remove ${rec.name}`,
    on: { click: async (e) => {
      e.stopPropagation();
      if (await confirmDialog("Remove this element?", "It goes from My elements. Designs that already use it keep their copy.", "Remove")) deleteLibraryItem(rec.id);
    } } }, icon("X", 12));
  return el("div.lib-tile", {}, b, del);
}

/** The "My elements" shelf. Fills itself (async); the panel repaints it when the library changes. */
export function myElementsShelf(app, query = "") {
  const box = el("section.el-sec.lib-shelf");
  const q = query.trim().toLowerCase();
  async function draw() {
    let list = [];
    try { list = await listLibrary("element"); } catch { box.replaceChildren(); return; }
    const shown = list.filter((r) => !q || `${r.name} ${r.tags.join(" ")}`.toLowerCase().includes(q));
    if (q && !shown.length) { box.replaceChildren(); return; }
    const more = shown.length > SHELF_LIMIT;
    const all = shelfOpen || !more;
    const toggle = more ? el("button.btn.small.ghost.lib-more", {
      type: "button", "aria-expanded": String(all),
      on: { click: () => { shelfOpen = !shelfOpen; draw(); } },
    }, all ? [icon("ChevronUp", 14), "Show fewer"] : [icon("ChevronDown", 14), `See all ${shown.length}`]) : null;
    box.replaceChildren(...[
      el("div.el-sec-head", {}, el("h4.sec-title", {}, "My elements", el("span.el-count", {}, shown.length ? String(shown.length) : "")),
        el("button.el-seeall", { type: "button", title: "Keep the selected objects as a reusable element", on: { click: () => askSaveSelection(app) } },
          icon("BookmarkPlus", 14), "Save selection")),
      shown.length ? el("div.el-grid.lib-grid", { class: all && more ? "lib-all" : null }, (all ? shown : shown.slice(0, SHELF_LIMIT)).map((r) => shelfTile(app, r)))
        : el("p.el-empty.lib-empty", {}, icon("PackageOpen", 24), el("span", {}, "Select something on the page and press Save selection to keep it here. Things your AI saves show up here too.")),
      toggle,
    ].filter(Boolean));
  }
  draw();
  return box;
}

/** A remove button for a "My templates" card. */
export function removeTemplateButton(tpl, after) {
  return el("button.tp-pcard-new.lib-tpl-del", { type: "button", title: "Remove from My templates", "aria-label": `Remove ${tpl.name}`,
    on: { click: async () => {
      if (!(await confirmDialog("Remove this template?", "It goes from My templates. Designs made from it stay as they are.", "Remove"))) return;
      await deleteLibraryItem(tpl.id);
      after?.();
    } } }, icon("Trash2", 14));
}
