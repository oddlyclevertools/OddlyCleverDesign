// Instagram templates: two posts, a matching 3-slide carousel and two stories.
import {
  arch, bleed, circle, ellipse, group, icon, linear, lineStyle, pill, poly, putter, radial,
  rect, shadow, sparkle, text,
} from "./ts-kit.js";

// ---- Swiss grid announcement (1080 x 1080) ------------------------------------------------

async function swissPost(app) {
  const put = putter(app);
  const INK = "#141414", RED = "#e8361f", GREY = "#77736b";
  app.editor.setBackground("#f1eee7");
  put(circle(880, 360, 250, RED), "Red circle");
  put(rect(60, 60, 960, 3, INK), "Top rule");
  put(text("No. 07", { x: 60, y: 82, w: 300, size: 26, font: "Inter", weight: 700, color: INK }), "Issue");
  put(text("DESIGN WEEK", { x: 620, y: 82, w: 400, size: 26, font: "Inter", weight: 700, color: INK, align: "right", charSpacing: 200 }), "Label");
  const head = "Form\nfollows\nfeeling.";
  put(text(head, { x: 52, y: 210, w: 900, size: 172, font: "Inter", weight: 900, color: INK, lineHeight: 0.86, charSpacing: -40,
    styles: lineStyle(head, 2, { fill: RED }) }), "Headline");
  put(rect(60, 800, 960, 3, INK), "Bottom rule");
  const cols = [
    ["WHEN", "12–14 May\n10:00–18:00"],
    ["WHERE", "Hall 3\nCity Arts Centre"],
    ["ENTRY", "Free for all\nBook a slot online"],
  ];
  cols.forEach(([k, v], i) => {
    put(text(k, { x: 60 + i * 330, y: 830, w: 300, size: 22, font: "Inter", weight: 800, color: RED, charSpacing: 200 }), `${k.toLowerCase()} label`);
    put(text(v, { x: 60 + i * 330, y: 872, w: 300, size: 32, font: "Inter", weight: 600, color: INK, lineHeight: 1.15 }), `${k.toLowerCase()} details`);
  });
  put(text("designweek.example", { x: 60, y: 1000, w: 600, size: 22, font: "Inter", weight: 600, color: GREY }), "Website");
  put(rect(990, 996, 30, 30, INK), "Square");
}

// ---- Retro 70s market (1080 x 1350) ------------------------------------------------------

async function retroPost(app) {
  const put = putter(app);
  const CREAM = "#f6e7c8", BROWN = "#5b2a12", ORANGE = "#e3672a", MUSTARD = "#f0b23a", TEAL = "#2c7a72", RUST = "#a8401c";
  app.editor.setBackground(CREAM);
  const bands = [[700, BROWN], [610, RUST], [520, ORANGE], [430, MUSTARD], [340, TEAL], [250, CREAM]];
  bands.forEach(([r, c]) => put(circle(540, 1390, r, c), "Rainbow band"));
  put(circle(540, 1390, 170, ORANGE), "Sun");
  put(sparkle(150, 160, 34, ORANGE), "Sparkle");
  put(sparkle(940, 250, 26, TEAL), "Sparkle");
  put(sparkle(900, 120, 16, MUSTARD), "Sparkle");
  put(text("EVERY SUNDAY  ·  9 AM – 2 PM", { x: 0, y: 110, w: 1080, size: 30, font: "Raleway", weight: 900, color: RUST, align: "center", charSpacing: 220 }), "When");
  put(text("Sunday\nMarket", { x: 0, y: 175, w: 1080, size: 190, font: "Titan One", color: BROWN, align: "center", lineHeight: 0.92,
    shadow: shadow(ORANGE, 0, 9, 9) }), "Title");
  put(text("vintage  ·  vinyl  ·  plants  ·  coffee", { x: 0, y: 610, w: 1080, size: 40, font: "Lora",
    fontStyle: "italic", color: BROWN, align: "center" }), "What");
  put(pill("THE OLD MILL YARD", { x: 540, y: 690, h: 74, size: 28, pad: 40, font: "Raleway", weight: 900, fill: BROWN, color: CREAM, spacing: 200, center: true }), "Venue");
}

