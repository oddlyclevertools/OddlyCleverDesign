// The Elements panel: one search box over everything, category chips, and sections with
// "See all": recently used, favourites (starred), graphics, badges, charts, decorations,
// shapes, lines, stickers, photo grids, frames, backgrounds and every Lucide icon. Click a tile
// to add it in the centre, drag it onto the page, or rest the pointer on it for a bigger
// preview. The star (or F on a focused tile) keeps it in Favourites. Recent and favourites are
// remembered in this browser between sessions.
import "./panel-elements.css";
import { icons as lucideIcons } from "lucide";
import { el, icon } from "../../ui/kit.js";
import { SHAPES, shapePreview } from "./shapes.js";
import { LINES, linePreview } from "./lines.js";
import { STICKERS, stickerSVG } from "./stickers.js";
import { FRAMES } from "./images.js";
import { outlinePath, roundRectPath } from "./geometry.js";
import { iconLabel, iconSVG, searchIcons } from "./vector.js";
import { ILLUSTRATIONS, illustrationSVG } from "./illustrations.js";
import { BADGES, badgePreview } from "./badges.js";
import { DECOR, decorSVG } from "./decor.js";
import { CHART_TYPES, chartPreview } from "./charts.js";
import { GRID_LAYOUTS, gridPreview } from "./grids.js";
import { SCENES } from "./scenes.js";
import { sceneThumb } from "./scene-apply.js";
import { DRAG_TYPE, insertItem } from "./actions.js";
import { hidePeek, peek } from "./peek.js";
import { myElementsShelf } from "../library/panel.js";
import { onLibraryChange } from "../library/store.js";

const ICON_CHUNK = 72;
const RECENT_KEY = "el-recent";
const FAV_KEY = "el-favs";
const MAX_RECENT = 24;
const MAX_FAVS = 200;
const SHELF = 8; // tiles in the Recent and Favourites shelves before "See all"

// ---- recently used and favourites (this browser, between sessions) -------------------------

const refOf = (it) => `${it.kind}:${it.key}`;
function readRefs(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v.filter((r) => typeof r === "string" && r.includes(":")) : [];
  } catch { return []; }
}
function writeRefs(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* storage blocked: works for this session only */ }
}
const favListeners = new Set();

/** Remember an element as just used (newest first). */
export function rememberUse(it) {
  if (!it || it.kind === "mine" || it.kind === "upload") return;
  const ref = refOf(it);
  writeRefs(RECENT_KEY, [ref, ...readRefs(RECENT_KEY).filter((r) => r !== ref)].slice(0, MAX_RECENT));
}
export const recentRefs = () => readRefs(RECENT_KEY);
export const favRefs = () => readRefs(FAV_KEY);
export const isFav = (it) => favRefs().includes(refOf(it));

/** Star or unstar an element. Returns the new state. */
export function toggleFav(it) {
  const ref = refOf(it), list = favRefs();
  const on = !list.includes(ref);
  writeRefs(FAV_KEY, on ? [ref, ...list].slice(0, MAX_FAVS) : list.filter((r) => r !== ref));
  favListeners.forEach((fn) => fn(it, on));
  return on;
}

function framePreview(key) {
  const d = key === "roundRect" ? roundRectPath(76, 76, 16) : outlinePath(key, 76, 76);
  return `<svg viewBox="-12 -12 100 100" class="el-frame-svg" aria-hidden="true">
    <defs><clipPath id="fp-${key}"><path d="${d}"/></clipPath>
      <linearGradient id="fg-${key}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#a78bfa"/></linearGradient></defs>
    <g clip-path="url(#fp-${key})"><rect x="-1" y="-1" width="78" height="78" fill="url(#fg-${key})"/>
      <circle cx="54" cy="22" r="8" fill="#fff7"/><path d="M-2 70 L24 38 L40 56 L52 44 L80 74 L80 80 L-2 80 Z" fill="#fff9"/></g></svg>`;
}

