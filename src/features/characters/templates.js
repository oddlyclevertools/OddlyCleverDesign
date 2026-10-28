// The "Oddly Clever" template pack: the cast on a rainy neon night street, with brick, paper
// labels, pink neon script and the gold crown. Built like the channel banner: cinematic and
// grown-up, never kiddy. Every template is drawn in code; the characters are vector groups.
import {
  C, brickWall, castMember, crown, glow, guideBox, linear, neon, paperLabel, putter, rain, rect, slash, text,
  vignette, wetStreet, punch, bleed, circle, group, poly, path, shadow,
} from "./tpl-draw.js";

const FONTS = [["Archivo Black"], ["Inter", 900], ["Inter", 800], ["Inter", 700], ["Pacifico"]];

/** Colour some characters of one line: { [line]: { [char]: style } }. */
function charStyle(line, from, to, style) {
  const chars = {};
  for (let i = from; i < to; i++) chars[i] = { ...style };
  return { [line]: chars };
}

/** The wordmark: heavy dark ODDLY with a gold rim, and the pink neon "clever" crossing it. */
function wordmark(put, x, y, size, { angle = -6 } = {}) {
  put(text("ODDLY", { x, y, w: size * 4.2, size, font: "Archivo Black", color: "#1b141f", stroke: "#e2a43a",
    strokeWidth: size * 0.04, shadow: shadow("rgba(255,177,92,0.55)", size * 0.35) }), "ODDLY");
  put(neon("clever", { x: x + size * 1.6, y: y + size * 0.62, w: size * 3.4, size: size * 0.95, font: "Pacifico",
    angle, glowBlur: size * 0.3 }), "clever (neon)");
}

// ---- 1. YouTube thumbnail: the loophole ----------------------------------------------------------

async function loophole(app) {
  const put = putter(app), W = 1280, H = 720;
  app.editor.setBackground(C.night);
  brickWall(put, 0, 0, W, 560, { brick: 72, seed: 11 });
  glow(put, 980, 300, 560, 420, C.amber, 0.42, "Lamp light");
  glow(put, 240, 220, 460, 320, C.pink, 0.26, "Neon spill");
  wetStreet(put, 0, 560, W, 160, [[240, 260, C.pink, 0.3], [990, 300, C.amber, 0.3]]);
  slash(put, 770, -20, 250, 760, 130, C.pink, "Pink slash");
  const s = await castMember(put, { who: "sparks", expr: "smug", dir: -1, sticker: true, look: [0.35, 0] },
    { at: { x: 1000, y: 1010 }, height: 930 });
  put(crown(s.head.x + s.r * 0.2, s.head.y - s.r * 1.62, s.r * 1.25, -20), "Crown");
  put(paperLabel("THEY HATE THIS", { cx: 236, cy: 112, size: 26, angle: -4, seed: 3 }), "Label");
  put(punch("THE $1\nLOOPHOLE", { x: 52, y: 170, w: 760, size: 122, styles: charStyle(0, 4, 6, { fill: C.gold }) }), "Title");
  put(paperLabel("WE FOUND IT. YOU DIDN'T.", { cx: 392, cy: 520, size: 24, angle: -2, seed: 9 }), "Tagline");
  rain(put, 0, 0, W, H, { n: 120, len: 30, seed: 4 });
  vignette(put, W, H, 0.7);
}

// ---- 2. YouTube thumbnail: caught out ------------------------------------------------------------

