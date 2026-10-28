// Bundled fonts (all SIL OFL via @fontsource, served from our own build: works offline).
// Each family lists the weights it ships; ensureFont() waits until a face is ready so Fabric
// measures text with the real font, not a fallback.
import "@fontsource/inter/400.css";
import "@fontsource/inter/400-italic.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/400-italic.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import "@fontsource/montserrat/900-italic.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/400-italic.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/poppins/800.css";
import "@fontsource/poppins/900.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/400-italic.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/900.css";
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/600.css";
import "@fontsource/oswald/700.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/400-italic.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/900.css";
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-serif-display/400-italic.css";
import "@fontsource/anton/400.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/archivo-black/400.css";
import "@fontsource/bangers/400.css";
import "@fontsource/permanent-marker/400.css";
import "@fontsource/lobster/400.css";
import "@fontsource/pacifico/400.css";
import "@fontsource/rubik/400.css";
import "@fontsource/rubik/500.css";
import "@fontsource/rubik/700.css";
import "@fontsource/rubik/900.css";
import "@fontsource/rubik/400-italic.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/900.css";
import "@fontsource/nunito/400-italic.css";
import "@fontsource/raleway/400.css";
import "@fontsource/raleway/700.css";
import "@fontsource/raleway/900.css";
import "@fontsource/raleway/400-italic.css";
import "@fontsource/kanit/400.css";
import "@fontsource/kanit/700.css";
import "@fontsource/kanit/900.css";
import "@fontsource/kanit/400-italic.css";
import "@fontsource/fredoka/400.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "@fontsource/barlow-condensed/400.css";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/900.css";
import "@fontsource/barlow-condensed/400-italic.css";
import "@fontsource/teko/400.css";
import "@fontsource/teko/600.css";
import "@fontsource/teko/700.css";
import "@fontsource/lilita-one/400.css";
import "@fontsource/righteous/400.css";
import "@fontsource/russo-one/400.css";
import "@fontsource/bungee/400.css";
import "@fontsource/luckiest-guy/400.css";
import "@fontsource/titan-one/400.css";
import "@fontsource/black-ops-one/400.css";
import "@fontsource/alfa-slab-one/400.css";
import "@fontsource/abril-fatface/400.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/700.css";
import "@fontsource/lora/400-italic.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/700.css";
import "@fontsource/merriweather/900.css";
import "@fontsource/merriweather/400-italic.css";
import "@fontsource/caveat/400.css";
import "@fontsource/caveat/700.css";
import "@fontsource/dancing-script/400.css";
import "@fontsource/dancing-script/700.css";

/** family -> { weights, italic, category } (the CSS family names @fontsource registers). */
export const FONTS = {
  "Inter": { weights: [400, 600, 700, 800, 900], italic: true, category: "Sans" },
  "Montserrat": { weights: [400, 600, 700, 800, 900], italic: true, category: "Sans" },
  "Poppins": { weights: [400, 600, 700, 800, 900], italic: true, category: "Sans" },
  "Roboto": { weights: [400, 700, 900], italic: true, category: "Sans" },
  "Space Grotesk": { weights: [400, 700], italic: false, category: "Sans" },
  "Oswald": { weights: [400, 600, 700], italic: false, category: "Display" },
  "Anton": { weights: [400], italic: false, category: "Display" },
  "Bebas Neue": { weights: [400], italic: false, category: "Display" },
  "Archivo Black": { weights: [400], italic: false, category: "Display" },
  "Bangers": { weights: [400], italic: false, category: "Display" },
  "Playfair Display": { weights: [400, 700, 900], italic: true, category: "Serif" },
  "DM Serif Display": { weights: [400], italic: true, category: "Serif" },
  "Permanent Marker": { weights: [400], italic: false, category: "Handwriting" },
  "Lobster": { weights: [400], italic: false, category: "Script" },
  "Pacifico": { weights: [400], italic: false, category: "Script" },
  "Rubik": { weights: [400, 500, 700, 900], italic: true, category: "Sans" },
  "Nunito": { weights: [400, 700, 900], italic: true, category: "Sans" },
  "Raleway": { weights: [400, 700, 900], italic: true, category: "Sans" },
  "Kanit": { weights: [400, 700, 900], italic: true, category: "Sans" },
  "Fredoka": { weights: [400, 600, 700], italic: false, category: "Rounded" },
  "Barlow Condensed": { weights: [400, 700, 900], italic: true, category: "Display" },
  "Teko": { weights: [400, 600, 700], italic: false, category: "Display" },
  "Lilita One": { weights: [400], italic: false, category: "Display" },
  "Righteous": { weights: [400], italic: false, category: "Display" },
  "Russo One": { weights: [400], italic: false, category: "Display" },
  "Bungee": { weights: [400], italic: false, category: "Display" },
  "Luckiest Guy": { weights: [400], italic: false, category: "Display" },
  "Titan One": { weights: [400], italic: false, category: "Display" },
  "Black Ops One": { weights: [400], italic: false, category: "Display" },
  "Alfa Slab One": { weights: [400], italic: false, category: "Display" },
  "Abril Fatface": { weights: [400], italic: false, category: "Serif" },
  "Lora": { weights: [400, 700], italic: true, category: "Serif" },
  "Merriweather": { weights: [400, 700, 900], italic: true, category: "Serif" },
  "Caveat": { weights: [400, 700], italic: false, category: "Handwriting" },
  "Dancing Script": { weights: [400, 700], italic: false, category: "Script" },
};

export const FONT_NAMES = Object.keys(FONTS);

/** The nearest weight a family really has (so "bold" on Anton stays Anton). */
export function nearestWeight(family, weight) {
  const ws = FONTS[family]?.weights || [400];
  return ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), ws[0]);
}

const EMOJI_ALL = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{E0020}-\u{E007F}\u{FE0F}\u{200D}]/gu;

/** The emoji in a string, once each (what to ask the browser to load from the emoji font). */
export const emojiIn = (text) => [...new Set(String(text || "").match(EMOJI_ALL) || [])].join("");

/** Wait until `family` at `weight`/`style` is loaded (and the emoji in `text`). Never throws. */
export async function ensureFont(family, weight = 400, style = "normal", text = "") {
  try {
    await document.fonts.load(`${style} ${weight} 48px "${family}"`);
    const e = emojiIn(text);
    if (e) await document.fonts.load(`${style} ${weight} 48px "${family}"`, e);
  } catch { /* unknown family: the browser falls back */ }
}

/** Load every face used by a set of Fabric text objects (before first render / export). */
export async function ensureFontsFor(objects) {
  const jobs = [];
  const walk = (o) => {
    if (o.fontFamily) jobs.push(ensureFont(o.fontFamily, o.fontWeight || 400, o.fontStyle || "normal", o.text));
    (o._objects || o.objects)?.forEach(walk); // live groups have _objects, saved JSON has objects
  };
  objects.forEach(walk);
  await Promise.all(jobs);
}
