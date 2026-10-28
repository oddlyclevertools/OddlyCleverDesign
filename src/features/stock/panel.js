// The Photos panel: free stock photos and videos from Pexels, Pixabay and Openverse. A search box,
// source chips, Photos/Videos tabs, shape and colour filters, and an endless grid of results.
// Click a result to add it, drag it onto the page or into a frame, or use its menu.
import { el, icon, modal, popover, closePopover, toast } from "../../ui/kit.js";
import { COLORS, ORIENTATIONS, SOURCES, SOURCE_IDS, creditLine, safeUrl } from "./sources.js";
import { forgetStockKey, getStockKey, isStockKeyRemembered, loadStockKeys, setStockKey } from "./keys.js";
import { readySources, searchMany } from "./api.js";
import {
  addStock, designCredits, getStockVideoBlob, hasVideoHandler, rememberItems, saveBlob,
} from "./actions.js";

export const STOCK_DRAG = "application/x-oddlyclever-stock";

// Kept between openings of the panel.
const state = {
  query: "", source: "all", kind: "photo", orientation: "any", color: "",
  items: [], pages: {}, more: {}, errors: {}, searched: false, scroll: 0,
};

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function renderStockPanel(box, app) {
  box.classList.add("sk-panel");
  const scroller = box.closest(".panel-inner") || box;
  let seq = 0, loading = false, abort = null;

  const input = el("input.sk-input", {
    type: "search", placeholder: "Search free photos", value: state.query, "aria-label": "Search free stock photos and videos",
    on: { keydown: (e) => { if (e.key === "Enter") { e.preventDefault(); newSearch(); } } },
  });
  const go = el("button.btn.primary.sk-go", { type: "button", title: "Search", "aria-label": "Search", on: { click: () => newSearch() } }, icon("Search", 16));
  const creditsBtn = el("button.btn.small.sk-credits-btn", { type: "button", title: "Credits for the stock pictures in this design", on: { click: () => showCredits(app) } },
    icon("Quote", 14), "Credits");
  const privacy = el("p.sk-privacy", { role: "note" });

  const chips = el("div.sk-chips", { role: "radiogroup", "aria-label": "Where to search" });
  const tabs = el("div.sk-tabs", { role: "tablist", "aria-label": "Photos or videos" });
  const shapeSel = el("select.sel.sk-shape", { "aria-label": "Shape", on: { change: (e) => { state.orientation = e.target.value; refilter(); } } },
    ...ORIENTATIONS.map((o) => el("option", { value: o.id, selected: o.id === state.orientation }, o.label)));
  const colorBtn = el("button.btn.small.sk-color-btn", { type: "button", "aria-label": "Colour filter", on: { click: () => pickColor() } });
  const filters = el("div.sk-filters", {}, shapeSel, colorBtn);

  const keysBox = el("details.sk-keys");
  const status = el("div.sk-status", { role: "status", "aria-live": "polite" });
  const cols = [el("div.sk-col"), el("div.sk-col")];
  const grid = el("div.sk-grid", {}, ...cols);
  const sentinel = el("div.sk-sentinel");
  const results = el("div.sk-results", {}, status, grid, sentinel);
  const from = el("p.sk-from", {}, "Free pictures from ",
    ...SOURCE_IDS.flatMap((s, i) => [i ? (i === SOURCE_IDS.length - 1 ? " and " : ", ") : "",
      el("a", { href: SOURCES[s].site, target: "_blank", rel: "noopener noreferrer" }, SOURCES[s].name)]), ".");

  box.append(
    el("div.sk-head", {}, el("div.sk-search", {}, icon("Search", 16), input, go), creditsBtn),
    privacy, chips, tabs, filters, keysBox, results, from,
  );

  // ---- controls ----------------------------------------------------------------------------
  function drawChips() {
    chips.replaceChildren(...["all", ...SOURCE_IDS].map((s) => {
      const def = SOURCES[s];
      const noKey = def?.needsKey && !getStockKey(s);
      const off = def && !def.kinds.includes(state.kind);
      return el("button.sk-chip", {
        type: "button", role: "radio", "aria-checked": String(state.source === s), class: state.source === s ? "on" : null, disabled: off,
        title: off ? `${def.name} has no videos` : noKey ? `${def.name} needs a free key (see below)` : s === "all" ? "Search every site you can" : `Search ${def.name} only`,
        on: { click: () => { state.source = s; drawControls(); if (noKey) keysBox.open = true; if (state.query) newSearch(); } },
      }, s === "all" ? "All" : def.name, noKey ? el("span.sk-chip-key", { "aria-hidden": "true" }, icon("KeyRound", 11)) : null);
    }));
  }
  function drawTabs() {
    tabs.replaceChildren(...[["photo", "Photos", "Image"], ["video", "Videos", "Film"]].map(([k, label, ic]) => el("button.sk-tab", {
      type: "button", role: "tab", "aria-selected": String(state.kind === k), class: state.kind === k ? "on" : null,
      on: { click: () => {
        if (state.kind === k) return;
        state.kind = k;
        if (k === "video" && state.source === "openverse") state.source = "all";
        drawControls();
        if (state.query) newSearch();
      } },
    }, icon(ic, 15), label)));
  }
  function drawColor() {
    const c = COLORS.find((x) => x.id === state.color);
    const usable = state.kind === "photo" && (state.source === "all" || SOURCES[state.source].colors);
    colorBtn.disabled = !usable;
    colorBtn.title = usable ? "Only show pictures with this main colour" : "Colour filter works for Pexels and Pixabay photos";
    colorBtn.replaceChildren(el("span.sk-swatch", { style: { background: c ? c.hex : "conic-gradient(#e5484d,#ffd60a,#30a46c,#0090ff,#8e4ec6,#e5484d)" } }),
      c ? c.label : "Any colour");
  }
  function drawPrivacy() {
    const who = sourcesNow().map((s) => SOURCES[s].name);
    privacy.replaceChildren(icon("ShieldCheck", 14), el("span", {}, who.length
      ? `Searching sends your words to ${who.join(", ")}. A picture is downloaded into your design only when you add it.`
      : state.kind === "video" || state.source === "all"
        ? "Nothing is sent yet: videos and colour searches use Pexels and Pixabay, which need a free key first."
        : `Nothing is sent yet: ${SOURCES[state.source]?.name || "this site"} needs a free key first.`));
  }
  function drawControls() { drawChips(); drawTabs(); drawColor(); drawPrivacy(); input.placeholder = state.kind === "video" ? "Search free videos" : "Search free photos"; }

  function pickColor() {
    const pick = (id) => { closePopover(); state.color = id; drawColor(); if (state.query) newSearch(); };
    popover(colorBtn, el("div.sk-color-pop", {},
      el("button.sk-color-any", { type: "button", on: { click: () => pick("") } }, "Any colour"),
      el("div.sk-color-grid", {}, ...COLORS.map((c) => el("button.sk-color", {
        type: "button", title: c.label, "aria-label": c.label, class: state.color === c.id ? "on" : null,
        style: { background: c.hex }, on: { click: () => pick(c.id) },
      }))),
      state.source === "all" ? el("p.sk-note", {}, "Openverse can't filter by colour, so it is skipped while a colour is on.") : null,
    ), { cls: "sk-pop" });
  }

  function drawKeys() {
    keysBox.replaceChildren(el("summary", {}, icon("KeyRound", 14), "Free keys for Pexels and Pixabay"),
      el("p.sk-note", {}, "Openverse works without a key. Pexels and Pixabay give a free key in a minute. It stays in this tab unless you tick Remember."),
      ...["pexels", "pixabay"].map(keyRow));
  }
  function keyRow(id) {
    const def = SOURCES[id];
    const has = Boolean(getStockKey(id));
    const field = el("input.sk-key", { type: "password", autocomplete: "off", spellcheck: false, placeholder: has ? "Key saved (paste to change)" : `Paste your ${def.name} key`, "aria-label": `${def.name} key` });
    const remember = el("input", { type: "checkbox", checked: isStockKeyRemembered(id) });
    const save = async () => {
      const v = field.value.trim();
      try {
        if (v) await setStockKey(id, v, { remember: remember.checked });
        else if (has) await setStockKey(id, getStockKey(id), { remember: remember.checked });
        else return;
        toast(`${def.name} key ${v ? "added" : "updated"}.`);
        drawKeys(); keysBox.open = true; drawControls();
      } catch (e) { toast(e.message, { error: true }); }
    };
    field.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
    remember.addEventListener("change", () => { if (has && !field.value) save(); });
    return el("div.sk-key-row", {},
      el("div.sk-key-top", {}, el("b", {}, def.name), has ? el("span.sk-ok", {}, icon("Check", 12), "ready") : null,
        el("a.sk-get", { href: def.keyUrl, target: "_blank", rel: "noopener noreferrer" }, "Get a free key", icon("ExternalLink", 11))),
      el("div.sk-key-line", {}, field, el("button.btn.small", { type: "button", on: { click: save } }, "Save")),
      el("div.sk-key-line", {}, el("label.sk-remember", {}, remember, "Remember on this computer"),
        has ? el("button.sk-forget", { type: "button", on: { click: async () => { await forgetStockKey(id); toast(`${def.name} key removed.`); drawKeys(); keysBox.open = true; drawControls(); } } }, "Forget key") : null));
  }

  // ---- searching -----------------------------------------------------------------------------
  const sourcesNow = () => {
    let list = readySources(state.kind, state.source);
    if (state.color) list = list.filter((s) => SOURCES[s].colors);
    return list;
  };

  function newSearch() {
    state.query = input.value.trim();
    if (!state.query) { input.focus(); return; }
    abort?.abort();
    loading = false;
    Object.assign(state, { items: [], pages: {}, more: {}, errors: {}, searched: true, scroll: 0 });
    cols.forEach((c) => c.replaceChildren());
    heights[0] = heights[1] = 0;
    scroller.scrollTop = 0;
    loadMore();
  }

  async function loadMore() {
    if (loading || !state.query) return;
    const list = sourcesNow().filter((s) => state.pages[s] === undefined || state.more[s]);
    if (!list.length) { showStatus(); return; }
    loading = true;
    const my = ++seq;
    abort = new AbortController();
    status.replaceChildren(el("span.sk-spin"), state.items.length ? "Loading more…" : "Searching…");
    if (!state.items.length) showSkeletons();
    const pages = Object.fromEntries(list.map((s) => [s, (state.pages[s] || 0) + 1]));
    try {
      const res = await searchMany(list, { query: state.query, kind: state.kind, orientation: state.orientation, color: state.color }, pages, { signal: abort.signal });
      if (my !== seq) return;
      for (const s of list) { state.pages[s] = pages[s]; state.more[s] = res.more[s]; }
      Object.assign(state.errors, res.errors);
      const fresh = res.items.filter((it) => !state.items.some((x) => x.id === it.id));
      rememberItems(fresh);
      state.items.push(...fresh);
      clearSkeletons();
      fresh.forEach((it, k) => addTile(it, k));
    } catch (e) {
      if (e?.name === "AbortError") return;
      state.errors.all = e.message;
    } finally {
      if (my === seq) { loading = false; clearSkeletons(); showStatus(); requestAnimationFrame(checkSentinel); }
    }
  }

  function showStatus() {
    const errs = Object.entries(state.errors).map(([s, m]) => el("p.sk-err", {}, icon("TriangleAlert", 13), m));
    let msg = null;
    if (!state.searched) msg = emptyNote(state.kind === "video" ? "Clapperboard" : "Images", "Search for anything: “city at night”, “gold coins”, “happy dog”.");
    else if (!sourcesNow().length) msg = emptyNote("KeyRound", state.kind === "video" ? "Videos need a free Pexels or Pixabay key. Add one above." : "Add a free key above to search this site.");
    else if (!state.items.length && !loading) msg = emptyNote("SearchX", "No pictures found. Try other words or fewer filters.");
    const any = Object.values(state.more).some(Boolean);
    status.replaceChildren(...errs, ...(msg ? [msg] : []));
    sentinel.textContent = state.items.length && !any ? "That's everything." : "";
  }

  /** A friendly empty or hint state: an icon over one line. */
  function emptyNote(ic, text) {
    return el("p.sk-empty", {}, el("span.sk-empty-ic", { "aria-hidden": "true" }, icon(ic, 20)), el("span", {}, text));
  }

  // Shimmer placeholders while the first page of a search loads (taller and shorter, like photos).
  const SKELETON_SHAPES = [[4, 3], [3, 4], [1, 1], [16, 9], [4, 5], [3, 2]];
  function showSkeletons() {
    clearSkeletons();
    SKELETON_SHAPES.forEach(([w, h], k) => cols[k % 2].append(el("div.sk-skel.oc-skeleton", { "aria-hidden": "true", style: { aspectRatio: `${w} / ${h}`, "--i": k } })));
  }
  function clearSkeletons() { cols.forEach((c) => c.querySelectorAll(".sk-skel").forEach((n) => n.remove())); }

  // ---- results -----------------------------------------------------------------------------
  const heights = [0, 0];
  function addTile(it, k = 0) {
    const i = heights[0] <= heights[1] ? 0 : 1;
    heights[i] += (it.height || 1) / (it.width || 1);
    const node = tile(it);
    node.style.setProperty("--i", String(Math.min(k, 14)));
    cols[i].append(node);
  }
  function refilter() { if (state.query) newSearch(); }

  function tile(it) {
    const img = el("img", { src: it.thumb, alt: it.title, loading: "lazy", draggable: false, referrerPolicy: "no-referrer" });
    img.addEventListener("load", () => node.classList.remove("sk-loading"), { once: true });
    img.addEventListener("error", () => { node.classList.remove("sk-loading"); node.classList.add("sk-broken"); }, { once: true });
    const more = el("button.sk-more", { type: "button", title: "More", "aria-label": `More for ${it.title}`, on: { click: (e) => { e.stopPropagation(); menu(it, more); } } }, icon("Ellipsis", 15));
    const badge = it.source === "openverse" ? el("span.sk-lic", { title: it.license }, it.license.replace(/ \d.*$/, "")) : null;
    const node = el("div.sk-tile.sk-loading", {
      role: "button", tabindex: 0, draggable: it.kind === "photo" ? "true" : "false",
      title: `${it.title}\nby ${it.author} · ${SOURCES[it.source].name} · ${it.license}`,
      "aria-label": `${it.kind === "video" ? "Video" : "Photo"}: ${it.title}, by ${it.author}`,
      style: { aspectRatio: `${it.width || 4} / ${it.height || 3}`, background: it.color || "var(--bg-3)" },
      on: {
        click: () => use(it, node),
        keydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); use(it, node); } },
        dragstart: (e) => { e.dataTransfer.setData(STOCK_DRAG, it.id); e.dataTransfer.effectAllowed = "copy"; node.classList.add("dragging"); },
        dragend: () => node.classList.remove("dragging"),
      },
    }, img, badge,
    it.kind === "video" ? el("span.sk-dur", {}, icon("Play", 11), fmtTime(it.duration || 0)) : null,
    el("span.sk-by", {}, it.author), more);
    return node;
  }

  async function use(it, node, place = null) {
    if (node.classList.contains("busy")) return;
    if (it.kind === "video") { videoMenu(it, node); return; }
    if (app.view !== "editor") { toast("Open a design first.", { error: true }); return; }
    node.classList.add("busy");
    try {
      await addStock(app, it.id, place);
    } catch (e) {
      toast(e.message, { error: true });
    } finally {
      node.classList.remove("busy");
    }
  }

  function menu(it, anchor) {
    const node = anchor.closest(".sk-tile");
    const item = (ic, label, fn) => el("button.sk-menu-item", { type: "button", on: { click: () => { closePopover(); fn(); } } }, icon(ic, 15), label);
    const rows = it.kind === "video" ? videoRows(it, node, item) : [
      item("Plus", "Add to design", () => use(it, node)),
      item("Wallpaper", "Use as background", () => use(it, node, "background")),
    ];
    popover(anchor, el("div.sk-menu", {},
      el("div.sk-menu-head", {}, el("b", {}, it.title), el("span", {}, `by ${it.author} · ${SOURCES[it.source].name}`), el("span.sk-menu-lic", {}, it.license)),
      ...rows,
      it.pageUrl ? el("a.sk-menu-item", { href: it.pageUrl, target: "_blank", rel: "noopener noreferrer", on: { click: () => closePopover() } }, icon("ExternalLink", 15), `Open on ${SOURCES[it.source].name}`) : null,
    ), { align: "end", cls: "sk-pop" });
  }

  function videoRows(it, node, item) {
    return [
      hasVideoHandler() ? item("Clapperboard", "Add to my videos", () => sendVideo(it, node)) : null,
      item("Download", "Save video file", () => saveVideo(it, node)),
      app.view === "editor" ? item("Image", "Add a still from it", () => addStill(it, node)) : null,
    ].filter(Boolean);
  }
  function videoMenu(it, node) { menu(it, node.querySelector(".sk-more")); }
  const addStill = (it, node) => busy(node, async () => {
    const still = { ...it, id: `${it.id}#still`, kind: "photo", title: `${it.title} (still)`.slice(0, 120) };
    rememberItems([still]);
    await addStock(app, still.id);
  });

  async function busy(node, fn) {
    node.classList.add("busy");
    try { await fn(); } catch (e) { toast(e.message, { error: true }); } finally { node.classList.remove("busy"); }
  }
  const sendVideo = (it, node) => busy(node, async () => { await addStock(app, it.id); toast("Video added to your videos, with its credit."); });
  const saveVideo = (it, node) => busy(node, async () => {
    const v = await getStockVideoBlob(it);
    saveBlob(v.blob, v.name);
    toast(`Saved. Credit for your description: ${creditLine(v.credit)}`, { ms: 7000 });
  });

  // ---- endless scroll ------------------------------------------------------------------------
  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) loadMore(); }, { root: null, rootMargin: "400px" });
  io.observe(sentinel);
  function checkSentinel() {
    const r = sentinel.getBoundingClientRect();
    if (r.top < innerHeight + 400 && Object.values(state.more).some(Boolean)) loadMore();
  }

  drawControls();
  drawKeys();
  loadStockKeys().then(() => { drawKeys(); drawControls(); });
  if (state.items.length) state.items.forEach((it, k) => addTile(it, k));
  showStatus();
  requestAnimationFrame(() => { scroller.scrollTop = state.scroll; });
  const onScroll = () => { state.scroll = scroller.scrollTop; };
  scroller.addEventListener("scroll", onScroll, { passive: true });
  return () => { io.disconnect(); abort?.abort(); scroller.removeEventListener("scroll", onScroll); };
}