// ---- Editorial carousel (3 slides, 1080 x 1350) -----------------------------------------

const ED = { BG: "#efe8dc", INK: "#1d1b18", ACC: "#c2502c", MUTED: "#7a7166" };

function carouselChrome(put, n) {
  put(text("THE SLOW ISSUE", { x: 80, y: 70, w: 500, size: 22, font: "Inter", weight: 800, color: ED.INK, charSpacing: 260 }), "Series");
  put(text(`0${n} / 03`, { x: 600, y: 70, w: 400, size: 22, font: "Inter", weight: 700, color: ED.MUTED, align: "right", charSpacing: 120 }), "Slide number");
  put(rect(80, 112, 920, 2, ED.INK), "Header rule");
  put(rect(80, 1236, 920, 2, ED.INK), "Footer rule");
  put(text("@yourhandle", { x: 80, y: 1262, w: 400, size: 24, font: "Inter", weight: 600, color: ED.MUTED }), "Handle");
  put(text(n < 3 ? "Swipe  →" : "Save for later", { x: 600, y: 1262, w: 400, size: 24, font: "Inter", weight: 700, color: ED.INK, align: "right" }), "Footer hint");
}

async function carousel1(app) {
  const put = putter(app);
  app.editor.setBackground(ED.BG);
  put(arch(600, 790, 380, 410, "#e6bd98"), "Arch");
  put(circle(790, 1000, 78, ED.ACC), "Sun");
  put(poly([[600, 1090], [680, 1056], [760, 1080], [850, 1040], [980, 1076], [980, 1200], [600, 1200]], "#d79b6f"), "Far hill");
  put(poly([[600, 1140], [720, 1110], [840, 1140], [980, 1118], [980, 1200], [600, 1200]], "#b9774d"), "Near hill");
  carouselChrome(put, 1);
  const head = "How to\nslow\ndown.";
  put(text(head, { x: 74, y: 170, w: 900, size: 210, font: "DM Serif Display", color: ED.INK, lineHeight: 0.9,
    styles: lineStyle(head, 1, { fill: ED.ACC, fontStyle: "italic" }) }), "Headline");
  put(text("Three small habits for calmer, clearer weeks.", { x: 80, y: 900, w: 440, size: 38, font: "Inter", weight: 500,
    color: ED.INK, lineHeight: 1.25 }), "Subtitle");
  put(text("A 3-part guide", { x: 80, y: 1150, w: 400, size: 26, font: "Inter", weight: 800, color: ED.ACC, charSpacing: 120 }), "Kicker");
}

function tip(put, y, num, title, body) {
  put(text(num, { x: 80, y, w: 260, size: 150, font: "Playfair Display", weight: 900, color: ED.ACC, lineHeight: 0.9 }), `Tip ${num} number`);
  const t = put(text(title, { x: 330, y: y + 14, w: 640, size: 64, font: "DM Serif Display", color: ED.INK, lineHeight: 1.04 }), `Tip ${num} title`);
  put(text(body, { x: 330, y: y + 14 + t.height + 28, w: 620, size: 32, font: "Inter", weight: 400, color: ED.MUTED, lineHeight: 1.4 }), `Tip ${num} text`);
}

async function carousel2(app) {
  const put = putter(app);
  app.editor.setBackground(ED.BG);
  carouselChrome(put, 2);
  tip(put, 200, "01", "Begin without your phone.", "Give the first twenty minutes of the day to light, water and a slow breakfast.");
  put(rect(80, 690, 920, 2, "rgba(29,27,24,0.18)"), "Divider");
  tip(put, 750, "02", "Do one thing at a time.", "Close the other tabs. Finish the task in front of you, then choose the next.");
}

async function carousel3(app) {
  const put = putter(app);
  app.editor.setBackground(ED.BG);
  carouselChrome(put, 3);
  tip(put, 200, "03", "Leave space in the week.", "Book an empty hour each day. Use it to think, walk, or simply catch up.");
  put(rect(80, 760, 920, 400, ED.INK, { rx: 28, ry: 28 }), "Card");
  put(text("Try one this week.", { x: 140, y: 820, w: 800, size: 84, font: "DM Serif Display", color: "#f6efe3", lineHeight: 1 }), "Call to action");
  put(text("Pick a habit, write it down, and tell a friend. Small changes last longer.", { x: 140, y: 935, w: 640, size: 32,
    font: "Inter", weight: 400, color: "rgba(246,239,227,0.72)", lineHeight: 1.35 }), "Call to action text");
  put(circle(880, 1080, 46, ED.ACC), "Button");
  put(icon("arrow", 880, 1080, 44, { stroke: "#ffffff", weight: 2.4 }), "Arrow icon");
}

