// Hover preview: rest the pointer on a panel tile and a larger picture of it appears beside
// the panel, with its name and what a click does. Cheap: it reuses the tile's own markup.
import { el } from "../../ui/kit.js";

let card = null, timer = 0, owner = null;

function hide() {
  clearTimeout(timer);
  owner = null;
  card?.classList.remove("show");
}

function show(tile, { title, hint, html }) {
  if (!card) {
    card = el("div.el-peek", { role: "tooltip", "aria-hidden": "true" });
    document.body.append(card);
  }
  card.replaceChildren(el("div.el-peek-art"), el("b", {}, title), el("span", {}, hint));
  const art = card.firstChild;
  if (typeof html === "string") art.innerHTML = html;
  else if (html) art.append(html);
  const r = tile.getBoundingClientRect();
  const panel = tile.closest(".el-panel")?.getBoundingClientRect() || r;
  const w = 248;
  const left = Math.min(innerWidth - w - 8, Math.max(panel.right, r.right) + 12);
  card.style.left = `${left}px`;
  card.style.top = `${Math.max(8, Math.min(innerHeight - 300, r.top + r.height / 2 - 130))}px`;
  requestAnimationFrame(() => card.classList.add("show"));
}

/**
 * Give a tile a hover preview. `get()` returns { title, hint, html } when the preview opens.
 * @param {HTMLElement} tile
 * @param {() => {title: string, hint: string, html: string|Node}} get
 */
export function peek(tile, get) {
  tile.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "touch") return;
    clearTimeout(timer);
    owner = tile;
    timer = setTimeout(() => { if (owner === tile && tile.isConnected) show(tile, get()); }, 380);
  });
  for (const ev of ["pointerleave", "pointerdown", "dragstart", "blur"]) tile.addEventListener(ev, hide);
}

export const hidePeek = hide;
