// Print templates, part 1: business card, party and wedding invitations, certificate and menu.
import {
  bleed, burst, circle, ellipse, frame, group, icon, line, linear, ornament, path, poly, putter, rect, ring, seeded,
  shadow, star, text,
} from "./ts-kit.js";

const GOLD = ["#f7e4a3", [0.35, "#c9a24c"], [0.6, "#f2d88a"], [1, "#a77a2b"]];

// ---- Business card: luxury monogram (1050 x 600) ----------------------------------------

async function businessCard(app) {
  const put = putter(app);
  const SOFT = "#d9d2c3";
  app.editor.setBackground(linear(135, ["#17171a", [1, "#0b0b0d"]]));
  put(ring(230, 300, 138, linear(135, GOLD), 4), "Monogram ring");
  put(ring(230, 300, 124, "rgba(201,162,76,0.4)", 1.5), "Monogram inner ring");
  put(text("AM", { x: 90, y: 236, w: 280, size: 118, font: "DM Serif Display", align: "center", fill: linear(135, GOLD) }), "Monogram");
  put(rect(440, 120, 1.5, 360, "rgba(201,162,76,0.6)"), "Divider");
  put(text("Avery Morgan", { x: 500, y: 118, w: 520, size: 64, font: "DM Serif Display", color: "#ffffff" }), "Name");
  put(text("INTERIOR DESIGNER", { x: 502, y: 206, w: 500, size: 18, font: "Inter", weight: 700, color: "#c9a24c", charSpacing: 360 }), "Job title");
  const rows = [["phone", "+44 20 7946 0000"], ["mail", "avery@studio.example"], ["globe", "studio.example"], ["pin", "18 Lark Lane, London"]];
  rows.forEach(([ic, label], i) => {
    const y = 296 + i * 46;
    put(icon(ic, 512, y + 12, 22, { stroke: "#c9a24c", weight: 1.8 }), `${ic} icon`);
    put(text(label, { x: 540, y, w: 460, size: 22, font: "Inter", weight: 400, color: SOFT }), `Contact ${i + 1}`);
  });
}

// ---- Party invitation (1500 x 2100) ------------------------------------------------------

function balloon(cx, cy, r, color, tilt = 0) {
  const knotY = cy + r * 1.18;
  return group([
    path(`M ${cx} ${knotY + 14} C ${cx - 30} ${knotY + 120} ${cx + 40} ${knotY + 200} ${cx - 10} ${knotY + 330}`, { stroke: "rgba(60,40,70,0.5)", strokeWidth: 3 }),
    poly([[cx, knotY - 6], [cx + 14, knotY + 18], [cx - 14, knotY + 18]], color),
    ellipse(cx, cy, r, r * 1.2, color),
    ellipse(cx - r * 0.38, cy - r * 0.45, r * 0.18, r * 0.32, "rgba(255,255,255,0.45)", { angle: 28 }),
  ], { angle: tilt });
}

function confetti(w, h, n, colors, seed = 9, avoid = null) {
  const rnd = seeded(seed), bits = [];
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h;
    if (avoid && x > avoid.x && x < avoid.x + avoid.w && y > avoid.y && y < avoid.y + avoid.h) continue;
    const c = colors[i % colors.length];
    bits.push(i % 3 ? rect(x, y, 14 + rnd() * 10, 30 + rnd() * 16, c, { angle: rnd() * 180, rx: 4, ry: 4 }) : circle(x, y, 8 + rnd() * 8, c));
  }
  return group(bits);
}

async function partyInvite(app) {
  const put = putter(app);
  const INK = "#2d1b4e", PINK = "#ff5c8a", TEAL = "#1fb5a8", SUN = "#ffbf3c", LILAC = "#8a6cf0";
  app.editor.setBackground("#fff1e4");
  put(bleed(confetti(1500, 2100, 110, [PINK, TEAL, SUN, LILAC], 9, { x: 180, y: 760, w: 1140, h: 1200 })), "Confetti");
  put(balloon(540, 300, 130, TEAL, -8), "Balloon");
  put(balloon(960, 300, 130, SUN, 8), "Balloon");
  put(balloon(750, 230, 150, PINK, 0), "Balloon");
  put(text("you're invited to", { x: 0, y: 820, w: 1500, size: 100, font: "Caveat", weight: 700, color: LILAC, align: "center" }), "Intro");
  put(text("MAYA'S\n30TH", { x: 0, y: 930, w: 1500, size: 290, font: "Lilita One", color: PINK, align: "center", lineHeight: 0.9,
    shadow: shadow(INK, 0, 12, 12) }), "Title");
  put(text("birthday party!", { x: 0, y: 1500, w: 1500, size: 110, font: "Caveat", weight: 700, color: INK, align: "center" }), "Subtitle");
  put(rect(250, 1680, 1000, 290, "#ffffff", { rx: 40, ry: 40, shadow: shadow("rgba(45,27,78,0.12)", 40, 0, 14) }), "Details card");
  put(text("SATURDAY 21 NOVEMBER  ·  7 PM", { x: 250, y: 1730, w: 1000, size: 46, font: "Nunito", weight: 900, color: INK, align: "center", charSpacing: 60 }), "Date");
  put(text("The Greenhouse, 12 Mill Lane", { x: 250, y: 1806, w: 1000, size: 44, font: "Nunito", weight: 700, color: INK, align: "center" }), "Place");
  put(text("RSVP to Sam by 10 Nov  ·  07700 900123", { x: 250, y: 1880, w: 1000, size: 36, font: "Nunito", weight: 700, color: "#8a7f99", align: "center" }), "RSVP");
}

