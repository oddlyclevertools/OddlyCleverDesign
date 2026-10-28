// Video pack, YouTube thumbnails part A (1280 x 720): reaction, versus, top 10, tutorial,
// tech review, finance, gaming, travel. All drawn in code.
import {
  bleed, burst, circle, curvedArrow, ellipse, face, fx, grid, group, line, linear, path, perspectiveGrid, phoneBack,
  pill, placeholderTag, poly, putter, radial, rays, rect, shadow, sparkle, star, text,
} from "./tv-kit.js";

const INK = "#16121b";

// ---- 1. Shocked reaction --------------------------------------------------------------------

async function shockedReaction(app) {
  const put = putter(app);
  app.editor.setBackground("#ffb800");
  put(bleed(rect(0, 0, 1280, 720, radial(["#fff36b", [0.55, "#ffc21a"], [1, "#ff8a00"]], { cx: 0.74, cy: 0.45, r: 0.75 }))), "Background glow");
  put(rays(940, 330, 1100, 28, "rgba(255,255,255,0.28)", { spread: 0.5 }), "Speed rays");
  put(face(950, 300, 165, { mood: "shock", shirt: "#ff2e63", skin: "#ffcfa8" }), "Face placeholder (swap for your photo)");
  put(burst(1168, 120, 74, 46, 12, "#ff2e63", { stroke: INK, strokeWidth: 6, strokeLineJoin: "round" }), "Shock burst");
  put(text("!", { x: 1128, y: 74, w: 80, size: 92, font: "Luckiest Guy", color: "#ffffff", align: "center" }), "Shock mark");
  put(placeholderTag(950, 664, "SWAP FOR YOUR PHOTO"), "Photo hint");

  const big = { font: "Luckiest Guy", size: 134, align: "left", w: 700, x: 54 };
  const edge = { outline: { thickness: 34, color: INK }, shadow: { offset: 40, direction: 90, blur: 0, transparency: 0, color: INK } };
  put(text("I CAN'T", { ...big, y: 70, color: "#ffffff", ...fx(edge) }), "Title line 1");
  put(text("BELIEVE", { ...big, y: 214, color: "#ff2e63", ...fx(edge) }), "Title line 2 (accent)");
  put(text("THIS!", { ...big, y: 358, color: "#ffffff", ...fx(edge) }), "Title line 3");
  put(curvedArrow(420, 560, 560, 650, 730, 520, { color: "#ffffff", width: 20, head: 60, outline: INK }), "Arrow to face");
}

// ---- 2. Versus price split ------------------------------------------------------------------

function cup(cx, baseY, s, { body, sleeve, lid, steam = "rgba(255,255,255,0.75)" }) {
  const w1 = 150 * s, w2 = 110 * s, h = 230 * s;
  return group([
    ellipse(cx, baseY + 4 * s, 120 * s, 18 * s, "rgba(0,0,0,0.25)"),
    poly([[cx - w1 / 2, baseY - h], [cx + w1 / 2, baseY - h], [cx + w2 / 2, baseY], [cx - w2 / 2, baseY]], body, { stroke: INK, strokeWidth: 7 * s, strokeLineJoin: "round" }),
    poly([[cx - w1 * 0.47, baseY - h * 0.72], [cx + w1 * 0.47, baseY - h * 0.72], [cx + w1 * 0.4, baseY - h * 0.32], [cx - w1 * 0.4, baseY - h * 0.32]], sleeve, { stroke: INK, strokeWidth: 7 * s, strokeLineJoin: "round" }),
    rect(cx - w1 * 0.58, baseY - h - 34 * s, w1 * 1.16, 40 * s, lid, { rx: 14 * s, ry: 14 * s, stroke: INK, strokeWidth: 7 * s }),
    rect(cx - w1 * 0.36, baseY - h - 56 * s, w1 * 0.72, 26 * s, lid, { rx: 10 * s, ry: 10 * s, stroke: INK, strokeWidth: 7 * s }),
    path(`M ${cx - 24 * s} ${baseY - h - 76 * s} C ${cx - 50 * s} ${baseY - h - 110 * s} ${cx} ${baseY - h - 130 * s} ${cx - 24 * s} ${baseY - h - 170 * s}`, { stroke: steam, strokeWidth: 10 * s }),
    path(`M ${cx + 26 * s} ${baseY - h - 76 * s} C ${cx} ${baseY - h - 110 * s} ${cx + 50 * s} ${baseY - h - 130 * s} ${cx + 26 * s} ${baseY - h - 170 * s}`, { stroke: steam, strokeWidth: 10 * s }),
  ]);
}

