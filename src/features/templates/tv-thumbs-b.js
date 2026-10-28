// Video pack, YouTube thumbnails part B (1280 x 720): podcast, room makeover, 30-day challenge,
// true crime, cooking, fitness, breaking news, minimal big word, Paper Diorama. All drawn in code.
import {
  actor, bleed, burst, circle, curvedArrow, ellipse, face, fx, group, line, linear, mic, path, pill,
  poly, putter, radial, rect, shadow, stripes, text, waveform,
} from "./tv-kit.js";

const INK = "#16121b";

// ---- 9. Podcast episode ----------------------------------------------------------------------

async function podcastEpisode(app) {
  const put = putter(app);
  const PINK = "#ff2e7e", GOLD = "#ffc83d";
  app.editor.setBackground("#0d0a10");
  put(bleed(rect(0, 0, 1280, 720, linear(180, ["#2a1530", [0.7, "#120c16"], [1, "#0d0a10"]]))), "Background");
  put(bleed(ellipse(640, 520, 700, 300, radial(["rgba(255,46,126,0.35)", [1, "rgba(255,46,126,0)"]]))), "Studio glow");
  put(waveform(380, 540, 520, 46, 150, "rgba(255,200,61,0.35)", 8), "Waveform");
  put(face(250, 450, 118, { mood: "smirk", shirt: "#2b2f3a", skin: "#f1b48c", hair: "#1b1210" }), "Host placeholder (swap for photo)");
  put(face(1030, 450, 118, { mood: "smile", shirt: "#7a2448", skin: "#c98a62", hair: "#3a2216" }), "Guest placeholder (swap for photo)");
  put(mic(640, 420, 0.95, { accent: PINK }), "Microphone");

  put(pill("EP. 42", { x: 640, y: 36, h: 52, size: 26, pad: 24, font: "Barlow Condensed", weight: 900, fill: GOLD, color: INK, center: true, spacing: 200 }), "Episode tag");
  put(text("WE WERE BROKE", { x: 40, y: 98, w: 1200, size: 132, font: "Barlow Condensed", weight: 900, color: "#ffffff", align: "center",
    ...fx({ shadow: { offset: 30, direction: 90, blur: 0, transparency: 0, color: "#000000" } }) }), "Title");
  put(text("at twenty-five", { x: 40, y: 226, w: 1200, size: 76, font: "DM Serif Display", fontStyle: "italic", color: PINK, align: "center",
    ...fx({ neon: { intensity: 30, tube: 0, color: PINK } }) }), "Title accent");
  put(pill("HOST", { x: 250, y: 650, h: 40, size: 18, pad: 18, fill: "rgba(255,255,255,0.12)", center: true, spacing: 260 }), "Name tag");
  put(pill("GUEST", { x: 1030, y: 650, h: 40, size: 18, pad: 18, fill: "rgba(255,255,255,0.12)", center: true, spacing: 260 }), "Name tag");
}

// ---- 10. Room makeover before / after ----------------------------------------------------