// ---- Wedding invitation (1500 x 2100) ----------------------------------------------------

function sprig(x, y, len, angle, color) {
  const parts = [path(`M 0 0 Q ${len * 0.15} ${-len * 0.5} 0 ${-len}`, { stroke: color, strokeWidth: 3 })];
  for (let i = 1; i <= 6; i++) {
    const t = i / 7, py = -len * t, px = Math.sin(t * Math.PI) * len * 0.07;
    const s = 1 - t * 0.45;
    parts.push(ellipse(px - 24 * s, py, 11 * s, 26 * s, color, { angle: -55 }), ellipse(px + 24 * s, py - 10, 11 * s, 26 * s, color, { angle: 55 }));
  }
  parts.push(ellipse(0, -len - 16, 10, 22, color));
  const g = group(parts);
  g.set({ originX: "center", originY: "bottom", left: x, top: y, angle });
  return g;
}

async function weddingInvite(app) {
  const put = putter(app);
  const INK = "#3b352c", GOLDC = "#b08a3e", SAGE = "#8d9c7f";
  app.editor.setBackground("#f8f4ec");
  put(bleed(frame(70, 70, 1360, 1960, GOLDC, 3)), "Outer frame");
  put(bleed(frame(92, 92, 1316, 1916, "rgba(176,138,62,0.5)", 1.5)), "Inner frame");
  put(sprig(700, 420, 240, -32, SAGE), "Leaf sprig");
  put(sprig(800, 420, 240, 32, SAGE), "Leaf sprig");
  put(circle(750, 400, 10, GOLDC), "Bud");
  put(text("TOGETHER WITH THEIR FAMILIES", { x: 0, y: 520, w: 1500, size: 30, font: "Raleway", weight: 700, color: INK, align: "center", charSpacing: 400 }), "Intro");
  put(text("Olivia", { x: 0, y: 600, w: 1500, size: 220, font: "Dancing Script", weight: 700, color: INK, align: "center" }), "Name 1");
  put(text("&", { x: 0, y: 840, w: 1500, size: 130, font: "Playfair Display", fontStyle: "italic", color: GOLDC, align: "center" }), "Ampersand");
  put(text("James", { x: 0, y: 960, w: 1500, size: 220, font: "Dancing Script", weight: 700, color: INK, align: "center" }), "Name 2");
  put(text("REQUEST THE PLEASURE OF YOUR COMPANY\nAT THE CELEBRATION OF THEIR MARRIAGE", { x: 150, y: 1290, w: 1200, size: 30, font: "Raleway", weight: 700,
    color: INK, align: "center", charSpacing: 300, lineHeight: 1.6 }), "Request");
  put(ornament(750, 1450, 200, GOLDC, 2), "Ornament");
  put(text("Saturday, 5 June 2027", { x: 0, y: 1510, w: 1500, size: 70, font: "Playfair Display", color: INK, align: "center" }), "Date");
  put(text("at four o'clock in the afternoon", { x: 0, y: 1610, w: 1500, size: 44, font: "Lora", fontStyle: "italic", color: INK, align: "center" }), "Time");
  put(text("THE ORANGERY  ·  ELM HOUSE ESTATE", { x: 0, y: 1720, w: 1500, size: 32, font: "Raleway", weight: 700, color: GOLDC, align: "center", charSpacing: 300 }), "Venue");
  put(text("Dinner and dancing to follow", { x: 0, y: 1800, w: 1500, size: 38, font: "Lora", fontStyle: "italic", color: "#7a7164", align: "center" }), "Reception");
}

