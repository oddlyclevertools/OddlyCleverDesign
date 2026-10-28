// Facebook, X, LinkedIn, Pinterest, Discord, email and blog templates.
import {
  bleed, circle, ellipse, frame, group, halftone, icon, line, linear, lineStyle, path, pill, poly, putter, radial,
  rect, seeded, shadow, sparkle, stripes, tape, text, tornPaper,
} from "./ts-kit.js";

// ---- Facebook post: brutalist sale (1200 x 630) -----------------------------------------

async function brutalSale(app) {
  const put = putter(app);
  const INK = "#0e0e0e", ACID = "#e2ff3d", PAPER = "#efede6";
  app.editor.setBackground(PAPER);
  put(bleed(frame(22, 22, 1156, 586, INK, 8)), "Border");
  put(text("ALL\nSHOES", { x: 64, y: 70, w: 640, size: 146, font: "Archivo Black", color: INK, lineHeight: 0.84, charSpacing: -20 }), "Headline");
  put(rect(746, 80, 390, 290, INK), "Hard shadow");
  put(rect(730, 64, 390, 290, ACID, { stroke: INK, strokeWidth: 8 }), "Price box");
  put(text("-50%", { x: 730, y: 104, w: 390, size: 150, font: "Anton", color: INK, align: "center" }), "Discount");
  put(text("EVERY PAIR", { x: 730, y: 300, w: 390, size: 24, font: "Space Grotesk", weight: 700, color: INK, align: "center", charSpacing: 300 }), "Discount note");
  put(text("NO CODE NEEDED", { x: 64, y: 400, w: 600, size: 26, font: "Space Grotesk", weight: 700, color: INK, charSpacing: 240 }), "Note");
  put(bleed(rect(30, 462, 1140, 80, INK)), "Ticker bar");
  put(text("WEEKEND ONLY  ✱  IN STORE & ONLINE  ✱  WHILE STOCKS LAST", { x: 30, y: 487, w: 1140, size: 30,
    font: "Archivo Black", color: ACID, align: "center", charSpacing: 30 }), "Ticker");
  put(text("SHOP.EXAMPLE.COM", { x: 64, y: 562, w: 500, size: 22, font: "Space Grotesk", weight: 700, color: INK, charSpacing: 200 }), "Website");
  put(text("FRI–SUN", { x: 700, y: 562, w: 436, size: 22, font: "Space Grotesk", weight: 700, color: INK, align: "right", charSpacing: 200 }), "Dates");
}

// ---- Facebook cover: paper collage bakery (1640 x 624) ----------------------------------

function wheat(x, y, h, color, angle = 0) {
  const parts = [line(x, y, x, y + h, color, 5)];
  for (let i = 0; i < 6; i++) {
    const gy = y + 14 + i * 26;
    parts.push(ellipse(x - 14, gy, 9, 20, color, { angle: -30 }), ellipse(x + 14, gy, 9, 20, color, { angle: 30 }));
  }
  parts.push(ellipse(x, y - 6, 8, 20, color));
  return group(parts, { angle });
}

