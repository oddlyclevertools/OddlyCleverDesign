// Print templates: an event poster (18 x 24 in, 1800 x 2400 px).
import { bleed, burst, circle, group, line, linear, putter, rect, shadow, text } from "./draw.js";

const NIGHT = "#15123c";

/** A retro perspective grid floor from the horizon (y0) to the bottom (y1). */
function gridFloor(y0, y1, w, color) {
  const vx = w / 2, lines = [];
  for (let i = -12; i <= 12; i++) lines.push(line(vx + i * 38, y0, vx + i * 260, y1, color, 4));
  for (let k = 1; k <= 9; k++) {
    const t = (k / 9) ** 2, y = y0 + (y1 - y0) * t;
    lines.push(line(-40, y, w + 40, y, color, 3 + t * 3));
  }
  return group(lines);
}

async function eventPoster(app) {
  const put = putter(app);
  const W = 1800, HORIZON = 1440, YELLOW = "#ffd23f", PINK = "#ff2e7e";
  app.editor.setBackground(linear(180, ["#0d0b2a", [0.6, NIGHT], [1, "#241a5e"]]));
  put(circle(900, 1000, 560, linear(180, [YELLOW, [0.55, "#ff6b3d"], [1, PINK]]),
    { shadow: shadow("rgba(255,80,120,0.45)", 140) }), "Sun");
  [14, 22, 32, 44, 58].forEach((h, i) => put(rect(300, 1080 + i * 74, 1200, h, NIGHT), "Sun stripe"));
  put(bleed(rect(0, HORIZON, W, 2400 - HORIZON, "#1d1752")), "Floor");
  put(bleed(gridFloor(HORIZON, 2400, W, "rgba(255,46,126,0.55)")), "Grid");
  put(bleed(rect(0, HORIZON - 4, W, 8, PINK, { shadow: shadow(PINK, 30) })), "Horizon");
  put(bleed(rect(0, 1860, W, 540, linear(180, ["rgba(21,18,60,0)", [0.35, "rgba(21,18,60,0.92)"], [1, NIGHT]]))), "Fade");

  put(text("SUMMER", { x: 0, y: 130, w: W, size: 450, font: "Bebas Neue", color: "#ffffff", align: "center", charSpacing: 20,
    shadow: shadow("rgba(0,0,0,0.35)", 40, 0, 14) }), "Title");
  put(text("NIGHTS", { x: 0, y: 1480, w: W, size: 440, font: "Bebas Neue", color: YELLOW, align: "center", charSpacing: 40,
    shadow: shadow("rgba(0,0,0,0.5)", 40, 0, 16) }), "Title accent");

  put(group([
    burst(1490, 820, 180, 152, 18, PINK, { shadow: shadow("rgba(0,0,0,0.35)", 30, 0, 10) }),
    text("FREE\nENTRY", { x: 1330, y: 732, w: 320, size: 92, font: "Anton", color: "#ffffff", align: "center", lineHeight: 0.95 }),
  ], { angle: 12 }), "Badge");

  put(text("LIVE MUSIC  ·  FOOD  ·  ART", { x: 0, y: 1990, w: W, size: 62, font: "Montserrat", weight: 800, color: "#ffffff",
    align: "center", charSpacing: 200 }), "Line-up");
  put(text("SAT 14 JUNE  ·  7 PM", { x: 0, y: 2090, w: W, size: 104, font: "Montserrat", weight: 900, color: YELLOW, align: "center" }), "Date");
  put(text("Riverside Park, Your City", { x: 0, y: 2232, w: W, size: 54, font: "Inter", weight: 600,
    color: "rgba(255,255,255,0.75)", align: "center" }), "Venue");
}

export default [
  { id: "event-poster", name: "Event Poster", size: "poster", tags: ["poster", "event", "print", "music", "retro", "party", "flyer"],
    fonts: [["Bebas Neue"], ["Anton"], ["Montserrat", 800], ["Montserrat", 900], ["Inter", 600]], build: eventPoster },
];
