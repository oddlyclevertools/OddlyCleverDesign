// YouTube thumbnail templates (1280 x 720). All drawn in code: shapes, text and gradients.
import {
  bleed, burst, circle, curvedArrow, ellipse, group, line, linear, lineStyle, outlined, path, pill, poly, putter,
  radial, rect, shadow, silhouette, slotLabel, text,
} from "./draw.js";

const PAPER_SHADOW = () => shadow("rgba(70, 60, 45, 0.16)", 22, 0, 8);

// ---- (a) Paper Diorama ------------------------------------------------------------------

/** A paper-cut "actor": a pawn-like body, a head with eyes that look at `lookX`, a stand. */
function actor(cx, baseY, h, color, { lookX = 0, brows = 0, ink = "#2a2a2c" } = {}) {
  const bw = h * 0.46, bh = h * 0.56, top = baseY - bh, x0 = cx - bw / 2;
  const body = path(`M ${x0} ${baseY} L ${x0 + bw * 0.05} ${top + bw * 0.32} Q ${x0 + bw * 0.08} ${top} ${x0 + bw * 0.32} ${top}
    L ${x0 + bw * 0.68} ${top} Q ${x0 + bw * 0.92} ${top} ${x0 + bw * 0.95} ${top + bw * 0.32} L ${x0 + bw} ${baseY} Z`,
  { fill: color, shadow: PAPER_SHADOW() });
  const r = h * 0.15, hy = top - r - h * 0.035;
  const head = circle(cx, hy, r, color, { shadow: PAPER_SHADOW() });
  const ex = r * 0.34 * lookX, er = r * 0.11;
  const eyes = [circle(cx - r * 0.3 + ex, hy, er, ink), circle(cx + r * 0.3 + ex, hy, er, ink)];
  const parts = [body, head, ...eyes];
  if (brows) {
    const by = hy - r * 0.32, d = r * 0.16 * brows;
    parts.push(line(cx - r * 0.46 + ex, by - d, cx - r * 0.14 + ex, by + d, ink, r * 0.07));
    parts.push(line(cx + r * 0.14 + ex, by + d, cx + r * 0.46 + ex, by - d, ink, r * 0.07));
  }
  const stand = rect(cx - bw * 0.62, baseY - 8, bw * 1.24, 18, "#c9c6bd", { rx: 9, ry: 9 });
  return { obj: group([stand, ...parts]), headTop: hy - r };
}

function cloud(cx, cy, s) {
  return group([
    circle(cx - 40 * s, cy + 6 * s, 30 * s, "#fbfaf7"),
    circle(cx, cy - 12 * s, 42 * s, "#fbfaf7"),
    circle(cx + 44 * s, cy + 4 * s, 32 * s, "#fbfaf7"),
    rect(cx - 70 * s, cy + 6 * s, 146 * s, 30 * s, "#fbfaf7", { rx: 15 * s, ry: 15 * s }),
  ], { shadow: PAPER_SHADOW() });
}

function paperBank(x, y) {
  const parts = [
    rect(x - 12, y + 228, 344, 24, "#e6e4dd", { rx: 4, ry: 4 }),
    rect(x + 14, y + 78, 292, 154, "#f8f7f3"),
  ];
  for (let i = 0; i < 4; i++) parts.push(rect(x + 38 + i * 70, y + 92, 30, 136, "#e3e1da", { rx: 4, ry: 4 }));
  parts.push(poly([[x - 6, y + 82], [x + 160, y], [x + 326, y + 82]], "#f1efea"));
  parts.push(text("BANK", { x: x + 100, y: y + 44, w: 120, size: 20, font: "Inter", weight: 800, color: "#a19e95", align: "center", charSpacing: 300 }));
  return group(parts, { shadow: PAPER_SHADOW() });
}