async function collageCover(app) {
  const put = putter(app);
  const INK = "#2b2118", RUST = "#c4572f", SAGE = "#8fa58a", CREAM = "#f7efdd";
  app.editor.setBackground("#dcc4a0");
  put(bleed(rect(0, 0, 1640, 624, linear(90, ["rgba(255,255,255,0.12)", "rgba(0,0,0,0.06)"]))), "Paper tone");
  put(tornPaper(70, 70, 460, 470, SAGE, { seed: 7, angle: -3, shadow: shadow("rgba(60,40,20,0.25)", 14, 4, 6) }), "Green paper");
  // a drawn loaf
  put(ellipse(300, 340, 150, 84, "#d38e4c", { stroke: INK, strokeWidth: 5 }), "Loaf");
  put(ellipse(290, 318, 112, 46, "#e8b071"), "Loaf crust light");
  [-60, 0, 60].forEach((dx) => put(path(`M ${300 + dx - 22} ${300} Q ${300 + dx + 4} ${316} ${300 + dx + 20} ${344}`, { stroke: "#fff1d6", strokeWidth: 9 }), "Loaf score"));
  put(wheat(150, 160, 190, CREAM, -18), "Wheat");
  put(wheat(450, 170, 170, CREAM, 16), "Wheat");
  put(tape(300, 82, 150, 38, -6), "Tape");
  put(tornPaper(600, 120, 720, 330, CREAM, { seed: 11, angle: 1.5, shadow: shadow("rgba(60,40,20,0.25)", 14, 4, 6) }), "Cream paper");
  put(text("fresh every morning", { x: 640, y: 160, w: 640, size: 54, font: "Caveat", weight: 700, color: RUST }), "Script");
  put(text("THE CORNER\nBAKERY", { x: 640, y: 228, w: 680, size: 82, font: "Alfa Slab One", color: INK, lineHeight: 0.98 }), "Name");
  put(rect(644, 412, 80, 6, RUST), "Rule");
  put(tape(1290, 132, 120, 34, 40), "Tape");
  // a stamp
  put(group([
    circle(1470, 330, 112, RUST),
    circle(1470, 330, 94, null, { stroke: CREAM, strokeWidth: 3, strokeDashArray: [8, 7] }),
    text("EST.", { x: 1370, y: 270, w: 200, size: 28, font: "Inter", weight: 800, color: CREAM, align: "center", charSpacing: 300 }),
    text("2019", { x: 1370, y: 302, w: 200, size: 62, font: "Alfa Slab One", color: CREAM, align: "center" }),
    text("BAKED HERE", { x: 1370, y: 370, w: 200, size: 18, font: "Inter", weight: 800, color: CREAM, align: "center", charSpacing: 200 }),
  ], { angle: 10 }), "Stamp");
  put(text("Open daily 7 am – 3 pm  ·  12 High Street", { x: 640, y: 490, w: 760, size: 30, font: "Inter", weight: 700, color: INK }), "Hours");
}

// ---- Facebook event cover: neon night quiz (1920 x 1005) --------------------------------

function brickWall(w, h) {
  const bricks = [], bw = 120, bh = 50;
  const rnd = seeded(5);
  for (let r = 0; r * bh < h; r++) for (let c = -1; c * bw < w; c++) {
    const x = c * bw + (r % 2 ? bw / 2 : 0);
    const k = Math.round(26 + rnd() * 12);
    bricks.push(rect(x + 3, r * bh + 3, bw - 6, bh - 6, `rgb(${k + 12}, ${k - 6}, ${k})`, { rx: 3, ry: 3 }));
  }
  return group(bricks);
}

async function neonEvent(app) {
  const put = putter(app);
  const PINK = "#ff2e7e", CYAN = "#8fe3ff", GOLD = "#ffc83d", W = 1920, H = 1005;
  app.editor.setBackground("#0d0a10");
  put(bleed(brickWall(W, H)), "Brick wall");
  put(bleed(rect(0, 0, W, H, radial(["rgba(13,10,16,0.15)", [0.6, "rgba(13,10,16,0.65)"], [1, "rgba(13,10,16,0.95)"]]))), "Vignette");
  put(bleed(ellipse(960, 430, 760, 380, radial(["rgba(255,46,126,0.28)", "rgba(255,46,126,0)"]))), "Pink glow");
  const neon = (c, blur = 28) => shadow(c, blur);
  put(rect(470, 120, 980, 560, null, { stroke: CYAN, strokeWidth: 8, rx: 60, ry: 60, shadow: neon(CYAN, 30) }), "Neon frame");
  put(text("FRIDAY NIGHT", { x: 470, y: 170, w: 980, size: 110, font: "Anton", align: "center", charSpacing: 120,
    fill: "rgba(0,0,0,0)", stroke: CYAN, strokeWidth: 4, shadow: neon(CYAN, 24) }), "Neon title");
  put(text("quiz", { x: 470, y: 270, w: 980, size: 300, font: "Pacifico", color: "#ffe1ec", align: "center",
    stroke: PINK, strokeWidth: 6, paintFirst: "stroke", shadow: neon(PINK, 40) }), "Neon script");
  put(text("TEAMS OF UP TO SIX  ·  CASH PRIZES  ·  HALF-PRICE SNACKS", { x: 0, y: 740, w: W, size: 36, font: "Inter", weight: 800,
    color: "#f3ead8", align: "center", charSpacing: 220 }), "Details");
  put(pill("FRI 13 NOV  ·  8 PM", { x: 960, y: 820, h: 92, size: 40, pad: 46, font: "Inter", weight: 900, fill: GOLD, color: "#16121b", spacing: 140, center: true }), "Date");
  put(text("The Lamp & Lantern, 4 Dock Road", { x: 0, y: 940, w: W, size: 30, font: "Inter", weight: 600, color: "rgba(243,234,216,0.7)", align: "center" }), "Venue");
}