function room(x, w, p) {
  const parts = [
    rect(x, 0, w, 480, p.wall),
    rect(x, 480, w, 240, p.floor),
    rect(x, 474, w, 14, p.trim),
    rect(x + 56, 96, 170, 210, p.trim, { rx: 6, ry: 6 }),
    rect(x + 68, 108, 146, 186, p.sky),
    line(x + 141, 108, x + 141, 294, p.trim, 8),
    line(x + 68, 200, x + 214, 200, p.trim, 8),
    ellipse(x + 400, 600, 230, 54, p.rug),
    rect(x + 250, 300, 310, 100, p.sofa2, { rx: 26, ry: 26 }),
    rect(x + 236, 370, 338, 110, p.sofa, { rx: 22, ry: 22 }),
    rect(x + 220, 350, 52, 140, p.sofa2, { rx: 20, ry: 20 }),
    rect(x + 538, 350, 52, 140, p.sofa2, { rx: 20, ry: 20 }),
    rect(x + 250, 480, 16, 30, p.trim), rect(x + 544, 480, 16, 30, p.trim),
  ];
  const frameAngle = p.messy ? -9 : 0;
  parts.push(group([rect(x + 330, 150, 150, 110, p.trim, { rx: 4, ry: 4 }), rect(x + 342, 162, 126, 86, p.art)], { angle: frameAngle }));
  if (p.messy) {
    parts.push(rect(x + 70, 520, 120, 90, "#a39b8f", { stroke: "#6d665c", strokeWidth: 4 }));
    parts.push(rect(x + 110, 456, 100, 70, "#b6aea2", { stroke: "#6d665c", strokeWidth: 4, angle: 8 }));
    parts.push(line(x + 70, 565, x + 190, 565, "#6d665c", 4));
    parts.push(path(`M ${x + 380} 640 q 30 -20 60 0 q 30 20 60 0`, { stroke: "#8b857c", strokeWidth: 8 }));
  } else {
    parts.push(rect(x + 62, 470, 64, 70, "#e86a3c", { rx: 10, ry: 10 }));
    for (const [dx, dy, a] of [[-30, -60, -30], [24, -70, 25], [-4, -96, 0], [-44, -20, -60], [40, -26, 55]]) {
      parts.push(ellipse(x + 94 + dx, 470 + dy, 22, 46, "#2f9e5b", { angle: a }));
    }
    parts.push(line(x + 600, 250, x + 600, 480, "#2b2b2b", 6));
    parts.push(poly([[x + 560, 250], [x + 640, 250], [x + 620, 190], [x + 580, 190]], "#ffd36b"));
    parts.push(ellipse(x + 600, 290, 90, 60, radial(["rgba(255,220,120,0.5)", [1, "rgba(255,220,120,0)"]])));
  }
  return group(parts);
}

async function roomMakeover(app) {
  const put = putter(app);
  app.editor.setBackground("#cfcac2");
  put(bleed(room(0, 640, { wall: "#b9b4ac", floor: "#8f8a82", trim: "#e2ded7", sky: "#a8b0b6", sofa: "#7d7a75", sofa2: "#6b6863",
    rug: "#9c968d", art: "#a19c94", messy: true })), "Before room");
  put(bleed(room(640, 640, { wall: "#ffd9c4", floor: "#c98b5a", trim: "#ffffff", sky: "#8fd3ff", sofa: "#1f8a8a", sofa2: "#17706f",
    rug: "#ffc23d", art: "#ff6b6b", messy: false })), "After room");
  put(rect(632, 0, 16, 720, "#ffffff", { shadow: shadow("rgba(0,0,0,0.35)", 24) }), "Divider");

  const tape = (label, cx, y, fill, color, angle) => pill(label, { x: cx, y, h: 70, size: 40, pad: 30, font: "Lilita One", weight: 400,
    fill, color, center: true, spacing: 120, radius: 6, shadowOf: shadow("rgba(0,0,0,0.3)", 12, 0, 6) }).set({ angle });
  put(tape("BEFORE", 320, 36, INK, "#ffffff", -4), "Label");
  put(tape("AFTER", 960, 36, "#ffffff", INK, 4), "Label");

  put(text("$200 ROOM MAKEOVER", { x: 30, y: 576, w: 1220, size: 112, font: "Lilita One", color: "#ffe14d", align: "center",
    ...fx({ outline: { thickness: 34, color: INK }, shadow: { offset: 36, direction: 90, blur: 0, transparency: 0, color: INK } }) }), "Title");
}

// ---- 11. 30-day challenge -------------------------------------------------------------------