async function paperDiorama(app) {
  const put = putter(app);
  const ACCENT = "#ff5a1f", INK = "#1d1d1f";
  app.editor.setBackground(linear(180, ["#f6f5f1", "#e9e7e1"]));
  put(cloud(1010, 112, 1), "Paper cloud");
  put(cloud(1180, 196, 0.7), "Paper cloud");
  put(bleed(path("M -20 720 L -20 470 C 160 410 300 430 460 455 C 640 485 760 400 960 420 C 1100 435 1200 462 1300 440 L 1300 720 Z",
    { fill: "#e6e4de", shadow: PAPER_SHADOW() })), "Far hills");
  put(bleed(path("M -20 720 L -20 548 C 200 512 380 562 600 542 C 820 522 1000 566 1300 532 L 1300 720 Z",
    { fill: "#dedcd5", shadow: PAPER_SHADOW() })), "Near hills");
  put(bleed(rect(-20, 628, 1320, 112, "#d6d4cc", { shadow: PAPER_SHADOW() })), "Ground");
  put(paperBank(70, 374), "Paper bank");

  const a = actor(735, 646, 400, "#a3a098", { lookX: 1, brows: 1 });
  const b = actor(1095, 646, 330, ACCENT, { lookX: -1, brows: -0.6 });
  put(a.obj, "Actor: the bank");
  put(b.obj, "Actor: you");
  const tagA = pill("THE BANK", { x: 735, y: a.headTop - 76, h: 54, size: 24, pad: 22, fill: INK, center: true });
  const tagB = pill("YOU", { x: 1095, y: b.headTop - 76, h: 54, size: 24, pad: 22, fill: ACCENT, center: true });
  put(path(`M ${735 + 108} ${a.headTop - 49} Q 972 ${a.headTop - 150} ${1095 - 62} ${b.headTop - 49}`,
    { stroke: INK, strokeWidth: 5, strokeDashArray: [16, 13] }), "Dashed line");
  put(tagA, "Role tag");
  put(tagB, "Role tag");
  put(group([circle(962, a.headTop - 100, 30, ACCENT, { stroke: "#ffffff", strokeWidth: 5, shadow: PAPER_SHADOW() }),
    text("$", { x: 937, y: a.headTop - 121, w: 50, size: 40, font: "Montserrat", weight: 900, color: "#ffffff", align: "center" })]), "Coin");

  put(text("WHO REALLY", { x: 60, y: 46, w: 800, size: 104, font: "Montserrat", weight: 900, color: INK, charSpacing: -10 }), "Title");
  put(text("PAYS?", { x: 60, y: 150, w: 800, size: 104, font: "Montserrat", weight: 900, color: ACCENT, charSpacing: -10 }), "Title accent");
}

// ---- (b) Before / after ------------------------------------------------------------------

async function beforeAfter(app) {
  const put = putter(app);
  app.editor.setBackground("#2b2f38");
  put(bleed(rect(0, 0, 640, 720, linear(160, ["#59606d", "#262a33"]))), "Before side");
  put(bleed(rect(640, 0, 640, 720, linear(160, ["#ffd84a", "#ff7a1a"]))), "After side");

  const base = 520;
  [118, 92, 104, 70].forEach((h, i) => put(rect(118 + i * 102, base - h, 70, h, "#7b8290", { rx: 10, ry: 10 }), "Bar"));
  put(line(96, base + 2, 544, base + 2, "#7b8290", 4), "Baseline");
  [150, 232, 318, 410].forEach((h, i) => put(rect(738 + i * 112, base - h, 78, h, "#ffffff",
    { rx: 12, ry: 12, shadow: shadow("rgba(120,50,0,0.28)", 18, 0, 8) }), "Bar"));
  put(curvedArrow(720, 388, 930, 330, 1176, 118, { color: "#1d1d1f", width: 16, head: 58, outline: "#ffffff" }), "Trend arrow");

  put(rect(632, 0, 16, 720, "#ffffff", { shadow: shadow("rgba(0,0,0,0.35)", 24) }), "Divider");
  put(group([
    circle(640, 300, 44, "#ffffff", { shadow: shadow("rgba(0,0,0,0.35)", 20, 0, 6) }),
    poly([[608, 300], [626, 286], [626, 314]], "#1d1d1f"),
    poly([[672, 300], [654, 286], [654, 314]], "#1d1d1f"),
  ]), "Slider handle");

  put(pill("BEFORE", { x: 320, y: 44, h: 64, size: 30, pad: 28, font: "Montserrat", weight: 900, fill: "#111111", center: true }), "Label");
  put(pill("AFTER", { x: 960, y: 44, h: 64, size: 30, pad: 28, font: "Montserrat", weight: 900, fill: "#ffffff", color: "#111111", center: true,
    shadowOf: shadow("rgba(120,50,0,0.3)", 16, 0, 6) }), "Label");
  put(text("30 DAYS LATER", { x: 40, y: 560, w: 1200, size: 124, font: "Anton", color: "#ffffff", align: "center",
    ...outlined("#000000", 18), shadow: shadow("rgba(0,0,0,0.55)", 0, 6, 10) }), "Title");
}

