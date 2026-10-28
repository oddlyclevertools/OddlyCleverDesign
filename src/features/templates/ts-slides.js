// A matching 6-slide presentation set (1920 x 1080): title, section, bullets, big stat, quote, thank you.
// One system: ink / coral / cream, Space Grotesk headings with Inter body, the same footer on every slide.
import { bleed, circle, icon, putter, rect, ring, stripes, text } from "./ts-kit.js";

const C = { INK: "#14161f", CORAL: "#ff6b4a", CREAM: "#f4efe6", SAND: "#e6dac6", MUTED_D: "#9095a3", MUTED_L: "#6f695f" };
const HEAD = "Space Grotesk";

/** The logo, footer rule, deck name and page number every slide shares. */
function chrome(put, n, dark) {
  const ink = dark ? C.CREAM : C.INK, muted = dark ? C.MUTED_D : C.MUTED_L;
  put(circle(132, 92, 12, C.CORAL), "Logo mark");
  put(text("NORTHWIND", { x: 156, y: 81, w: 400, size: 22, font: "Inter", weight: 800, color: ink, charSpacing: 300 }), "Logo");
  put(rect(120, 990, 1680, 2, dark ? "rgba(244,239,230,0.18)" : "rgba(20,22,31,0.15)"), "Footer rule");
  put(text("Q3 Review  ·  Northwind Studio", { x: 120, y: 1012, w: 800, size: 22, font: "Inter", weight: 600, color: muted }), "Footer");
  put(text(String(n).padStart(2, "0"), { x: 1500, y: 1012, w: 300, size: 22, font: "Inter", weight: 800, color: ink, align: "right" }), "Page number");
}

async function slideTitle(app) {
  const put = putter(app);
  app.editor.setBackground(C.INK);
  put(circle(1520, 420, 250, C.CORAL), "Coral circle");
  put(rect(1240, 560, 330, 360, C.SAND, { rx: 0, ry: 0 }), "Sand block");
  put(stripes(1240, 560, 330, 360, 28, "rgba(20,22,31,0.18)", 6), "Stripes");
  put(ring(1700, 820, 92, C.CREAM, 6), "Ring");
  chrome(put, 1, true);
  put(text("Q3 2026  ·  QUARTERLY REVIEW", { x: 120, y: 300, w: 900, size: 28, font: "Inter", weight: 800, color: C.CORAL, charSpacing: 260 }), "Kicker");
  const head = "Building\nmomentum.";
  put(text(head, { x: 112, y: 360, w: 1100, size: 176, font: HEAD, weight: 700, color: C.CREAM, lineHeight: 0.95, charSpacing: -30 }), "Title");
  put(text("Product, growth and what comes next.", { x: 120, y: 780, w: 1000, size: 40, font: "Inter", weight: 400, color: C.MUTED_D }), "Subtitle");
}

async function slideSection(app) {
  const put = putter(app);
  app.editor.setBackground(C.CORAL);
  put(text("02", { x: 820, y: 130, w: 1000, size: 640, font: HEAD, weight: 700, align: "right", charSpacing: -40,
    fill: "rgba(0,0,0,0)", stroke: C.INK, strokeWidth: 5 }), "Section number");
  chrome(put, 2, false);
  put(text("SECTION TWO", { x: 120, y: 360, w: 600, size: 26, font: "Inter", weight: 800, color: C.INK, charSpacing: 300 }), "Kicker");
  put(text("What we\nshipped", { x: 112, y: 410, w: 900, size: 150, font: HEAD, weight: 700, color: C.INK, lineHeight: 0.95, charSpacing: -20 }), "Section title");
  put(text("Six releases, two big bets and one rebuild.", { x: 120, y: 790, w: 760, size: 38, font: "Inter", weight: 400, color: "rgba(20,22,31,0.75)" }), "Section text");
}

async function slideBullets(app) {
  const put = putter(app);
  app.editor.setBackground(C.CREAM);
  chrome(put, 3, false);
  put(text("Three things\nthat worked", { x: 112, y: 190, w: 640, size: 92, font: HEAD, weight: 700, color: C.INK, lineHeight: 1, charSpacing: -20 }), "Title");
  put(rect(120, 430, 90, 8, C.CORAL), "Accent");
  put(text("What moved the numbers this quarter, and why we will keep doing it.", { x: 120, y: 480, w: 560, size: 32,
    font: "Inter", weight: 400, color: C.MUTED_L, lineHeight: 1.4 }), "Intro");
  const rows = [
    ["A faster first week", "The new onboarding cut setup time from two days to forty minutes."],
    ["Fewer, better emails", "We sent half as many messages and doubled the click rate."],
    ["Support inside the app", "Help is one click away, so tickets dropped by a third."],
  ];
  rows.forEach(([t, d], i) => {
    const y = 190 + i * 250;
    if (i) put(rect(860, y - 40, 940, 2, "rgba(20,22,31,0.12)"), "Row divider");
    put(circle(900, y + 40, 40, C.INK), `Point ${i + 1} badge`);
    put(text(String(i + 1), { x: 860, y: y + 18, w: 80, size: 40, font: HEAD, weight: 700, color: C.CORAL, align: "center" }), `Point ${i + 1} number`);
    put(text(t, { x: 980, y: y + 4, w: 820, size: 46, font: "Inter", weight: 800, color: C.INK }), `Point ${i + 1} title`);
    put(text(d, { x: 980, y: y + 70, w: 780, size: 30, font: "Inter", weight: 400, color: C.MUTED_L, lineHeight: 1.35 }), `Point ${i + 1} text`);
  });
}

