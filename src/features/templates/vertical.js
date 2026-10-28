// Vertical templates (1080 x 1920): two Shorts covers and an Instagram story.
import {
  bleed, circle, group, linear, outlined, pill, poly, putter, radial, rect, shadow, silhouette, slotLabel,
  sparkle, text,
} from "./draw.js";

// ---- Shorts cover: big number hook --------------------------------------------------------

async function shortsNumber(app) {
  const put = putter(app);
  app.editor.setBackground(linear(180, ["#22104f", [0.55, "#120838"], [1, "#05030f"]]));
  put(bleed(circle(540, 820, 620, radial(["rgba(255,61,139,0.55)", [0.5, "rgba(124,58,237,0.28)"], [1, "rgba(124,58,237,0)"]]))), "Glow");
  put(sparkle(170, 520, 46, "#ffe14d"), "Sparkle");
  put(sparkle(930, 380, 30, "#ffffff"), "Sparkle");
  put(sparkle(900, 1130, 40, "#ff7ab6"), "Sparkle");
  put(sparkle(150, 1080, 24, "#ffffff"), "Sparkle");

  put(pill("PART 1", { x: 540, y: 230, h: 84, size: 36, pad: 40, font: "Montserrat", weight: 900, fill: "#ff3d8b", center: true,
    spacing: 160, shadowOf: shadow("rgba(255,61,139,0.5)", 30, 0, 8) }), "Part tag");
  put(text("3", { x: 140, y: 300, w: 800, size: 820, font: "Anton", align: "center",
    fill: linear(180, ["#fff59a", [0.5, "#ffd400"], [1, "#ffa600"]]), ...outlined("#000000", 30),
    shadow: shadow("rgba(0,0,0,0.6)", 0, 14, 22) }), "Big number");
  put(text("MONEY RULES", { x: 40, y: 1250, w: 1000, size: 170, font: "Anton", color: "#ffffff", align: "center",
    ...outlined("#000000", 20), shadow: shadow("rgba(0,0,0,0.55)", 0, 8, 12) }), "Title");
  put(group([
    rect(150, 1464, 780, 118, "#ffe14d", { rx: 16, ry: 16, shadow: shadow("rgba(0,0,0,0.5)", 24, 0, 10) }),
    text("NOBODY TELLS YOU", { x: 150, y: 1490, w: 780, size: 70, font: "Montserrat", weight: 900, color: "#111111", align: "center" }),
  ], { angle: -2 }), "Highlight");
}

// ---- Shorts cover: story time (light) -----------------------------------------------------

async function shortsStory(app) {
  const put = putter(app);
  app.editor.setBackground("#f5efe6");
  put(bleed(circle(980, 200, 300, "#f0dcc6")), "Soft shape");
  put(bleed(circle(80, 1700, 260, "#ece3d6")), "Soft shape");
  const frame = group([
    rect(110, 250, 860, 1000, "#ffffff", { rx: 40, ry: 40, shadow: shadow("rgba(80,50,20,0.22)", 50, 0, 20) }),
    rect(140, 280, 800, 940, linear(165, ["#e2cfb8", "#b99a7a"]), { rx: 24, ry: 24 }),
    silhouette(540, 1220, 620, "rgba(255,255,255,0.32)"),
    slotLabel(540, 520, { label: "YOUR PHOTO", size: 34 }),
  ], { angle: -2 });
  put(frame, "Photo frame");
  put(pill("STORY TIME", { x: 610, y: 214, h: 96, size: 40, pad: 40, font: "Montserrat", weight: 900, fill: "#ff5a36",
    shadowOf: shadow("rgba(200,60,20,0.35)", 24, 0, 8) }).set({ angle: 5 }), "Sticker");

  put(text("I QUIT MY JOB", { x: 40, y: 1346, w: 1000, size: 108, font: "Archivo Black", color: "#1c1917", align: "center" }), "Title");
  put(rect(300, 1490, 480, 150, "#ffd84d", { rx: 10, ry: 10, angle: -2 }), "Marker");
  put(text("AT 25", { x: 240, y: 1490, w: 600, size: 150, font: "Archivo Black", color: "#1c1917", align: "center" }), "Title accent");
  put(text("@yourchannel", { x: 140, y: 1700, w: 800, size: 40, font: "Inter", weight: 600, color: "#8a7f73", align: "center" }), "Handle");
}

