// Colour palettes and font pairings for the Styles panel.
// A palette names five roles: bg (page), ink (text), main (the big colour), a1 and a2 (accents).

const pal = (id, name, mood, bg, ink, main, a1, a2) => ({ id, name, mood, bg, ink, main, a1, a2 });

export const PALETTES = [
  pal("oddly", "Oddly Clever neon", "Cocky night street", "#0d0a10", "#f3ead8", "#ff2e7e", "#ffc83d", "#8fe3ff"),
  pal("paper-label", "Paper label", "Oddly Clever daylight", "#f3ead8", "#16121b", "#ff2e7e", "#16121b", "#ffc83d"),
  pal("retro", "Retro sunset", "Warm 70s", "#2b1b3d", "#fff1d6", "#ff6b35", "#f7c548", "#e84a7f"),
  pal("pastel", "Pastel cloud", "Soft and friendly", "#fdf6f0", "#3d3a4b", "#f7a8c4", "#a8d8ea", "#ffd6a5"),
  pal("luxury", "Luxury gold", "Rich and calm", "#0f0f12", "#f5efe0", "#c9a54c", "#8a6d2f", "#e8d8a8"),
  pal("forest", "Forest walk", "Natural and quiet", "#1f2d24", "#eef3e8", "#7fb069", "#d9a441", "#a3c4bc"),
  pal("ocean", "Deep ocean", "Cool and clear", "#06263d", "#e8f6ff", "#1fa2c7", "#7be0e8", "#ffcf56"),
  pal("candy", "Candy pop", "Loud and sweet", "#fff0f6", "#2a1033", "#ff3fa4", "#7a3cff", "#ffd23f"),
  pal("mono", "Mono press", "Black and white", "#ffffff", "#111111", "#111111", "#6b6b6b", "#c8c8c8"),
  pal("mono-dark", "Mono night", "Serious dark", "#111111", "#f2f2f2", "#ffffff", "#8a8a8a", "#3a3a3a"),
  pal("earth", "Earth clay", "Warm and handmade", "#f1e6d6", "#3b2a20", "#c0623b", "#7a8450", "#d9a35f"),
  pal("cyber", "Cyber grid", "Hacker neon", "#070b14", "#e6fbff", "#00f0ff", "#ff2bd6", "#b6ff00"),
  pal("mint", "Fresh mint", "Clean and light", "#f2fbf7", "#16332b", "#2ec4a0", "#ff8a5b", "#9bd1ff"),
  pal("sunset", "Golden hour", "Warm glow", "#3a1530", "#fff4e0", "#ff8c42", "#ffd166", "#ef476f"),
  pal("royal", "Royal night", "Bold and noble", "#14123a", "#f6f1ff", "#6c4cff", "#ffc83d", "#ff5d8f"),
  pal("citrus", "Citrus splash", "Bright and zesty", "#fffbea", "#1d2b12", "#ffb703", "#8ac926", "#fb5607"),
  pal("berry", "Wild berry", "Moody and sweet", "#2a0f24", "#ffe8f3", "#c2185b", "#ff80ab", "#7c4dff"),
  pal("nordic", "Nordic frost", "Calm and cold", "#eef2f5", "#1d2a36", "#4f7cac", "#9fb8cf", "#c0a080"),
  pal("lava", "Lava rock", "Hot and heavy", "#120707", "#fff0e6", "#ff3b1f", "#ff9f1c", "#ffd23f"),
  pal("matcha", "Matcha latte", "Cosy and soft", "#f4f1e6", "#2f3a25", "#8aa05b", "#c8a27a", "#e9d8a6"),
  pal("vapor", "Vaporwave", "Dreamy 90s", "#1b1035", "#fdf0ff", "#ff71ce", "#01cdfe", "#b967ff"),
  pal("arcade", "Arcade cabinet", "Gaming", "#0b0b1f", "#ffffff", "#ff004d", "#29adff", "#ffec27"),
  pal("news", "Breaking news", "Urgent and clear", "#ffffff", "#0b0b0b", "#d7141a", "#0b3d91", "#ffcc00"),
  pal("coffee", "Coffee house", "Warm and grown-up", "#2b1d16", "#f7ecdf", "#c58b5a", "#e7c9a5", "#8d5b3a"),
  pal("lagoon", "Blue lagoon", "Holiday", "#e9fbff", "#06324a", "#00a6c8", "#ff7f50", "#ffe066"),
  pal("midnight", "Midnight blue", "Trustworthy", "#0a1630", "#eaf1ff", "#3d7bff", "#8fb3ff", "#ffb547"),
  pal("bubblegum", "Bubblegum", "Playful", "#ffe3f1", "#331a2d", "#ff5fa2", "#5fd3ff", "#fff07a"),
  pal("military", "Field green", "Tough and plain", "#2c2f22", "#ecebd9", "#a3a35b", "#d9c88f", "#7a5c3a"),
  pal("rose-gold", "Rose gold", "Elegant", "#fbf1ee", "#3e2a2a", "#c98b7b", "#e8c3b5", "#9c6b5f"),
  pal("toxic", "Toxic lime", "Edgy", "#0e120a", "#f2ffe0", "#a8ff1f", "#ff3df5", "#00e0a4"),
  pal("brick", "Brick and amber", "Oddly Clever street", "#1c1110", "#f3ead8", "#c4553a", "#ffb547", "#ff2e7e"),
  pal("ink-blue", "Ink and paper", "Editorial", "#f6f3ec", "#1b2340", "#2541b2", "#e05a47", "#b9b29c"),
  pal("tropical", "Tropical", "Sunny and fun", "#0f3b3a", "#fffaf0", "#ff6f59", "#ffd447", "#3ddc97"),
  pal("lavender", "Lavender field", "Gentle", "#f4f0fb", "#2e2448", "#8e6fd8", "#f2a7c3", "#9fd8cb"),
];