// ---- (c) Big number ----------------------------------------------------------------------

function coin(cx, cy, r, angle = 0) {
  return group([
    circle(cx, cy, r, "#ffbe1a", { stroke: "#a86a00", strokeWidth: r * 0.1, shadow: shadow("rgba(0,0,0,0.5)", 20, 0, 8) }),
    circle(cx, cy, r * 0.74, "#ffd23f", { stroke: "#e09a00", strokeWidth: r * 0.06 }),
    text("$", { x: cx - r, y: cy - r * 0.56, w: r * 2, size: r * 1.1, font: "Anton", color: "#b87400", align: "center" }),
  ], { angle });
}

async function bigNumber(app) {
  const put = putter(app);
  app.editor.setBackground(radial(["#33195c", "#120a24", "#07060d"], { cx: 0.5, cy: 0.55, r: 0.8 }));
  const rays = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, d = 0.07, R = 1000;
    rays.push(poly([[640, 380], [640 + Math.cos(a - d) * R, 380 + Math.sin(a - d) * R], [640 + Math.cos(a + d) * R, 380 + Math.sin(a + d) * R]],
      "rgba(255, 214, 80, 0.06)"));
  }
  put(group(rays), "Light rays");
  put(ellipse(640, 392, 560, 200, radial(["rgba(255,196,40,0.42)", "rgba(255,196,40,0)"])), "Glow");
  put(coin(150, 560, 74, -14), "Coin");
  put(coin(1138, 600, 92, 12), "Coin");
  put(coin(1150, 136, 54, 18), "Coin");
  put(coin(178, 132, 40, -8), "Coin");

  put(text("HOW I MADE", { x: 140, y: 92, w: 1000, size: 66, font: "Montserrat", weight: 900, color: "#ffffff", align: "center",
    charSpacing: 80, shadow: shadow("rgba(0,0,0,0.6)", 12, 0, 4) }), "Kicker");
  put(text("$1,000,000", { x: 20, y: 186, w: 1240, size: 240, font: "Anton", align: "center",
    fill: linear(180, ["#fff59a", [0.45, "#ffd400"], [1, "#ff9d00"]]),
    ...outlined("#000000", 22), shadow: shadow("rgba(0,0,0,0.75)", 0, 10, 14) }), "Big number");
  const tag = group([
    rect(380, 520, 520, 92, "#ff2d2d", { rx: 14, ry: 14, shadow: shadow("rgba(0,0,0,0.5)", 18, 0, 8) }),
    text("IN 12 MONTHS", { x: 380, y: 538, w: 520, size: 58, font: "Montserrat", weight: 900, color: "#ffffff", align: "center", charSpacing: 30 }),
  ], { angle: -3 });
  put(tag, "Tag");
}

// ---- (d) Reaction ------------------------------------------------------------------------