// ---- Y2K chrome story (1080 x 1920) ------------------------------------------------------

const CHROME = ["#ffffff", [0.22, "#c9d1e3"], [0.45, "#6b7590"], [0.55, "#f4f7ff"], [0.78, "#9aa4bd"], [1, "#e9eef9"]];

async function y2kStory(app) {
  const put = putter(app);
  const NAVY = "#1b1f3b";
  app.editor.setBackground(linear(160, ["#c9b8ff", [0.45, "#f3c6ef"], [1, "#a8e6ff"]]));
  put(bleed(circle(900, 300, 560, radial(["rgba(255,255,255,0.75)", "rgba(255,255,255,0)"]))), "Glow");
  put(bleed(circle(120, 1600, 520, radial(["rgba(140,240,255,0.7)", "rgba(140,240,255,0)"]))), "Glow");
  // Orbit rings
  put(ellipse(540, 860, 470, 150, null, { stroke: "rgba(27,31,59,0.35)", strokeWidth: 3, angle: -14 }), "Orbit");
  put(ellipse(540, 860, 400, 110, null, { stroke: "rgba(255,255,255,0.9)", strokeWidth: 3, angle: 12 }), "Orbit");
  // Chrome stars
  const chromeStar = (cx, cy, r, name) => put(sparkle(cx, cy, r, linear(135, CHROME), { stroke: NAVY, strokeWidth: 4,
    shadow: shadow("rgba(27,31,59,0.35)", 20, 6, 10) }), name);
  chromeStar(860, 330, 120, "Chrome star");
  chromeStar(180, 1180, 80, "Chrome star");
  chromeStar(930, 1360, 48, "Chrome star");
  chromeStar(220, 420, 36, "Chrome star");

  put(pill("★ COLLECTION 02", { x: 540, y: 230, h: 70, size: 26, pad: 32, font: "Inter", weight: 800, fill: NAVY, color: "#ffffff", spacing: 220, center: true }), "Tag");
  put(text("NEW\nDROP", { x: 0, y: 560, w: 1080, size: 300, font: "Bungee", align: "center", lineHeight: 0.92,
    fill: linear(180, CHROME), stroke: NAVY, strokeWidth: 7, paintFirst: "stroke", strokeLineJoin: "round",
    shadow: shadow("rgba(27,31,59,0.4)", 0, 10, 16) }), "Title");
  put(text("FRIDAY · 8 PM", { x: 0, y: 1260, w: 1080, size: 64, font: "Russo One", color: NAVY, align: "center", charSpacing: 120 }), "Date");
  put(text("only 200 pieces  ✦  no restocks", { x: 0, y: 1350, w: 1080, size: 36, font: "Inter", weight: 600,
    color: "rgba(27,31,59,0.75)", align: "center" }), "Details");
  put(group([
    rect(290, 1600, 500, 110, NAVY, { rx: 55, ry: 55, shadow: shadow("rgba(27,31,59,0.35)", 30, 0, 12) }),
    text("SET A REMINDER", { x: 290, y: 1640, w: 500, size: 32, font: "Inter", weight: 800, color: "#ffffff", align: "center", charSpacing: 160 }),
  ]), "Button");
}

// ---- Soft pastel checklist story (1080 x 1920) ------------------------------------------