// ---- credits dialog -----------------------------------------------------------------------

/** Show every stock credit in the open design, ready to copy into a video description. */
export function showCredits(app) {
  const list = app.view === "editor" ? designCredits(app) : [];
  const text = list.length ? ["Stock credits:", ...list.map((c) => `- ${creditLine(c)}`)].join("\n") : "";
  modal("Credits", () => el("div.sk-credits", {},
    list.length
      ? el("p.sk-note", {}, "Paste these into your video description. Openverse pictures need the credit by their licence; Pexels and Pixabay ask for it kindly.")
      : el("p.sk-empty", {}, "This design has no stock pictures yet. Pictures you add from the Photos panel keep their credit here."),
    list.length ? el("ul.sk-credit-list", {}, ...list.map((c) => el("li", {},
      el("b", {}, c.title), el("span", {}, ` by ${c.author} · ${c.site} · ${c.license}`),
      safeUrl(c.pageUrl) ? el("a", { href: safeUrl(c.pageUrl), target: "_blank", rel: "noopener noreferrer" }, "source") : null))) : null,
    list.length ? el("textarea.sk-credit-text", { readOnly: true, rows: Math.min(10, list.length + 2), "aria-label": "Credits text" }, text) : null,
    list.length ? el("div.row.end", {}, el("button.btn.primary", { type: "button", on: { click: async () => {
      try { await navigator.clipboard.writeText(text); toast("Credits copied."); } catch { toast("Couldn't copy. Select the text and copy it.", { error: true }); }
    } } }, icon("Copy", 15), "Copy all")) : null,
  ));
}
