// The command palette (Ctrl+K): "What do you want to do?". It searches every panel, every labelled
// shortcut, every size preset, the buttons in the header and the selection toolbar, plus whatever
// other modules add with registerCommands() (templates and your designs), and runs the chosen one.
import { SIZES } from "../core/sizes.js";
import { el, icon } from "./kit.js";
import { listPanels, listShortcuts } from "./shell.js";
import { BRAND, keysOf, modKey } from "./brand.js";

/**
 * @typedef {object} Command
 * @property {string} id
 * @property {string} label       what the row says ("Open the Text panel")
 * @property {string} group       a short tag shown on the row ("Tool", "Size", "Template"...)
 * @property {string} [icon]      a Lucide icon name
 * @property {string} [hint]      grey text after the label
 * @property {string} [keys]      a shortcut combo to show ("mod+z")
 * @property {string} [keywords]  extra words to match
 * @property {(app: object) => unknown} run
 */

/** @type {Array<(app: object) => Command[] | Promise<Command[]>>} */
const sources = [];

/** Add a command source: `fn(app)` returns a list of commands (or a promise of one) each time the palette opens. */
export function registerCommands(fn) { sources.push(fn); }

const SUGGESTED = ["panel:templates", "panel:text", "panel:elements", "panel:uploads", "top:download", "help:tour", "size:yt-thumb", "size:shorts"];

function builtins(app) {
  const inEditor = app.view === "editor";
  const out = [];
  if (inEditor) {
    for (const p of listPanels()) {
      out.push({ id: `panel:${p.id}`, label: `Open ${p.label}`, group: "Tool", icon: p.icon, keywords: `${p.id} panel drawer add`,
        run: (a) => a.openPanel(p.id) });
    }
    for (const sc of listShortcuts()) {
      if (sc.when && !safe(() => sc.when(app))) continue;
      out.push({ id: `key:${sc.keys}`, label: sc.label.replace(/\s*\(.*\)$/, ""), group: "Action", icon: "Keyboard", keys: sc.keys,
        run: (a) => sc.run(a, new KeyboardEvent("keydown")) });
    }
    out.push(...buttonsIn(app.shell.topRight, "Header", "top"));
    if (!app.shell.toolbar.classList.contains("empty")) out.push(...buttonsIn(app.shell.toolbar, "Selection", "sel"));
    out.push({ id: "nav:home", label: "Go to all designs (home)", group: "Go", icon: "House", keywords: "home back exit close",
      run: () => { location.hash = "#/"; } });
  }
  for (const s of SIZES) {
    out.push({ id: `size:${s.id}`, label: `New ${s.name}`, hint: `${s.w} × ${s.h}`, group: "Size", icon: "Ratio",
      keywords: `${s.group} create start blank ${s.w}x${s.h}`,
      run: (a) => a.newDesign({ size: s.id }) });
  }
  out.push(
    { id: "help:tour", label: "Take the quick tour", group: "Help", icon: "Compass", keywords: "help guide learn how start beginner",
      run: (a) => a.onboard?.startTour(true) },
    { id: "help:keys", label: "Show all keyboard shortcuts", group: "Help", icon: "Keyboard", keywords: "help keys hotkeys",
      run: (a) => a.onboard?.showShortcuts() },
    { id: "help:welcome", label: "What are you making today?", group: "Help", icon: "Sparkles", keywords: "help welcome start new",
      run: (a) => a.onboard?.openWelcome() });
  return out;
}

function safe(fn) { try { return fn(); } catch { return false; } }

/** Commands for the visible, enabled, labelled buttons inside `box` (top actions, selection toolbar). */
function buttonsIn(box, group, prefix) {
  const out = [], seen = new Set();
  for (const b of box.querySelectorAll("button")) {
    if (b.disabled || !b.offsetParent) continue;
    const label = (b.getAttribute("title") || b.getAttribute("aria-label") || b.textContent || "").trim().replace(/\s*\(.*\)$/, "");
    if (!label || label.length > 60 || seen.has(label)) continue;
    seen.add(label);
    out.push({ id: `${prefix}:${label.toLowerCase().replace(/\W+/g, "-")}`, label, group, icon: "MousePointerClick",
      keywords: (b.textContent || "").trim(), run: () => b.click() });
  }
  return out;
}

/** Higher is better; 0 = no match. Every query word must start a word (or sit inside the label). */
function score(cmd, q) {
  const label = cmd.label.toLowerCase();
  const hay = `${label} ${cmd.group} ${cmd.hint || ""} ${cmd.keywords || ""}`.toLowerCase();
  const words = hay.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let s = 0;
  for (const w of q.split(/\s+/).filter(Boolean)) {
    if (words.some((x) => x === w)) s += 30;
    else if (label.split(/[^\p{L}\p{N}]+/u).some((x) => x.startsWith(w))) s += 24;
    else if (words.some((x) => x.startsWith(w))) s += 14;
    else if (label.includes(w)) s += 6;
    else return 0;
  }
  if (label.startsWith(q)) s += 40;
  if (cmd.group === "Tool") s += 8;
  if (cmd.group === "Action") s += 4;
  return s;
}

