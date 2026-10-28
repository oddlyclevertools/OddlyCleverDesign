// Video pack, Shorts / Reels / TikTok covers (1080 x 1920). The key text sits in the middle
// band (about y 300-1500) so the platform's own buttons and captions don't cover it.
import {
  bleed, burst, circle, curvedArrow, dots, ellipse, fx, grid, group, line, linear, path, pill, poly, putter, radial,
  rays, rect, shadow, sparkle, text,
} from "./tv-kit.js";

const INK = "#16121b";

// ---- S1. POV chat --------------------------------------------------------------------------

function bubble(x, y, w, label, { fill, color, mine = false, size = 60 }) {
  const t = text(label, { x: x + 34, y: y + 30, w: w - 68, size, font: "Inter", weight: 700, color, lineHeight: 1.15 });
  const h = t.height + 60;
  const tail = mine
    ? poly([[x + w - 30, y + h - 34], [x + w + 22, y + h + 4], [x + w - 70, y + h - 6]], fill)
    : poly([[x + 30, y + h - 34], [x - 22, y + h + 4], [x + 70, y + h - 6]], fill);
  return { obj: group([tail, rect(x, y, w, h, fill, { rx: 44, ry: 44 }), t], { shadow: shadow("rgba(0,0,0,0.3)", 30, 0, 12) }), h };
}

async function shortPov(app) {
  const put = putter(app);
  app.editor.setBackground("#1a0b3a");
  put(bleed(rect(0, 0, 1080, 1920, linear(170, ["#3b1a7a", [0.55, "#1a0b3a"], [1, "#0a0518"]]))), "Background");
  put(bleed(circle(900, 400, 420, radial(["rgba(255,46,126,0.4)", [1, "rgba(255,46,126,0)"]]))), "Glow");
  put(bleed(circle(120, 1500, 460, radial(["rgba(80,140,255,0.35)", [1, "rgba(80,140,255,0)"]]))), "Glow");

  put(text("POV:", { x: 80, y: 250, w: 920, size: 260, font: "Bungee", color: "#ffe14d",
    ...fx({ shadow: { offset: 30, direction: 90, blur: 0, transparency: 0, color: "#ff2e7e" } }) }), "Title");
  put(text("you finally quit\nyour 9 to 5", { x: 88, y: 560, w: 920, size: 92, font: "Inter", weight: 900, color: "#ffffff", lineHeight: 1.05 }), "Subtitle");

  const a = bubble(70, 880, 800, "are you coming in today??", { fill: "#2c2a3a", color: "#ffffff" });
  put(a.obj, "Chat bubble (them)");
  const b = bubble(290, 880 + a.h + 60, 720, "nope. never again.", { fill: "#2f7bff", color: "#ffffff", mine: true });
  put(b.obj, "Chat bubble (you)");
  const ty = 880 + a.h + 60 + b.h + 70;
  const c = bubble(70, ty, 620, "wait... what?!", { fill: "#2c2a3a", color: "#ffffff" });
  put(c.obj, "Chat bubble (them)");
  const dy = ty + c.h + 60;
  put(group([
    rect(80, dy, 220, 110, "#2c2a3a", { rx: 55, ry: 55 }),
    circle(140, dy + 55, 14, "rgba(255,255,255,0.8)"), circle(190, dy + 55, 14, "rgba(255,255,255,0.55)"), circle(240, dy + 55, 14, "rgba(255,255,255,0.3)"),
  ]), "Typing dots");
  put(text("Seen 9:02 AM", { x: 290, y: ty - 44, w: 720, size: 30, font: "Inter", weight: 600, color: "rgba(255,255,255,0.5)", align: "right" }), "Read receipt");
}

// ---- S2. Did you know -----------------------------------------------------------------------

