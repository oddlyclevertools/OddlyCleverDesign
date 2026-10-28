// Print templates, part 2: Swiss talk poster, sale flyer, infographic, two wallpapers and a logo.
import {
  arch, bleed, circle, group, icon, linear, path, poly, putter, radial, rect, ring, seeded, shadow,
  sparkle, star, text,
} from "./ts-kit.js";

// ---- Swiss talk poster (18 x 24 in, 1800 x 2400) ----------------------------------------

async function swissPoster(app) {
  const put = putter(app);
  const INK = "#111111", RED = "#e4362b", BLUE = "#2747d8", MUTED = "#5f5b54";
  app.editor.setBackground("#e9e5dc");
  put(circle(1180, 760, 560, INK), "Black circle");
  put(circle(660, 1100, 400, RED, { globalCompositeOperation: "multiply" }), "Red circle");
  put(rect(1230, 1180, 380, 380, BLUE, { globalCompositeOperation: "multiply" }), "Blue square");
  put(text("Evening lectures on type, grids and the web.", { x: 100, y: 110, w: 640, size: 48, font: "Inter", weight: 600, color: INK, lineHeight: 1.15 }), "Intro");
  put(text("07.11.2026", { x: 1740, y: 110, w: 700, size: 60, font: "Inter", weight: 800, color: INK, angle: 90, charSpacing: 100 }), "Date");
  put(text("Design\nTalks", { x: 86, y: 1440, w: 1600, size: 330, font: "Inter", weight: 900, color: INK, lineHeight: 0.84, charSpacing: -50 }), "Title");
  put(text("Vol. 04", { x: 1300, y: 1700, w: 400, size: 60, font: "Inter", weight: 800, color: RED, align: "right" }), "Volume");
  put(rect(100, 2040, 1600, 4, INK), "Rule");
  const talks = [["18:00", "Opening", "Lea Brandt"], ["18:45", "Grids that breathe", "Tomás Ruiz"], ["19:30", "Type on screen", "Ama Owusu"]];
  talks.forEach(([t, title, who], i) => {
    const x = 100 + i * 540;
    put(text(t, { x, y: 2070, w: 500, size: 34, font: "Inter", weight: 800, color: RED }), `Talk ${i + 1} time`);
    put(text(title, { x, y: 2120, w: 500, size: 40, font: "Inter", weight: 800, color: INK }), `Talk ${i + 1} title`);
    put(text(who, { x, y: 2172, w: 500, size: 34, font: "Inter", weight: 400, color: MUTED }), `Talk ${i + 1} speaker`);
  });
  put(text("Free entry  ·  Book ahead at talks.example  ·  City Arts Centre, Hall 3", { x: 100, y: 2290, w: 1600, size: 30, font: "Inter",
    weight: 600, color: MUTED }), "Footer");
}

// ---- Sale flyer (US letter, 2550 x 3300) -------------------------------------------------

function rays(cx, cy, n, r, fill) {
  const ws = [];
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2, a2 = ((i + 0.5) / n) * Math.PI * 2;
    ws.push(poly([[cx, cy], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r], [cx + Math.cos(a2) * r, cy + Math.sin(a2) * r]], fill));
  }
  return group(ws);
}

function priceTag(cx, cy, label, angle, fill, color) {
  const w = 420, h = 240, x = cx - w / 2, y = cy - h / 2;
  return group([
    poly([[x + 90, y], [x + w, y], [x + w, y + h], [x + 90, y + h], [x, y + h / 2]], fill, { stroke: "#1a1a1a", strokeWidth: 10, strokeLineJoin: "round" }),
    circle(x + 70, cy, 22, "#e5262d", { stroke: "#1a1a1a", strokeWidth: 8 }),
    text(label, { x: x + 100, y: cy - 70, w: w - 110, size: 124, font: "Anton", color, align: "center" }),
  ], { angle, scaleX: 1.45, scaleY: 1.45 });
}