// ---- X post: editorial stat (1600 x 900) ------------------------------------------------

async function editorialStat(app) {
  const put = putter(app);
  const INK = "#151515", RED = "#d33a2c", MUTED = "#6d675e";
  app.editor.setBackground("#f5f0e6");
  put(text("THE NUMBER", { x: 90, y: 80, w: 600, size: 26, font: "Inter", weight: 800, color: INK, charSpacing: 320 }), "Kicker");
  put(rect(90, 124, 1420, 3, INK), "Rule");
  put(text("72%", { x: 70, y: 170, w: 760, size: 400, font: "Abril Fatface", color: RED, charSpacing: -30 }), "Big number");
  put(rect(830, 200, 2, 520, "rgba(21,21,21,0.25)"), "Column rule");
  put(text("of readers finish an article that opens with a question.", { x: 890, y: 210, w: 620, size: 66,
    font: "Merriweather", weight: 900, color: INK, lineHeight: 1.18 }), "Headline");
  // little bar chart
  const bars = [[0.35, "2022"], [0.5, "2023"], [0.61, "2024"], [0.72, "2026"]];
  bars.forEach(([v, y], i) => {
    const x = 890 + i * 150, h = 260 * v;
    put(rect(x, 720 - h, 96, h, i === bars.length - 1 ? RED : "#d9cfbf"), `Bar ${y}`);
    put(text(y, { x: x - 10, y: 736, w: 116, size: 24, font: "Inter", weight: 700, color: MUTED, align: "center" }), `Bar label ${y}`);
  });
  put(rect(90, 790, 1420, 2, "rgba(21,21,21,0.25)"), "Footer rule");
  put(text("Source: Example Reader Study, 2026", { x: 90, y: 812, w: 800, size: 24, font: "Inter", weight: 500, color: MUTED }), "Source");
  put(text("@yourpublication", { x: 1010, y: 812, w: 500, size: 24, font: "Inter", weight: 700, color: INK, align: "right" }), "Handle");
}

// ---- X header: topographic minimal (1500 x 500) -----------------------------------------

async function topoHeader(app) {
  const put = putter(app);
  app.editor.setBackground(linear(100, ["#0f2a25", [1, "#173d35"]]));
  const rings = [];
  for (let i = 0; i < 14; i++) {
    rings.push(ellipse(1240, 300, 60 + i * 42, 40 + i * 30, null, { stroke: `rgba(196,232,214,${0.42 - i * 0.025})`, strokeWidth: 2, angle: -12 + i * 1.5 }));
  }
  put(bleed(group(rings)), "Contour lines");
  for (let i = 0; i < 6; i++) put(ellipse(160, 80, 60 + i * 44, 34 + i * 26, null, { stroke: "rgba(196,232,214,0.14)", strokeWidth: 2, angle: 18 }), "Contour line");
  put(circle(1240, 300, 12, "#ffb86b", { shadow: shadow("rgba(255,184,107,0.8)", 24) }), "Marker");
  put(text("JORDAN LEE  ·  PRODUCT DESIGNER", { x: 500, y: 150, w: 600, size: 20, font: "Inter", weight: 800, color: "#ffb86b", charSpacing: 300 }), "Name");
  put(text("Notes on building calm,\nuseful software.", { x: 500, y: 196, w: 640, size: 54, font: "Lora", color: "#eaf4ee", lineHeight: 1.1,
    styles: lineStyle("Notes on building calm,\nuseful software.", 1, { fontStyle: "italic" }) }), "Tagline");
}

// ---- LinkedIn post: hiring (1200 x 1200) -------------------------------------------------