function bulb(cx, cy, r) {
  return group([
    rays(cx, cy, r * 2.1, 14, "rgba(255,255,255,0.55)", { spread: 0.35 }),
    circle(cx, cy, r, "#ffffff", { stroke: INK, strokeWidth: 12 }),
    path(`M ${cx - r * 0.3} ${cy + r * 0.1} L ${cx - r * 0.12} ${cy - r * 0.2} L ${cx} ${cy + r * 0.1} L ${cx + r * 0.12} ${cy - r * 0.2} L ${cx + r * 0.3} ${cy + r * 0.1}`,
      { stroke: "#ffb000", strokeWidth: 10 }),
    rect(cx - r * 0.45, cy + r * 0.82, r * 0.9, r * 0.5, "#b8bcc6", { rx: 12, ry: 12, stroke: INK, strokeWidth: 12 }),
    rect(cx - r * 0.3, cy + r * 1.3, r * 0.6, r * 0.22, INK, { rx: 10, ry: 10 }),
  ]);
}

async function shortDidYouKnow(app) {
  const put = putter(app);
  app.editor.setBackground("#ffd60a");
  put(bleed(rect(0, 0, 1080, 1920, linear(180, ["#ffe14d", "#ffb800"]))), "Background");
  put(bleed(dots(40, 40, 15, 27, 72, 5, "rgba(22,18,27,0.08)")), "Dot pattern");
  put(bulb(540, 520, 170), "Light bulb");

  put(text("DID YOU", { x: 60, y: 840, w: 960, size: 170, font: "Titan One", color: "#ffffff", align: "center",
    ...fx({ outline: { thickness: 22, color: INK }, shadow: { offset: 40, direction: 90, blur: 0, transparency: 0, color: INK } }) }), "Title");
  put(text("KNOW?", { x: 60, y: 1010, w: 960, size: 220, font: "Titan One", color: "#ff2e63", align: "center",
    ...fx({ outline: { thickness: 22, color: INK }, shadow: { offset: 40, direction: 90, blur: 0, transparency: 0, color: INK } }) }), "Title accent");
  put(group([
    rect(110, 1300, 860, 230, "#ffffff", { rx: 36, ry: 36, stroke: INK, strokeWidth: 10, shadow: shadow(INK, 0, 0, 14) }),
    text("Honey never goes bad.\nNot even after 3,000 years.", { x: 150, y: 1350, w: 780, size: 54, font: "Inter", weight: 800, color: INK, align: "center", lineHeight: 1.15 }),
  ]), "Fact card");
  put(text("FACT #12", { x: 60, y: 1590, w: 960, size: 44, font: "Titan One", color: INK, align: "center", charSpacing: 200 }), "Fact number");
}

// ---- S3. Recipe ----------------------------------------------------------------------------

function cookie(cx, cy, r, seed) {
  let chips = "";
  for (let i = 0; i < 6; i++) {
    const a = seed + i * 1.9, d = r * (0.25 + ((i * 37) % 5) / 9);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, rr = r * 0.11;
    chips += `M ${x - rr} ${y} a ${rr} ${rr} 0 1 0 ${rr * 2} 0 a ${rr} ${rr} 0 1 0 ${-rr * 2} 0 `;
  }
  return group([
    circle(cx + 6, cy + 10, r, "rgba(90,40,10,0.3)"),
    circle(cx, cy, r, radial(["#e9a85a", [0.75, "#cf8636"], [1, "#a8611f"]]), { stroke: "#8a4d18", strokeWidth: 4 }),
    path(chips, { fill: "#4a2512" }),
  ]);
}