async function pastelStory(app) {
  const put = putter(app);
  const INK = "#3c3346", PLUM = "#8f6bb3";
  app.editor.setBackground(linear(180, ["#fde8df", [1, "#efe4fb"]]));
  put(bleed(circle(940, 220, 300, "#f9cfd8")), "Soft blob");
  put(bleed(circle(120, 1740, 340, "#d6f0e4")), "Soft blob");
  put(circle(160, 380, 90, "#e4d8fb"), "Soft blob");
  put(sparkle(900, 640, 30, "#ffffff"), "Sparkle");
  put(sparkle(150, 1520, 22, "#ffffff"), "Sparkle");
  put(text("Sunday", { x: 0, y: 240, w: 1080, size: 100, font: "Dancing Script", weight: 700, color: PLUM, align: "center" }), "Script");
  put(text("RESET LIST", { x: 0, y: 350, w: 1080, size: 132, font: "Fredoka", weight: 700, color: INK, align: "center", charSpacing: 40 }), "Title");
  put(rect(110, 560, 860, 960, "#ffffff", { rx: 48, ry: 48, shadow: shadow("rgba(120,80,140,0.18)", 60, 0, 24) }), "Card");
  const items = ["Drink a big glass of water", "Tidy one small corner", "Step outside for ten minutes", "Plan three things for Monday", "Go to bed a little earlier"];
  const tints = ["#fbd3dc", "#d8ecff", "#d6f0e4", "#fde3c4", "#e4d8fb"];
  items.forEach((s, i) => {
    const y = 640 + i * 170;
    put(rect(180, y, 84, 84, tints[i], { rx: 24, ry: 24 }), "Checkbox");
    if (i < 2) put(icon("check", 222, y + 42, 54, { stroke: INK, weight: 2.6 }), "Tick");
    put(text(s, { x: 300, y: y + 20, w: 620, size: 42, font: "Nunito", weight: 700, color: INK }), `Item ${i + 1}`);
  });
  put(text("you've got this ♡", { x: 0, y: 1600, w: 1080, size: 70, font: "Caveat", weight: 700, color: PLUM, align: "center" }), "Sign-off");
  put(text("@yourhandle", { x: 0, y: 1740, w: 1080, size: 30, font: "Nunito", weight: 700, color: "rgba(60,51,70,0.6)", align: "center" }), "Handle");
}

export default [
  { id: "ts-ig-swiss", name: "Swiss Grid Event", size: "ig-post", tags: ["instagram", "event", "minimal", "swiss", "grid", "announcement"],
    fonts: [["Inter", 900], ["Inter", 800], ["Inter", 700], ["Inter", 600]], build: swissPost },
  { id: "ts-ig-retro", name: "70s Sunday Market", size: "ig-portrait", tags: ["instagram", "retro", "70s", "market", "rainbow", "portrait"],
    fonts: [["Titan One"], ["Raleway", 900], ["Lora", 400, "italic"]], build: retroPost },
  { id: "ts-carousel-1", name: "Slow Guide · Cover", size: "ig-carousel", tags: ["instagram", "carousel", "editorial", "guide", "cover", "set"],
    fonts: [["DM Serif Display"], ["DM Serif Display", 400, "italic"], ["Inter", 500], ["Inter", 800], ["Inter", 700], ["Inter", 600]], build: carousel1 },
  { id: "ts-carousel-2", name: "Slow Guide · Tips", size: "ig-carousel", tags: ["instagram", "carousel", "editorial", "tips", "list", "set"],
    fonts: [["Playfair Display", 900], ["DM Serif Display"], ["Inter", 400], ["Inter", 800], ["Inter", 700], ["Inter", 600]], build: carousel2 },
  { id: "ts-carousel-3", name: "Slow Guide · Ending", size: "ig-carousel", tags: ["instagram", "carousel", "editorial", "call to action", "set"],
    fonts: [["Playfair Display", 900], ["DM Serif Display"], ["Inter", 400], ["Inter", 800], ["Inter", 700], ["Inter", 600]], build: carousel3 },
  { id: "ts-story-y2k", name: "Y2K Chrome Drop", size: "ig-story", tags: ["story", "instagram", "y2k", "chrome", "launch", "fashion"],
    fonts: [["Bungee"], ["Russo One"], ["Inter", 800], ["Inter", 600]], build: y2kStory },
  { id: "ts-story-pastel", name: "Pastel Reset List", size: "ig-story", tags: ["story", "instagram", "pastel", "checklist", "self care", "cute"],
    fonts: [["Dancing Script", 700], ["Fredoka", 700], ["Nunito", 700], ["Caveat", 700]], build: pastelStory },
];