async function versusPrice(app) {
  const put = putter(app);
  app.editor.setBackground("#1b6bff");
  put(bleed(rect(0, 0, 1280, 720, linear(135, ["#4fa3ff", "#1340d8"]))), "Left side");
  put(bleed(poly([[700, 0], [1280, 0], [1280, 720], [580, 720]], linear(135, ["#ffd34d", "#ff7a00"]))), "Right side");
  put(poly([[688, 0], [712, 0], [592, 720], [568, 720]], "#ffffff"), "Split line");

  put(cup(310, 640, 1.15, { body: "#f4f1ea", sleeve: "#b98a5e", lid: "#ffffff" }), "Cheap cup");
  put(cup(960, 640, 1.15, { body: "#1d1d22", sleeve: "#ffd34d", lid: "#2c2c33" }), "Fancy cup");
  put(sparkle(1110, 330, 30, "#ffffff"), "Sparkle");
  put(sparkle(820, 250, 20, "#ffffff"), "Sparkle");

  const price = { font: "Bungee", size: 150, align: "center", ...fx({ outline: { thickness: 30, color: INK }, shadow: { offset: 36, direction: 90, blur: 0, transparency: 0, color: INK } }) };
  put(text("$2", { ...price, x: 60, y: 56, w: 500, color: "#ffffff" }), "Price left");
  put(text("$200", { ...price, x: 690, y: 56, w: 560, color: "#ffffff" }), "Price right");

  put(group([
    burst(640, 380, 120, 92, 16, "#ffffff", { stroke: INK, strokeWidth: 8, strokeLineJoin: "round" }),
    text("VS", { x: 540, y: 336, w: 200, size: 96, font: "Bungee", color: "#ff2e63", align: "center" }),
  ], { shadow: shadow("rgba(0,0,0,0.35)", 24, 0, 8) }), "VS badge");
  put(pill("BLIND TASTE TEST", { x: 640, y: 662, h: 44, size: 20, pad: 20, font: "Inter", weight: 900, fill: INK, center: true, spacing: 200 }), "Tag");
}

// ---- 3. Top 10 list --------------------------------------------------------------------------

function mysteryTile(x, y, s, n, fill) {
  return group([
    rect(x, y, s, s, fill, { rx: 22, ry: 22, stroke: "#ffffff", strokeWidth: 5, shadow: shadow("rgba(0,0,0,0.45)", 20, 0, 8) }),
    text("?", { x, y: y + s * 0.18, w: s, size: s * 0.66, font: "Titan One", color: "rgba(255,255,255,0.85)", align: "center" }),
    circle(x + 6, y + 6, 30, "#ffd23f", { stroke: INK, strokeWidth: 4 }),
    text(`#${n}`, { x: x - 24, y: y - 9, w: 60, size: 26, font: "Titan One", color: INK, align: "center" }),
  ]);
}

async function top10(app) {
  const put = putter(app);
  app.editor.setBackground("#120a2e");
  put(bleed(rect(0, 0, 1280, 720, linear(160, ["#2a1468", [0.6, "#140b3a"], [1, "#0a0620"]]))), "Background");
  put(rays(300, 400, 900, 20, "rgba(255,255,255,0.05)"), "Light rays");
  put(bleed(ellipse(300, 420, 360, 300, radial(["rgba(255,90,170,0.55)", [1, "rgba(255,90,170,0)"]]))), "Number glow");

  put(text("TOP", { x: 40, y: 46, w: 520, size: 96, font: "Titan One", color: "#ffffff", align: "center", charSpacing: 120 }), "Label");
  put(text("10", { x: 10, y: 134, w: 580, size: 440, font: "Titan One", color: "#ffd23f", align: "center",
    ...fx({ echo: { offset: 40, direction: 120, color: "#ff2e7e" } }) }), "Big number");

  put(text("GADGETS", { x: 600, y: 92, w: 660, size: 132, font: "Titan One", color: "#ffffff",
    ...fx({ shadow: { offset: 30, direction: 90, blur: 0, transparency: 0, color: "#ff2e7e" } }) }), "Title");
  put(text("UNDER $50", { x: 604, y: 236, w: 660, size: 92, font: "Titan One", color: "#5ee6ff" }), "Subtitle");
  put(mysteryTile(624, 420, 180, 3, "#ff2e7e"), "Tile #3");
  put(mysteryTile(834, 420, 180, 2, "#7b4dff"), "Tile #2");
  put(mysteryTile(1044, 420, 180, 1, "#00b8d9"), "Tile #1");
  put(sparkle(1210, 70, 26, "#ffd23f"), "Sparkle");
}

