// Video pack, channel art: YouTube end screen (1920 x 1080), channel banner (2560 x 1440,
// text kept inside the 1546 x 423 safe area), Twitch offline banner (1920 x 1080), podcast
// cover (3000 x 3000). All drawn in code.
import {
  bleed, circle, dots, ellipse, fx, group, guide, line, linear, mic, path, pill, poly, putter, radial,
  rect, shadow, sparkle, text, waveform,
} from "./tv-kit.js";

const INK = "#16121b";

// ---- W1. End screen --------------------------------------------------------------------------

/** A 16:9 slot where YouTube places a video element: a framed dark card with a play mark. */
function videoSlot(x, y, w, label, accent) {
  const h = Math.round((w * 9) / 16);
  return group([
    rect(x - 14, y - 14, w + 28, h + 28, null, { fill: "", stroke: accent, strokeWidth: 6, rx: 30, ry: 30 }),
    rect(x, y, w, h, linear(135, ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.03)"]), { rx: 18, ry: 18,
      stroke: "rgba(255,255,255,0.25)", strokeWidth: 3, strokeDashArray: [18, 14] }),
    circle(x + w / 2, y + h / 2, 56, "rgba(255,255,255,0.12)"),
    poly([[x + w / 2 - 18, y + h / 2 - 28], [x + w / 2 - 18, y + h / 2 + 28], [x + w / 2 + 30, y + h / 2]], "rgba(255,255,255,0.6)"),
    text(label, { x, y: y + h + 40, w, size: 34, font: "Kanit", weight: 700, color: "#ffffff", align: "center", charSpacing: 260 }),
  ]);
}

async function endScreen(app) {
  const put = putter(app);
  const PINK = "#ff2e7e", CYAN = "#8fe3ff";
  app.editor.setBackground("#0d0a10");
  put(bleed(rect(0, 0, 1920, 1080, linear(135, ["#22102e", [0.55, "#0d0a10"], [1, "#081822"]]))), "Background");
  put(bleed(circle(260, 120, 520, radial(["rgba(255,46,126,0.28)", [1, "rgba(255,46,126,0)"]]))), "Glow");
  put(bleed(circle(1700, 1000, 560, radial(["rgba(143,227,255,0.2)", [1, "rgba(143,227,255,0)"]]))), "Glow");
  put(dots(1620, 80, 6, 4, 40, 5, "rgba(255,255,255,0.18)"), "Dots");

  put(text("THANKS FOR WATCHING", { x: 120, y: 92, w: 1200, size: 30, font: "Kanit", weight: 700, color: CYAN, charSpacing: 500 }), "Label");
  put(text("WATCH THIS NEXT", { x: 112, y: 132, w: 1500, size: 120, font: "Kanit", weight: 900, color: "#ffffff", charSpacing: -10 }), "Title");
  put(videoSlot(120, 340, 780, "BEST FOR YOU", PINK), "Video slot 1");
  put(videoSlot(1020, 340, 780, "LATEST VIDEO", CYAN), "Video slot 2");

  put(group([
    circle(960, 930, 98, "rgba(255,255,255,0.08)", { stroke: "#ffffff", strokeWidth: 5, strokeDashArray: [14, 12] }),
    text("YOUR\nLOGO", { x: 880, y: 892, w: 160, size: 34, font: "Kanit", weight: 900, color: "rgba(255,255,255,0.7)", align: "center" }),
  ]), "Subscribe slot");
  put(pill("SUBSCRIBE", { x: 1100, y: 896, h: 70, size: 30, pad: 32, font: "Kanit", weight: 900, fill: PINK, spacing: 200 }), "Subscribe button");
}

// ---- W2. Channel banner ----------------------------------------------------------------------

const SAFE = { x: 507, y: 508, w: 1546, h: 423 };

function skyline(y, color) {
  let d = `M -20 1460 L -20 ${y + 120}`;
  let x = -20;
  const hs = [80, 160, 110, 220, 140, 260, 90, 190, 300, 150, 230, 120, 280, 170, 100, 240, 140, 320, 180, 110, 210, 150];
  for (let i = 0; x < 2580; i++) {
    const h = hs[i % hs.length], w = 90 + ((i * 53) % 70);
    d += ` L ${x} ${y + 200 - h} L ${x + w} ${y + 200 - h}`;
    x += w;
  }
  d += ` L 2580 ${y + 120} L 2580 1460 Z`;
  return path(d, { fill: color, strokeLineJoin: "miter" });
}

