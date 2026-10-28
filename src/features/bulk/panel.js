// The Bulk Create panel: 1 load a table, 2 link columns to texts and pictures, 3 preview and make.
import { el, icon, toast, toggle } from "../../ui/kit.js";
import { readTableFile, parseTable } from "./data.js";
import { autoLinks, linkTargets, placeholderColumns } from "./engine.js";
import { openPreview } from "./preview.js";
import { forProject, getState, onState, setLink, setState } from "./state.js";
import { norm } from "./textstyles.js";

const FILE_TYPES = ".csv,.tsv,.txt,.xlsx,.xlsm,text/csv,text/tab-separated-values";

function chooseFile(onFile) {
  const input = el("input", { type: "file", accept: FILE_TYPES, style: { display: "none" } });
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    input.remove();
    if (f) onFile(f);
  });
  document.body.append(input);
  input.click();
}

/** Load a table into the panel state (and make the obvious picture links). */
export function useTable(app, table, source) {
  const links = { ...getState().links, ...autoLinks(linkTargets(app), table.columns) };
  setState({ table, source, links });
  if (table.truncated) toast(`Only the first ${table.rows.length} rows are used.`, { ms: 5000 });
}

function dataSection(app) {
  const st = getState();
  if (st.table) {
    const { columns, rows } = st.table;
    const head = columns.slice(0, 4);
    return el("section.sec", {},
      el("h4.sec-title", {}, "1 · Your data"),
      el("div.bk-loaded", {},
        icon("Sheet", 18),
        el("div.grow", {}, el("b", {}, `${rows.length} row${rows.length === 1 ? "" : "s"}`), el("small", {}, ` · ${st.source || "pasted table"}`)),
        el("button.btn.small.ghost", { type: "button", title: "Use other data", on: { click: () => setState({ table: null, links: {} }) } }, "Change")),
      el("div.bk-table", { role: "table", "aria-label": "First rows" },
        el("div.bk-tr.bk-th", { role: "row" }, head.map((c) => el("span", { role: "columnheader", title: c }, c))),
        rows.slice(0, 3).map((r) => el("div.bk-tr", { role: "row" }, head.map((c) => el("span", { role: "cell", title: r[c] }, /^data:/i.test(r[c]) ? "(picture)" : r[c] || "–"))))),
      columns.length > 4 ? el("p.bk-note", {}, `+ ${columns.length - 4} more column${columns.length - 4 === 1 ? "" : "s"}: ${columns.slice(4).join(", ")}`) : null);
  }
  const area = el("textarea.bk-paste", { rows: 5, spellcheck: false, placeholder: "Paste a table here.\nFirst row = headings, e.g.\nName   City   Photo", "aria-label": "Paste a table" });
  const use = () => {
    try { useTable(app, parseTable(area.value), "pasted table"); } catch (e) { toast(e.message, { error: true }); }
  };
  area.addEventListener("paste", () => setTimeout(() => { if (area.value.includes("\n")) use(); }, 0));
  return el("section.sec", {},
    el("h4.sec-title", {}, "1 · Your data"),
    el("p.bk-note", {}, "One row per design. Copy rows from Excel or Google Sheets and paste them, or open a file."),
    area,
    el("div.row", {},
      el("button.btn.small", { type: "button", on: { click: use } }, icon("ClipboardPaste", 15), "Use pasted table"),
      el("button.btn.small", { type: "button", on: { click: () => chooseFile(async (f) => {
        try { useTable(app, await readTableFile(f), f.name); } catch (e) { toast(e.message, { error: true }); }
      }) } }, icon("FolderOpen", 15), "Open CSV or Excel")));
}

function linkSection(app) {
  const st = getState();
  const { columns } = st.table;
  const targets = linkTargets(app);
  const viaPlaceholders = placeholderColumns(targets, columns);
  const sel = new Set(app.editor.selection());
  const columnSelect = (t) => {
    const s = el("select.sel.bk-col", { "aria-label": `Column for ${t.label}`, on: { change: () => setLink(t.key, s.value) } },
      el("option", { value: "" }, "Not linked"),
      columns.map((c) => el("option", { value: c, selected: st.links[t.key] === c }, c)));
    return s;
  };
  const rowOf = (t) => {
    const ph = (t.placeholders || []).filter((p) => columns.some((c) => norm(c) === norm(p)));
    const top = t.obj.group && t.obj.group.data?.kind === "grid" ? t.obj.group : t.obj;
    return el("div.bk-target", { class: sel.has(top) || sel.has(t.obj) ? "on" : null },
      el("button.bk-tname", { type: "button", title: "Select it on the page", on: { click: () => { app.editor.select([top]); } } },
        icon(t.kind === "text" ? "Type" : "Image", 15), el("span", {}, t.label)),
      ph.length && !st.links[t.key]
        ? el("span.bk-ph", { title: "This text has {{column}} placeholders: they're filled in for each row." }, ph.map((p) => `{{${p}}}`).join(" "))
        : columnSelect(t));
  };
  const texts = targets.filter((t) => t.kind === "text"), pics = targets.filter((t) => t.kind === "picture");
  return el("section.sec", {},
    el("h4.sec-title", {}, "2 · Link columns"),
    el("p.bk-note", {}, "Type ", el("code", {}, "{{Name}}"), " in a text, or click a text or picture on the page and pick a column."),
    targets.length ? null : el("p.bk-empty", {}, icon("TextCursorInput", 22), el("span", {}, "Add some text or a frame to the page first.")),
    texts.length ? el("div.bk-targets", {}, texts.map(rowOf)) : null,
    pics.length ? el("h5.bk-sub", {}, "Pictures") : null,
    pics.length ? el("div.bk-targets", {}, pics.map(rowOf)) : null,
    pics.length ? el("p.bk-note", {}, "Picture columns hold a file name from your picture folders (Ask AI › My folders) or a data URL.") : null,
    viaPlaceholders.length || Object.keys(st.links).length ? null : el("p.bk-warn", {}, "Nothing is linked yet."));
}

function makeSection(app) {
  const st = getState();
  const linked = Object.keys(st.links).length + placeholderColumns(linkTargets(app), st.table.columns).length;
  return el("section.sec", {},
    el("h4.sec-title", {}, "3 · Make them"),
    toggle({ label: "Shrink long text to fit its box", value: st.fit, onChange: (v) => setState({ fit: v }) }),
    el("button.btn.primary.bk-go", {
      type: "button", disabled: !linked,
      on: { click: () => openPreview(app, { rows: st.table, mapping: st.links, fit: st.fit }) },
    }, icon("LayoutGrid", 17), `Preview ${st.table.rows.length} design${st.table.rows.length === 1 ? "" : "s"}`),
    el("p.bk-note", {}, "You'll see every design first, with any that need a look flagged."));
}

/** Render the panel; returns its cleanup. */
export function renderBulkPanel(box, app) {
  const root = el("div.bk-panel");
  box.append(root);
  let raf = 0;
  const paint = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      forProject(app.project?.id || null);
      const st = getState();
      root.replaceChildren(...[
        el("p.bk-lead", {}, "Make many versions of this design from a table: names, prices, photos."),
        dataSection(app),
        st.table ? linkSection(app) : null,
        st.table ? makeSection(app) : null].filter(Boolean));
    });
  };
  paint();
  const offs = [onState(paint), app.bus.on("selection", paint), app.bus.on("doc", paint), app.bus.on("change", (l) => { if (l !== "Typing") paint(); })];
  return () => { cancelAnimationFrame(raf); offs.forEach((f) => f()); };
}