// ---- 4. Tutorial / how-to -------------------------------------------------------------------

function appWindow(x, y, w, h) {
  const bar = 46;
  const clips = [["#ff5d73", 0.08, 0.3], ["#5b8cff", 0.4, 0.28], ["#ffc23d", 0.72, 0.2]];
  const parts = [
    rect(x, y, w, h, "#ffffff", { rx: 22, ry: 22, shadow: shadow("rgba(20,30,80,0.25)", 50, 0, 20) }),
    rect(x, y, w, bar, "#eef1f8", { rx: 22, ry: 22 }),
    rect(x, y + bar - 20, w, 20, "#eef1f8"),
    circle(x + 30, y + 23, 8, "#ff5d73"), circle(x + 56, y + 23, 8, "#ffc23d"), circle(x + 82, y + 23, 8, "#3ccf8e"),
    rect(x + 24, y + bar + 22, w - 48, h * 0.48, linear(135, ["#2b3a67", "#5a3d8a"]), { rx: 14, ry: 14 }),
    circle(x + w / 2, y + bar + 22 + h * 0.24, 38, "rgba(255,255,255,0.9)"),
    poly([[x + w / 2 - 12, y + bar + 22 + h * 0.24 - 20], [x + w / 2 - 12, y + bar + 22 + h * 0.24 + 20], [x + w / 2 + 20, y + bar + 22 + h * 0.24]], "#5a3d8a"),
  ];
  const ty = y + bar + 40 + h * 0.48;
  for (const [c, a, b] of clips) parts.push(rect(x + 24 + (w - 48) * a, ty, (w - 48) * b, 40, c, { rx: 8, ry: 8 }));
  parts.push(rect(x + 24, ty + 54, (w - 48) * 0.7, 30, "#c7cfe2", { rx: 8, ry: 8 }));
  parts.push(rect(x + 24 + (w - 48) * 0.55, ty - 14, 5, 108, "#ff2e63"));
  return group(parts, { angle: 4 });
}

async function tutorial(app) {
  const put = putter(app);
  const BLUE = "#2f5bff", NAVY = "#141a3a";
  app.editor.setBackground("#f3f5fb");
  put(bleed(grid(0, 0, 1280, 720, 40, "rgba(47,91,255,0.08)", 2)), "Grid paper");
  put(bleed(circle(1010, 330, 330, "rgba(47,91,255,0.1)")), "Accent circle");
  put(appWindow(720, 120, 500, 430), "App window");
  put(path("M 1030 420 L 1030 494 L 1048 478 L 1062 508 L 1076 501 L 1062 472 L 1086 472 Z",
    { fill: "#ffffff", stroke: NAVY, strokeWidth: 6 }), "Cursor");

  put(pill("HOW TO", { x: 60, y: 58, h: 58, size: 26, pad: 26, font: "Kanit", weight: 900, fill: BLUE, spacing: 160 }), "Tag");
  put(text("EDIT VIDEOS", { x: 56, y: 140, w: 700, size: 104, font: "Kanit", weight: 900, color: NAVY, charSpacing: -10 }), "Title");
  put(text("IN 5 MINUTES", { x: 56, y: 248, w: 700, size: 104, font: "Kanit", weight: 900, color: BLUE, charSpacing: -10 }), "Title accent");

  const steps = [["1", "CUT"], ["2", "COLOR"], ["3", "EXPORT"]];
  put(line(110, 470, 530, 470, "rgba(20,26,58,0.25)", 6, { strokeDashArray: [4, 14] }), "Steps line");
  steps.forEach(([n, label], i) => {
    const cx = 110 + i * 210;
    put(group([
      circle(cx, 470, 50, i === 2 ? BLUE : "#ffffff", { stroke: BLUE, strokeWidth: 6, shadow: shadow("rgba(20,30,80,0.18)", 18, 0, 6) }),
      text(n, { x: cx - 50, y: 437, w: 100, size: 60, font: "Kanit", weight: 900, color: i === 2 ? "#ffffff" : BLUE, align: "center" }),
      text(label, { x: cx - 100, y: 538, w: 200, size: 30, font: "Kanit", weight: 700, color: NAVY, align: "center", charSpacing: 80 }),
    ]), `Step ${n}`);
  });
}