// ---- Instagram story: new video ------------------------------------------------------------

async function storyNewVideo(app) {
  const put = putter(app);
  app.editor.setBackground(linear(165, ["#ff7a3d", [0.5, "#ff2e63"], [1, "#6a2cf0"]]));
  put(bleed(circle(940, 260, 420, radial(["rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]))), "Light");
  put(sparkle(150, 300, 44, "#ffffff"), "Sparkle");
  put(sparkle(930, 560, 28, "#ffe14d"), "Sparkle");
  put(sparkle(120, 1330, 30, "#ffe14d"), "Sparkle");

  put(text("NEW", { x: 90, y: 220, w: 900, size: 230, font: "Anton", color: "#ffffff", align: "center",
    shadow: shadow("rgba(80,0,40,0.35)", 30, 0, 12) }), "Title");
  put(text("VIDEO", { x: 90, y: 440, w: 900, size: 230, font: "Anton", color: "#ffe14d", align: "center",
    shadow: shadow("rgba(80,0,40,0.35)", 30, 0, 12) }), "Title accent");

  put(rect(110, 760, 860, 640, "#ffffff", { rx: 48, ry: 48, shadow: shadow("rgba(60,0,60,0.4)", 60, 0, 24) }), "Card");
  put(rect(150, 800, 780, 439, linear(135, ["#232a3b", "#4b5568"]), { rx: 28, ry: 28 }), "Thumbnail placeholder");
  put(slotLabel(540, 1150, { label: "YOUR THUMBNAIL", size: 26, color: "rgba(255,255,255,0.7)" }), "Thumbnail label");
  put(group([
    circle(540, 1010, 74, "rgba(255,255,255,0.95)", { shadow: shadow("rgba(0,0,0,0.35)", 24, 0, 8) }),
    poly([[518, 970], [518, 1050], [584, 1010]], "#ff2e63", { stroke: "#ff2e63", strokeWidth: 8, strokeLineJoin: "round" }),
  ]), "Play button");
  put(text("How I built it in 30 days", { x: 150, y: 1278, w: 780, size: 46, font: "Inter", weight: 800, color: "#14121a" }), "Video title");
  put(text("12:47  ·  New", { x: 150, y: 1336, w: 780, size: 30, font: "Inter", weight: 600, color: "#8a8595" }), "Video meta");

  put(pill("TAP TO WATCH", { x: 540, y: 1520, h: 124, size: 46, pad: 64, font: "Montserrat", weight: 900, fill: "#ffffff",
    color: "#14121a", center: true, spacing: 100, shadowOf: shadow("rgba(60,0,60,0.35)", 30, 0, 12) }), "Button");
}

const shortsTags = ["shorts", "reels", "tiktok", "vertical", "cover"];
export default [
  { id: "shorts-number", name: "Shorts: Big Hook", size: "shorts", tags: [...shortsTags, "number", "dark", "money"],
    fonts: [["Anton"], ["Montserrat", 900]], build: shortsNumber },
  { id: "shorts-story", name: "Shorts: Story Time", size: "shorts", tags: [...shortsTags, "light", "photo", "story", "vlog"],
    fonts: [["Archivo Black"], ["Montserrat", 900], ["Inter", 600], ["Inter", 700]], build: shortsStory },
  { id: "story-new-video", name: "Story: New Video", size: "ig-story", tags: ["instagram", "story", "facebook", "vertical", "announcement", "gradient"],
    fonts: [["Anton"], ["Montserrat", 900], ["Inter", 800], ["Inter", 600], ["Inter", 700]], build: storyNewVideo },
];
