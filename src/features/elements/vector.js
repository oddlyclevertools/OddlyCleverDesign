// SVG markup to recolourable Fabric groups (Lucide icons and our code-drawn stickers).
import { Group, loadSVGFromString } from "fabric";
import { icons } from "lucide";

/** Parse SVG markup into one Group, scaled so its long side is `size` px. */
export async function svgToGroup(svg, size = 260) {
  const { objects } = await loadSVGFromString(svg);
  const list = objects.filter(Boolean);
  if (!list.length) throw new Error("That graphic is empty.");
  const g = new Group(list, { objectCaching: true });
  const long = Math.max(g.width, g.height) || 1;
  g.scale(size / long);
  return g;
}

// ---- Lucide icons (ISC licence) --------------------------------------------------------

const ICON_NAMES = Object.keys(icons);
const words = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z])([A-Z][a-z])/g, "$1 $2").toLowerCase();
const ICON_INDEX = ICON_NAMES.map((n) => ({ name: n, words: words(n), list: words(n).split(" ") }));

// Shown first when nothing is searched: the icons thumbnails and posts reach for most.
const FEATURED = ["Heart", "Star", "Check", "X", "ArrowRight", "ArrowDown", "Flame", "Zap", "Crown", "Trophy", "DollarSign",
  "TrendingUp", "TrendingDown", "Play", "CirclePlay", "ThumbsUp", "ThumbsDown", "Eye", "Lock", "Bell", "Gift", "Rocket",
  "Lightbulb", "MapPin", "Clock", "Camera", "Music", "Gamepad2", "Smile", "Skull", "Sparkles", "Target", "ShoppingCart",
  "Coffee", "Globe", "Sun", "Moon", "Cloud", "Mail", "Phone", "MessageCircle", "Search", "Settings", "Users", "User",
  "House", "Car", "Plane", "Book", "Brain", "Bomb", "Ghost", "Medal", "PiggyBank", "Banknote", "ChartColumn", "Megaphone",
  "Hourglass", "TriangleAlert", "Info", "CircleHelp", "Ban", "Pizza", "Dumbbell"].filter((n) => icons[n]);
const ORDERED = [...FEATURED, ...ICON_NAMES.filter((n) => !FEATURED.includes(n))];

/** Icon names matching a search (all of them, popular first, for an empty query). */
export function searchIcons(q) {
  const t = q.trim().toLowerCase();
  if (!t) return ORDERED;
  const parts = t.split(/\s+/);
  const scored = [];
  for (const it of ICON_INDEX) {
    if (!parts.every((p) => it.list.some((w) => w.startsWith(p)))) continue;
    const exact = it.words === t ? 0 : it.words.startsWith(t) ? 1 : 2;
    scored.push([exact, it.words.length, it.name]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return scored.map((s) => s[2]);
}

export const iconLabel = (name) => {
  const w = words(name);
  return w.charAt(0).toUpperCase() + w.slice(1);
};

const attrs = (o) => Object.entries(o).map(([k, v]) => `${k}="${String(v).replace(/"/g, "&quot;")}"`).join(" ");

/** SVG markup for a Lucide icon in one colour. */
export function iconSVG(name, color = "#1b1b1f") {
  const node = icons[name];
  if (!node) throw new Error(`No icon called ${name}.`);
  const body = node.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export async function createIcon(name, color = "#1b1b1f") {
  const g = await svgToGroup(iconSVG(name, color), 220);
  g.set({ name: iconLabel(name), data: { kind: "icon", icon: name, color } });
  return g;
}

/** Every colour used by a vector group's parts (fills and strokes), most used first. */
export function groupColors(g) {
  const count = new Map();
  const walk = (o) => {
    if (o._objects) return o._objects.forEach(walk);
    for (const c of [o.fill, o.stroke]) {
      if (typeof c !== "string" || c === "none" || c === "transparent" || !c) continue;
      const k = c.toLowerCase();
      count.set(k, (count.get(k) || 0) + 1);
    }
  };
  walk(g);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

/** Replace one colour with another everywhere inside a group. */
export function replaceGroupColor(g, from, to) {
  const f = String(from).toLowerCase();
  const walk = (o) => {
    if (o._objects) return o._objects.forEach(walk);
    if (typeof o.fill === "string" && o.fill.toLowerCase() === f) o.set("fill", to);
    if (typeof o.stroke === "string" && o.stroke.toLowerCase() === f) o.set("stroke", to);
  };
  walk(g);
  g.set("dirty", true);
}