async function hiringPost(app) {
  const put = putter(app);
  const BLUE = "#2447f5", INK = "#0e1330", MUTED = "#5b6280";
  app.editor.setBackground("#f6f7fb");
  put(bleed(rect(0, 0, 1200, 560, BLUE)), "Blue block");
  put(halftone(780, 60, 12, 10, 34, 9, "rgba(255,255,255,0.35)"), "Halftone");
  put(pill("NORTHWIND STUDIO", { x: 90, y: 90, h: 54, size: 20, pad: 24, font: "Inter", weight: 800, fill: "rgba(255,255,255,0.16)", spacing: 240 }), "Company");
  put(text("We're\nhiring.", { x: 82, y: 190, w: 900, size: 170, font: "Inter", weight: 900, color: "#ffffff", lineHeight: 0.9, charSpacing: -40 }), "Headline");
  const roles = [["Product Designer", "Remote · Full time"], ["Frontend Engineer", "Remote · Full time"], ["Customer Lead", "London · Hybrid"]];
  roles.forEach(([r, d], i) => {
    const y = 620 + i * 130;
    put(rect(90, y, 1020, 108, "#ffffff", { rx: 22, ry: 22, shadow: shadow("rgba(14,19,48,0.08)", 24, 0, 8) }), `Role ${i + 1} card`);
    put(text(r, { x: 130, y: y + 22, w: 700, size: 38, font: "Inter", weight: 800, color: INK }), `Role ${i + 1}`);
    put(text(d, { x: 130, y: y + 68, w: 700, size: 24, font: "Inter", weight: 500, color: MUTED }), `Role ${i + 1} details`);
    put(circle(1046, y + 54, 30, BLUE), `Role ${i + 1} button`);
    put(icon("arrow", 1046, y + 54, 30, { stroke: "#ffffff", weight: 2.6 }), `Role ${i + 1} arrow`);
  });
  put(text("Apply at example.com/jobs", { x: 90, y: 1040, w: 700, size: 34, font: "Inter", weight: 800, color: BLUE }), "Call to action");
  put(text("Know someone great? Share this post.", { x: 90, y: 1092, w: 800, size: 26, font: "Inter", weight: 500, color: MUTED }), "Share hint");
}

// ---- LinkedIn banner (1584 x 396) --------------------------------------------------------

async function linkedinBanner(app) {
  const put = putter(app);
  const GOLD = "#f6c453";
  app.editor.setBackground(linear(90, ["#0d1b2e", [1, "#16304f"]]));
  put(bleed(stripes(1180, 0, 404, 396, 26, "rgba(246,196,83,0.18)", 3)), "Stripes");
  put(bleed(circle(1584, 396, 260, null, { stroke: "rgba(255,255,255,0.12)", strokeWidth: 2 })), "Ring");
  put(bleed(circle(1584, 396, 180, null, { stroke: "rgba(255,255,255,0.12)", strokeWidth: 2 })), "Ring");
  put(halftone(40, 250, 14, 5, 26, 5, "rgba(246,196,83,0.22)"), "Dots");
  put(text("Helping small teams ship\nbetter products, faster.", { x: 560, y: 92, w: 900, size: 56, font: "Raleway", weight: 900,
    color: "#ffffff", lineHeight: 1.08, styles: lineStyle("Helping small teams ship\nbetter products, faster.", 1, { fill: GOLD }) }), "Headline");
  const chips = ["PRODUCT STRATEGY", "UX RESEARCH", "WORKSHOPS"];
  let x = 560;
  chips.forEach((c) => {
    const p = pill(c, { x, y: 248, h: 48, size: 18, pad: 22, font: "Inter", weight: 800, fill: "rgba(255,255,255,0)", color: "#dce6f5",
      stroke: "rgba(220,230,245,0.5)", strokeWidth: 2, spacing: 200 });
    put(p, `Skill: ${c.toLowerCase()}`);
    x += p.width + 14;
  });
}

// ---- Pinterest pin: recipe (1000 x 1500) -------------------------------------------------

function oatsJar(cx, top) {
  const w = 300, h = 380, x = cx - w / 2;
  return group([
    rect(x - 16, top - 46, w + 32, 54, "#c98a5a", { rx: 14, ry: 14 }),
    rect(x, top, w, h, "rgba(255,255,255,0.55)", { rx: 46, ry: 46, stroke: "#5a3d4f", strokeWidth: 6 }),
    rect(x + 14, top + 220, w - 28, 146, "#f3e2c3", { rx: 34, ry: 34 }),
    rect(x + 14, top + 150, w - 28, 80, "#b5487d"),
    rect(x + 14, top + 80, w - 28, 76, "#f3e2c3"),
    circle(cx - 70, top + 70, 34, "#5d3b8c"), circle(cx - 10, top + 58, 38, "#e0456b"), circle(cx + 62, top + 70, 32, "#5d3b8c"),
    circle(cx + 30, top + 40, 22, "#e0456b"),
    rect(x + 34, top + 30, 18, 300, "rgba(255,255,255,0.6)", { rx: 9, ry: 9 }),
  ]);
}