// ---- 5. Tech review --------------------------------------------------------------------------

async function techReview(app) {
  const put = putter(app);
  const CYAN = "#3de0ff";
  app.editor.setBackground("#070b16");
  put(bleed(rect(0, 0, 1280, 720, linear(120, ["#0c1630", [0.6, "#070b16"], [1, "#04060c"]]))), "Background");
  put(bleed(ellipse(930, 360, 420, 420, radial(["rgba(61,224,255,0.45)", [0.5, "rgba(61,120,255,0.15)"], [1, "rgba(0,0,0,0)"]]))), "Spotlight");
  put(ellipse(930, 676, 260, 28, "rgba(0,0,0,0.6)"), "Floor shadow");
  put(phoneBack(800, 70, 300, 600, { body: "#3a5a8c", angle: -12 }), "Phone (drawn)");

  put(text("HONEST REVIEW", { x: 60, y: 70, w: 600, size: 30, font: "Barlow Condensed", weight: 700, color: CYAN, charSpacing: 500 }), "Label");
  put(text("WORTH", { x: 52, y: 120, w: 640, size: 170, font: "Russo One", color: "#ffffff" }), "Title");
  put(text("IT?", { x: 52, y: 292, w: 640, size: 170, font: "Russo One", color: CYAN,
    ...fx({ neon: { intensity: 40, tube: 0, color: CYAN } }) }), "Title accent");

  const sx = 60, sy = 520;
  put(group([
    rect(sx, sy, 400, 120, "rgba(255,255,255,0.07)", { rx: 20, ry: 20, stroke: "rgba(255,255,255,0.18)", strokeWidth: 2 }),
    text("9.1", { x: sx + 24, y: sy + 16, w: 170, size: 92, font: "Russo One", color: "#ffffff" }),
    ...[0, 1, 2, 3, 4].map((i) => star(sx + 218 + i * 36, sy + 48, 16, i < 4 ? "#ffc83d" : "rgba(255,255,255,0.25)")),
    text("/10  AFTER 6 MONTHS", { x: sx + 202, y: sy + 76, w: 200, size: 20, font: "Barlow Condensed", weight: 700, color: "rgba(255,255,255,0.65)", charSpacing: 120 }),
  ]), "Score card");
}

// ---- 6. Finance chart ------------------------------------------------------------------------

async function financeChart(app) {
  const put = putter(app);
  const GREEN = "#2bff88", RED = "#ff4d6d";
  app.editor.setBackground("#03130c");
  put(bleed(rect(0, 0, 1280, 720, linear(180, ["#062517", "#020a06"]))), "Background");
  put(bleed(grid(0, 0, 1280, 720, 80, "rgba(43,255,136,0.07)", 2)), "Chart grid");

  const candles = [[620, 440, 520, 1], [670, 400, 450, 1], [720, 405, 430, 0],
    [770, 340, 410, 1], [820, 300, 360, 1], [870, 310, 335, 0], [920, 240, 320, 1], [970, 190, 260, 1], [1020, 200, 225, 0],
    [1070, 140, 210, 1], [1120, 90, 160, 1]];
  const parts = [];
  for (const [x, top, bot, up] of candles) {
    const c = up ? GREEN : RED;
    parts.push(line(x, top - 26, x, bot + 26, c, 4));
    parts.push(rect(x - 15, top, 30, bot - top, c, { rx: 3, ry: 3 }));
  }
  put(group(parts, { opacity: 0.9 }), "Candles");
  put(bleed(path("M 0 600 C 300 590 420 560 560 500 C 700 440 820 380 940 270 C 1020 200 1100 140 1280 70 L 1280 720 L 0 720 Z",
    { fill: linear(180, ["rgba(43,255,136,0.35)", "rgba(43,255,136,0)"]) })), "Area fill");
  put(curvedArrow(560, 620, 900, 560, 1200, 110, { color: GREEN, width: 30, head: 92, outline: "#03130c" }), "Arrow up");

  put(pill("1 YEAR LATER", { x: 60, y: 60, h: 52, size: 24, pad: 22, font: "Inter", weight: 900, fill: GREEN, color: "#03130c", spacing: 160 }), "Tag");
  put(text("+340%", { x: 48, y: 120, w: 760, size: 250, font: "Teko", weight: 700, color: GREEN,
    ...fx({ neon: { intensity: 16, tube: 0, color: GREEN } }) }), "Big result");
  put(text("MY $1,000 BET", { x: 60, y: 392, w: 700, size: 82, font: "Teko", weight: 600, color: "#ffffff" }), "Title");
}