async function caughtOut(app) {
  const put = putter(app), W = 1280, H = 720;
  app.editor.setBackground(C.night);
  brickWall(put, 0, 0, W, H, { brick: 80, seed: 21 });
  put(bleed(rect(0, 0, W, H, linear(90, ["rgba(13,10,16,0.15)", [0.45, "rgba(13,10,16,0.55)"], [1, "rgba(13,10,16,0.92)"]]))), "Shade");
  glow(put, 330, 380, 520, 460, C.cyan, 0.22, "Cold light");
  slash(put, 120, -20, 150, 760, 120, "rgba(255,46,126,0.85)", "Pink slash");
  await castMember(put, { who: "milo", expr: "shock", head: true, sticker: true, look: [0.6, 0] },
    { at: { x: 330, y: 390 }, height: 600, by: "head" });
  put(punch("IT WAS\nLEGAL?!", { x: 630, y: 160, w: 640, size: 128, align: "left", styles: charStyle(1, 0, 5, { fill: C.pink }) }), "Title");
  put(paperLabel("THE BANK NEVER SAW IT", { cx: 900, cy: 520, size: 26, angle: 3, seed: 14 }), "Label");
  put(text("A TRUE STORY", { x: 660, y: 600, w: 560, size: 24, font: "Inter", weight: 800, color: "rgba(255,255,255,0.7)", charSpacing: 400 }), "Kicker");
  rain(put, 0, 0, W, H, { n: 90, len: 28, seed: 8, alpha: 0.1 });
  vignette(put, W, H, 0.65);
}

// ---- 3. YouTube thumbnail: versus ----------------------------------------------------------------

async function versus(app) {
  const put = putter(app), W = 1280, H = 720;
  app.editor.setBackground(C.night);
  brickWall(put, 0, 0, W, H, { brick: 76, seed: 31 });
  put(poly([[0, 0], [700, 0], [580, H], [0, H]], "rgba(15,46,32,0.72)"), "Green side");
  put(poly([[700, 0], [W, 0], [W, H], [580, H]], "rgba(18,28,58,0.78)"), "Blue side");
  put(path(`M 700 0 L 580 ${H}`, { stroke: C.gold, strokeWidth: 10 }), "Split");
  glow(put, 320, 420, 420, 380, C.gold, 0.22, "Light");
  glow(put, 960, 420, 420, 380, C.pink, 0.22, "Light");
  await castMember(put, { who: "brick", expr: "grin", look: [0.35, 0] }, { at: { x: 330, y: 790 }, height: 700 });
  await castMember(put, { who: "rae", expr: "smug", dir: -1, look: [0.35, 0] }, { at: { x: 980, y: 800 }, height: 740 });
  put(circle(640, 360, 84, C.gold, { stroke: C.ink, strokeWidth: 10, shadow: shadow("rgba(0,0,0,0.6)", 30, 0, 10) }), "VS badge");
  put(text("VS", { x: 540, y: 316, w: 200, size: 92, font: "Archivo Black", color: C.ink, align: "center" }), "VS");
  put(punch("WHO GOT RICHER?", { x: 40, y: 34, w: 1200, size: 82, align: "center" }), "Title");
  put(paperLabel("$0 → $1M", { cx: 250, cy: 640, size: 34, angle: -4, seed: 2, spacing: 120 }), "Label left");
  put(paperLabel("$1M → $0", { cx: 1040, cy: 640, size: 34, angle: 3, seed: 6, spacing: 120 }), "Label right");
  vignette(put, W, H, 0.6);
}

// ---- 4. Shorts cover: beat the casino ------------------------------------------------------------

async function casino(app) {
  const put = putter(app), W = 1080, H = 1920;
  app.editor.setBackground(C.night);
  brickWall(put, 0, 0, W, 1560, { brick: 96, seed: 41 });
  glow(put, 540, 1050, 760, 760, C.amber, 0.4, "Lamp light");
  glow(put, 540, 260, 700, 380, C.pink, 0.24, "Neon spill");
  wetStreet(put, 0, 1560, W, 360, [[300, 300, C.pink, 0.3], [800, 280, C.gold, 0.28]]);
  put(punch("HOW HE\nBEAT THE\nCASINO", { x: 60, y: 120, w: 960, size: 168, align: "center", styles: charStyle(2, 0, 6, { fill: C.gold }) }), "Title");
  put(paperLabel("TRUE STORY · 60 SECONDS", { cx: 540, cy: 680, size: 34, angle: -3, seed: 12 }), "Label");
  const s = await castMember(put, { who: "sparks", expr: "grin", sticker: true, look: [0.35, 0] }, { at: { x: 600, y: 1730 }, height: 980 });
  put(crown(s.head.x + s.r * 0.1, s.head.y - s.r * 1.6, s.r * 1.2, 18), "Crown");
  wordmark(put, 300, 1770, 74);
  rain(put, 0, 0, W, H, { n: 180, len: 40, seed: 9 });
  vignette(put, W, H, 0.7);
}

