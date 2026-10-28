// The File menu: new, copy, rename, design files, keyboard shortcuts and About.
import { version as APP_VERSION } from "../../../package.json";
import { listShortcuts } from "../../ui/shell.js";
import { closePopover, el, icon, modal, popover, toast } from "../../ui/kit.js";
import { stagger } from "../../ui/motion.js";
import { popFrom } from "../../ui/popfrom.js";
import { exportDesign } from "./export.js";
import { chooseDesignFile } from "./importer.js";
import { duplicateDesign } from "./projects.js";
import { formatBytes } from "./util.js";

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// ---- keyboard shortcuts --------------------------------------------------------------------

const KEY_NAMES = {
  mod: IS_MAC ? "⌘" : "Ctrl", alt: IS_MAC ? "⌥" : "Alt", shift: "Shift",
  delete: "Delete", backspace: "Backspace", escape: "Esc", enter: "Enter", tab: "Tab", space: "Space",
  arrowleft: "←", arrowright: "→", arrowup: "↑", arrowdown: "↓", pageup: "Page Up", pagedown: "Page Down",
  home: "Home", end: "End",
};
// Keys typed with Shift that the combo format stores as the symbol.
const SHIFTED = { "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0", "?": "/", "_": "-", "{": "[", "}": "]", "|": "\\", ":": ";", "\"": "'", "<": ",", ">": "." };

/** "mod+shift+z" -> ["Ctrl", "Shift", "Z"]; "mod++" -> ["Ctrl", "+"]; "!" -> ["Shift", "1"]. */
export function keyParts(combo) {
  const m = combo.match(/^((?:(?:mod|alt|shift)\+)*)(.+)$/);
  const mods = m[1] ? m[1].slice(0, -1).split("+") : [];
  let key = m[2];
  if (SHIFTED[key]) { mods.push("shift"); key = SHIFTED[key]; }
  const name = KEY_NAMES[key] || (key.length === 1 ? key.toUpperCase() : key.replace(/^f(\d+)$/, "F$1"));
  return [...mods.map((x) => KEY_NAMES[x] || x), name];
}

const GROUPS = [
  ["History", /undo|redo/i],
  ["Selection", /select|deselect/i],
  ["View", /zoom|fit|ruler|guide|grid|pan/i],
  ["Text", /text|bold|italic|underline|font|align text/i],
  ["Arrange", /group|align|forward|backward|front|back|layer|lock|nudge|move|distribute|flip/i],
  ["Edit", /copy|cut|paste|duplicate|delete|style/i],
  ["File", /save|download|export|open|file|shortcut|resize|new/i],
];

function groupOf(s) {
  if (s.group) return s.group;
  const hit = GROUPS.find(([, re]) => re.test(s.label));
  return hit ? hit[0] : "Other";
}

function shortcutsModal() {
  const all = listShortcuts();
  const search = el("input.fl-search", { type: "search", placeholder: "Search shortcuts", "aria-label": "Search shortcuts" });
  const body = el("div.fl-keys");
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const groups = new Map();
    for (const s of all) {
      if (q && !s.label.toLowerCase().includes(q)) continue;
      const g = groupOf(s);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(s);
    }
    const order = [...GROUPS.map(([g]) => g), "Help", "Other"];
    const names = [...groups.keys()].sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    body.replaceChildren(...(names.length ? names.map((g) => el("section.fl-key-group", {},
      el("h4.sec-title", {}, g),
      groups.get(g).map((s) => el("div.fl-key-row", {},
        el("span", {}, s.label.replace(/\s*\([^)]*\)\s*$/, "")),
        el("span.fl-combos", {}, s.keys.split("|").map((c, i) => [
          i ? el("span.fl-or", {}, "or") : null,
          el("span.fl-combo", {}, keyParts(c).map((k) => el("kbd", {}, k))),
        ]).flat())))))
      : [el("div.fl-empty", {}, icon("SearchX", 22), el("span", {}, "No shortcuts match. Try another word, like “copy” or “zoom”."))]));
  };
  search.addEventListener("input", draw);
  draw();
  modal("Keyboard shortcuts", el("div.fl-keys-wrap", {}, search, body), { wide: true });
  requestAnimationFrame(() => search.focus());
}