/** Font pairings: a heading face and a body face. */
const pair = (id, name, mood, head, hw, body, bw, opts = {}) => ({
  id, name, mood, head: { family: head, weight: hw, style: opts.headStyle || "normal" }, body: { family: body, weight: bw },
});

export const PAIRINGS = [
  pair("oddly", "Oddly Clever", "Heavy grotesk + neon script", "Archivo Black", 400, "Inter", 600),
  pair("oddly-script", "Neon script title", "Pink neon script + white grotesk", "Pacifico", 400, "Inter", 800),
  pair("thumb-anton", "Thumbnail punch", "Loud YouTube titles", "Anton", 400, "Montserrat", 700),
  pair("bebas", "Clean impact", "Tall and modern", "Bebas Neue", 400, "Inter", 400),
  pair("editorial", "Editorial", "Serif headline, calm body", "Playfair Display", 900, "Lora", 400),
  pair("luxury", "Luxury serif", "Fashion and premium", "DM Serif Display", 400, "Raleway", 400),
  pair("abril", "Magazine", "High-contrast serif", "Abril Fatface", 400, "Poppins", 400),
  pair("startup", "Startup", "Friendly tech", "Poppins", 800, "Inter", 400),
  pair("geo", "Geometric", "Sharp and tidy", "Montserrat", 900, "Roboto", 400),
  pair("gaming", "Gaming", "Arcade energy", "Russo One", 400, "Kanit", 400),
  pair("military", "Ops", "Tough and stencil-like", "Black Ops One", 400, "Barlow Condensed", 400),
  pair("comic", "Comic pop", "Shouty and fun", "Bangers", 400, "Nunito", 700),
  pair("cartoon", "Cartoon", "Bubbly and bold", "Luckiest Guy", 400, "Fredoka", 600),
  pair("rounded", "Soft rounded", "Kind and approachable", "Fredoka", 700, "Nunito", 400),
  pair("retro", "Retro diner", "70s sign", "Righteous", 400, "Rubik", 400),
  pair("slab", "Slab poster", "Wild west poster", "Alfa Slab One", 400, "Merriweather", 400),
  pair("condensed", "Sports", "Scoreboard", "Teko", 700, "Barlow Condensed", 400),
  pair("handmade", "Handmade note", "Personal and warm", "Permanent Marker", 400, "Caveat", 400),
  pair("wedding", "Celebration", "Script and serif", "Dancing Script", 700, "Lora", 400),
  pair("lobster", "Diner script", "Bold script headline", "Lobster", 400, "Oswald", 400),
  pair("bungee", "Street sign", "Signage", "Bungee", 400, "Space Grotesk", 400),
  pair("titan", "Kids club", "Chunky and happy", "Titan One", 400, "Nunito", 400),
  pair("doc", "Documentary", "Serious storytelling", "Merriweather", 900, "Inter", 400),
  pair("oswald", "News desk", "Clear headlines", "Oswald", 700, "Roboto", 400),
  pair("lilita", "Podcast", "Friendly bold", "Lilita One", 400, "Raleway", 400),
];
