// Social templates: an Instagram quote post (1080 x 1080) and a YouTube channel banner
// (2560 x 1440, with the 1546 x 423 safe area that every device shows).
import { bleed, circle, group, line, linear, pill, putter, radial, rect, shadow, sparkle, text } from "./draw.js";

// ---- Instagram quote post --------------------------------------------------------------------

async function quotePost(app) {
  const put = putter(app);
  const ACCENT = "#d9572b", INK = "#1f1b16", MUTED = "#86796b";
  app.editor.setBackground("#f4ece1");
  put(circle(900, 170, 250, "#efd6c1"), "Soft shape");
  put(circle(150, 960, 170, "#e9dfd1"), "Soft shape");
  put(text("“", { x: 96, y: 70, w: 400, size: 420, font: "Playfair Display", weight: 900, color: ACCENT }), "Quote mark");
  put(text("Small steps every day add up to big change.", { x: 120, y: 350, w: 860, size: 104, font: "DM Serif Display",
    color: INK, lineHeight: 1.08 }), "Quote");
  put(rect(122, 762, 84, 7, ACCENT, { rx: 3.5, ry: 3.5 }), "Rule");
  put(text("YOUR NAME", { x: 120, y: 806, w: 700, size: 30, font: "Inter", weight: 700, color: INK, charSpacing: 300 }), "Author");
  put(text("Author, speaker, dreamer", { x: 120, y: 852, w: 700, size: 27, font: "Inter", weight: 500, color: MUTED }), "Author role");
  put(text("@yourhandle", { x: 640, y: 980, w: 340, size: 26, font: "Inter", weight: 600, color: MUTED, align: "right" }), "Handle");
}

// ---- YouTube channel banner ------------------------------------------------------------------

const SAFE = { x: 507, y: 508, w: 1546, h: 424 };

function dotGrid(x0, y0, cols, rows, gap, r, fill) {
  const dots = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) dots.push(circle(x0 + i * gap, y0 + j * gap, r, fill));
  return group(dots);
}

async function channelBanner(app) {
  const put = putter(app);
  app.editor.setBackground(linear(105, ["#090d24", [0.5, "#17103c"], [1, "#2a0d38"]]));
  put(bleed(circle(260, 1180, 700, radial(["rgba(255,61,139,0.5)", "rgba(255,61,139,0)"]))), "Glow");
  put(bleed(circle(2340, 260, 640, radial(["rgba(70,120,255,0.5)", "rgba(70,120,255,0)"]))), "Glow");
  put(circle(260, 720, 230, linear(135, ["#ff3d8b", "#7c3aed"]), { shadow: shadow("rgba(0,0,0,0.4)", 60, 0, 20) }), "Shape");
  put(circle(2290, 720, 190, "", { fill: null, stroke: "#ffe14d", strokeWidth: 26 }), "Ring");
  put(rect(2120, 530, 120, 120, "#38bdf8", { rx: 28, ry: 28, angle: 18 }), "Shape");
  put(dotGrid(80, 520, 6, 5, 46, 6, "rgba(255,255,255,0.22)"), "Dots");
  put(dotGrid(2180, 820, 6, 5, 46, 6, "rgba(255,255,255,0.22)"), "Dots");
  put(sparkle(470, 560, 30, "#ffe14d"), "Sparkle");
  put(sparkle(2090, 880, 24, "#ffffff"), "Sparkle");

  put(text("YOUR CHANNEL", { x: SAFE.x, y: 556, w: SAFE.w, size: 160, font: "Montserrat", weight: 900, color: "#ffffff",
    align: "center", charSpacing: 20, shadow: shadow("rgba(0,0,0,0.45)", 30, 0, 10) }), "Channel name");
  put(line(1180, 760, 1380, 760, "#ff3d8b", 8), "Rule");
  put(text("New videos every Tuesday and Thursday", { x: SAFE.x, y: 790, w: SAFE.w, size: 52, font: "Inter", weight: 600,
    color: "#c9bcff", align: "center" }), "Tagline");

  // A dashed guide for the safe area: visible while editing, never exported.
  const guide = { guide: true };
  put(rect(SAFE.x, SAFE.y, SAFE.w, SAFE.h, "", { fill: null, stroke: "rgba(255,255,255,0.55)", strokeWidth: 4,
    strokeDashArray: [18, 14], data: guide }), "Safe area guide (not exported)");
  put(pill("SAFE AREA · SHOWN ON EVERY DEVICE", { x: SAFE.x, y: SAFE.y - 58, h: 44, size: 20, pad: 18, fill: "rgba(255,255,255,0.14)",
    spacing: 160 }).set({ data: guide }), "Safe area label (not exported)");
}

export default [
  { id: "quote-post", name: "Quote Post", size: "ig-post", tags: ["instagram", "quote", "square", "social", "serif", "warm"],
    fonts: [["Playfair Display", 900], ["DM Serif Display"], ["Inter", 700], ["Inter", 500], ["Inter", 600]], build: quotePost },
  { id: "channel-banner", name: "Channel Banner", size: "yt-banner", tags: ["youtube", "banner", "channel", "art", "header"],
    fonts: [["Montserrat", 900], ["Inter", 600], ["Inter", 800]], build: channelBanner },
];