// ---- 5. Shorts cover: the Keeper ------------------------------------------------------------------

async function keeper(app) {
  const put = putter(app), W = 1080, H = 1920;
  app.editor.setBackground(C.night);
  brickWall(put, 0, 0, W, H, { brick: 96, seed: 51 });
  // the shop window: amber shelves, a dark frame
  const wx = 110, wy = 660, ww = 860, wh = 1000;
  put(rect(wx - 22, wy - 22, ww + 44, wh + 44, "#140d12", { rx: 6, ry: 6, shadow: shadow("rgba(0,0,0,0.7)", 40, 0, 16) }), "Window frame");
  put(rect(wx, wy, ww, wh, linear(180, ["#5a3510", [0.5, "#c07a28"], [1, "#6a3a10"]])), "Shop light");
  let shelves = "", jars = "";
  for (let i = 0; i < 4; i++) {
    const y = wy + 180 + i * 220;
    shelves += `M ${wx} ${y} h ${ww} v 14 h ${-ww} Z `;
    for (let j = 0; j < 9; j++) {
      const bx = wx + 40 + j * 92 + ((i * 37 + j * 13) % 30), bh = 50 + ((i * 7 + j * 11) % 5) * 18;
      jars += `M ${bx + 6} ${y - bh} h 22 q 6 0 6 6 v ${bh - 6} h -34 v ${-bh + 6} q 0 -6 6 -6 Z `;
    }
  }
  put(path(jars, { fill: "rgba(255,214,150,0.32)", strokeWidth: 0 }), "Jars");
  put(path(shelves, { fill: "#2a170a", strokeWidth: 0 }), "Shelves");
  glow(put, 540, 1150, 520, 520, "#ffd99a", 0.35, "Lamp");
  await castMember(put, { who: "keeper", expr: "grin" }, { at: { x: 540, y: 1660 }, height: 960 });
  put(neon("MEMORIES · BOUGHT & SOLD", { x: 60, y: 530, w: 960, size: 58, font: "Archivo Black", color: C.cyan, core: "#e6fbff", align: "center", glowBlur: 30 }), "Neon sign");
  put(punch("HE BUYS\nYOUR MEMORIES", { x: 40, y: 110, w: 1000, size: 132, align: "center", styles: charStyle(1, 5, 13, { fill: C.cyan }) }), "Title");
  put(paperLabel("WOULD YOU SELL ONE?", { cx: 540, cy: 1760, size: 40, angle: -2, seed: 17 }), "Label");
  rain(put, 0, 0, W, H, { n: 160, len: 40, seed: 12, alpha: 0.12 });
  vignette(put, W, H, 0.75);
}

// ---- 6. Shorts cover: the crew --------------------------------------------------------------------

async function crew(app) {
  const put = putter(app), W = 1080, H = 1920;
  app.editor.setBackground(C.night);
  brickWall(put, 0, 0, W, 1580, { brick: 96, seed: 61 });
  glow(put, 540, 1150, 820, 640, C.amber, 0.36, "Lamp light");
  wetStreet(put, 0, 1580, W, 340, [[200, 220, C.pink, 0.28], [560, 240, C.gold, 0.26], [900, 220, C.cyan, 0.22]]);
  put(punch("4 FRIENDS.\n1 LOOPHOLE.", { x: 40, y: 150, w: 1000, size: 128, align: "center", styles: charStyle(1, 0, 1, { fill: C.gold }) }), "Title");
  put(paperLabel("PART 1 · THE PLAN", { cx: 540, cy: 520, size: 36, angle: 2, seed: 22 }), "Label");
  await castMember(put, { who: "brick", expr: "smug" }, { at: { x: 530, y: 1610 }, height: 860 });
  await castMember(put, { who: "rae", expr: "grin", dir: -1 }, { at: { x: 860, y: 1650 }, height: 900 });
  await castMember(put, { who: "sparks", expr: "smug" }, { at: { x: 290, y: 1660 }, height: 860 });
  await castMember(put, { who: "milo", expr: "worried", look: [-0.6, 0.2] }, { at: { x: 600, y: 1730 }, height: 640 });
  wordmark(put, 330, 1770, 64);
  rain(put, 0, 0, W, H, { n: 160, len: 40, seed: 15 });
  vignette(put, W, H, 0.7);
}