// ---- about -------------------------------------------------------------------------------

const LICENCES = [
  { name: "Fabric.js", what: "canvas engine", licence: "MIT", url: "https://github.com/fabricjs/fabric.js/blob/master/LICENSE" },
  { name: "Lucide", what: "icons", licence: "ISC", url: "https://lucide.dev/license" },
  { name: "pdf-lib", what: "PDF export", licence: "MIT", url: "https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md" },
  { name: "Fontsource fonts", what: "Inter, Montserrat, Poppins, Roboto, Oswald, Anton, Bebas Neue, Playfair Display and more",
    licence: "SIL Open Font License 1.1", url: "https://openfontlicense.org" },
  { name: "Vite", what: "build tool", licence: "MIT", url: "https://github.com/vitejs/vite/blob/main/LICENSE" },
];

function aboutModal() {
  const link = (href, text) => el("a.fl-link", { href, target: "_blank", rel: "noopener noreferrer" }, text, icon("ExternalLink", 13));
  modal("About", el("div.fl-about", {},
    el("div.fl-about-head", {}, el("span.logo", { "aria-hidden": "true" }, icon("Sparkles", 18)),
      el("div", {}, el("b", {}, "OddlyClever Design"), el("div.fl-muted", {}, `Version ${APP_VERSION || "0.1.0"}`))),
    el("p", {}, "A free design editor that runs in your browser and works offline. Your designs stay on this computer."),
    el("p", {}, "Free and open-source software under the ", link("https://opensource.org/license/mit", "MIT licence"),
      ". Use it for anything, paid work included."),
    el("h4.sec-title", {}, "Licences of the parts we use"),
    el("ul.fl-licences", {}, LICENCES.map((l) => el("li", {},
      el("div", {}, el("b", {}, l.name), el("span.fl-muted", {}, ` · ${l.what}`)), link(l.url, l.licence))))));
}

// ---- the menu ------------------------------------------------------------------------------

function menuItem(iconName, label, hint, run) {
  return el("button.fl-item", { type: "button", role: "menuitem", on: { click: () => { closePopover(); run(); } } },
    icon(iconName, 17), el("span", {}, label), hint ? el("small", {}, hint) : null);
}

function fileMenu(app) {
  const guard = (fn) => async () => {
    try { await fn(); } catch (e) { toast(e.message, { error: true }); }
  };
  const menu = el("div.fl-menu", { role: "menu", "aria-label": "File" },
    menuItem("FilePlus", "New design", "", () => { location.hash = "#/"; }),
    menuItem("Copy", "Make a copy", "", guard(async () => {
      const name = `Copy of ${app.project?.name || "Untitled design"}`;
      await duplicateDesign(app, name);
      await app.save();
      toast(`You're now editing “${name}”. The original is kept.`);
    })),
    menuItem("PenLine", "Rename", "", () => {
      const n = app.shell.nameInput;
      n.focus();
      n.select();
    }),
    el("div.fl-sep"),
    menuItem("FileDown", "Download design file (.ocd)", "", guard(async () => {
      const res = await exportDesign(app, "ocd");
      toast(`Downloaded ${res.filename} (${formatBytes(res.bytes)}).`);
    })),
    menuItem("FolderOpen", "Open design file…", "", () => chooseDesignFile(app)),
    el("div.fl-sep"),
    menuItem("Keyboard", "Keyboard shortcuts", "?", shortcutsModal),
    menuItem("Info", "About OddlyClever Design", "", aboutModal));
  // Arrow keys move between items, like a native menu.
  menu.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...menu.querySelectorAll(".fl-item")];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  });
  requestAnimationFrame(() => menu.querySelector(".fl-item")?.focus());
  return stagger(menu);
}

export function fileMenuButton(app) {
  const btn = el("button.ibtn.fl-menu-btn", { type: "button", title: "File", "aria-label": "File menu", "aria-haspopup": "menu" },
    icon("Menu"));
  btn.addEventListener("click", () => popFrom(popover(btn, fileMenu(app), { align: "end", cls: "fl-pop" }), btn));
  return btn;
}

export { shortcutsModal, aboutModal };