function calendar(x, y, w, h, angle) {
  const head = 92, cols = 7, rows = 5, pad = 18;
  const cw = (w - pad * 2) / cols, ch = (h - head - pad * 2) / rows;
  const parts = [
    rect(x, y, w, h, "#ffffff", { rx: 24, ry: 24, shadow: shadow("rgba(0,30,80,0.35)", 40, 0, 18) }),
    rect(x, y, w, head, "#ff3b3b", { rx: 24, ry: 24 }),
    rect(x, y + head - 24, w, 24, "#ff3b3b"),
    text("30 DAYS", { x, y: y + 18, w, size: 58, font: "Archivo Black", color: "#ffffff", align: "center", charSpacing: 120 }),
    circle(x + 90, y - 2, 14, "#2b2b2b"), circle(x + w - 90, y - 2, 14, "#2b2b2b"),
  ];
  let xs = "";
  for (let d = 1; d <= 30; d++) {
    const c = (d - 1) % cols, r = Math.floor((d - 1) / cols);
    const cx = x + pad + c * cw, cy = y + head + pad + r * ch;
    parts.push(text(String(d), { x: cx + 6, y: cy + 6, w: cw - 12, size: 20, font: "Archivo Black", color: d === 30 ? "#1aa35a" : "#6b7385" }));
    if (d < 30) {
      const m = cw * 0.3, top = cy + ch * 0.36, bot = cy + ch - 10;
      xs += `M ${cx + m} ${top} L ${cx + cw - 10} ${bot} M ${cx + cw - 10} ${top} L ${cx + m} ${bot} `;
    } else {
      parts.push(ellipse(cx + cw / 2, cy + ch / 2, cw / 2 - 4, ch / 2 - 6, null, { stroke: "#1aa35a", strokeWidth: 7, fill: "" }));
    }
  }
  parts.push(path(xs, { stroke: "#ff3b3b", strokeWidth: 7 }));
  return group(parts, { angle });
}

async function thirtyDays(app) {
  const put = putter(app);
  app.editor.setBackground("#0a7cff");
  put(bleed(rect(0, 0, 1280, 720, linear(150, ["#3fd0ff", [0.55, "#0a7cff"], [1, "#0646b8"]]))), "Background");
  for (const [x, y, r] of [[1180, 640, 80], [80, 660, 50], [640, 40, 30]]) put(circle(x, y, r, "rgba(255,255,255,0.12)"), "Bubble");
  put(calendar(800, 120, 420, 480, 5), "Calendar");

  const edge = fx({ shadow: { offset: 36, direction: 90, blur: 0, transparency: 0, color: "#062b70" } });
  put(text("I TRIED", { x: 58, y: 70, w: 660, size: 84, font: "Archivo Black", color: "#ffffff", ...edge }), "Kicker");
  put(text("COLD\nSHOWERS", { x: 54, y: 170, w: 700, size: 116, font: "Archivo Black", color: "#ffe14d", lineHeight: 0.92, ...edge }), "Title");
  put(text("for 30 days...", { x: 64, y: 432, w: 660, size: 96, font: "Permanent Marker", color: "#ffffff", angle: -4, ...edge }), "Handwritten");
  put(curvedArrow(470, 600, 600, 680, 730, 560, { color: "#ffffff", width: 16, head: 52 }), "Arrow");
}

// ---- 12. True crime / mystery ----------------------------------------------------------------