async function shortRecipe(app) {
  const put = putter(app);
  const BROWN = "#5a2d12", PINK = "#ff5c8a";
  app.editor.setBackground("#fff1dc");
  put(bleed(rect(0, 0, 1080, 1920, linear(180, ["#ffe3c2", "#ffd0a8"]))), "Background");
  put(rect(90, 960, 900, 640, "#2c2c34", { rx: 40, ry: 40, angle: -4, shadow: shadow("rgba(90,40,10,0.35)", 50, 0, 20) }), "Baking tray");
  put(rect(130, 990, 820, 570, "#f6efe4", { rx: 20, ry: 20, angle: -4 }), "Baking paper");
  [[320, 1140, 110, 0.3], [640, 1110, 120, 1.2], [440, 1390, 115, 2.1], [770, 1370, 105, 3.0]].forEach(([x, y, r, s]) => put(cookie(x, y, r, s), "Cookie"));

  put(group([
    circle(540, 330, 190, PINK, { stroke: INK, strokeWidth: 12, shadow: shadow(INK, 0, 0, 16) }),
    text("3", { x: 390, y: 200, w: 300, size: 300, font: "Luckiest Guy", color: "#ffffff", align: "center" }),
  ]), "Big number");
  put(text("INGREDIENT", { x: 40, y: 560, w: 1000, size: 130, font: "Luckiest Guy", color: BROWN, align: "center" }), "Title");
  put(text("COOKIES", { x: 40, y: 690, w: 1000, size: 190, font: "Luckiest Guy", color: "#ffffff", align: "center",
    ...fx({ outline: { thickness: 24, color: BROWN }, shadow: { offset: 36, direction: 90, blur: 0, transparency: 0, color: BROWN } }) }), "Title accent");
  const chips = [["BANANA", 230], ["OATS", 540], ["CHOC CHIPS", 850]];
  for (const [label, cx] of chips) {
    put(pill(label, { x: cx, y: 1660, h: 80, size: 34, pad: 28, font: "Inter", weight: 900, fill: "#ffffff", color: BROWN, center: true,
      spacing: 60, stroke: BROWN, strokeWidth: 5 }), "Ingredient");
  }
}

// ---- S4. Part 2 ---------------------------------------------------------------------------

async function shortPart2(app) {
  const put = putter(app);
  const PINK = "#ff2bd6", CYAN = "#22f0ff";
  app.editor.setBackground("#05030c");
  put(bleed(rect(0, 0, 1080, 1920, radial(["#2a0a45", [1, "#05030c"]], { cx: 0.5, cy: 0.45, r: 0.7 }))), "Background");
  put(bleed(grid(0, 0, 1080, 1920, 90, "rgba(34,240,255,0.06)", 2)), "Grid");
  put(rect(90, 300, 900, 1240, null, { fill: "", stroke: PINK, strokeWidth: 8, rx: 40, ry: 40, shadow: shadow(PINK, 40) }), "Neon frame");

  put(text("PART", { x: 90, y: 400, w: 900, size: 150, font: "Bungee", color: "#ffffff", align: "center", charSpacing: 200,
    ...fx({ neon: { intensity: 40, tube: 0, color: CYAN } }) }), "Label");
  put(text("2", { x: 90, y: 560, w: 900, size: 640, font: "Bungee", color: "#ffffff", align: "center",
    ...fx({ glitch: { offset: 40, direction: 0, colorA: CYAN, colorB: PINK } }) }), "Big number");
  put(text("you won't believe\nwhat happened next", { x: 140, y: 1250, w: 800, size: 70, font: "Inter", weight: 900, color: "#ffffff", align: "center", lineHeight: 1.1 }), "Hook");
  put(pill("WATCH PART 1 FIRST", { x: 540, y: 1620, h: 96, size: 38, pad: 40, font: "Inter", weight: 900, fill: PINK, center: true, spacing: 120,
    shadowOf: shadow(PINK, 30) }), "Button");
}

// ---- S5. Day in my life --------------------------------------------------------------------

function clockIcon(cx, cy, r, fill) {
  return group([
    circle(cx, cy, r, fill, { stroke: INK, strokeWidth: 6 }),
    line(cx, cy, cx, cy - r * 0.55, INK, 7), line(cx, cy, cx + r * 0.4, cy + r * 0.15, INK, 7),
    circle(cx, cy, 6, INK),
  ]);
}