// ---- 7. Gaming neon --------------------------------------------------------------------------

async function gamingNeon(app) {
  const put = putter(app);
  const PINK = "#ff2bd6", CYAN = "#22f0ff";
  app.editor.setBackground("#12002a");
  put(bleed(rect(0, 0, 1280, 440, linear(180, ["#0b0024", [0.7, "#3a0659"], [1, "#8a0f6b"]]))), "Sky");
  put(circle(640, 400, 230, linear(180, ["#ffe14d", [0.55, "#ff7a3d"], [1, "#ff2bd6"]]), { shadow: shadow("rgba(255,60,200,0.6)", 60) }), "Sun");
  for (let i = 0; i < 6; i++) put(rect(380, 300 + i * 24 + i * i * 1.6, 520, 5 + i * 2.4, "#4a0a66"), "Sun stripe");
  put(bleed(rect(0, 440, 1280, 280, linear(180, ["#1a0033", "#05000f"]))), "Floor");
  put(bleed(perspectiveGrid(0, 440, 1280, 720, 640, { stroke: PINK, width: 3 })), "Neon grid");
  put(bleed(rect(0, 434, 1280, 8, CYAN, { shadow: shadow(CYAN, 30) })), "Horizon line");
  for (const [x, y, r] of [[120, 80, 3], [260, 160, 2], [1080, 90, 3], [1180, 210, 2], [900, 60, 2], [380, 50, 2]]) put(circle(x, y, r, "#ffffff"), "Star");

  put(text("1 VS 100", { x: 40, y: 96, w: 1200, size: 190, font: "Black Ops One", color: "#ffffff", align: "center",
    ...fx({ neon: { intensity: 60, tube: 20, color: CYAN }, outline: { thickness: 12, color: "#0b0024" } }) }), "Title");
  put(pill("LAST ONE STANDING", { x: 640, y: 560, h: 92, size: 62, pad: 40, font: "Teko", weight: 700, fill: "#0b0024", color: "#ffe14d",
    spacing: 260, center: true, stroke: CYAN, strokeWidth: 4, radius: 14, shadowOf: shadow(CYAN, 30) }), "Subtitle");
  put(pill("● LIVE", { x: 60, y: 50, h: 48, size: 22, pad: 20, font: "Inter", weight: 900, fill: "#ff2e4d", spacing: 160 }), "Live tag");
}

// ---- 8. Travel vlog --------------------------------------------------------------------------