async function recipePin(app) {
  const put = putter(app);
  const INK = "#3d2a37", BERRY = "#c23a6b";
  app.editor.setBackground("#fbeee8");
  put(bleed(rect(0, 980, 1000, 520, "#fff8f3")), "Lower panel");
  put(circle(500, 760, 280, "#f6d5d6"), "Plate");
  put(oatsJar(500, 590), "Jar illustration");
  [[200, 560], [820, 640], [180, 900], [830, 900]].forEach(([x, y], i) => put(circle(x, y, 18 + (i % 2) * 8, i % 2 ? "#5d3b8c" : "#e0456b"), "Berry"));
  put(sparkle(780, 520, 22, BERRY), "Sparkle");
  put(pill("5-MINUTE BREAKFAST", { x: 500, y: 80, h: 62, size: 24, pad: 28, font: "Nunito", weight: 900, fill: BERRY, spacing: 200, center: true }), "Tag");
  put(text("Berry\novernight oats", { x: 40, y: 170, w: 920, size: 112, font: "Lora", weight: 700, color: INK, align: "center", lineHeight: 0.98,
    styles: lineStyle("Berry\novernight oats", 1, { fontStyle: "italic" }) }), "Title");
  const steps = [["1", "Mix oats, milk\n& yoghurt"], ["2", "Layer the\nberry jam"], ["3", "Chill overnight,\ntop & enjoy"]];
  steps.forEach(([n, s], i) => {
    const cx = 200 + i * 300;
    put(circle(cx, 1080, 40, BERRY), `Step ${n} badge`);
    put(text(n, { x: cx - 40, y: 1056, w: 80, size: 44, font: "Fredoka", weight: 700, color: "#ffffff", align: "center" }), `Step ${n} number`);
    put(text(s, { x: cx - 140, y: 1140, w: 280, size: 34, font: "Nunito", weight: 700, color: INK, align: "center", lineHeight: 1.2 }), `Step ${n}`);
  });
  [["clock", "5 min prep"], ["user", "Serves 1"], ["leaf", "No cooking"]].forEach(([ic, label], i) => {
    const x = 170 + i * 250;
    put(icon(ic, x, 1300, 36, { stroke: INK, weight: 2 }), `${label} icon`);
    put(text(label, { x: x + 30, y: 1286, w: 200, size: 28, font: "Nunito", weight: 700, color: INK }), label);
  });
  put(rect(100, 1250, 800, 2, "rgba(61,42,55,0.15)"), "Divider");
  put(text("SAVE FOR LATER  ·  yourblog.example", { x: 0, y: 1400, w: 1000, size: 26, font: "Nunito", weight: 900, color: BERRY, align: "center", charSpacing: 160 }), "Footer");
}

// ---- Discord banner: neon gaming (960 x 540) --------------------------------------------

function gamepad(cx, cy, s, color) {
  const w = 260 * s, h = 150 * s;
  const body = path(`M ${cx - w / 2 + 40 * s} ${cy - h / 2} H ${cx + w / 2 - 40 * s} C ${cx + w / 2 + 10 * s} ${cy - h / 2} ${cx + w / 2 + 30 * s} ${cy + h / 2 + 30 * s} ${cx + w / 2 - 10 * s} ${cy + h / 2 + 20 * s}
    C ${cx + w / 2 - 40 * s} ${cy + h / 2 + 10 * s} ${cx + 50 * s} ${cy + 20 * s} ${cx} ${cy + 20 * s} C ${cx - 50 * s} ${cy + 20 * s} ${cx - w / 2 + 40 * s} ${cy + h / 2 + 10 * s} ${cx - w / 2 + 10 * s} ${cy + h / 2 + 20 * s}
    C ${cx - w / 2 - 30 * s} ${cy + h / 2 + 30 * s} ${cx - w / 2 - 10 * s} ${cy - h / 2} ${cx - w / 2 + 40 * s} ${cy - h / 2} Z`,
  { fill: "rgba(0,0,0,0)", stroke: color, strokeWidth: 6 * s, shadow: shadow(color, 18) });
  const dx = cx - 70 * s, bx = cx + 70 * s;
  return group([
    body,
    line(dx - 24 * s, cy, dx + 24 * s, cy, color, 8 * s), line(dx, cy - 24 * s, dx, cy + 24 * s, color, 8 * s),
    circle(bx + 20 * s, cy - 14 * s, 9 * s, color), circle(bx - 8 * s, cy + 12 * s, 9 * s, color),
  ]);
}

