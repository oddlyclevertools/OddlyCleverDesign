// The font family popover: search, category chips, favourites, recently used, your uploaded fonts,
// then the bundled fonts by category, each name drawn in its own font. Resting on a font shows it
// on the selected text (live preview); the arrow keys move through the list, Enter picks, and F
// (or the star) adds a font to your favourites. "Upload a font" adds your own.
import { FONTS, FONT_NAMES } from "../../core/fonts.js";
import { el, icon, popover, closePopover } from "../../ui/kit.js";
import { userFonts, uploadFonts, chooseFontFiles } from "../styles/user-fonts.js";
import { recentFonts } from "./helpers.js";

export const CATEGORY_ORDER = ["Sans", "Display", "Serif", "Script", "Handwriting", "Rounded"];
const CHIPS = ["All", "Favourites", "Yours", ...CATEGORY_ORDER];
const FAV_KEY = "oc.text.favFonts";
const HOVER_MS = 140;
let lastChip = "All";

const categoryOf = (name) => FONTS[name]?.category || "Yours";

export function favouriteFonts() {
  try {
    const list = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    return Array.isArray(list) ? list.filter((f) => typeof f === "string") : [];
  } catch {
    return [];
  }
}
export function toggleFavouriteFont(family) {
  const list = favouriteFonts();
  const next = list.includes(family) ? list.filter((f) => f !== family) : [family, ...list].slice(0, 40);
  try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* storage blocked: favourites aren't kept */ }
  return next.includes(family);
}

/**
 * Open the font picker under `anchor`.
 * @param {HTMLElement} anchor
 * @param {string} current the family in use
 * @param {(family: string) => void} onPick
 * @param {{onPreview?: (family: string) => void, onPreviewEnd?: () => void}} [live] live preview hooks
 */