async function trueCrime(app) {
  const put = putter(app);
  const RED = "#ff2b2b";
  app.editor.setBackground("#05070d");
  put(bleed(rect(0, 0, 1280, 720, linear(180, ["#0f1a2a", "#03050a"]))), "Background");
  put(poly([[880, -10], [1010, -10], [1220, 720], [680, 720]], linear(180, ["rgba(190,220,255,0.35)", "rgba(190,220,255,0.03)"])), "Spotlight");
  put(ellipse(950, 660, 230, 34, "rgba(190,220,255,0.18)"), "Light pool");
  put(group([
    path("M 950 300 C 900 300 880 330 880 360 L 880 380 C 860 382 842 388 842 396 L 1058 396 C 1058 388 1040 382 1020 380 L 1020 360 C 1020 330 1000 300 950 300 Z", { fill: "#010204" }),
    ellipse(950, 432, 52, 62, "#010204"),
    path("M 830 680 C 830 560 860 500 950 496 C 1040 500 1070 560 1070 680 Z", { fill: "#010204" }),
    rect(918, 478, 64, 40, "#010204"),
  ]), "Figure in hat");
  put(text("?", { x: 880, y: 360, w: 140, size: 120, font: "Bebas Neue", color: RED, align: "center",
    ...fx({ neon: { intensity: 40, tube: 0, color: RED } }) }), "Question mark");

  put(pill("UNSOLVED · CASE 1987", { x: 64, y: 70, h: 48, size: 22, pad: 20, font: "Barlow Condensed", weight: 700, fill: "rgba(0,0,0,0)",
    color: RED, spacing: 300, stroke: RED, strokeWidth: 3, radius: 4 }), "Case label");
  put(text("THE MAN WHO", { x: 58, y: 140, w: 720, size: 118, font: "Bebas Neue", color: "#e9edf3", charSpacing: 40 }), "Title");
  put(text("VANISHED", { x: 54, y: 240, w: 780, size: 230, font: "Bebas Neue", color: RED, charSpacing: 20,
    ...fx({ shadow: { offset: 20, direction: 90, blur: 40, transparency: 30, color: "#000000" } }) }), "Title accent");

  const tape = group([
    rect(-100, 590, 1500, 64, "#ffd400", { shadow: shadow("rgba(0,0,0,0.6)", 20, 0, 8) }),
    text("DO NOT CROSS   ●   POLICE LINE   ●   DO NOT CROSS   ●   POLICE LINE   ●   DO NOT CROSS", { x: -60, y: 600, w: 1460, size: 44,
      font: "Barlow Condensed", weight: 900, color: INK, charSpacing: 120 }),
  ], { angle: -6 });
  put(tape, "Police tape");
}

// ---- 13. Cooking -----------------------------------------------------------------------------

function ramenBowl(cx, cy, r) {
  const parts = [
    circle(cx + 10, cy + 18, r * 1.02, "rgba(80,0,0,0.35)"),
    circle(cx, cy, r, linear(135, ["#2b2b33", "#121218"]), { stroke: "#ff5a3c", strokeWidth: r * 0.035 }),
    circle(cx, cy, r * 0.86, radial(["#ffcf7a", [0.7, "#f2a33a"], [1, "#c46a14"]])),
  ];
  let noodles = "";
  for (let i = 0; i < 9; i++) {
    const yy = cy - r * 0.35 + i * r * 0.09, x0 = cx - r * 0.62;
    noodles += `M ${x0} ${yy} q ${r * 0.1} -${r * 0.08} ${r * 0.2} 0 t ${r * 0.2} 0 t ${r * 0.2} 0 t ${r * 0.2} 0 t ${r * 0.2} 0 t ${r * 0.2} 0 `;
  }
  parts.push(path(noodles, { stroke: "#ffe7a3", strokeWidth: r * 0.035 }));
  for (const [dx, dy] of [[0.36, -0.32], [0.5, 0.0]]) {
    parts.push(ellipse(cx + r * dx, cy + r * dy, r * 0.19, r * 0.15, "#fffaf0", { stroke: "#e8dcc2", strokeWidth: 3 }));
    parts.push(circle(cx + r * dx, cy + r * dy, r * 0.09, radial(["#ffb21a", [1, "#ff7a00"]])));
  }
  for (const [dx, dy] of [[-0.42, 0.3], [-0.16, 0.48]]) {
    parts.push(circle(cx + r * dx, cy + r * dy, r * 0.17, "#f4b3a0", { stroke: "#c96a52", strokeWidth: r * 0.03 }));
    parts.push(circle(cx + r * dx, cy + r * dy, r * 0.07, "#fbd6c9"));
  }
  parts.push(rect(cx - r * 0.66, cy - r * 0.62, r * 0.28, r * 0.42, "#1d3a24", { angle: -18 }));
  let onions = "";
  for (const [dx, dy] of [[0.1, 0.3], [0.2, 0.4], [0.05, 0.55], [0.3, 0.22], [-0.05, 0.2], [0.24, 0.6]]) {
    const ox = cx + r * dx, oy = cy + r * dy, rr = r * 0.035;
    onions += `M ${ox - rr} ${oy} a ${rr} ${rr} 0 1 0 ${rr * 2} 0 a ${rr} ${rr} 0 1 0 ${-rr * 2} 0 `;
  }
  parts.push(path(onions, { stroke: "#4cc35a", strokeWidth: r * 0.02 }));
  parts.push(line(cx - r * 0.2, cy - r * 1.25, cx + r * 0.95, cy + r * 0.2, "#8a5a32", r * 0.06));
  parts.push(line(cx - r * 0.05, cy - r * 1.32, cx + r * 1.05, cy + r * 0.05, "#a8703e", r * 0.06));
  return group(parts);
}