// ---- 7. Instagram post: the fact --------------------------------------------------------------------

async function fact(app) {
  const put = putter(app), W = 1080, H = 1080;
  app.editor.setBackground(C.night);
  brickWall(put, 0, 0, W, H, { brick: 84, seed: 71 });
  glow(put, 420, 560, 700, 600, C.amber, 0.34, "Lamp light");
  const card = rect(-390, -300, 780, 600, C.paper, { shadow: shadow("rgba(0,0,0,0.6)", 50, 0, 22) });
  const body = text("A man once bought every lottery ticket there was.\nAnd it was legal.", {
    x: -330, y: -170, w: 660, size: 58, font: "Inter", weight: 900, color: C.ink, lineHeight: 1.08 });
  const kicker = text("FACT #07", { x: -330, y: -240, w: 400, size: 30, font: "Archivo Black", color: C.pink, charSpacing: 300 });
  const by = text("— the Oddly Clever files", { x: -330, y: 220, w: 660, size: 28, font: "Inter", weight: 700, color: "#6d6070" });
  const g = group([card, kicker, body, by]);
  g.set({ originX: "center", originY: "center", left: 470, top: 560, angle: -3 });
  put(g, "Fact card");
  await castMember(put, { who: "rae", expr: "smug", head: true, sticker: true, dir: -1 }, { at: { x: 820, y: 290 }, height: 330, by: "head" });
  wordmark(put, 610, 900, 64);
  vignette(put, W, H, 0.6);
}

// ---- 8. YouTube channel banner -------------------------------------------------------------------

const SAFE = { x: 507, y: 508, w: 1546, h: 424 };

async function banner(app) {
  const put = putter(app), W = 2560, H = 1440;
  app.editor.setBackground(C.night);
  brickWall(put, 0, 0, W, 1100, { brick: 120, seed: 81 });
  glow(put, 1300, 700, 1100, 640, C.amber, 0.42, "Lamp light");
  glow(put, 1650, 860, 600, 300, C.pink, 0.3, "Neon spill");
  // the shop at the right: the Keeper behind a lit window
  put(rect(2060, 520, 420, 580, linear(180, ["#5a3510", [0.5, "#b8752a"], [1, "#5a3510"]]), { stroke: "#140d12", strokeWidth: 24 }), "Shop window");
  for (let i = 0; i < 3; i++) put(rect(2072, 640 + i * 150, 396, 10, "#2a170a"), "Shelf");
  await castMember(put, { who: "keeper", expr: "smug" }, { at: { x: 2280, y: 1100 }, height: 520 });
  put(neon("OPEN LATE", { x: 2060, y: 430, w: 420, size: 56, font: "Archivo Black", color: C.cyan, core: "#e6fbff", align: "center" }), "Neon sign");
  wetStreet(put, 0, 1100, W, 340, [[700, 400, C.pink, 0.26], [1350, 600, C.amber, 0.3], [2270, 360, C.cyan, 0.2]]);
  wordmark(put, 1010, 520, 210);
  put(paperLabel("WE FOUND THE LOOPHOLE. YOU DIDN'T.", { cx: 1520, cy: 900, size: 34, angle: -2, seed: 33 }), "Tagline");
  const s = await castMember(put, { who: "sparks", expr: "smug", sticker: true }, { at: { x: 790, y: 1080 }, height: 660 });
  put(crown(s.head.x + s.r * 0.15, s.head.y - s.r * 1.6, s.r * 1.2, 16), "Crown");
  rain(put, 0, 0, W, H, { n: 260, len: 46, seed: 27 });
  vignette(put, W, H, 0.7);
  const guide = { guide: true };
  put(rect(SAFE.x, SAFE.y, SAFE.w, SAFE.h, "", { fill: null, stroke: "rgba(255,255,255,0.55)", strokeWidth: 4,
    strokeDashArray: [18, 14], data: guide }), "Safe area guide (not exported)");
  put(text("SAFE AREA · SHOWN ON EVERY DEVICE", { x: SAFE.x, y: SAFE.y - 44, w: 900, size: 24, font: "Inter", weight: 800,
    color: "rgba(255,255,255,0.7)", charSpacing: 200, data: guide }), "Safe area label (not exported)");
}