async function travelVlog(app) {
  const put = putter(app);
  app.editor.setBackground("#ff8a5c");
  put(bleed(rect(0, 0, 1280, 720, linear(180, ["#4b2a8c", [0.45, "#ff5e7e"], [0.75, "#ffa14d"], [1, "#ffd27a"]]))), "Sunset sky");
  put(circle(900, 470, 150, radial(["#fff6c8", [0.6, "#ffe08a"], [1, "#ffbd59"]]), { shadow: shadow("rgba(255,230,150,0.8)", 80) }), "Sun");
  put(bleed(path("M -20 720 L -20 470 L 140 380 L 260 450 L 420 330 L 560 440 L 700 400 L 820 470 L 1000 380 L 1140 450 L 1300 400 L 1300 720 Z",
    { fill: "#8b3a78", opacity: 0.85 })), "Far hills");
  put(bleed(path("M -20 720 L -20 540 C 200 500 360 560 560 520 C 760 480 980 560 1300 510 L 1300 720 Z", { fill: "#5a1f5e" })), "Near hills");
  put(bleed(rect(0, 610, 1280, 110, linear(180, ["#2a5fa8", "#18306a"]))), "Sea");
  for (let i = 0; i < 6; i++) put(line(760 + i * 40 - i * i * 4, 630 + i * 14, 1040 - i * 40 + i * i * 4, 630 + i * 14, "rgba(255,226,150,0.6)", 4), "Sun glint");

  put(path("M 80 230 C 300 130 520 300 760 150", { stroke: "#ffffff", strokeWidth: 5, strokeDashArray: [14, 14], opacity: 0.9 }), "Flight path");
  put(group([
    path("M 0 0 L 64 -10 L 82 -4 L 64 4 L 0 0 Z", { fill: "#ffffff" }),
    path("M 30 -4 L 18 -38 L 30 -38 L 50 -4 Z", { fill: "#ffffff" }),
    path("M 30 2 L 18 30 L 30 30 L 48 2 Z", { fill: "#ffffff" }),
  ], { left: 790, top: 150, angle: -25, originX: "center", originY: "center" }), "Plane");

  put(text("48 HOURS IN", { x: 62, y: 244, w: 700, size: 86, font: "Bebas Neue", color: "#ffffff", charSpacing: 120,
    shadow: shadow("rgba(60,10,60,0.45)", 20, 0, 6) }), "Kicker");
  put(text("Lisbon", { x: 40, y: 330, w: 760, size: 210, font: "Pacifico", color: "#ffffff",
    ...fx({ shadow: { offset: 30, direction: 100, blur: 10, transparency: 20, color: "#5a1f5e" } }) }), "Place name");
  put(group([
    path("M 0 -40 C -26 -40 -40 -20 -40 -2 C -40 26 0 56 0 56 C 0 56 40 26 40 -2 C 40 -20 26 -40 0 -40 Z", { fill: "#ff2e63", stroke: "#ffffff", strokeWidth: 6 }),
    circle(0, -4, 14, "#ffffff"),
  ], { left: 1150, top: 110, originX: "center", originY: "center" }), "Map pin");
  put(pill("PORTUGAL  ·  VLOG 07", { x: 64, y: 600, h: 50, size: 22, pad: 22, font: "Inter", weight: 800, fill: "rgba(255,255,255,0.92)", color: "#5a1f5e", spacing: 200 }), "Tag");
}

const THUMB = { size: "yt-thumb" };
const yt = ["thumbnail", "youtube", "video"];
export default [
  { ...THUMB, id: "tv-shocked-reaction", name: "Shocked Reaction", tags: [...yt, "reaction", "face", "shocked", "surprised", "yellow", "arrow"],
    fonts: [["Luckiest Guy"], ["Inter", 800]], build: shockedReaction },
  { ...THUMB, id: "tv-versus-price", name: "Cheap vs Expensive", tags: [...yt, "versus", "vs", "compare", "price", "cheap", "expensive", "split", "coffee"],
    fonts: [["Bungee"], ["Inter", 900]], build: versusPrice },
  { ...THUMB, id: "tv-top-10", name: "Top 10 List", tags: [...yt, "top", "list", "ranking", "number", "countdown", "gadgets", "best"],
    fonts: [["Titan One"]], build: top10 },
  { ...THUMB, id: "tv-tutorial-steps", name: "How-To Tutorial", tags: [...yt, "tutorial", "how", "guide", "steps", "lesson", "education", "light"],
    fonts: [["Kanit", 900], ["Kanit", 700]], build: tutorial },
  { ...THUMB, id: "tv-tech-review", name: "Tech Review", tags: [...yt, "tech", "review", "phone", "gadget", "unboxing", "dark", "rating"],
    fonts: [["Russo One"], ["Barlow Condensed", 700]], build: techReview },
  { ...THUMB, id: "tv-finance-chart", name: "Stock Chart Win", tags: [...yt, "finance", "money", "stocks", "crypto", "chart", "investing", "green", "growth"],
    fonts: [["Teko", 700], ["Teko", 600], ["Inter", 900]], build: financeChart },
  { ...THUMB, id: "tv-gaming-neon", name: "Gaming Neon", tags: [...yt, "gaming", "game", "neon", "retro", "synthwave", "live", "stream"],
    fonts: [["Black Ops One"], ["Teko", 700], ["Inter", 900]], build: gamingNeon },
  { ...THUMB, id: "tv-travel-vlog", name: "Travel Vlog", tags: [...yt, "travel", "vlog", "sunset", "trip", "holiday", "city", "script"],
    fonts: [["Bebas Neue"], ["Pacifico"], ["Inter", 800]], build: travelVlog },
];
