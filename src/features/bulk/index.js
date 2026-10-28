// Bulk Create: many versions of one design from a table (paste, CSV/TSV or .xlsx). Columns fill
// {{placeholders}} or linked texts, picture columns fill frames, images and photo-grid cells.
// Long text shrinks to fit, and rows with text that overflows or is hard to read are flagged
// (the studio's design check). Output: designs, pages (when app.pages exists) or a ZIP.
import "./bulk.css";
import { el } from "../../ui/kit.js";
import { registerPanel, registerTool } from "../../ui/shell.js";
import { parseTable, readTableFile } from "./data.js";
import { bulkCreate, linkTargets, outputVariants, previewBulk } from "./engine.js";
import { renderBulkPanel, useTable } from "./panel.js";
import { forProject, getState, onState, setLink } from "./state.js";

/** The key a selected object is linked under (null when it can't be linked from the toolbar). */
function keyOf(app, obj) {
  return linkTargets(app).find((t) => t.obj === obj)?.key || null;
}

export function install(app) {
  app.bulk = {
    /** Make one design / page / picture per row; see engine.js bulkCreate. */
    bulkCreate: (opts) => bulkCreate(app, opts),
    /** Build every row's variant without saving (thumbs + flags). */
    previewBulk: (opts) => previewBulk(app, opts),
    /** Save variants from previewBulk. */
    outputVariants: (variants, opts) => outputVariants(app, variants, opts),
    /** Parse pasted / CSV / TSV text into {columns, rows}. */
    parseTable,
    /** Read a CSV, TSV or .xlsx File into {columns, rows}. */
    readTableFile,
    /** Load a table into the Bulk Create panel. */
    useTable: (table, source) => useTable(app, table, source),
    /** Things a column can fill: [{key, kind, label}]. */
    targets: () => linkTargets(app).map(({ key, kind, label, placeholders }) => ({ key, kind, label, placeholders })),
  };

  registerPanel({ id: "bulk", icon: "Sheet", label: "Bulk create", order: 72, render: (box) => renderBulkPanel(box, app) });

  // Click a text or picture on the page, then pick its column right in the toolbar.
  registerTool({
    id: "bulk-link", order: 66,
    match: (sel) => {
      const st = forProject(app.project?.id || null);
      return Boolean(st.table) && sel.length === 1 && Boolean(keyOf(app, sel[0]));
    },
    render: (_, sel) => {
      const st = getState();
      const key = keyOf(app, sel[0]);
      const s = el("select.sel.bk-tool-sel", {
        title: "Fill this from a column of your Bulk create data", "aria-label": "Bulk create column",
        on: { change: () => setLink(key, s.value) },
      }, el("option", { value: "" }, "Not linked"), st.table.columns.map((c) => el("option", { value: c, selected: st.links[key] === c }, c)));
      return el("div.tgroup.bk-tool", {}, el("span.bk-tool-label", {}, "Data"), s);
    },
  });
  onState(() => app.refreshToolbar?.());
}