export function openFontPicker(anchor, current, onPick, { onPreview = null, onPreviewEnd = null } = {}) {
  let chip = lastChip;
  let hoverTimer = 0, previewing = null;
  const search = el("input.tx-font-search", {
    type: "search", placeholder: `Search ${FONT_NAMES.length + userFonts().length} fonts`, "aria-label": "Search fonts", spellcheck: false,
  });
  const list = el("div.tx-font-list", { role: "listbox", "aria-label": "Fonts" });
  const chips = el("div.tx-font-chips", { role: "tablist", "aria-label": "Font kinds" });

  const preview = (name) => {
    clearTimeout(hoverTimer);
    if (!onPreview || name === previewing) return;
    hoverTimer = setTimeout(() => { previewing = name; onPreview(name); }, HOVER_MS);
  };
  const stopPreview = () => {
    clearTimeout(hoverTimer);
    if (previewing == null) return;
    previewing = null;
    onPreviewEnd?.();
  };
  const pick = (name) => {
    stopPreview();
    closePopover();
    onPick(name);
  };

  const row = (name, favs) => {
    const fav = favs.includes(name);
    const btn = el("button.tx-font-row", {
      type: "button", role: "option", "aria-selected": String(name === current), class: name === current ? "on" : null,
      title: `${name} (${categoryOf(name)})`, style: { fontFamily: `"${name}", var(--ui)` }, dataset: { family: name },
      on: {
        click: () => pick(name),
        mouseenter: () => preview(name),
        focus: () => preview(name),
      },
    }, el("span", {}, name), name === current ? icon("Check", 15) : null);
    const star = el("button.tx-font-star", {
      type: "button", tabindex: "-1", class: fav ? "on" : null, "aria-pressed": String(fav),
      title: fav ? "Remove from favourites (F)" : "Add to favourites (F)", "aria-label": `${fav ? "Remove" : "Add"} ${name} ${fav ? "from" : "to"} favourites`,
      on: { click: () => { toggleFavouriteFont(name); paint(name); } },
    }, icon("Star", 14));
    return el("div.tx-font-item", {}, btn, star);
  };

  const upload = el("button.tx-font-upload", {
    type: "button", title: "Add your own .ttf, .otf, .woff or .woff2 font",
    on: { click: async () => {
      const added = await uploadFonts(await chooseFontFiles());
      if (added.length) pick(added[0].family);
    } },
  }, icon("Upload", 15), "Upload a font");

  const paintChips = () => chips.replaceChildren(...CHIPS.map((c) => el("button.tx-font-chip", {
    type: "button", role: "tab", "aria-selected": String(c === chip), class: c === chip ? "on" : null,
    on: { click: () => { chip = lastChip = c; paintChips(); paint(); } },
  }, c === "Favourites" ? icon("Star", 12) : null, c)));

  /** Draw the list; `keep` refocuses that font's row afterwards (after a star toggle). */
  const paint = (keep = null) => {
    const q = search.value.trim().toLowerCase();
    const mine = userFonts().map((f) => f.family);
    const all = [...mine, ...FONT_NAMES];
    const favs = favouriteFonts().filter((n) => all.includes(n));
    const match = (n) => (!q || n.toLowerCase().includes(q) || categoryOf(n).toLowerCase().includes(q))
      && (chip === "All" || (chip === "Favourites" ? favs.includes(n) : categoryOf(n) === chip));
    const groups = [];
    const top = !q && chip === "All";
    if (favs.length && (top || chip === "Favourites")) groups.push(["Favourites", favs.filter(match)]);
    const recent = recentFonts().filter((n) => all.includes(n) && match(n));
    if (recent.length && top) groups.push(["Recently used", recent]);
    if (chip !== "Favourites") {
      const yours = mine.filter(match);
      if (yours.length) groups.push(["Your fonts", yours]);
      for (const cat of CATEGORY_ORDER) {
        const names = FONT_NAMES.filter((n) => FONTS[n].category === cat && match(n));
        if (names.length) groups.push([cat, names]);
      }
    }
    const empty = chip === "Yours" && !q
      ? el("p.tx-empty", {}, "No fonts of your own yet. Upload one below and it shows up here in every design.")
      : chip === "Favourites" && !favs.length
        ? el("p.tx-empty", {}, "No favourites yet. Click a font's star, or press F on it, to keep it here.")
        : el("p.tx-empty", {}, "No fonts match.");
    const shown = groups.filter(([, names]) => names.length);
    list.replaceChildren(...(shown.length ? shown.map(([title, names]) => el("div.tx-font-group", { role: "group", "aria-label": title },
      el("h5", {}, title), names.map((n) => row(n, favs)))) : [empty]));
    if (keep) list.querySelector(`.tx-font-row[data-family="${CSS.escape(keep)}"]`)?.focus({ preventScroll: true });
  };

  const rows = () => [...list.querySelectorAll(".tx-font-row")];
  const move = (from, d) => {
    const r = rows();
    if (!r.length) return;
    const i = r.indexOf(from);
    const next = i < 0 ? (d > 0 ? r[0] : r.at(-1)) : r[Math.max(0, Math.min(r.length - 1, i + d))];
    next.focus();
    next.scrollIntoView({ block: "nearest" });
  };
  search.addEventListener("input", () => paint());
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") rows()[0]?.click();
    else if (e.key === "ArrowDown") { e.preventDefault(); move(null, 1); }
  });
  list.addEventListener("keydown", (e) => {
    const r = e.target.closest?.(".tx-font-row");
    if (!r) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (e.key === "ArrowUp" && rows()[0] === r) search.focus();
      else move(r, e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      move(null, e.key === "Home" ? 1 : -1);
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      toggleFavouriteFont(r.dataset.family);
      paint(r.dataset.family);
    }
  });
  list.addEventListener("mouseleave", () => { if (!list.contains(document.activeElement)) stopPreview(); });
  search.addEventListener("focus", stopPreview);

  paintChips();
  paint();
  popover(anchor, el("div.tx-font-pop", {}, el("div.tx-font-head", {}, icon("Search", 15), search), chips, list,
    el("p.tx-font-keys", {}, "↑ ↓ to move · Enter to pick · F to favourite"), upload), { cls: "tx-pop", onClose: stopPreview });
  requestAnimationFrame(() => {
    search.focus();
    list.querySelector(".tx-font-row.on")?.scrollIntoView({ block: "center" });
  });
}