async function shortDayInLife(app) {
  const put = putter(app);
  app.editor.setBackground("#ffe4d6");
  put(bleed(rect(0, 0, 1080, 1920, linear(180, ["#ffd6e0", [0.5, "#ffe9d6"], [1, "#d9ecff"]]))), "Background");
  put(bleed(circle(940, 260, 300, "rgba(255,255,255,0.45)")), "Soft circle");
  put(text("a day in", { x: 80, y: 250, w: 920, size: 120, font: "Dancing Script", weight: 700, color: "#ff4f7b" }), "Script kicker");
  put(text("MY LIFE", { x: 72, y: 370, w: 940, size: 220, font: "Righteous", color: INK }), "Title");
  put(pill("AS A 23-YEAR-OLD DESIGNER", { x: 80, y: 620, h: 70, size: 30, pad: 30, font: "Inter", weight: 800, fill: INK, spacing: 160 }), "Subtitle");

  const items = [["6:00", "coffee + sunrise", "#ffd36b"], ["9:00", "deep work", "#8fd3ff"], ["13:00", "gym", "#a8f0c6"],
    ["18:00", "side project", "#ffb3c7"], ["22:00", "lights out", "#c9b8ff"]];
  put(line(170, 800, 170, 1600, "rgba(22,18,27,0.25)", 8, { strokeDashArray: [2, 22] }), "Timeline");
  items.forEach(([time, what, c], i) => {
    const y = 800 + i * 200;
    put(group([
      clockIcon(170, y, 54, c),
      text(time, { x: 260, y: y - 62, w: 700, size: 60, font: "Righteous", color: INK }),
      text(what, { x: 262, y: y + 6, w: 700, size: 52, font: "Inter", weight: 600, color: "rgba(22,18,27,0.7)" }),
    ]), `Timeline ${time}`);
  });
}

// ---- S6. Tier list -------------------------------------------------------------------------

async function shortTierList(app) {
  const put = putter(app);
  app.editor.setBackground("#111018");
  put(bleed(rect(0, 0, 1080, 1920, linear(180, ["#1c1a28", "#0b0a10"]))), "Background");
  put(text("RANKING", { x: 60, y: 210, w: 960, size: 120, font: "Russo One", color: "#ffffff", align: "center" }), "Title");
  put(text("EVERY SNACK", { x: 60, y: 340, w: 960, size: 120, font: "Russo One", color: "#ffd23f", align: "center" }), "Title accent");

  const tiers = [["S", "#ff5b6e"], ["A", "#ff9f45"], ["B", "#ffd23f"], ["C", "#6fdc8c"], ["D", "#5aa9ff"]];
  const fills = ["#ffffff", "#ffe8b0", "#c9f0ff", "#ffd1dc", "#d7ccff", "#c8f7d5"];
  tiers.forEach(([t, c], i) => {
    const y = 540 + i * 190, items = [3, 2, 3, 1, 2][i];
    const parts = [
      rect(60, y, 960, 170, "#24222f", { rx: 18, ry: 18 }),
      rect(60, y, 170, 170, c, { rx: 18, ry: 18 }),
      text(t, { x: 60, y: y + 22, w: 170, size: 130, font: "Russo One", color: INK, align: "center" }),
    ];
    for (let k = 0; k < items; k++) {
      const x = 260 + k * 160;
      parts.push(rect(x, y + 20, 130, 130, fills[(i + k) % fills.length], { rx: 22, ry: 22 }));
      parts.push(text("?", { x, y: y + 38, w: 130, size: 92, font: "Russo One", color: "rgba(22,18,27,0.3)", align: "center" }));
    }
    put(group(parts), `Tier ${t}`);
  });
  put(text("#1 will shock you", { x: 60, y: 1540, w: 960, size: 56, font: "Inter", weight: 800, color: "rgba(255,255,255,0.7)", align: "center" }), "Hook");
}

// ---- S7. Money growth ----------------------------------------------------------------------