async function channelBanner(app) {
  const put = putter(app);
  const PINK = "#ff2e7e", GOLD = "#ffc83d", CYAN = "#8fe3ff";
  app.editor.setBackground("#0d0a10");
  put(bleed(rect(0, 0, 2560, 1440, linear(180, ["#1a0d2a", [0.55, "#2a0f2e"], [1, "#0d0a10"]]))), "Background");
  put(bleed(ellipse(1280, 760, 1500, 520, radial(["rgba(255,46,126,0.35)", [1, "rgba(255,46,126,0)"]]))), "Neon haze");
  put(bleed(skyline(1020, "#140b1c")), "Skyline");
  put(dots(120, 560, 8, 6, 44, 5, "rgba(143,227,255,0.25)"), "Dots");
  put(dots(2130, 560, 8, 6, 44, 5, "rgba(255,46,126,0.3)"), "Dots");
  put(path("M 160 900 C 320 820 380 640 300 560", { stroke: GOLD, strokeWidth: 10 }), "Squiggle");
  put(path("M 2400 600 C 2260 660 2240 840 2330 900", { stroke: CYAN, strokeWidth: 10 }), "Squiggle");
  put(sparkle(560, 620, 34, GOLD), "Sparkle");
  put(sparkle(2010, 820, 26, "#ffffff"), "Sparkle");

  put(text("NIGHT SHIFT", { x: SAFE.x, y: 540, w: SAFE.w, size: 200, font: "Bungee", color: "#ffffff", align: "center",
    ...fx({ neon: { intensity: 35, tube: 0, color: PINK } }) }), "Channel name");
  put(text("late-night tech, explained", { x: SAFE.x, y: 750, w: SAFE.w, size: 70, font: "DM Serif Display", fontStyle: "italic", color: CYAN, align: "center" }), "Tagline");
  put(pill("NEW VIDEOS EVERY FRIDAY · 8 PM", { x: 1280, y: 850, h: 60, size: 26, pad: 28, font: "Barlow Condensed", weight: 700,
    fill: GOLD, color: INK, center: true, spacing: 260 }), "Schedule");

  put(guide(rect(SAFE.x, SAFE.y, SAFE.w, SAFE.h, null, { fill: "", stroke: "rgba(255,255,255,0.55)", strokeWidth: 4, strokeDashArray: [18, 14] })),
    "Safe area guide (not exported)");
  put(guide(pill("SAFE AREA · SHOWN ON EVERY DEVICE", { x: SAFE.x, y: SAFE.y - 58, h: 44, size: 20, pad: 18, fill: "rgba(255,255,255,0.14)", spacing: 160 })),
    "Safe area label (not exported)");
}

// ---- W3. Twitch offline ----------------------------------------------------------------------

async function twitchOffline(app) {
  const put = putter(app);
  const PURPLE = "#9146ff", LIME = "#c6ff3d";
  app.editor.setBackground("#120826");
  put(bleed(rect(0, 0, 1920, 1080, linear(135, ["#2b0f5c", [0.6, "#140a2e"], [1, "#0a0518"]]))), "Background");
  put(bleed(circle(1500, 300, 520, radial(["rgba(145,70,255,0.45)", [1, "rgba(145,70,255,0)"]]))), "Glow");
  put(group([
    circle(1500, 330, 190, "#ffe9a8", { shadow: shadow("rgba(255,233,168,0.6)", 80) }),
    circle(1590, 270, 170, "#2b0f5c"),
  ]), "Moon");
  put(text("z", { x: 1300, y: 160, w: 100, size: 90, font: "Russo One", color: "#ffffff" }), "Zzz");
  put(text("z", { x: 1250, y: 90, w: 100, size: 64, font: "Russo One", color: "rgba(255,255,255,0.7)" }), "Zzz");
  put(text("z", { x: 1210, y: 40, w: 100, size: 44, font: "Russo One", color: "rgba(255,255,255,0.45)" }), "Zzz");

  put(pill("● OFFLINE", { x: 120, y: 130, h: 64, size: 30, pad: 28, font: "Russo One", weight: 400, fill: "#ff3d5a", spacing: 180, radius: 10 }), "Status");
  put(text("BE RIGHT\nBACK", { x: 112, y: 230, w: 1100, size: 190, font: "Russo One", color: "#ffffff", lineHeight: 0.95,
    ...fx({ shadow: { offset: 30, direction: 90, blur: 0, transparency: 0, color: PURPLE } }) }), "Title");

  const days = [["MON", "7 PM"], ["WED", "7 PM"], ["FRI", "9 PM"], ["SAT", "3 PM"]];
  days.forEach(([d, t], i) => {
    const x = 120 + i * 300;
    put(group([
      rect(x, 690, 270, 210, "rgba(255,255,255,0.06)", { rx: 24, ry: 24, stroke: i === 2 ? LIME : "rgba(255,255,255,0.18)", strokeWidth: 4 }),
      text(d, { x, y: 720, w: 270, size: 64, font: "Russo One", color: i === 2 ? LIME : "#ffffff", align: "center" }),
      text(t, { x, y: 812, w: 270, size: 46, font: "Barlow Condensed", weight: 700, color: "rgba(255,255,255,0.75)", align: "center", charSpacing: 80 }),
    ]), `Schedule ${d}`);
  });
  put(text("STREAM SCHEDULE", { x: 120, y: 636, w: 800, size: 32, font: "Barlow Condensed", weight: 700, color: LIME, charSpacing: 400 }), "Schedule label");
  put(pill("@YOURNAME", { x: 1680, y: 960, h: 64, size: 30, pad: 28, font: "Barlow Condensed", weight: 700, fill: PURPLE, spacing: 160,
    center: true }), "Handle");
}