async function cooking(app) {
  const put = putter(app);
  app.editor.setBackground("#ff4a2b");
  put(bleed(rect(0, 0, 1280, 720, radial(["#ff7a3d", [1, "#d8261a"]], { cx: 0.7, cy: 0.5, r: 0.8 }))), "Background");
  put(ramenBowl(920, 380, 280), "Ramen bowl");
  put(group([
    burst(140, 120, 100, 82, 18, "#ffe14d", { stroke: INK, strokeWidth: 6, strokeLineJoin: "round" }),
    text("5 MIN", { x: 40, y: 92, w: 200, size: 56, font: "Lilita One", color: INK, align: "center" }),
  ], { angle: -8 }), "Time badge");

  const edge = fx({ outline: { thickness: 30, color: INK }, shadow: { offset: 36, direction: 90, blur: 0, transparency: 0, color: INK } });
  put(text("RAMEN", { x: 50, y: 230, w: 640, size: 190, font: "Lilita One", color: "#ffffff", ...edge }), "Title");
  put(text("HACK", { x: 50, y: 410, w: 640, size: 190, font: "Lilita One", color: "#ffe14d", ...edge }), "Title accent");
  put(text("better than takeout", { x: 410, y: 620, w: 420, size: 50, font: "Caveat", weight: 700, color: "#ffffff", angle: -5 }), "Handwritten note");
}

// ---- 14. Fitness -----------------------------------------------------------------------------

function dumbbell(cx, cy, s, angle) {
  const plate = (x, h, w) => rect(cx + x - w / 2, cy - h / 2, w, h, "#16121b", { rx: 10 * s, ry: 10 * s, stroke: "#3a3a3a", strokeWidth: 4 * s });
  return group([
    rect(cx - 250 * s, cy - 14 * s, 500 * s, 28 * s, linear(180, ["#d8d8d8", "#8a8a8a"]), { rx: 10 * s, ry: 10 * s }),
    plate(-190 * s, 240 * s, 46 * s), plate(-140 * s, 200 * s, 42 * s), plate(140 * s, 200 * s, 42 * s), plate(190 * s, 240 * s, 46 * s),
    rect(cx - 70 * s, cy - 20 * s, 140 * s, 40 * s, "#2b2b2b", { rx: 8 * s, ry: 8 * s }),
  ], { angle, shadow: shadow("rgba(0,0,0,0.45)", 30, 0, 16) });
}