async function saleFlyer(app) {
  const put = putter(app);
  const RED = "#e5262d", YELLOW = "#ffd43b", INK = "#1a1a1a", W = 2550;
  app.editor.setBackground(RED);
  put(bleed(rays(1275, 1350, 28, 2600, "#ef4a3c")), "Sunburst");
  put(bleed(circle(1275, 1350, 900, radial(["rgba(255,212,59,0.35)", "rgba(255,212,59,0)"]))), "Glow");
  put(text("MEGA", { x: 0, y: 330, w: W, size: 340, font: "Alfa Slab One", color: "#ffffff", align: "center", charSpacing: 200,
    shadow: shadow(INK, 0, 14, 14) }), "Kicker");
  put(text("SALE", { x: 0, y: 640, w: W, size: 820, font: "Alfa Slab One", color: YELLOW, align: "center",
    stroke: INK, strokeWidth: 22, paintFirst: "stroke", shadow: shadow(INK, 0, 26, 26) }), "Title");
  put(group([
    rect(375, 1700, 1800, 260, INK),
    poly([[375, 1700], [235, 1830], [375, 1960]], INK),
    poly([[2175, 1700], [2315, 1830], [2175, 1960]], INK),
    text("UP TO 70% OFF", { x: 375, y: 1735, w: 1800, size: 190, font: "Anton", color: "#ffffff", align: "center", charSpacing: 60 }),
  ], { angle: -3 }), "Banner");
  put(priceTag(620, 2280, "-30%", -12, YELLOW, INK), "Price tag");
  put(priceTag(1930, 2260, "-50%", 10, "#ffffff", RED), "Price tag");
  put(text("Shoes · Bags · Jackets · Homeware", { x: 0, y: 2560, w: W, size: 88, font: "Inter", weight: 800, color: "#ffffff", align: "center" }), "Categories");
  put(bleed(rect(0, 2760, W, 540, INK)), "Footer band");
  put(text("THIS WEEKEND ONLY  ·  FRI 20 – SUN 22 NOV", { x: 0, y: 2860, w: W, size: 104, font: "Anton", color: YELLOW, align: "center", charSpacing: 60 }), "Dates");
  put(text("The Arcade, 9 Market Street  ·  Open 9 am – 8 pm", { x: 0, y: 3040, w: W, size: 64, font: "Inter", weight: 600, color: "#ffffff", align: "center" }), "Address");
}

// ---- Infographic (800 x 2000) ------------------------------------------------------------