/** Categories in panel order: title, chip label, how many show in the overview. */
const CATS = [
  { kind: "illustration", title: "Graphics", chip: "Graphics", show: 8 },
  { kind: "badge", title: "Badges and labels", chip: "Badges", show: 6 },
  { kind: "chart", title: "Charts", chip: "Charts", show: 4 },
  { kind: "decor", title: "Decorations", chip: "Decor", show: 8 },
  { kind: "shape", title: "Shapes", chip: "Shapes", show: 8 },
  { kind: "line", title: "Lines and arrows", chip: "Lines", show: 4 },
  { kind: "sticker", title: "Stickers", chip: "Stickers", show: 8 },
  { kind: "grid", title: "Photo grids", chip: "Grids", show: 4 },
  { kind: "frame", title: "Frames", chip: "Frames", show: 4 },
  { kind: "scene", title: "Backgrounds", chip: "Backgrounds", show: 4 },
  { kind: "icon", title: "Icons", chip: "Icons", show: 12 },
];
const CAT = Object.fromEntries(CATS.map((c) => [c.kind, c]));

const HINT = {
  scene: "Click to use as the page background.",
  grid: "Click to add, then drop photos onto the cells.",
  chart: "Click to add, then Edit chart to change the numbers.",
  badge: "Click to add. Double-click it on the page to change the words.",
  frame: "Click to add, then drop a photo onto it.",
};

const item = (kind, key, label, tags, html) => ({ kind, key, label, words: `${label} ${tags || ""} ${CAT[kind]?.chip || ""}`.toLowerCase(), html });

/** The catalogue as plain items so one search covers everything. */
function catalogue() {
  return {
    illustration: ILLUSTRATIONS.map((s) => item("illustration", s.key, s.label, `${s.tags} illustration graphic sticker`, () => illustrationSVG(s.key))),
    badge: BADGES.map((b) => item("badge", b.key, b.label, `${b.tags} badge label text`, () => badgePreview(b.key))),
    chart: CHART_TYPES.map((c) => item("chart", c.key, c.label, `${c.tags} chart graph data`, () => chartPreview(c.key))),
    decor: DECOR.map((d) => item("decor", d.key, d.label, `${d.tags} decoration graphic`, () => decorSVG(d.key))),
    shape: SHAPES.map((s) => item("shape", s.key, s.label, `${s.tags || ""} shape`, () => shapePreview(s.key))),
    line: LINES.map((l) => item("line", l.key, l.label, `${l.tags || ""} line arrow`, () => linePreview(l.key))),
    sticker: STICKERS.map((s) => item("sticker", s.key, s.label, `${s.tags || ""} sticker`, () => stickerSVG(s.key))),
    grid: GRID_LAYOUTS.map((g) => item("grid", g.key, `Grid: ${g.label}`, "grid collage photo cells layout", () => gridPreview(g.key))),
    frame: FRAMES.map((f) => item("frame", f.key, f.label, "photo picture image frame", () => framePreview(f.key))),
    scene: SCENES.map((s) => item("scene", s.key, s.label, `${s.tags} ${s.group} background wallpaper`, null)),
  };
}

const matches = (it, q) => !q || q.split(/\s+/).every((p) => it.words.includes(p));

// Scene thumbnails are drawn a few at a time so the panel opens instantly.
const pending = [];
let pumping = false;
function queueThumb(img, key) {
  pending.push([img, key]);
  if (pumping) return;
  pumping = true;
  const pump = () => {
    const batch = pending.splice(0, 3);
    for (const [im, k] of batch) if (im.isConnected) { try { im.src = sceneThumb(k); } catch { im.alt = "Preview unavailable"; } }
    if (pending.length) requestAnimationFrame(pump);
    else pumping = false;
  };
  requestAnimationFrame(pump);
}

function tile(app, it) {
  const star = el("button.el-star", { type: "button", tabindex: -1 });
  const paintStar = (on) => {
    star.classList.toggle("on", on);
    star.setAttribute("aria-pressed", String(on));
    star.title = on ? "Remove from Favourites (F)" : "Add to Favourites (F)";
    star.setAttribute("aria-label", `${on ? "Remove" : "Add"} ${it.label} ${on ? "from" : "to"} Favourites`);
    star.replaceChildren(icon("Star", 13));
  };
  paintStar(isFav(it));
  star.addEventListener("click", (e) => { e.stopPropagation(); paintStar(toggleFav(it)); });
  const b = el(`button.el-tile.el-tile-${it.kind}`, {
    type: "button", draggable: "true", "aria-label": `Add ${it.label}`, "data-label": it.label,
    on: {
      click: () => { hidePeek(); rememberUse(it); insertItem(app, it); },
      keydown: (e) => {
        if (e.key.toLowerCase() !== "f" || e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        e.stopPropagation();
        paintStar(toggleFav(it));
      },
      dragstart: (e) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind: it.kind, key: it.key }));
        e.dataTransfer.effectAllowed = "copy";
        b.classList.add("dragging");
      },
      dragend: (e) => {
        b.classList.remove("dragging");
        if (e.dataTransfer?.dropEffect !== "none") rememberUse(it);
      },
    },
  });
  if (it.kind === "icon") b.append(icon(it.key, 26));
  else if (it.kind === "scene") {
    const img = el("img", { alt: "", draggable: "false" });
    b.append(img, el("span.el-tile-name", {}, it.label));
    queueThumb(img, it.key);
  } else b.innerHTML = it.html();
  peek(b, () => ({
    title: it.label,
    hint: HINT[it.kind] || "Click to add, or drag onto the page.",
    html: it.kind === "icon" ? iconSVG(it.key, "#f3ead8")
      : it.kind === "scene" ? el("img", { src: sceneThumb(it.key, 384, 240), alt: "" })
        : it.html(),
  }));
  return el(`div.el-tw.el-tw-${it.kind}`, {}, b, star);
}