// ---- 9. YouTube end screen ------------------------------------------------------------------------

async function endScreen(app) {
  const put = putter(app), W = 1920, H = 1080;
  app.editor.setBackground(C.night);
  brickWall(put, 0, 0, W, 900, { brick: 100, seed: 91 });
  glow(put, 470, 600, 700, 520, C.amber, 0.38, "Lamp light");
  wetStreet(put, 0, 900, W, 180, [[470, 400, C.amber, 0.28], [1400, 500, C.pink, 0.22]]);
  put(punch("ONE MORE\nLOOPHOLE?", { x: 80, y: 80, w: 860, size: 120, styles: charStyle(1, 0, 8, { fill: C.gold }) }), "Title");
  guideBox(put, 1040, 110, 780, 439, "Next video");
  guideBox(put, 1040, 590, 780, 439, "Best for viewer");
  put(circle(470, 640, 150, "rgba(255,255,255,0.04)", { stroke: "rgba(255,255,255,0.55)", strokeWidth: 4, strokeDashArray: [18, 12],
    data: { guide: true } }), "Subscribe slot (not exported)");
  await castMember(put, { who: "brick", expr: "grin" }, { at: { x: 210, y: 1040 }, height: 600 });
  await castMember(put, { who: "milo", expr: "worried", dir: -1, look: [0.6, -0.3] }, { at: { x: 760, y: 1050 }, height: 560 });
  put(paperLabel("SUBSCRIBE · NEW LOOPHOLE EVERY WEEK", { cx: 480, cy: 380, size: 26, angle: -2, seed: 41 }), "Label");
  rain(put, 0, 0, W, H, { n: 160, len: 36, seed: 33, alpha: 0.1 });
  vignette(put, W, H, 0.6);
}

const tpl = (id, name, size, tags, build) => ({ id, name, size, tags: ["oddly clever", "neon", "night", ...tags], fonts: FONTS, category: "oddly", build });

export default [
  tpl("oc-loophole", "The $1 Loophole", "yt-thumb", ["youtube", "thumbnail", "sparks", "crown", "money"], loophole),
  tpl("oc-caught-out", "It Was Legal?!", "yt-thumb", ["youtube", "thumbnail", "milo", "shock"], caughtOut),
  tpl("oc-versus", "Who Got Richer", "yt-thumb", ["youtube", "thumbnail", "versus", "brick", "rae"], versus),
  tpl("oc-casino", "Beat the Casino", "shorts", ["shorts", "reels", "tiktok", "cover", "sparks"], casino),
  tpl("oc-keeper", "The Memory Dealer", "shorts", ["shorts", "reels", "tiktok", "cover", "keeper", "mystery"], keeper),
  tpl("oc-crew", "The Crew", "shorts", ["shorts", "reels", "tiktok", "cover", "cast", "team"], crew),
  tpl("oc-fact", "Oddly Clever Fact", "ig-post", ["instagram", "post", "fact", "rae", "paper"], fact),
  tpl("oc-banner", "Oddly Clever Banner", "yt-banner", ["youtube", "banner", "channel", "header", "sparks", "keeper"], banner),
  tpl("oc-end", "One More Loophole", "yt-end", ["youtube", "end screen", "outro", "brick", "milo"], endScreen),
];