async function shortMoney(app) {
  const put = putter(app);
  const GREEN = "#2bff88";
  app.editor.setBackground("#03130c");
  put(bleed(rect(0, 0, 1080, 1920, linear(180, ["#073020", "#020a06"]))), "Background");
  put(bleed(grid(0, 0, 1080, 1920, 90, "rgba(43,255,136,0.06)", 2)), "Grid");

  put(text("$0", { x: 80, y: 250, w: 920, size: 200, font: "Teko", weight: 700, color: "rgba(255,255,255,0.55)" }), "Start value");
  put(curvedArrow(330, 360, 520, 300, 640, 420, { color: "#ffffff", width: 18, head: 56 }), "Arrow");
  put(text("$10K", { x: 60, y: 420, w: 960, size: 380, font: "Teko", weight: 700, color: GREEN, align: "center",
    ...fx({ neon: { intensity: 20, tube: 0, color: GREEN } }) }), "Big result");
  put(pill("IN 90 DAYS", { x: 540, y: 820, h: 90, size: 42, pad: 40, font: "Inter", weight: 900, fill: GREEN, color: "#03130c", center: true, spacing: 160 }), "Tag");

  const bars = [80, 120, 110, 170, 230, 210, 320, 410, 520];
  const parts = [];
  bars.forEach((h, i) => {
    const x = 120 + i * 96;
    parts.push(rect(x, 1500 - h, 70, h, i === bars.length - 1 ? GREEN : "rgba(43,255,136,0.45)", { rx: 10, ry: 10 }));
  });
  put(group(parts), "Bar chart");
  put(line(100, 1510, 980, 1510, "rgba(255,255,255,0.3)", 4), "Baseline");
  put(sparkle(940, 940, 36, "#ffffff"), "Sparkle");
  put(text("here's exactly how", { x: 60, y: 1590, w: 960, size: 66, font: "Inter", weight: 800, color: "#ffffff", align: "center" }), "Hook");
}

const shortsTags = ["shorts", "reels", "tiktok", "vertical", "cover", "video"];
const S = { size: "shorts" };
export default [
  { ...S, id: "tv-short-pov", name: "Shorts: POV Chat", tags: [...shortsTags, "pov", "chat", "text", "message", "funny", "purple"],
    fonts: [["Bungee"], ["Inter", 900], ["Inter", 700], ["Inter", 600]], build: shortPov },
  { ...S, id: "tv-short-did-you-know", name: "Shorts: Did You Know", tags: [...shortsTags, "fact", "facts", "trivia", "question", "yellow", "learn"],
    fonts: [["Titan One"], ["Inter", 800]], build: shortDidYouKnow },
  { ...S, id: "tv-short-recipe", name: "Shorts: Easy Recipe", tags: [...shortsTags, "recipe", "food", "cooking", "baking", "cookies", "ingredients"],
    fonts: [["Luckiest Guy"], ["Inter", 900]], build: shortRecipe },
  { ...S, id: "tv-short-part-2", name: "Shorts: Part 2", tags: [...shortsTags, "part", "series", "story", "neon", "glitch", "dark"],
    fonts: [["Bungee"], ["Inter", 900]], build: shortPart2 },
  { ...S, id: "tv-short-day-in-life", name: "Shorts: Day in My Life", tags: [...shortsTags, "vlog", "day", "routine", "life", "pastel", "timeline"],
    fonts: [["Dancing Script", 700], ["Righteous"], ["Inter", 800], ["Inter", 600]], build: shortDayInLife },
  { ...S, id: "tv-short-tier-list", name: "Shorts: Tier List", tags: [...shortsTags, "tier", "list", "ranking", "rank", "best", "worst"],
    fonts: [["Russo One"], ["Inter", 800]], build: shortTierList },
  { ...S, id: "tv-short-money", name: "Shorts: Money Growth", tags: [...shortsTags, "money", "finance", "side hustle", "income", "chart", "green"],
    fonts: [["Teko", 700], ["Inter", 900], ["Inter", 800]], build: shortMoney },
];
