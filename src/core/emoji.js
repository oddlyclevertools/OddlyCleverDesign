// Colour emoji that look the same everywhere, flags included (Windows shows 🇬🇧 as the letters
// "GB" with its own emoji font). Noto Color Emoji (SIL OFL; the COLRv1 build from
// @infolektuell/noto-color-emoji, which Chrome and Edge draw; served from our own build) is added to every bundled font family for emoji code points only, so "Inter" and the
// rest draw emoji from it while letters, digits, #, *, © and ™ stay with the real font. Only the
// subsets a design uses are downloaded. Canvas text doesn't load fonts by itself, so text that
// gains emoji asks for them and redraws once they arrive.
import { cache } from "fabric";
import emojiCSS from "@infolektuell/noto-color-emoji/index.css?raw";
import { FONTS, emojiIn } from "./fonts.js";

const FILES = import.meta.glob("/node_modules/@infolektuell/noto-color-emoji/files/*.woff2", { query: "?url", import: "default", eager: true });
const TEXT_SYMBOLS = new Set([0x2122, 0x2139]); // ™ ℹ stay with the text font

/** "U+23,U+30-39,U+1f1e6-1f1ff" without the ASCII/Latin and text-symbol parts. */
export function emojiOnlyRange(range) {
  return range.split(",").map((r) => r.trim()).filter((r) => {
    const [a, b = a] = r.replace(/^U\+/i, "").split("-").map((h) => parseInt(h, 16));
    if (!(a >= 0)) return false;
    if (b < 0x2000) return false;
    if (a === b && TEXT_SYMBOLS.has(a)) return false;
    if (a >= 0x2100 && b <= 0x21ff) return false; // letterlike symbols and arrows (↔ ↗) stay as text
    return true;
  }).join(",");
}

/** The subsets of the emoji font: [{ url, range }]. */
function subsets() {
  const out = [];
  for (const block of emojiCSS.split("@font-face").slice(1)) {
    const file = block.match(/files\/([\w-]+\.woff2)/)?.[1];
    const range = block.match(/unicode-range:\s*([^;]+);/)?.[1];
    const url = Object.entries(FILES).find(([k]) => k.endsWith(`/${file}`))?.[1];
    const clean = range ? emojiOnlyRange(range) : "";
    if (url && clean) out.push({ url, range: clean });
  }
  return out;
}

let installed = false;

/**
 * Add the emoji faces to every bundled family (once), at exactly the weights and styles the
 * family has: Chrome groups faces by those, and a face with another weight would never be used.
 */
export function installEmojiFont(fonts = FONTS) {
  if (installed || typeof FontFace === "undefined") return;
  installed = true;
  const parts = subsets();
  for (const [family, f] of Object.entries(fonts)) {
    // Upright only: an italic face that covers just emoji would make Chrome drop the synthesised
    // italic for the letters, so italic text keeps the system's emoji.
    for (const weight of f.weights || [400]) {
      for (const { url, range } of parts) {
        try {
          document.fonts.add(new FontFace(family, `url(${url}) format("woff2")`, { unicodeRange: range, weight: String(weight), display: "block" }));
        } catch { /* a family name the browser rejects: that family just keeps system emoji */ }
      }
    }
  }
}

/** Load the emoji faces a text object needs, then re-measure and redraw it. */
export async function loadEmojiFor(obj, canvas) {
  const e = emojiIn(obj?.text);
  if (!e || !obj.fontFamily) return;
  const font = `${obj.fontStyle || "normal"} ${obj.fontWeight || 400} 48px "${obj.fontFamily}"`;
  if (document.fonts.check(font, e)) return;
  try { await document.fonts.load(font, e); } catch { return; }
  cache.clearFontCache(obj.fontFamily);
  obj.initDimensions?.();
  obj.set?.("dirty", true);
  obj.setCoords?.();
  canvas?.requestRenderAll();
}

/** Watch a canvas: text that is added or typed with emoji gets its emoji font. */
export function watchEmoji(canvas) {
  const check = (o) => {
    if (!o) return;
    if (typeof o.text === "string") loadEmojiFor(o, canvas);
    (o._objects || []).forEach(check);
  };
  canvas.on("object:added", (e) => check(e.target));
  canvas.on("text:changed", (e) => check(e.target));
}