function arcPath(cx, cy, r, a0, a1) {
  const p = (a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

async function infographic(app) {
  const put = putter(app);
  const DEEP = "#0d4f66", TEAL = "#1d9bb5", SKY = "#bfe6f0", INK = "#16323d", MUTED = "#55707a";
  app.editor.setBackground("#f3f9fb");
  // header
  put(bleed(rect(0, 0, 800, 560, linear(160, [DEEP, [1, "#127391"]]))), "Header");
  put(icon("drop", 640, 170, 230, { fill: "rgba(191,230,240,0.18)", stroke: "rgba(191,230,240,0.5)", weight: 1 }), "Big drop");
  put(text("A GUIDE FOR HOMES", { x: 60, y: 80, w: 500, size: 20, font: "Nunito", weight: 900, color: SKY, charSpacing: 300 }), "Kicker");
  put(text("Every drop\ncounts", { x: 56, y: 130, w: 600, size: 96, font: "Nunito", weight: 900, color: "#ffffff", lineHeight: 0.98 }), "Title");
  put(text("Simple ways to save water at home, and where it all goes.", { x: 60, y: 370, w: 520, size: 30, font: "Nunito", weight: 700,
    color: SKY, lineHeight: 1.3 }), "Subtitle");
  // big stat
  put(rect(60, 610, 680, 250, "#ffffff", { rx: 28, ry: 28, shadow: shadow("rgba(13,79,102,0.12)", 30, 0, 10) }), "Stat card");
  put(text("142 L", { x: 100, y: 650, w: 420, size: 120, font: "Nunito", weight: 900, color: TEAL }), "Stat number");
  put(text("of water one person uses at home every day", { x: 100, y: 790, w: 560, size: 28, font: "Nunito", weight: 700, color: INK }), "Stat text");
  put(icon("drop", 640, 715, 90, { fill: SKY, stroke: TEAL, weight: 1.6 }), "Stat icon");
  // tips
  put(text("4 easy wins", { x: 60, y: 920, w: 680, size: 54, font: "Nunito", weight: 900, color: INK }), "Tips heading");
  const tips = [
    ["drop", "Turn off the tap", "while you brush: save 6 L a minute"],
    ["clock", "Take 4-minute showers", "and save up to 40 L each time"],
    ["sun", "Water plants at dusk", "so less of it dries up in the sun"],
    ["recycle", "Run full loads only", "and save around 50 L a week"],
  ];
  tips.forEach(([ic, t, d], i) => {
    const y = 1010 + i * 120;
    put(circle(105, y + 42, 44, i % 2 ? SKY : TEAL), `Tip ${i + 1} badge`);
    put(icon(ic, 105, y + 42, 46, { stroke: i % 2 ? DEEP : "#ffffff", weight: 2 }), `Tip ${i + 1} icon`);
    put(text(t, { x: 175, y: y + 6, w: 560, size: 34, font: "Nunito", weight: 900, color: INK }), `Tip ${i + 1} title`);
    put(text(d, { x: 175, y: y + 50, w: 560, size: 26, font: "Nunito", weight: 700, color: MUTED }), `Tip ${i + 1} text`);
  });
  // donut
  put(text("Where it goes", { x: 60, y: 1520, w: 680, size: 54, font: "Nunito", weight: 900, color: INK }), "Chart heading");
  const parts = [["Shower", 0.34, DEEP], ["Toilet", 0.22, TEAL], ["Taps", 0.18, "#5cc6dc"], ["Washing", 0.13, "#9fdbe8"], ["Other", 0.13, "#d3e6ea"]];
  let a = -Math.PI / 2;
  const cx = 230, cy = 1780, r = 130;
  parts.forEach(([label, v, c], i) => {
    const a1 = a + v * Math.PI * 2;
    put(path(arcPath(cx, cy, r, a + 0.02, a1 - 0.02), { stroke: c, strokeWidth: 64, strokeLineCap: "butt" }), `Chart: ${label}`);
    put(rect(450, 1640 + i * 56, 26, 26, c, { rx: 6, ry: 6 }), `Key ${label}`);
    put(text(`${label}  ${Math.round(v * 100)}%`, { x: 492, y: 1640 + i * 56, w: 260, size: 28, font: "Nunito", weight: 800, color: INK }), `Key label ${label}`);
    a = a1;
  });
  put(text("Figures are rounded examples.", { x: 60, y: 1950, w: 680, size: 20, font: "Nunito", weight: 700, color: MUTED }), "Source");
}

// ---- Desktop wallpaper: dusk dunes (1920 x 1080) ----------------------------------------

function dune(points, fill) {
  let d = `M -20 1100 L -20 ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    const mx = (x0 + x1) / 2;
    d += ` C ${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`;
  }
  d += " L 1940 1100 Z";
  return path(d, { fill, strokeWidth: 0 });
}

async function dunesWallpaper(app) {
  const put = putter(app);
  app.editor.setBackground(linear(180, ["#1c1640", [0.45, "#6b3a73"], [0.75, "#e2697a"], [1, "#ffb37a"]]));
  const rnd = seeded(21);
  const stars = [];
  for (let i = 0; i < 70; i++) stars.push(circle(rnd() * 1920, rnd() * 420, 1 + rnd() * 2.2, `rgba(255,255,255,${0.35 + rnd() * 0.5})`));
  put(bleed(group(stars)), "Stars");
  put(circle(1300, 640, 300, radial(["rgba(255,200,140,0.55)", "rgba(255,200,140,0)"])), "Sun glow");
  put(circle(1300, 640, 170, linear(180, ["#fff1c9", [1, "#ffb36b"]])), "Sun");
  put(bleed(dune([[-20, 700], [500, 640], [1100, 760], [1940, 660]], "#b8536f")), "Far dune");
  put(bleed(dune([[-20, 820], [600, 740], [1300, 860], [1940, 780]], "#7e3a66")), "Middle dune");
  put(bleed(dune([[-20, 900], [800, 980], [1400, 880], [1940, 960]], "#45244f")), "Near dune");
  put(bleed(dune([[-20, 1010], [700, 960], [1940, 1040]], "#26173a")), "Front dune");
  put(text("STAY CURIOUS", { x: 80, y: 990, w: 600, size: 22, font: "Raleway", weight: 700, color: "rgba(255,226,200,0.7)", charSpacing: 600 }), "Caption");
}

// ---- Phone wallpaper: boho arches (1080 x 2340) -----------------------------------------

function rainbowArch(cx, baseY, rOuter, colors, band) {
  const parts = [];
  colors.forEach((c, i) => {
    const r = rOuter - i * band;
    parts.push(path(`M ${cx - r} ${baseY} A ${r} ${r} 0 0 1 ${cx + r} ${baseY} Z`, { fill: c, strokeWidth: 0 }));
  });
  return group(parts);
}

async function archWallpaper(app) {
  const put = putter(app);
  const TERRA = "#c4613a", SAND = "#e3ae7c", SAGE = "#9aa98a", BLUSH = "#f3bea4";
  app.editor.setBackground("#efe2cf");
  put(arch(96, 724, 888, 1700, null, { stroke: TERRA, strokeWidth: 4 }), "Arch outline");
  put(arch(130, 760, 820, 1700, linear(180, ["#fbe3d3", [1, "#f2b79c"]])), "Arch window");
  put(circle(540, 1170, 150, "#fff4e3"), "Sun");
  put(ring(540, 1170, 190, "rgba(255,244,227,0.6)", 3), "Sun ring");
  put(rainbowArch(540, 1990, 380, [TERRA, SAND, SAGE, "#e9b9a6", BLUSH], 66), "Rainbow arch");
  put(path("M 130 2020 Q 330 1900 560 2000 T 950 1950 L 950 2340 L 130 2340 Z", { fill: "#d9875e", strokeWidth: 0 }), "Far hill");
  put(path("M 130 2120 Q 420 2010 700 2110 T 950 2090 L 950 2340 L 130 2340 Z", { fill: "#b5583a", strokeWidth: 0 }), "Near hill");
  put(sparkle(120, 900, 24, TERRA), "Sparkle");
  put(sparkle(990, 1020, 18, SAGE), "Sparkle");
  put(sparkle(60, 1640, 14, SAGE), "Sparkle");
  put(circle(1030, 1500, 7, TERRA), "Dot");
}

// ---- Logo: coffee badge (500 x 500) ------------------------------------------------------

async function logoBadge(app) {
  const put = putter(app);
  const GREEN = "#1f3b2d", CREAM = "#f1e6cf", AMBER = "#d99a3d";
  app.editor.setBackground("#ffffff");
  put(circle(250, 250, 232, GREEN), "Badge");
  put(ring(250, 250, 210, CREAM, 3), "Ring");
  put(text("COFFEE ROASTERS  ·  EST 2026", { x: -150, y: 90, w: 800, size: 22, font: "Inter", weight: 800, color: CREAM, align: "center",
    charSpacing: 260, data: { curve: 54 } }), "Curved text");
  put(icon("cup", 250, 214, 96, { stroke: AMBER, weight: 1.8 }), "Cup icon");
  put(text("NORTH\nBREW", { x: 50, y: 282, w: 400, size: 60, font: "Righteous", color: CREAM, align: "center", lineHeight: 0.9 }), "Brand name");
  put(star(132, 300, 12, AMBER), "Star");
  put(star(368, 300, 12, AMBER), "Star");
}

export default [
  { id: "ts-poster-swiss", name: "Swiss Talks Poster", size: "poster", category: "print", tags: ["poster", "event", "swiss", "minimal", "talks", "design"],
    fonts: [["Inter", 900], ["Inter", 800], ["Inter", 600], ["Inter", 400]], build: swissPoster },
  { id: "ts-flyer-sale", name: "Mega Sale Flyer", size: "flyer", category: "print", tags: ["flyer", "sale", "retail", "bold", "red", "discount"],
    fonts: [["Alfa Slab One"], ["Anton"], ["Inter", 800], ["Inter", 600]], build: saleFlyer },
  { id: "ts-infographic-water", name: "Water Saving Infographic", size: "infographic", category: "print", tags: ["infographic", "stats", "chart", "icons", "water", "education"],
    fonts: [["Nunito", 900], ["Nunito", 800], ["Nunito", 700]], build: infographic },
  { id: "ts-wall-dunes", name: "Dusk Dunes Wallpaper", size: "desktop-wallpaper", category: "print", tags: ["wallpaper", "desktop", "landscape", "sunset", "calm", "gradient"],
    fonts: [["Raleway", 700]], build: dunesWallpaper },
  { id: "ts-wall-arches", name: "Boho Arches Wallpaper", size: "phone-wallpaper", category: "print", tags: ["wallpaper", "phone", "boho", "arches", "pastel", "rainbow"],
    fonts: [], build: archWallpaper },
  { id: "ts-logo-badge", name: "Coffee Badge Logo", size: "logo", category: "print", tags: ["logo", "badge", "coffee", "brand", "emblem", "circle"],
    fonts: [["Inter", 800], ["Righteous"]], build: logoBadge },
];