export function renderElementsPanel(box, app) {
  const cat = catalogue();
  const input = el("input.el-search-input", { type: "search", placeholder: "Search graphics, badges, icons…", "aria-label": "Search elements", spellcheck: false });
  const clear = el("button.el-search-clear", { type: "button", title: "Clear search", "aria-label": "Clear search", hidden: true }, icon("X", 15));
  const search = el("div.el-search", {}, icon("Search", 16), input, clear);
  const chips = el("div.el-chips", { role: "tablist", "aria-label": "Element categories" });
  const body = el("div.el-body");
  let view = null; // null = everything, or a category kind
  let observer = null;

  const iconItems = (names) => names.map((n) => ({ kind: "icon", key: n, label: iconLabel(n) }));

  function iconGrid(names, limit = Infinity) {
    const grid = el("div.el-grid.el-grid-icon");
    let shown = 0;
    const more = () => {
      const end = Math.min(names.length, limit, shown + ICON_CHUNK);
      for (const it of iconItems(names.slice(shown, end))) grid.append(tile(app, it));
      shown = end;
      return shown < Math.min(names.length, limit);
    };
    more();
    if (limit === Infinity && shown < names.length) {
      const sentinel = el("div.el-sentinel");
      observer?.disconnect();
      observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting) && !more()) { observer.disconnect(); sentinel.remove(); }
      }, { root: box, rootMargin: "300px" });
      requestAnimationFrame(() => { grid.after(sentinel); observer.observe(sentinel); });
    }
    return grid;
  }

  const go = (kind) => { view = kind; paint(); box.scrollTop = 0; };

  // Recent and favourite refs ("kind:key") back to items; ones that no longer exist are skipped.
  const byRef = new Map(Object.values(cat).flat().map((it) => [refOf(it), it]));
  const resolve = (refs) => refs.map((r) => {
    if (byRef.has(r)) return byRef.get(r);
    const kind = r.slice(0, r.indexOf(":")), key = r.slice(r.indexOf(":") + 1);
    return kind === "icon" && lucideIcons[key] ? { kind, key, label: iconLabel(key), words: `${iconLabel(key)} icon`.toLowerCase() } : null;
  }).filter(Boolean);
  const SPECIAL = {
    recent: { title: "Recently used", chip: "Recent", icon: "History", items: () => resolve(recentRefs()), empty: "Things you add show up here." },
    fav: { title: "Favourites", chip: "Favourites", icon: "Star", items: () => resolve(favRefs()), empty: "Star an element (or press F on it) to keep it here." },
  };
  const titleOf = (kind) => SPECIAL[kind]?.title || CAT[kind].title;

  function shelf(kind, q) {
    const items = SPECIAL[kind].items().filter((it) => matches(it, q));
    if (!items.length) return null;
    const head = el("div.el-sec-head", {}, el("h4.sec-title.el-shelf-title", {}, icon(SPECIAL[kind].icon, 13), SPECIAL[kind].title,
      el("span.el-count", {}, String(items.length))),
    items.length > SHELF ? el("button.el-seeall", { type: "button", on: { click: () => go(kind) } }, "See all", icon("ChevronRight", 14)) : null);
    return el(`section.el-sec.el-shelf.el-shelf-${kind}`, {}, head, el("div.el-grid.el-grid-mixed", {}, items.slice(0, SHELF).map((it) => tile(app, it))));
  }

  function sectionNode(kind, items, { limit = Infinity, count = items.length } = {}) {
    const head = el("div.el-sec-head", {}, el("h4.sec-title", {}, CAT[kind].title, el("span.el-count", {}, String(count))),
      limit < count ? el("button.el-seeall", { type: "button", on: { click: () => go(kind) } }, "See all", icon("ChevronRight", 14)) : null);
    const grid = kind === "icon" ? iconGrid(items, limit) : el(`div.el-grid.el-grid-${kind}`, {}, items.slice(0, limit).map((it) => tile(app, it)));
    return el("section.el-sec", {}, head, grid);
  }

  function paintChips() {
    const extra = Object.entries(SPECIAL).filter(([k, sp]) => view === k || sp.items().length)
      .map(([k, sp]) => el("button.el-chip", { type: "button", role: "tab", "aria-selected": String(view === k), class: view === k ? "on" : null,
        on: { click: () => go(k) } }, sp.chip));
    chips.replaceChildren(
      el("button.el-chip", { type: "button", role: "tab", "aria-selected": String(!view), class: !view ? "on" : null, on: { click: () => go(null) } }, "All"),
      ...extra,
      ...CATS.map((c) => el("button.el-chip", { type: "button", role: "tab", "aria-selected": String(view === c.kind), class: view === c.kind ? "on" : null,
        on: { click: () => go(c.kind) } }, c.chip)),
    );
    chips.querySelector(".on")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  function paint() {
    observer?.disconnect();
    hidePeek();
    paintChips();
    const q = input.value.trim().toLowerCase();
    clear.hidden = !q;
    const nodes = [];
    if (view) {
      nodes.push(el("button.el-back", { type: "button", on: { click: () => go(null) } }, icon("ChevronLeft", 16), titleOf(view)));
      const special = SPECIAL[view];
      const items = special ? special.items().filter((it) => matches(it, q)) : view === "icon" ? searchIcons(q) : cat[view].filter((it) => matches(it, q));
      if (view === "icon") nodes.push(el("section.el-sec", {}, iconGrid(items)));
      else nodes.push(el("section.el-sec", {}, el(`div.el-grid.el-grid-${special ? "mixed" : view}`, {}, items.map((it) => tile(app, it)))));
      if (!items.length) nodes.push(el("p.el-empty", {}, special && !q ? special.empty : "Nothing matches that search."));
    } else {
      let any = false;
      for (const c of CATS) {
        if (c.kind === "icon") continue;
        const items = cat[c.kind].filter((it) => matches(it, q));
        if (!items.length) continue;
        any = true;
        nodes.push(sectionNode(c.kind, items, { limit: q ? Math.max(c.show, 8) : c.show }));
      }
      const icons = searchIcons(q);
      if (icons.length) {
        any = true;
        nodes.push(sectionNode("icon", icons, { limit: q ? 30 : CAT.icon.show, count: icons.length }));
      }
      nodes.unshift(myElementsShelf(app, q));
      // Recently used and Favourites sit at the top (while searching, their matches come first too).
      nodes.unshift(...[shelf("recent", q), shelf("fav", q)].filter(Boolean));
      if (!any) nodes.push(el("p.el-empty", {}, `Nothing matches “${input.value.trim()}”. Try “money”, “arrow”, “neon” or “chart”.`));
      if (!q) nodes.unshift(el("p.el-tip", {}, icon("MousePointerClick", 14), " Click to add, drag onto the page, or hover for a closer look."));
    }
    body.replaceChildren(...nodes);
  }

  let t = 0;
  input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(paint, 90); });
  input.addEventListener("keydown", (e) => { if (e.key === "Escape" && input.value) { e.stopPropagation(); input.value = ""; paint(); } });
  clear.addEventListener("click", () => { input.value = ""; paint(); input.focus(); });
  box.classList.add("el-panel");
  box.append(search, chips, body);
  paint();
  const offLib = onLibraryChange(() => { if (!view) paint(); });
  // Starring changes the Favourites shelf (and chip): repaint, keeping the scroll spot and focus.
  const onFav = (it) => {
    const top = box.scrollTop, focused = document.activeElement?.closest?.(".el-tw") && box.contains(document.activeElement);
    if (view === "fav" || !view) paint(); else paintChips();
    box.scrollTop = top;
    if (focused) box.querySelector(`.el-tile[data-label="${CSS.escape(it.label)}"]`)?.focus({ preventScroll: true });
  };
  favListeners.add(onFav);
  return () => { observer?.disconnect(); hidePeek(); offLib(); favListeners.delete(onFav); };
}