async function discordBanner(app) {
  const put = putter(app);
  const PINK = "#ff4fd8", CYAN = "#5ef2ff";
  app.editor.setBackground(linear(180, ["#120a2e", [1, "#2a0f4f"]]));
  const grid = [];
  for (let i = -10; i <= 10; i++) grid.push(line(480 + i * 30, 380, 480 + i * 140, 560, "rgba(94,242,255,0.35)", 2));
  for (let k = 1; k < 6; k++) grid.push(line(-20, 380 + (k / 6) ** 2 * 180, 980, 380 + (k / 6) ** 2 * 180, "rgba(94,242,255,0.3)", 2));
  put(bleed(rect(0, 380, 960, 160, "#160c35")), "Floor");
  put(bleed(group(grid)), "Grid");
  put(bleed(rect(0, 378, 960, 4, PINK, { shadow: shadow(PINK, 16) })), "Horizon");
  put(gamepad(480, 120, 0.6, CYAN), "Gamepad");
  put(text("LATE LOBBY", { x: 0, y: 190, w: 960, size: 112, font: "Righteous", color: "#ffffff", align: "center",
    shadow: shadow(PINK, 30), stroke: PINK, strokeWidth: 3, paintFirst: "stroke" }), "Server name");
  put(text("GAME NIGHTS  ·  FRI & SAT  ·  9 PM", { x: 0, y: 318, w: 960, size: 24, font: "Inter", weight: 800, color: CYAN, align: "center", charSpacing: 260 }), "Tagline");
  put(sparkle(140, 90, 14, "#ffffff"), "Sparkle");
  put(sparkle(830, 160, 18, PINK), "Sparkle");
  put(sparkle(780, 60, 9, "#ffffff"), "Sparkle");
}

// ---- Email header (600 x 200) ------------------------------------------------------------

async function emailHeader(app) {
  const put = putter(app);
  const INK = "#22201c", ACC = "#d0612f";
  app.editor.setBackground("#f6f1e7");
  put(bleed(rect(0, 196, 600, 4, ACC)), "Bottom bar");
  put(icon("sun", 64, 92, 56, { stroke: ACC, weight: 1.8 }), "Sun icon");
  put(text("The Sunday Letter", { x: 112, y: 58, w: 420, size: 46, font: "Lora", weight: 700, color: INK }), "Title");
  put(text("ISSUE 42  ·  SMALL IDEAS FOR A BETTER WEEK", { x: 114, y: 118, w: 460, size: 12, font: "Inter", weight: 800, color: "#8a8275", charSpacing: 220 }), "Issue line");
}

// ---- Blog banner: houseplant guide (1200 x 628) -----------------------------------------

function plant(cx, base, s) {
  const leaves = [];
  const L = (x, y, rx, ry, a, c) => leaves.push(ellipse(cx + x * s, base + y * s, rx * s, ry * s, c, { angle: a }));
  L(-70, -250, 40, 110, -38, "#3f7a52"); L(70, -260, 40, 110, 36, "#4e8d60"); L(0, -320, 42, 120, 0, "#5ea06f");
  L(-110, -170, 34, 90, -62, "#5ea06f"); L(110, -180, 34, 90, 60, "#3f7a52");
  const pot = poly([[cx - 110 * s, base - 120 * s], [cx + 110 * s, base - 120 * s], [cx + 84 * s, base], [cx - 84 * s, base]], "#d9774a");
  const rim = rect(cx - 124 * s, base - 140 * s, 248 * s, 34 * s, "#c4643a", { rx: 8 * s, ry: 8 * s });
  return group([...leaves, pot, rim]);
}

