// v0.2 text presets and combos, using the new fonts and effects. Same format as PRESETS in
// presets.js: parts = [[text, props, widthFactor?], ...]; bg = the preview tile tone.

const fx = (effect, curve = 0) => ({ data: { effect, ...(curve ? { curve } : {}) } });
const OC = { night: "#0d0a10", pink: "#ff2e7e", gold: "#ffc83d", cyan: "#8fe3ff", paper: "#f3ead8", ink: "#16121b" };

/** The moods the Text panel groups presets by, in order. */
export const MOODS = [
  "Oddly Clever", "Thumbnail punch", "YouTube & social", "Neon & night", "Gaming", "Luxury & editorial",
  "Retro & fun", "Labels & banners", "Quotes", "Sports",
];

const p = (id, label, mood, bg, parts) => ({ id, label, mood, bg, parts });

export const MORE_PRESETS = [
  // ---- Oddly Clever ----
  p("oc-wordmark", "Oddly Clever combo", "Oddly Clever", "night", [
    ["ODDLY", { fontFamily: "Archivo Black", fontSize: 130, fill: OC.paper, charSpacing: 20, lineHeight: 1, ...fx({ outline: { thickness: 22, color: OC.ink } }) }],
    ["clever", { fontFamily: "Pacifico", fontSize: 120, fill: OC.pink, angle: -6, ...fx({ neon: { intensity: 72, tube: 55, color: null } }) }, 0.6],
  ]),
  p("oc-loophole", "Paper label", "Oddly Clever", "night", [
    ["WE FOUND THE LOOPHOLE.\nYOU DIDN'T.", { fontFamily: "Inter", fontWeight: 900, fontSize: 44, fill: OC.ink, charSpacing: 40, lineHeight: 1.2,
      angle: -2, ...fx({ background: { roundness: 6, spread: 34, transparency: 0, color: OC.paper } }) }, 0.62],
  ]),
  p("oc-sticker", "Die-cut sticker", "Oddly Clever", "night", [
    ["CLAW KING", { fontFamily: "Archivo Black", fontSize: 110, fill: OC.gold, ...fx({ sticker: { thickness: 45, color: "#ffffff", edge: OC.ink, shadow: 50 }, outline: { thickness: 16, color: OC.ink } }) }],
  ]),
  p("oc-neon-lines", "Double neon sign", "Oddly Clever", "night", [
    ["open late", { fontFamily: "Pacifico", fontSize: 120, fill: OC.pink, ...fx({ double: { offset: 32, direction: -135, glow: 65, color: OC.cyan } }) }, 0.7],
  ]),
  p("oc-rain", "Night street title", "Oddly Clever", "night", [
    ["THE LOOPHOLE", { fontFamily: "Anton", fontSize: 140, fill: OC.paper, lineHeight: 1, ...fx({ shadow: { offset: 30, direction: 90, blur: 60, transparency: 20, color: OC.pink }, outline: { thickness: 20, color: OC.ink } }) }],
    ["nobody told you about", { fontFamily: "Pacifico", fontSize: 54, fill: OC.cyan, angle: -4, ...fx({ neon: { intensity: 55, tube: 50, color: null } }) }, 0.6],
  ]),

  // ---- Thumbnail punch ----
  p("yt-stack", "YouTube title stack", "Thumbnail punch", "dark", [
    ["I TRIED", { fontFamily: "Anton", fontSize: 92, fill: "#ffffff", lineHeight: 1, ...fx({ outline: { thickness: 50, color: "#000000" } }) }],
    ["EVERY", { fontFamily: "Anton", fontSize: 160, fill: "#ffde59", lineHeight: 1, ...fx({ outline: { thickness: 55, color: "#000000" }, shadow: { offset: 35, direction: 50, blur: 0, transparency: 0, color: "#000000" } }) }],
    ["DIET", { fontFamily: "Anton", fontSize: 96, fill: "#ffffff", lineHeight: 1, ...fx({ background: { roundness: 12, spread: 30, transparency: 0, color: "#e11d2e" } }) }, 0.5],
  ]),
  p("yt-worth", "Question + scribble", "Thumbnail punch", "dark", [
    ["WAS IT WORTH IT?", { fontFamily: "Montserrat", fontWeight: 900, fontSize: 96, fill: "#ffffff", lineHeight: 1.02, ...fx({ outline: { thickness: 48, color: "#000000" } }) }],
    ["(honest review)", { fontFamily: "Caveat", fontWeight: 700, fontSize: 70, fill: "#ffde59", angle: -4, ...fx({ outline: { thickness: 30, color: "#000000" } }) }, 0.5],
  ]),
  p("yt-sale", "Big sale", "Thumbnail punch", "dark", [
    ["50% OFF", { fontFamily: "Titan One", fontSize: 140, fill: "#ffd23f", ...fx({ longshadow: { length: 45, direction: 45, color: "#b4241c" }, outline: { thickness: 14, color: "#7a1410" } }) }],
  ]),

  // ---- YouTube & social ----
  p("subscribe-btn", "Subscribe button", "YouTube & social", "light", [
    ["SUBSCRIBE", { fontFamily: "Montserrat", fontWeight: 900, fontSize: 64, fill: "#ffffff", charSpacing: 60, ...fx({ background: { roundness: 45, spread: 50, transparency: 0, color: "#e11d2e" } }) }, 0.5],
  ]),
  p("podcast", "Podcast title", "YouTube & social", "dark", [
    ["THE DEEP END", { fontFamily: "Lilita One", fontSize: 120, fill: "#f6f1ff", lineHeight: 1, ...fx({ shadow: { offset: 26, direction: 90, blur: 0, transparency: 0, color: "#6c4cff" } }) }],
    ["PODCAST · EPISODE 42", { fontFamily: "Raleway", fontWeight: 700, fontSize: 28, fill: "#ffc83d", charSpacing: 320 }, 0.6],
  ]),
  p("caption-pop", "Shorts caption", "YouTube & social", "dark", [
    ["wait for it…", { fontFamily: "Poppins", fontWeight: 800, fontSize: 70, fill: "#ffffff", ...fx({ background: { roundness: 60, spread: 26, transparency: 0, color: "#000000" } }) }, 0.6],
  ]),

  // ---- Neon & night ----
  p("neon-sign", "Neon sign", "Neon & night", "night", [
    ["Cocktails", { fontFamily: "Lobster", fontSize: 128, fill: "#ff3fd2", ...fx({ neon: { intensity: 78, tube: 62, color: null } }) }, 0.7],
  ]),
  p("neon-tubes", "Neon tubes", "Neon & night", "night", [
    ["NIGHT SHIFT", { fontFamily: "Righteous", fontSize: 110, fill: OC.cyan, charSpacing: 40, ...fx({ double: { offset: 30, direction: -135, glow: 60, color: OC.pink } }) }],
  ]),
  p("cyber-glitch", "Cyber glitch", "Neon & night", "night", [
    ["SYSTEM ERROR", { fontFamily: "Russo One", fontSize: 104, fill: "#e6fbff", ...fx({ glitch: { offset: 55, direction: 0, colorA: "#00f0ff", colorB: "#ff2bd6" } }) }],
  ]),
  p("vapor", "Vaporwave chrome", "Neon & night", "night", [
    ["SUNSET DRIVE", { fontFamily: "Kanit", fontWeight: 900, fontStyle: "italic", fontSize: 110, fill: "#ff71ce", lineHeight: 1,
      ...fx({ chrome: { shine: 70, tint: "#ff9ad9" }, longshadow: { length: 30, direction: 45, color: "#01cdfe" } }) }],
  ]),

  // ---- Gaming ----
  p("game-levelup", "Gaming title", "Gaming", "dark", [
    ["LEVEL UP", { fontFamily: "Russo One", fontSize: 128, fill: "#ffc83d", ...fx({ extrude: { depth: 60, direction: 60, color: "#c4452a" }, outline: { thickness: 14, color: "#2a0d08" } }) }],
  ]),
  p("game-boss", "Chrome boss", "Gaming", "dark", [
    ["BOSS FIGHT", { fontFamily: "Black Ops One", fontSize: 120, fill: "#ffffff", ...fx({ chrome: { shine: 75, tint: "#c9ced6" }, extrude: { depth: 50, direction: 70, color: "#6b7487" } }) }],
  ]),
  p("game-over", "Arcade", "Gaming", "night", [
    ["GAME OVER", { fontFamily: "Bungee", fontSize: 110, fill: "#ff004d", ...fx({ longshadow: { length: 50, direction: 45, color: "#29203a" } }) }],
  ]),
  p("game-victory", "Victory", "Gaming", "dark", [
    ["VICTORY!", { fontFamily: "Luckiest Guy", fontSize: 140, fill: "#ffec27", ...fx({ outline: { thickness: 40, color: "#1b1035" }, shadow: { offset: 40, direction: 60, blur: 0, transparency: 0, color: "#ff004d" } }) }],
  ]),

  // ---- Luxury & editorial ----
  p("lux-gold", "Gold serif", "Luxury & editorial", "night", [
    ["The Gold Edition", { fontFamily: "DM Serif Display", fontSize: 110, fill: "#e6b84a", ...fx({ chrome: { shine: 55, tint: "#e6b84a" }, lift: { intensity: 40 } }) }],
  ]),
  p("lux-maison", "Luxury serif title", "Luxury & editorial", "night", [
    ["Maison Noir", { fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 116, fill: "#f5efe0", lineHeight: 1.02 }],
    ["COLLECTION · 2026", { fontFamily: "Raleway", fontWeight: 400, fontSize: 24, fill: "#c9a54c", charSpacing: 480 }, 0.6],
  ]),
  p("editorial", "Magazine cover", "Luxury & editorial", "paper", [
    ["The Big Interview", { fontFamily: "Abril Fatface", fontSize: 100, fill: "#1b2340", lineHeight: 1.02 }],
    ["BY THE NUMBERS", { fontFamily: "Inter", fontWeight: 700, fontSize: 22, fill: "#e05a47", charSpacing: 360 }, 0.6],
  ]),
  p("doc-serif", "Story title", "Luxury & editorial", "paper", [
    ["How Salt Built Empires", { fontFamily: "Merriweather", fontWeight: 900, fontSize: 84, fill: "#1d1b18", lineHeight: 1.1, ...fx({ lift: { intensity: 30 } }) }],
  ]),

  // ---- Retro & fun ----
  p("retro-70s", "Retro 70s", "Retro & fun", "paper", [
    ["GROOVY", { fontFamily: "Titan One", fontSize: 140, fill: "#f7c548", ...fx({ echo: { offset: 55, direction: 45, color: "#e84a7f" }, outline: { thickness: 18, color: "#2b1b3d" } }) }],
  ]),
  p("retro-diner", "Diner script", "Retro & fun", "light", [
    ["Burger Joint", { fontFamily: "Lobster", fontSize: 116, fill: "#ffffff", ...fx({ outline: { thickness: 34, color: "#d7141a" }, shadow: { offset: 30, direction: 60, blur: 0, transparency: 0, color: "#2b1b3d" } }) }, 0.7],
  ]),
  p("comic-pop", "Comic pop", "Retro & fun", "light", [
    ["KA-POW!", { fontFamily: "Bangers", fontSize: 150, fill: "#ffd23f", angle: -6, charSpacing: 30, ...fx({ outline: { thickness: 40, color: "#000000" }, shadow: { offset: 40, direction: 45, blur: 0, transparency: 0, color: "#ff3fa4" } }) }],
  ]),
  p("cute-sticker", "Cute sticker", "Retro & fun", "paper", [
    ["So cute!", { fontFamily: "Luckiest Guy", fontSize: 116, fill: "#ff5fa2", ...fx({ sticker: { thickness: 50, color: "#ffffff", edge: "#331a2d", shadow: 40 } }) }],
  ]),
  p("wild-west", "Wanted poster", "Retro & fun", "paper", [
    ["WANTED", { fontFamily: "Alfa Slab One", fontSize: 140, fill: "#3b2a20", charSpacing: 30, lineHeight: 1 }],
    ["DEAD OR ALIVE", { fontFamily: "Teko", fontWeight: 600, fontSize: 52, fill: "#c0623b", charSpacing: 260 }, 0.6],
  ]),

  // ---- Labels & banners ----
  p("sticker-label", "Sticker label", "Labels & banners", "light", [
    ["NEW!", { fontFamily: "Fredoka", fontWeight: 700, fontSize: 110, fill: OC.ink, ...fx({ sticker: { thickness: 55, color: OC.gold, edge: OC.ink, shadow: 35 } }) }, 0.4],
  ]),
  p("news-banner", "News banner", "Labels & banners", "light", [
    ["BREAKING NEWS", { fontFamily: "Oswald", fontWeight: 700, fontSize: 76, fill: "#ffffff", charSpacing: 60, ...fx({ background: { roundness: 0, spread: 30, transparency: 0, color: "#d7141a" } }) }],
    ["LIVE · 24/7 COVERAGE", { fontFamily: "Roboto", fontWeight: 700, fontSize: 28, fill: "#0b0b0b", charSpacing: 160, ...fx({ background: { roundness: 0, spread: 26, transparency: 0, color: "#ffcc00" } }) }, 0.6],
  ]),
  p("price-tag", "Price tag", "Labels & banners", "light", [
    ["$9.99", { fontFamily: "Anton", fontSize: 140, fill: "#ffffff", ...fx({ background: { roundness: 40, spread: 40, transparency: 0, color: OC.pink } }) }, 0.5],
    ["ONLY TODAY", { fontFamily: "Inter", fontWeight: 800, fontSize: 30, fill: OC.ink, charSpacing: 220, ...fx({ background: { roundness: 20, spread: 30, transparency: 0, color: OC.gold } }) }, 0.5],
  ]),
  p("top-secret", "Tape label", "Labels & banners", "dark", [
    ["TOP SECRET", { fontFamily: "Black Ops One", fontSize: 76, fill: OC.ink, angle: -3, charSpacing: 80, ...fx({ background: { roundness: 0, spread: 40, transparency: 0, color: OC.paper } }) }],
  ]),

  // ---- Quotes ----
  p("quote-serif", "Serif quote", "Quotes", "paper", [
    ["“Make it simple,\nbut significant.”", { fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 66, fill: "#1d1b18", lineHeight: 1.15 }],
    ["— A WISE DESIGNER", { fontFamily: "Inter", fontWeight: 600, fontSize: 22, fill: "#6b5d4f", charSpacing: 300 }, 0.6],
  ]),
  p("quote-bold", "Bold quote", "Quotes", "light", [
    ["STOP\nWAITING.", { fontFamily: "Anton", fontSize: 140, fill: OC.ink, lineHeight: 1, ...fx({ background: { roundness: 0, spread: 30, transparency: 0, color: OC.gold } }) }, 0.6],
  ]),
  p("quote-hand", "Handwritten note", "Quotes", "paper", [
    ["you've got this", { fontFamily: "Caveat", fontWeight: 700, fontSize: 110, fill: OC.pink, angle: -3 }, 0.7],
  ]),
  p("quote-script", "Dreamy script", "Quotes", "dark", [
    ["Dream big", { fontFamily: "Dancing Script", fontWeight: 700, fontSize: 130, fill: "#ffffff", ...fx({ shadow: { offset: 20, direction: 90, blur: 70, transparency: 30, color: "#ff71ce" } }) }, 0.7],
  ]),

  // ---- Sports ----
  p("game-day", "Game day", "Sports", "dark", [
    ["GAME DAY", { fontFamily: "Teko", fontWeight: 700, fontSize: 170, fill: "#ffffff", lineHeight: 0.95, ...fx({ extrude: { depth: 55, direction: 30, color: "#d7141a" } }) }],
    ["FRI · 7PM · HOME", { fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 44, fill: "#ffcc00", charSpacing: 220 }, 0.6],
  ]),
  p("scoreboard", "Scoreboard", "Sports", "dark", [
    ["FINAL SCORE", { fontFamily: "Barlow Condensed", fontWeight: 900, fontStyle: "italic", fontSize: 110, fill: "#ffffff", charSpacing: 40, ...fx({ background: { roundness: 0, spread: 34, transparency: 0, color: "#0b3d91" } }) }],
  ]),
];

/** Moods for the v0.1 presets (by id). */
export const BASE_MOODS = {
  "yellow-outline": "Thumbnail punch", "white-stroke": "Thumbnail punch", highlight: "Thumbnail punch", "combo-money": "Thumbnail punch",
  "combo-truth": "Thumbnail punch", neon: "Neon & night", glitch: "Neon & night", retro: "Retro & fun", echo: "Retro & fun",
  splice: "Retro & fun", hollow: "Thumbnail punch", "red-label": "Labels & banners", documentary: "Luxury & editorial",
  "combo-serif": "Luxury & editorial", curved: "YouTube & social", marker: "YouTube & social", "script-pop": "Retro & fun",
};