async function reaction(app) {
  const put = putter(app);
  app.editor.setBackground(linear(125, ["#0a1a5c", "#1747ff", "#3d8bff"]));
  put(bleed(rect(0, 0, 1280, 720, radial(["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"], { cx: 0.26, cy: 0.6, r: 0.5 }))), "Light");
  put(circle(330, 432, 300, radial(["#8fb0ff", "#4a6cf0"], { cy: 0.4, r: 0.7 }), { stroke: "#ffffff", strokeWidth: 14,
    shadow: shadow("rgba(0,0,20,0.5)", 40, 0, 14), name: "Photo placeholder" }), "Photo placeholder");
  put(silhouette(330, 732, 430, "rgba(255,255,255,0.3)"), "Photo silhouette");
  put(slotLabel(330, 650, { label: "YOUR PHOTO", size: 28 }), "Photo label");

  const title = "THIS\nCHANGES\nEVERYTHING";
  put(text(title, { x: 636, y: 58, w: 610, size: 126, font: "Anton", color: "#ffffff", lineHeight: 0.98,
    styles: lineStyle(title, 1, { fill: "#ffe14d" }), ...outlined("#000000", 18), shadow: shadow("rgba(0,0,0,0.55)", 0, 8, 10) }), "Title");

  put(rect(986, 532, 112, 112, "rgba(255,255,255,0.16)", { rx: 18, ry: 18, stroke: "rgba(255,255,255,0.55)", strokeWidth: 3 }), "Mystery item");
  put(text("?", { x: 986, y: 538, w: 112, size: 96, font: "Anton", color: "#ffffff", align: "center" }), "Mystery mark");
  put(circle(1042, 588, 104, "", { fill: null, stroke: "#ff2121", strokeWidth: 15, shadow: shadow("rgba(0,0,0,0.45)", 14, 0, 4) }), "Circle highlight");
  put(curvedArrow(690, 474, 720, 640, 922, 600, { color: "#ff2121", width: 22, head: 62, outline: "#ffffff" }), "Red arrow");
}

// ---- (e) Versus ----------------------------------------------------------------------------

function imageSlot(x, y, w, h, label = "YOUR IMAGE") {
  return group([
    rect(x, y, w, h, "rgba(255,255,255,0.12)", { rx: 36, ry: 36, stroke: "rgba(255,255,255,0.75)", strokeWidth: 4, strokeDashArray: [16, 12] }),
    slotLabel(x + w / 2, y + h / 2, { label, size: 24 }),
  ]);
}

async function versus(app) {
  const put = putter(app);
  app.editor.setBackground("#111111");
  put(bleed(poly([[0, 0], [702, 0], [578, 720], [0, 720]], linear(135, ["#ff5a4d", "#b8001f"]))), "Side A");
  put(bleed(poly([[702, 0], [1280, 0], [1280, 720], [578, 720]], linear(135, ["#3d86ff", "#0a2a8f"]))), "Side B");
  put(text("A", { x: 40, y: 40, w: 560, size: 700, font: "Anton", color: "rgba(255,255,255,0.07)", align: "center" }), "Big letter");
  put(text("B", { x: 690, y: 40, w: 560, size: 700, font: "Anton", color: "rgba(255,255,255,0.07)", align: "center" }), "Big letter");
  put(bleed(poly([[690, 0], [714, 0], [590, 720], [566, 720]], "#ffffff")), "Split line");

  const head = { size: 104, font: "Anton", color: "#ffffff", align: "center", ...outlined("#000000", 14), shadow: shadow("rgba(0,0,0,0.5)", 0, 6, 8) };
  put(text("BUDGET", { x: 30, y: 36, w: 560, ...head }), "Name A");
  put(text("LUXURY", { x: 690, y: 36, w: 560, ...head }), "Name B");
  put(imageSlot(150, 190, 300, 300), "Image placeholder A");
  put(imageSlot(830, 190, 300, 300), "Image placeholder B");
  const price = { size: 112, font: "Anton", color: "#ffe14d", align: "center", ...outlined("#000000", 14), shadow: shadow("rgba(0,0,0,0.5)", 0, 6, 8) };
  put(text("$9", { x: 30, y: 528, w: 560, ...price }), "Price A");
  put(text("$900", { x: 690, y: 528, w: 560, ...price }), "Price B");

  put(burst(640, 360, 138, 108, 14, "#ffffff", { shadow: shadow("rgba(0,0,0,0.45)", 24, 0, 8) }), "Badge burst");
  put(circle(640, 360, 94, "#ffd400", { stroke: "#111111", strokeWidth: 12 }), "VS badge");
  put(text("VS", { x: 540, y: 300, w: 200, size: 112, font: "Anton", color: "#111111", align: "center", skewX: -8 }), "VS");
}