async function blogBanner(app) {
  const put = putter(app);
  const INK = "#1f2d24", MUTED = "#4f6355";
  app.editor.setBackground("#dfe8dc");
  put(bleed(circle(930, 330, 280, "#cbdac6")), "Backdrop circle");
  put(bleed(rect(700, 548, 500, 80, "#c9d6c4")), "Shelf");
  put(plant(930, 560, 1.15), "Plant illustration");
  put(pill("GUIDES", { x: 80, y: 110, h: 48, size: 18, pad: 22, font: "Inter", weight: 800, fill: INK, color: "#dfe8dc", spacing: 260 }), "Category");
  put(text("A beginner's guide to houseplants", { x: 78, y: 190, w: 560, size: 64, font: "Merriweather", weight: 900, color: INK, lineHeight: 1.15 }), "Title");
  put(icon("clock", 96, 486, 30, { stroke: MUTED, weight: 2 }), "Clock icon");
  put(text("8 min read  ·  by Sam Ortiz", { x: 124, y: 474, w: 500, size: 24, font: "Inter", weight: 600, color: MUTED }), "Meta");
}

export default [
  { id: "ts-fb-brutal", name: "Brutalist Sale Post", size: "fb-post", tags: ["facebook", "sale", "brutalist", "bold", "discount", "shop"],
    fonts: [["Archivo Black"], ["Anton"], ["Space Grotesk", 700]], build: brutalSale },
  { id: "ts-fb-collage", name: "Collage Bakery Cover", size: "fb-cover", tags: ["facebook", "cover", "collage", "paper", "bakery", "small business"],
    fonts: [["Caveat", 700], ["Alfa Slab One"], ["Inter", 800], ["Inter", 700]], build: collageCover },
  { id: "ts-fb-neon-event", name: "Neon Quiz Night", size: "fb-event", tags: ["facebook", "event", "neon", "night", "quiz", "bar"],
    fonts: [["Anton"], ["Pacifico"], ["Inter", 900], ["Inter", 800], ["Inter", 600]], build: neonEvent },
  { id: "ts-x-stat", name: "Editorial Stat", size: "x-post", tags: ["x", "twitter", "stat", "editorial", "number", "chart"],
    fonts: [["Abril Fatface"], ["Merriweather", 900], ["Inter", 800], ["Inter", 700], ["Inter", 500]], build: editorialStat },
  { id: "ts-x-topo", name: "Topographic Header", size: "x-header", tags: ["x", "twitter", "header", "minimal", "personal", "dark"],
    fonts: [["Lora"], ["Lora", 400, "italic"], ["Inter", 800]], build: topoHeader },
  { id: "ts-li-hiring", name: "We're Hiring", size: "li-post", tags: ["linkedin", "hiring", "jobs", "business", "blue", "careers"],
    fonts: [["Inter", 900], ["Inter", 800], ["Inter", 500]], build: hiringPost },
  { id: "ts-li-banner", name: "Pro Profile Banner", size: "li-banner", tags: ["linkedin", "banner", "profile", "business", "navy"],
    fonts: [["Raleway", 900], ["Inter", 800]], build: linkedinBanner },
  { id: "ts-pin-recipe", name: "Recipe Pin", size: "pin", tags: ["pinterest", "recipe", "food", "pastel", "steps", "breakfast"],
    fonts: [["Lora", 700], ["Lora", 700, "italic"], ["Nunito", 900], ["Nunito", 700], ["Fredoka", 700]], build: recipePin },
  { id: "ts-discord-neon", name: "Neon Gaming Banner", size: "discord-banner", tags: ["discord", "gaming", "neon", "server", "banner"],
    fonts: [["Righteous"], ["Inter", 800]], build: discordBanner },
  { id: "ts-email-letter", name: "Newsletter Header", size: "email-header", tags: ["email", "newsletter", "header", "minimal", "serif"],
    fonts: [["Lora", 700], ["Inter", 800]], build: emailHeader },
  { id: "ts-blog-plants", name: "Guide Blog Banner", size: "blog-banner", tags: ["blog", "banner", "guide", "plants", "green", "article"],
    fonts: [["Merriweather", 900], ["Inter", 800], ["Inter", 600]], build: blogBanner },
];