// ---- W4. Podcast cover -----------------------------------------------------------------------

async function podcastCover(app) {
  const put = putter(app);
  const ORANGE = "#ff5a1f", CREAM = "#f3ead8";
  app.editor.setBackground(CREAM);
  put(bleed(rect(0, 0, 3000, 3000, linear(180, ["#f6eedd", "#ecdfc4"]))), "Background");
  put(circle(2250, 2250, 760, ORANGE), "Sun circle");
  put(dots(260, 2200, 9, 6, 90, 12, "rgba(22,18,27,0.18)"), "Dots");
  put(waveform(260, 2000, 1180, 36, 300, INK, 22), "Waveform");
  put(mic(2250, 1640, 3.8, { body: INK, accent: CREAM }), "Microphone");

  put(text("MONEY", { x: 220, y: 230, w: 2600, size: 620, font: "Alfa Slab One", color: INK, charSpacing: -10 }), "Title");
  put(text("TALKS", { x: 220, y: 830, w: 2600, size: 620, font: "Alfa Slab One", color: ORANGE, charSpacing: -10 }), "Title accent");
  put(text("the podcast", { x: 240, y: 1500, w: 1600, size: 200, font: "DM Serif Display", fontStyle: "italic", color: INK }), "Subtitle");
  put(rect(220, 2620, 1200, 150, INK, { rx: 75, ry: 75 }), "Host bar");
  put(text("WITH SAM RIVERA", { x: 220, y: 2662, w: 1200, size: 72, font: "Inter", weight: 900, color: CREAM, align: "center", charSpacing: 300 }), "Host");
}

export default [
  { id: "tv-end-screen", name: "End Screen: Watch Next", size: "yt-end", category: "slides",
    tags: ["youtube", "end", "screen", "outro", "subscribe", "watch next", "video"],
    fonts: [["Kanit", 900], ["Kanit", 700]], build: endScreen },
  { id: "tv-channel-banner", name: "Channel Banner: Night Shift", size: "yt-banner", category: "slides",
    tags: ["youtube", "banner", "channel", "art", "header", "neon", "safe area"],
    fonts: [["Bungee"], ["DM Serif Display", 400, "italic"], ["Barlow Condensed", 700], ["Inter", 800]], build: channelBanner },
  { id: "tv-twitch-offline", name: "Twitch Offline Banner", size: "twitch-offline", category: "slides",
    tags: ["twitch", "offline", "stream", "schedule", "gaming", "purple", "banner"],
    fonts: [["Russo One"], ["Barlow Condensed", 700]], build: twitchOffline },
  { id: "tv-podcast-cover", name: "Podcast Cover", size: "podcast",
    tags: ["podcast", "cover", "art", "square", "spotify", "apple", "show", "mic"],
    fonts: [["Alfa Slab One"], ["DM Serif Display", 400, "italic"], ["Inter", 900]], build: podcastCover },
];