async function slideStat(app) {
  const put = putter(app);
  app.editor.setBackground(C.INK);
  chrome(put, 4, true);
  put(text("WEEKLY ACTIVE USERS", { x: 120, y: 240, w: 800, size: 26, font: "Inter", weight: 800, color: C.MUTED_D, charSpacing: 300 }), "Kicker");
  put(text("3.4×", { x: 104, y: 270, w: 900, size: 360, font: HEAD, weight: 700, color: C.CORAL, charSpacing: -40 }), "Big number");
  put(text("more people use the app every week than at this time last year.", { x: 120, y: 700, w: 760, size: 46,
    font: "Inter", weight: 600, color: C.CREAM, lineHeight: 1.25 }), "Caption");
  const data = [["Q3 '25", 21], ["Q4 '25", 30], ["Q1 '26", 44], ["Q2 '26", 58], ["Q3 '26", 72]];
  const base = 880, x0 = 1060, bw = 110, gap = 40, k = 8;
  data.forEach(([label, v], i) => {
    const x = x0 + i * (bw + gap), h = v * k, last = i === data.length - 1;
    put(rect(x, base - h, bw, h, last ? C.CORAL : "rgba(244,239,230,0.16)", { rx: 10, ry: 10 }), `Bar ${label}`);
    put(text(`${v}k`, { x: x - 20, y: base - h - 50, w: bw + 40, size: 30, font: "Inter", weight: 800, color: last ? C.CORAL : C.CREAM, align: "center" }), `Value ${label}`);
    put(text(label, { x: x - 20, y: base + 22, w: bw + 40, size: 24, font: "Inter", weight: 600, color: C.MUTED_D, align: "center" }), `Label ${label}`);
  });
}

async function slideQuote(app) {
  const put = putter(app);
  app.editor.setBackground(C.CREAM);
  put(bleed(rect(1700, 0, 220, 1080, C.SAND)), "Side band");
  chrome(put, 5, false);
  put(text("“", { x: 104, y: 120, w: 300, size: 340, font: "Lora", weight: 700, color: C.CORAL, lineHeight: 1 }), "Quote mark");
  put(text("The new onboarding is the first tool our whole team actually enjoys using.", { x: 120, y: 360, w: 1440, size: 78,
    font: "Lora", fontStyle: "italic", color: C.INK, lineHeight: 1.22 }), "Quote");
  put(circle(160, 810, 40, C.INK), "Avatar");
  put(text("PS", { x: 120, y: 794, w: 80, size: 30, font: "Inter", weight: 800, color: C.CREAM, align: "center" }), "Initials");
  put(text("Priya Shah", { x: 226, y: 778, w: 700, size: 34, font: "Inter", weight: 800, color: C.INK }), "Name");
  put(text("Head of Operations, Example Co.", { x: 226, y: 822, w: 800, size: 28, font: "Inter", weight: 400, color: C.MUTED_L }), "Role");
}

async function slideThanks(app) {
  const put = putter(app);
  app.editor.setBackground(C.INK);
  put(circle(1720, 300, 300, C.CORAL), "Coral circle");
  put(ring(1720, 300, 380, "rgba(244,239,230,0.25)", 3), "Ring");
  put(rect(1420, 640, 300, 300, C.SAND), "Sand block");
  put(stripes(1420, 640, 300, 300, 28, "rgba(20,22,31,0.18)", 6), "Stripes");
  chrome(put, 6, true);
  const head = "Thank you.";
  put(text(head, { x: 112, y: 300, w: 1300, size: 220, font: HEAD, weight: 700, color: C.CREAM, charSpacing: -40 }), "Title");
  put(text("Questions? We would love to hear them.", { x: 120, y: 580, w: 1100, size: 44, font: "Inter", weight: 400, color: C.MUTED_D }), "Subtitle");
  [["mail", "hello@northwind.example"], ["globe", "northwind.example"]].forEach(([ic, label], i) => {
    const y = 730 + i * 80;
    put(circle(150, y + 22, 32, C.CORAL), `${ic} badge`);
    put(icon(ic, 150, y + 22, 32, { stroke: C.INK, weight: 2 }), `${ic} icon`);
    put(text(label, { x: 200, y: y + 2, w: 900, size: 34, font: "Inter", weight: 600, color: C.CREAM }), `Contact ${i + 1}`);
  });
}

const FONTS = [[HEAD, 700], ["Inter", 800], ["Inter", 600], ["Inter", 400]];
const tags = (...t) => ["presentation", "slides", "deck", "business", "matching set", ...t];

export default [
  { id: "ts-slide-title", name: "Deck · Title", size: "presentation", category: "slides", tags: tags("title", "cover"), fonts: FONTS, build: slideTitle },
  { id: "ts-slide-section", name: "Deck · Section", size: "presentation", category: "slides", tags: tags("section", "divider"), fonts: FONTS, build: slideSection },
  { id: "ts-slide-bullets", name: "Deck · Key Points", size: "presentation", category: "slides", tags: tags("bullets", "list", "points"), fonts: FONTS, build: slideBullets },
  { id: "ts-slide-stat", name: "Deck · Big Number", size: "presentation", category: "slides", tags: tags("stat", "number", "chart"), fonts: FONTS, build: slideStat },
  { id: "ts-slide-quote", name: "Deck · Quote", size: "presentation", category: "slides", tags: tags("quote", "testimonial"),
    fonts: [...FONTS, ["Lora", 700], ["Lora", 400, "italic"]], build: slideQuote },
  { id: "ts-slide-thanks", name: "Deck · Thank You", size: "presentation", category: "slides", tags: tags("thank you", "end", "contact"), fonts: FONTS, build: slideThanks },
];