// ---- Certificate (3300 x 2550) -----------------------------------------------------------

function seal(cx, cy) {
  return group([
    poly([[cx - 150, cy + 120], [cx - 40, cy + 120], [cx - 70, cy + 470], [cx - 130, cy + 410], [cx - 200, cy + 450]], "#1f2f57"),
    poly([[cx + 150, cy + 120], [cx + 40, cy + 120], [cx + 70, cy + 470], [cx + 130, cy + 410], [cx + 200, cy + 450]], "#1f2f57"),
    burst(cx, cy, 240, 214, 36, linear(135, GOLD), { shadow: shadow("rgba(60,40,10,0.3)", 30, 0, 10) }),
    circle(cx, cy, 186, "#1f2f57"),
    ring(cx, cy, 166, "#d8b65e", 5),
    star(cx, cy - 30, 64, "#e9cd7c"),
    text("2026", { x: cx - 150, y: cy + 56, w: 300, size: 54, font: "Playfair Display", weight: 700, color: "#e9cd7c", align: "center", charSpacing: 200 }),
  ]);
}

async function certificate(app) {
  const put = putter(app);
  const NAVY = "#1f2f57", GOLDC = "#b48c3c", INK = "#2b2b33";
  app.editor.setBackground("#fbf8f1");
  put(bleed(frame(80, 80, 3140, 2390, NAVY, 28)), "Border");
  put(bleed(frame(150, 150, 3000, 2250, GOLDC, 5)), "Gold line");
  [[150, 150], [3150, 150], [150, 2400], [3150, 2400]].forEach(([x, y]) => put(poly([[x, y - 40], [x + 40, y], [x, y + 40], [x - 40, y]], GOLDC), "Corner ornament"));
  put(text("CERTIFICATE", { x: 0, y: 360, w: 3300, size: 230, font: "Playfair Display", weight: 900, color: NAVY, align: "center", charSpacing: 300 }), "Title");
  put(text("OF ACHIEVEMENT", { x: 0, y: 650, w: 3300, size: 72, font: "Raleway", weight: 700, color: GOLDC, align: "center", charSpacing: 600 }), "Subtitle");
  put(ornament(1650, 820, 360, GOLDC, 4), "Ornament");
  put(text("This certificate is proudly presented to", { x: 0, y: 900, w: 3300, size: 70, font: "Lora", fontStyle: "italic", color: INK, align: "center" }), "Presented to");
  put(text("Alex Rivera", { x: 0, y: 1020, w: 3300, size: 300, font: "Dancing Script", weight: 700, color: NAVY, align: "center" }), "Recipient");
  put(rect(1050, 1400, 1200, 4, GOLDC), "Name line");
  put(text("for outstanding work and leadership on the Spring Community Garden project, 2026.", { x: 750, y: 1470, w: 1800, size: 60,
    font: "Lora", color: INK, align: "center", lineHeight: 1.35 }), "Reason");
  const sig = (x, signature, nm, role) => {
    put(text(signature, { x, y: 1840, w: 800, size: 110, font: "Dancing Script", weight: 700, color: "#3a4a78", align: "center" }), `Signature ${nm}`);
    put(rect(x, 1990, 800, 4, INK), `Signature line ${nm}`);
    put(text(nm, { x, y: 2020, w: 800, size: 50, font: "Raleway", weight: 700, color: INK, align: "center", charSpacing: 200 }), `Signer ${nm}`);
    put(text(role, { x, y: 2090, w: 800, size: 44, font: "Lora", fontStyle: "italic", color: "#6d6a63", align: "center" }), `Role ${nm}`);
  };
  sig(500, "Jamie Cole", "JAMIE COLE", "Programme Director");
  sig(2000, "12 May 2026", "DATE", "Awarded on");
  put(seal(1650, 1900), "Seal");
}

// ---- Menu (A4, 2480 x 3508) --------------------------------------------------------------

function oliveBranch(cx, cy, len, color, fruit) {
  const parts = [path(`M ${cx - len / 2} ${cy + 20} Q ${cx} ${cy - 30} ${cx + len / 2} ${cy + 20}`, { stroke: color, strokeWidth: 6 })];
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8, x = cx - len / 2 + len * t, y = cy + 20 - Math.sin(t * Math.PI) * 25;
    parts.push(ellipse(x, y + (i % 2 ? 28 : -28), 14, 42, color, { angle: i % 2 ? -50 : 50 }));
  }
  parts.push(ellipse(cx - len * 0.18, cy + 34, 20, 26, fruit), ellipse(cx + len * 0.22, cy + 30, 20, 26, fruit));
  return group(parts);
}