// ---- (f) Dark cinematic documentary ---------------------------------------------------------

async function documentary(app) {
  const put = putter(app);
  const GOLD = "#c9a86a";
  app.editor.setBackground(linear(180, ["#0b0910", [0.5, "#24170f"], [1, "#5a3518"]]));
  put(bleed(ellipse(640, 560, 820, 360, radial(["rgba(255,186,110,0.95)", [0.35, "rgba(235,120,50,0.45)"], [1, "rgba(0,0,0,0)"]]))), "Horizon glow");
  put(bleed(path("M -20 740 L -20 560 L 120 520 L 230 548 L 380 470 L 470 505 L 560 452 L 700 530 L 820 488 L 940 540 L 1060 498 L 1180 540 L 1300 512 L 1300 740 Z",
    { fill: "#2a1a10" })), "Far ridge");
  put(bleed(path("M -20 740 L -20 612 C 160 590 300 600 460 574 C 560 558 610 560 660 566 C 760 580 900 620 1300 602 L 1300 740 Z",
    { fill: "#070504" })), "Near ridge");
  put(group([
    rect(636, 528, 10, 34, "#070504", { rx: 4, ry: 4 }),
    circle(641, 520, 7, "#070504"),
    line(646, 534, 664, 512, "#070504", 3),
  ]), "Lone figure");
  put(bleed(rect(0, 0, 1280, 720, radial([[0.5, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.8)"]], { r: 0.75 }))), "Vignette");
  put(bleed(rect(0, 0, 1280, 56, "#000000")), "Letterbox");
  put(bleed(rect(0, 664, 1280, 56, "#000000")), "Letterbox");

  put(text("A DOCUMENTARY", { x: 240, y: 198, w: 800, size: 19, font: "Inter", weight: 600, color: GOLD, align: "center", charSpacing: 640 }), "Label");
  put(line(580, 244, 700, 244, GOLD, 2), "Thin rule");
  put(text("THE LAST EMPIRE", { x: 40, y: 270, w: 1200, size: 88, font: "DM Serif Display", color: "#f3eadb", align: "center",
    charSpacing: 160, shadow: shadow("rgba(255,170,90,0.28)", 30) }), "Title");
  put(text("EPISODE 1  ·  THE FALL", { x: 240, y: 392, w: 800, size: 20, font: "Inter", weight: 500, color: "#d8ccb6", align: "center", charSpacing: 420 }), "Subtitle");
  put(text("EP. 01", { x: 56, y: 82, w: 200, size: 16, font: "Inter", weight: 700, color: "rgba(201,168,106,0.75)", charSpacing: 300 }), "Episode");
}

const THUMB = { size: "yt-thumb" };
export default [
  { ...THUMB, id: "paper-diorama", name: "Paper Diorama", tags: ["thumbnail", "youtube", "paper", "minimal", "story", "white"],
    fonts: [["Montserrat", 900], ["Inter", 800]], build: paperDiorama },
  { ...THUMB, id: "before-after", name: "Before & After", tags: ["thumbnail", "youtube", "before", "after", "split", "results"],
    fonts: [["Anton"], ["Montserrat", 900]], build: beforeAfter },
  { ...THUMB, id: "big-number", name: "Big Number", tags: ["thumbnail", "youtube", "money", "number", "dark", "gold"],
    fonts: [["Anton"], ["Montserrat", 900]], build: bigNumber },
  { ...THUMB, id: "reaction", name: "Reaction", tags: ["thumbnail", "youtube", "face", "arrow", "circle", "blue"],
    fonts: [["Anton"], ["Inter", 700]], build: reaction },
  { ...THUMB, id: "versus", name: "Versus", tags: ["thumbnail", "youtube", "vs", "compare", "split", "red", "blue"],
    fonts: [["Anton"], ["Inter", 700]], build: versus },
  { ...THUMB, id: "documentary", name: "Cinematic Documentary", tags: ["thumbnail", "youtube", "dark", "film", "serif", "history"],
    fonts: [["DM Serif Display"], ["Inter", 600], ["Inter", 500], ["Inter", 700]], build: documentary },
];