let openState = null;

/** Open the palette (closes it if it's already open). */
export function openPalette(app, initial = "") {
  if (openState) { openState.close(); return; }
  // Sync sources fill the list at once (so fast typing is never lost); async ones join when ready.
  const all = [];
  const add = (list) => {
    for (const c of list || []) if (c && c.label && typeof c.run === "function") all.push(c);
  };
  add(builtins(app));
  const later = [];
  for (const fn of sources) {
    try {
      const r = fn(app);
      if (r && typeof r.then === "function") later.push(r.then(add).catch((e) => console.error("[palette source]", e)));
      else add(r);
    } catch (e) { console.error("[palette source]", e); }
  }
  Promise.all(later).then(() => { if (openState?.render) openState.render(); });

  const input = el("input.pal-input", { type: "search", placeholder: "What do you want to do?", value: initial, spellcheck: false,
    "aria-label": "What do you want to do?", autocomplete: "off", role: "combobox", "aria-expanded": "true", "aria-controls": "pal-list" });
  const list = el("div.pal-list", { id: "pal-list", role: "listbox" });
  const box = el("div.pal", { role: "dialog", "aria-label": "Command search" },
    el("div.pal-head", {}, el("img.pal-face", { src: BRAND.sparksHead, alt: "", draggable: false }), input, el("kbd", {}, "Esc")),
    list,
    el("div.pal-foot", {}, el("span", {}, el("kbd", {}, "↑"), el("kbd", {}, "↓"), " move"), el("span", {}, el("kbd", {}, "Enter"), " do it"),
      el("span.grow"), el("span.pal-try", {}, "Try “text”, “undo”, “poster” or “download”")));
  const back = el("div.pal-back", { on: { pointerdown: (e) => { if (e.target === back) close(); } } }, box);
  document.body.append(back);
  requestAnimationFrame(() => back.classList.add("show"));

  let rows = [], active = 0;
  function render() {
    const q = input.value.trim().toLowerCase();
    let shown;
    if (!q) {
      const byId = new Map(all.map((c) => [c.id, c]));
      shown = SUGGESTED.map((id) => byId.get(id)).filter(Boolean);
      if (shown.length < 6) shown = all.slice(0, 8);
    } else {
      shown = all.map((c) => ({ c, s: score(c, q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 40).map((x) => x.c);
    }
    rows = shown.map((c, i) => el("button.pal-row", { type: "button", role: "option", id: `pal-${i}`, dataset: { group: c.group },
      on: { click: () => run(c), pointermove: () => setActive(i) } },
    el("span.pal-ico", {}, icon(c.icon || "ChevronRight", 16)),
    el("span.pal-label", {}, c.label, c.hint ? el("small", {}, c.hint) : null),
    c.keys ? el("span.pal-keys", {}, keysOf(c.keys).map((k) => el("kbd", {}, k))) : null,
    el("span.pal-tag", {}, c.group)));
    const keep = rows[active]?.textContent;
    list.replaceChildren(...[
      !q ? el("div.pal-sec", {}, "Popular") : null,
      ...rows,
      rows.length ? null : el("div.pal-empty", {}, el("b", {}, "Nothing called that yet."),
        el("span", {}, "Try a simpler word, like “photo”, “shape”, “title” or “square”.")),
    ].filter(Boolean));
    const again = rows.findIndex((r) => r.textContent === keep);
    setActive(again >= 0 ? again : 0);
  }
  function setActive(i) {
    active = Math.max(0, Math.min(rows.length - 1, i));
    rows.forEach((r, j) => r.classList.toggle("on", j === active));
    if (rows[active]) {
      input.setAttribute("aria-activedescendant", rows[active].id);
      rows[active].scrollIntoView({ block: "nearest" });
    }
  }
  function run(c) {
    close();
    // Let the palette go first, so a popover opened by the command isn't closed by this click.
    setTimeout(() => {
      try {
        const r = c.run(app);
        if (r && typeof r.catch === "function") r.catch((e) => console.error("[palette]", e));
      } catch (e) { console.error("[palette]", e); }
    }, 0);
  }
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") { e.preventDefault(); const r = rows[active]; if (r) r.click(); }
  };
  input.addEventListener("input", render);
  input.addEventListener("keydown", onKey);
  const prevFocus = document.activeElement;
  function close() {
    if (!openState) return;
    openState = null;
    back.classList.remove("show");
    setTimeout(() => back.remove(), 180);
    if (prevFocus && prevFocus !== document.body && document.contains(prevFocus)) prevFocus.focus?.({ preventScroll: true });
  }
  openState = { close, render };
  render();
  input.focus();
  input.select();
  return openState;
}

export const paletteHint = () => `${modKey} K`;