async function menu(app) {
  const put = putter(app);
  const GREEN = "#23402f", MUTED = "#6c6a5c", ACC = "#9b6a2f";
  app.editor.setBackground("#f4efe3");
  put(bleed(frame(110, 110, 2260, 3288, GREEN, 6)), "Border");
  put(text("Olive & Thyme", { x: 0, y: 250, w: 2480, size: 250, font: "Abril Fatface", color: GREEN, align: "center" }), "Restaurant name");
  put(text("KITCHEN  ·  WINE  ·  GARDEN", { x: 0, y: 560, w: 2480, size: 52, font: "Raleway", weight: 700, color: ACC, align: "center", charSpacing: 500 }), "Tagline");
  put(oliveBranch(1240, 680, 520, GREEN, "#6d7a3a"), "Olive branch");
  const sections = [
    ["Starters", 830, [["Burrata & peaches", "Basil oil, toasted almonds, sea salt", "9"], ["Crispy squid", "Lemon aioli, chilli, parsley", "10"], ["Soup of the day", "Ask your server, served with sourdough", "7"]]],
    ["Mains", 1580, [["Slow-cooked lamb", "White beans, rosemary, salsa verde", "24"], ["Wild mushroom risotto", "Parmesan, thyme, truffle butter", "18"], ["Market fish", "Crushed potatoes, capers, brown butter", "22"], ["Garden plate", "Roast vegetables, hummus, flatbread", "16"]]],
    ["Desserts", 2520, [["Olive oil cake", "Crème fraîche, poached pear", "8"], ["Dark chocolate pot", "Sea salt, hazelnut crumb", "8"], ["Cheese board", "Three cheeses, honey, crackers", "12"]]],
  ];
  sections.forEach(([title, y0, items]) => {
    put(text(title, { x: 0, y: y0, w: 2480, size: 110, font: "Lora", fontStyle: "italic", weight: 700, color: GREEN, align: "center" }), `${title} heading`);
    put(ornament(1240, y0 + 160, 180, ACC, 4), `${title} ornament`);
    items.forEach(([nm, desc, price], i) => {
      const y = y0 + 230 + i * 175;
      put(text(nm, { x: 300, y, w: 1500, size: 60, font: "Lora", weight: 700, color: GREEN }), `${nm}`);
      put(text(desc, { x: 300, y: y + 76, w: 1500, size: 42, font: "Raleway", weight: 400, color: MUTED }), `${nm} details`);
      put(text(price, { x: 1880, y, w: 300, size: 60, font: "Lora", weight: 700, color: ACC, align: "right" }), `${nm} price`);
    });
  });
  put(text("Please tell us about any allergies  ·  A 12.5% service charge is added to tables of six or more", { x: 200, y: 3270, w: 2080, size: 36,
    font: "Raleway", weight: 400, color: MUTED, align: "center" }), "Footer");
}

export default [
  { id: "ts-card-luxe", name: "Luxe Business Card", size: "business-card", category: "print", tags: ["business card", "luxury", "gold", "black", "monogram", "print"],
    fonts: [["DM Serif Display"], ["Inter", 700], ["Inter", 400]], build: businessCard },
  { id: "ts-invite-party", name: "Birthday Party Invite", size: "invitation", category: "print", tags: ["invitation", "party", "birthday", "balloons", "confetti", "fun"],
    fonts: [["Caveat", 700], ["Lilita One"], ["Nunito", 900], ["Nunito", 700]], build: partyInvite },
  { id: "ts-invite-wedding", name: "Botanical Wedding Invite", size: "invitation", category: "print", tags: ["invitation", "wedding", "elegant", "serif", "botanical", "gold"],
    fonts: [["Raleway", 700], ["Dancing Script", 700], ["Playfair Display", 400, "italic"], ["Playfair Display"], ["Lora", 400, "italic"]], build: weddingInvite },
  { id: "ts-certificate", name: "Classic Certificate", size: "certificate", category: "print", tags: ["certificate", "award", "achievement", "diploma", "classic", "navy"],
    fonts: [["Playfair Display", 900], ["Playfair Display", 700], ["Raleway", 700], ["Lora"], ["Lora", 400, "italic"], ["Dancing Script", 700]], build: certificate },
  { id: "ts-menu-bistro", name: "Bistro Menu", size: "menu", category: "print", tags: ["menu", "restaurant", "food", "bistro", "elegant", "a4"],
    fonts: [["Abril Fatface"], ["Raleway", 700], ["Raleway", 400], ["Lora", 700], ["Lora", 700, "italic"]], build: menu },
];