async function fitness(app) {
  const put = putter(app);
  const Y = "#e8ff3a";
  app.editor.setBackground("#0c0c0c");
  put(bleed(poly([[760, 0], [1280, 0], [1280, 720], [560, 720]], Y)), "Accent slab");
  put(stripes(560, 676, 720, 44, 26, "rgba(0,0,0,0.85)"), "Hazard stripe");
  put(dumbbell(960, 360, 1, -24), "Dumbbell");

  put(text("100", { x: 40, y: 10, w: 640, size: 330, font: "Teko", weight: 700, color: Y }), "Big number");
  put(text("PUSH-UPS", { x: 48, y: 300, w: 660, size: 150, font: "Teko", weight: 700, color: "#ffffff" }), "Title");
  put(text("EVERY SINGLE DAY", { x: 52, y: 460, w: 660, size: 58, font: "Teko", weight: 600, color: "rgba(255,255,255,0.7)", charSpacing: 160 }), "Subtitle");
  put(group([
    circle(1150, 130, 86, "#ff2e4d", { stroke: "#ffffff", strokeWidth: 8, shadow: shadow("rgba(0,0,0,0.4)", 20, 0, 8) }),
    text("DAY", { x: 1064, y: 76, w: 172, size: 34, font: "Teko", weight: 700, color: "#ffffff", align: "center", charSpacing: 200 }),
    text("30", { x: 1064, y: 102, w: 172, size: 96, font: "Teko", weight: 700, color: "#ffffff", align: "center" }),
  ], { angle: 10 }), "Day stamp");
}

// ---- 15. Breaking news -----------------------------------------------------------------------

function globe(cx, cy, r) {
  let d = "";
  for (const k of [0.25, 0.55, 0.85]) d += `M ${cx} ${cy - r} A ${r * k} ${r} 0 0 0 ${cx} ${cy + r} A ${r * k} ${r} 0 0 0 ${cx} ${cy - r} `;
  for (const t of [-0.66, -0.33, 0, 0.33, 0.66]) {
    const yy = cy + r * t, hw = r * Math.sqrt(1 - t * t);
    d += `M ${cx - hw} ${yy} L ${cx + hw} ${yy} `;
  }
  return group([
    circle(cx, cy, r * 1.25, radial(["rgba(60,140,255,0.4)", [1, "rgba(60,140,255,0)"]])),
    circle(cx, cy, r, radial(["#2c6bff", [0.7, "#0f2f86"], [1, "#081a4f"]], { cx: 0.38, cy: 0.35, r: 0.7 })),
    path(d, { stroke: "rgba(160,200,255,0.45)", strokeWidth: 3 }),
    circle(cx, cy, r, null, { fill: "", stroke: "rgba(160,200,255,0.7)", strokeWidth: 4 }),
  ]);
}

async function breakingNews(app) {
  const put = putter(app);
  const RED = "#e50914";
  app.editor.setBackground("#06102a");
  put(bleed(rect(0, 0, 1280, 720, linear(135, ["#0c1f55", "#040a1c"]))), "Background");
  put(globe(1040, 250, 250), "Globe");
  put(pill("● LIVE", { x: 60, y: 54, h: 50, size: 24, pad: 22, font: "Russo One", weight: 400, fill: RED, spacing: 160, radius: 6 }), "Live tag");
  put(text("09:41 · WORLD", { x: 210, y: 66, w: 400, size: 26, font: "Russo One", color: "rgba(255,255,255,0.7)", charSpacing: 160 }), "Time");
  put(text("IT'S\nOFFICIAL", { x: 54, y: 128, w: 900, size: 150, font: "Oswald", weight: 700, color: "#ffffff", lineHeight: 0.95,
    ...fx({ shadow: { offset: 24, direction: 90, blur: 30, transparency: 40, color: "#000000" } }) }), "Headline");

  put(bleed(rect(0, 470, 1280, 104, RED, { shadow: shadow("rgba(0,0,0,0.5)", 30, 0, 10) })), "Red band");
  put(rect(0, 470, 360, 104, "#ffffff"), "Band label box");
  put(text("BREAKING", { x: 20, y: 498, w: 320, size: 52, font: "Russo One", color: RED, align: "center" }), "Band label");
  put(text("NEWS UPDATE", { x: 390, y: 486, w: 900, size: 76, font: "Russo One", color: "#ffffff", charSpacing: 60 }), "Band text");
  put(bleed(rect(0, 574, 1280, 70, "#0a0f1e")), "Ticker");
  put(text("MARKETS REACT  ·  WHAT IT MEANS FOR YOU  ·  FULL STORY INSIDE  ·  MARKETS REACT", { x: 30, y: 594, w: 1400, size: 30,
    font: "Oswald", weight: 600, color: "#ffd400", charSpacing: 80 }), "Ticker text");
}

