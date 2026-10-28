// Brand bits shared by the shell, the home screen and the overlays: the Sparks art, the logo, the
// "ODDLY clever" wordmark and keyboard labels. No imports from shell.js (avoids an import cycle).
// The art in /public/brand is the user's own property (all rights reserved): see ASSETS.md.
import { el } from "./kit.js";

export const BRAND = {
  avatar: `${import.meta.env.BASE_URL}brand/avatar-96.png`,
  avatarBig: `${import.meta.env.BASE_URL}brand/avatar-256.png`,
  sparks: `${import.meta.env.BASE_URL}brand/sparks.png`,
  sparksGrin: `${import.meta.env.BASE_URL}brand/sparks_grin.png`,
  sparksHead: `${import.meta.env.BASE_URL}brand/sparks_head.png`,
};

/** The tip jar. The app stays free; this is the optional "buy me a tea". */
export const TEA_URL = "https://ko-fi.com/oddlyclevertools";

/** The round Sparks sticker logo. */
export function logo() {
  return el("span.logo", { "aria-hidden": "true" }, el("img", { src: BRAND.avatar, alt: "", draggable: false, width: 36, height: 36 }));
}

/** "ODDLY clever" wordmark (with an optional small tag after it). */
export function wordmark(tag = "Design") {
  return el("span.wordmark", {}, el("b.wm-odd", {}, "ODDLY"), el("i.wm-clever", {}, "clever"), tag ? el("small.wm-tag", {}, tag.toUpperCase()) : null);
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");
export const modKey = isMac ? "⌘" : "Ctrl";


/** "mod+shift+z|mod+y" -> ["Ctrl", "Shift", "Z"] (the first alternative). */
export function keysOf(combo) {
  const first = String(combo).split("|")[0];
  const names = { mod: modKey, shift: "Shift", alt: isMac ? "⌥" : "Alt", delete: "Del", backspace: "⌫", escape: "Esc", space: "Space",
    arrowleft: "←", arrowright: "→", arrowup: "↑", arrowdown: "↓", enter: "Enter", "!": "Shift+1", "=": "=", "+": "+" };
  return first.split("+").filter(Boolean).map((p) => names[p] || (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)));
}