// ---- 16. Minimal big word --------------------------------------------------------------------

async function minimalWord(app) {
  const put = putter(app);
  const RED = "#ff3b2f";
  app.editor.setBackground("#efebe3");
  put(text("QUIT.", { x: 36, y: 10, w: 1220, size: 620, font: "Anton", color: "#141414", charSpacing: -20,
    styles: { 0: { 4: { fill: RED } } } }), "Big word");
  put(line(64, 652, 184, 652, RED, 8), "Rule");
  put(text("why I walked away from a $120k job", { x: 210, y: 628, w: 1000, size: 44, font: "DM Serif Display", fontStyle: "italic", color: "#141414" }), "Subtitle");
  put(circle(1180, 90, 26, RED), "Accent dot");
}

// ---- 17. Paper Diorama (white diorama, one accent, actors in tension) ----------------------

function paperHouse(x, y, s) {
  return group([
    rect(x, y + 80 * s, 200 * s, 150 * s, "#f8f7f3"),
    poly([[x - 16 * s, y + 86 * s], [x + 100 * s, y], [x + 216 * s, y + 86 * s]], "#ecebe5"),
    rect(x + 80 * s, y + 150 * s, 44 * s, 80 * s, "#dedcd5"),
    rect(x + 24 * s, y + 110 * s, 40 * s, 40 * s, "#e3e1da"),
    rect(x + 140 * s, y + 110 * s, 40 * s, 40 * s, "#e3e1da"),
    text("FOR RENT", { x: x + 20 * s, y: y + 44 * s, w: 160 * s, size: 15 * s, font: "Inter", weight: 800, color: "#a19e95", align: "center", charSpacing: 200 }),
  ], { shadow: shadow("rgba(70, 60, 45, 0.16)", 22, 0, 8) });
}

async function paperDioramaRent(app) {
  const put = putter(app);
  const ACCENT = "#2f6bff", INKD = "#1d1d1f";
  app.editor.setBackground(linear(180, ["#f7f6f2", "#e9e7e1"]));
  put(bleed(path("M -20 720 L -20 500 C 200 450 420 480 640 470 C 860 460 1060 440 1300 470 L 1300 720 Z",
    { fill: "#e5e3dc", shadow: shadow("rgba(70, 60, 45, 0.16)", 22, 0, 8) })), "Far hills");
  put(bleed(rect(-20, 628, 1320, 112, "#d6d4cc", { shadow: shadow("rgba(70, 60, 45, 0.16)", 22, 0, 8) })), "Ground");
  put(paperHouse(470, 404, 1.0), "Paper house");

  const bank = actor(200, 646, 300, "#b4b1a8", { lookX: 1, brows: 0.6 });
  const lord = actor(800, 646, 340, "#a3a098", { lookX: 1, brows: 1 });
  const you = actor(1110, 646, 290, ACCENT, { lookX: -1, brows: -0.6 });
  put(bank.obj, "Actor: the bank");
  put(lord.obj, "Actor: the landlord");
  put(you.obj, "Actor: you");

  const tag = (label, cx, top, fill) => pill(label, { x: cx, y: top - 70, h: 48, size: 21, pad: 20, fill, center: true });
  put(path(`M 270 ${bank.headTop - 46} Q 520 ${bank.headTop - 140} 700 ${lord.headTop - 46}`,
    { stroke: INKD, strokeWidth: 4, strokeDashArray: [14, 12] }), "Dashed line");
  put(path(`M 905 ${lord.headTop - 46} Q 990 ${lord.headTop - 130} 1070 ${you.headTop - 46}`,
    { stroke: INKD, strokeWidth: 4, strokeDashArray: [14, 12] }), "Dashed line");
  put(tag("THE BANK", 200, bank.headTop, INKD), "Role tag");
  put(tag("LANDLORD", 800, lord.headTop, INKD), "Role tag");
  put(tag("YOU", 1110, you.headTop, ACCENT), "Role tag");
  put(group([circle(990, lord.headTop - 92, 28, ACCENT, { stroke: "#ffffff", strokeWidth: 5 }),
    text("%", { x: 966, y: lord.headTop - 112, w: 48, size: 34, font: "Montserrat", weight: 900, color: "#ffffff", align: "center" })]), "Rate coin");

  put(text("WHY RENT", { x: 56, y: 44, w: 900, size: 96, font: "Montserrat", weight: 900, color: INKD, charSpacing: -10 }), "Title");
  put(text("KEEPS RISING", { x: 56, y: 140, w: 900, size: 96, font: "Montserrat", weight: 900, color: ACCENT, charSpacing: -10 }), "Title accent");
}

const THUMB = { size: "yt-thumb" };
const yt = ["thumbnail", "youtube", "video"];
export default [
  { ...THUMB, id: "tv-podcast-episode", name: "Podcast Episode", tags: [...yt, "podcast", "interview", "episode", "talk", "guest", "mic", "dark"],
    fonts: [["Barlow Condensed", 900], ["DM Serif Display", 400, "italic"], ["Inter", 800]], build: podcastEpisode },
  { ...THUMB, id: "tv-room-makeover", name: "Room Makeover", tags: [...yt, "before", "after", "makeover", "room", "home", "diy", "transformation"],
    fonts: [["Lilita One"]], build: roomMakeover },
  { ...THUMB, id: "tv-30-days", name: "I Tried It for 30 Days", tags: [...yt, "challenge", "30", "days", "calendar", "habit", "experiment", "blue"],
    fonts: [["Archivo Black"], ["Permanent Marker"]], build: thirtyDays },
  { ...THUMB, id: "tv-true-crime", name: "True Crime Mystery", tags: [...yt, "mystery", "crime", "dark", "documentary", "unsolved", "story"],
    fonts: [["Bebas Neue"], ["Barlow Condensed", 700], ["Barlow Condensed", 900]], build: trueCrime },
  { ...THUMB, id: "tv-cooking", name: "Cooking Hack", tags: [...yt, "cooking", "food", "recipe", "kitchen", "ramen", "hack"],
    fonts: [["Lilita One"], ["Caveat", 700]], build: cooking },
  { ...THUMB, id: "tv-fitness", name: "Fitness Challenge", tags: [...yt, "fitness", "gym", "workout", "challenge", "sport", "health"],
    fonts: [["Teko", 700], ["Teko", 600]], build: fitness },
  { ...THUMB, id: "tv-breaking-news", name: "Breaking News", tags: [...yt, "news", "breaking", "live", "update", "world", "report"],
    fonts: [["Russo One"], ["Oswald", 700], ["Oswald", 600]], build: breakingNews },
  { ...THUMB, id: "tv-minimal-word", name: "Minimal Big Word", tags: [...yt, "minimal", "clean", "word", "simple", "essay", "serif"],
    fonts: [["Anton"], ["DM Serif Display", 400, "italic"]], build: minimalWord },
  { ...THUMB, id: "tv-paper-diorama-rent", name: "Paper Diorama: Who Wins", tags: [...yt, "paper", "diorama", "story", "explainer", "economics", "white", "minimal"],
    fonts: [["Montserrat", 900], ["Inter", 800]], build: paperDioramaRent },
];
