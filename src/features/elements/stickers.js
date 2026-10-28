// Thumbnail stickers drawn in code (our own artwork, CC0). Each one is SVG markup with a main
// colour, so the toolbar can recolour it; the panel shows the same markup as its preview.
import { svgToGroup } from "./vector.js";

const INK = "#1b1b1f";
const WHITE = "#ffffff";

function spiky(cx, cy, radii, rot = 0) {
  const n = radii.length;
  return radii.map((r, i) => {
    const a = rot + (i * Math.PI * 2) / n - Math.PI / 2;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");
}
const BOOM_OUT = [96, 58, 88, 52, 99, 60, 84, 50, 94, 56, 90, 54, 98, 58, 86, 50, 95, 55, 89, 53];
const BOOM_IN = BOOM_OUT.map((r) => r * 0.62);
const BURST = Array.from({ length: 36 }, (_, i) => (i % 2 ? 80 : 96));

const ARROW = "M14 78 L118 78 L118 38 L190 100 L118 162 L118 122 L14 122 Z";

/** key, label, tags, main colour, viewBox and the SVG body (with {c} for the main colour). */
export const STICKERS = [
  { key: "redArrow", label: "Red arrow", tags: "arrow pointer right thumbnail", color: "#ff2b2b",
    box: "0 0 204 200", body: `<path d="${ARROW}" fill="none" stroke="${WHITE}" stroke-width="16" stroke-linejoin="round"/><path d="${ARROW}" fill="{c}" stroke="{c}" stroke-width="2" stroke-linejoin="round"/>` },
  { key: "redArrowDown", label: "Arrow pointing down", tags: "arrow pointer down thumbnail", color: "#ff2b2b",
    box: "0 0 204 204", body: `<g transform="rotate(45 102 102)"><path d="${ARROW}" fill="none" stroke="${WHITE}" stroke-width="16" stroke-linejoin="round"/><path d="${ARROW}" fill="{c}"/></g>` },
  { key: "curvedArrow", label: "Curved arrow", tags: "arrow hand drawn pointer swoosh", color: "#ff2b2b",
    box: "0 0 210 190", body: `<path d="M28 160 C 38 84, 104 40, 166 58" fill="none" stroke="${WHITE}" stroke-width="28" stroke-linecap="round"/>
      <path d="M186 64 L150 76 L164 34 Z" fill="${WHITE}" stroke="${WHITE}" stroke-width="14" stroke-linejoin="round"/>
      <path d="M28 160 C 38 84, 104 40, 166 58" fill="none" stroke="{c}" stroke-width="15" stroke-linecap="round"/>
      <path d="M186 64 L150 76 L164 34 Z" fill="{c}" stroke="{c}" stroke-width="4" stroke-linejoin="round"/>` },
  { key: "circleMark", label: "Hand-drawn circle", tags: "circle highlight scribble ring mark", color: "#ff2b2b",
    box: "0 0 220 190", body: `<path d="M44 98 C40 52 92 26 134 30 C180 34 200 74 190 110 C178 154 116 172 74 160 C36 150 18 118 34 88 C48 64 82 50 114 46" fill="none" stroke="{c}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: "underline", label: "Scribble underline", tags: "underline highlight hand drawn", color: "#ff2b2b",
    box: "0 0 210 90", body: `<path d="M14 40 C60 26 126 46 196 30 M30 62 C82 50 136 66 182 56" fill="none" stroke="{c}" stroke-width="10" stroke-linecap="round"/>` },
  { key: "xMark", label: "X mark", tags: "cross wrong no bad cancel", color: "#ff2b2b",
    box: "0 0 200 200", body: `<path d="M46 46 L154 154 M154 46 L46 154" stroke="${WHITE}" stroke-width="52" stroke-linecap="round"/><path d="M46 46 L154 154 M154 46 L46 154" stroke="{c}" stroke-width="32" stroke-linecap="round"/>` },
  { key: "check", label: "Check mark", tags: "tick yes right good correct", color: "#1fc15a",
    box: "0 0 200 200", body: `<path d="M38 104 L84 150 L166 52" fill="none" stroke="${WHITE}" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 104 L84 150 L166 52" fill="none" stroke="{c}" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: "newBadge", label: "NEW badge", tags: "new burst label sale", color: "#ffd21f",
    box: "0 0 200 200", body: `<g transform="rotate(-12 100 100)"><polygon points="${spiky(100, 100, BURST)}" fill="{c}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <g fill="${INK}"><polygon points="25,125 25,75 37,75 53,104 53,75 65,75 65,125 53,125 37,96 37,125"/>
      <polygon points="73,75 105,75 105,86 85,86 85,95 102,95 102,105 85,105 85,114 105,114 105,125 73,125"/>
      <polygon points="113,75 125,75 131,107 138,75 150,75 157,107 163,75 175,75 163,125 151,125 144,95 137,125 125,125"/></g></g>` },
  { key: "alert", label: "! badge", tags: "exclamation alert warning attention", color: "#ff2b2b",
    box: "0 0 200 200", body: `<circle cx="100" cy="100" r="86" fill="{c}" stroke="${WHITE}" stroke-width="10"/><rect x="87" y="40" width="26" height="82" rx="13" fill="${WHITE}"/><circle cx="100" cy="150" r="14" fill="${WHITE}"/>` },
  { key: "priceTag", label: "Price tag", tags: "sale discount percent offer", color: "#ff4d2e",
    box: "0 0 210 200", body: `<g transform="rotate(-18 105 100)"><path d="M16 100 L68 42 L184 42 Q196 42 196 54 L196 146 Q196 158 184 158 L68 158 Z" fill="{c}" stroke="${WHITE}" stroke-width="7" stroke-linejoin="round"/>
      <circle cx="60" cy="100" r="11" fill="${WHITE}"/><circle cx="112" cy="78" r="12" fill="none" stroke="${WHITE}" stroke-width="8"/>
      <circle cx="158" cy="122" r="12" fill="none" stroke="${WHITE}" stroke-width="8"/><path d="M160 68 L110 132" stroke="${WHITE}" stroke-width="9" stroke-linecap="round"/></g>` },
  { key: "boom", label: "Explosion", tags: "burst boom bang pow comic", color: "#ff5a1f",
    box: "0 0 200 200", body: `<polygon points="${spiky(100, 100, BOOM_OUT)}" fill="{c}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <polygon points="${spiky(100, 100, BOOM_IN, 0.16)}" fill="#ffd21f" stroke-linejoin="round"/>
      <polygon points="${spiky(100, 100, BOOM_IN.map((r) => r * 0.5), 0.3)}" fill="${WHITE}"/>` },
  { key: "sparkles", label: "Sparkles", tags: "stars shine magic twinkle", color: "#ffc81f",
    box: "0 0 200 200", body: `<path d="M86 20 Q94 78 150 86 Q94 94 86 152 Q78 94 22 86 Q78 78 86 20 Z" fill="{c}"/>
      <path d="M156 112 Q160 140 186 144 Q160 148 156 176 Q152 148 126 144 Q152 140 156 112 Z" fill="{c}"/>
      <path d="M150 18 Q153 36 170 39 Q153 42 150 60 Q147 42 130 39 Q147 36 150 18 Z" fill="{c}"/>` },
  { key: "faceHappy", label: "Happy face", tags: "emoji smile face happy", color: "#ffcc33",
    box: "0 0 200 200", body: `<circle cx="100" cy="100" r="90" fill="{c}" stroke="#e3a600" stroke-width="5"/>
      <circle cx="52" cy="118" r="14" fill="#ff7a8a" opacity="0.45"/><circle cx="148" cy="118" r="14" fill="#ff7a8a" opacity="0.45"/>
      <ellipse cx="70" cy="80" rx="10" ry="15" fill="#3b2412"/><ellipse cx="130" cy="80" rx="10" ry="15" fill="#3b2412"/>
      <path d="M56 118 Q100 172 144 118" fill="none" stroke="#3b2412" stroke-width="11" stroke-linecap="round"/>` },
  { key: "faceShocked", label: "Shocked face", tags: "emoji surprised wow face omg", color: "#ffcc33",
    box: "0 0 200 200", body: `<circle cx="100" cy="100" r="90" fill="{c}" stroke="#e3a600" stroke-width="5"/>
      <path d="M46 52 Q64 36 84 46 M116 46 Q136 36 154 52" fill="none" stroke="#3b2412" stroke-width="8" stroke-linecap="round"/>
      <circle cx="68" cy="84" r="19" fill="${WHITE}" stroke="#3b2412" stroke-width="4"/><circle cx="132" cy="84" r="19" fill="${WHITE}" stroke="#3b2412" stroke-width="4"/>
      <circle cx="68" cy="86" r="8" fill="#3b2412"/><circle cx="132" cy="86" r="8" fill="#3b2412"/>
      <ellipse cx="100" cy="142" rx="20" ry="26" fill="#3b2412"/>` },
  { key: "faceAngry", label: "Angry face", tags: "emoji mad face rage", color: "#ff6a3d",
    box: "0 0 200 200", body: `<circle cx="100" cy="100" r="90" fill="{c}" stroke="#c9401b" stroke-width="5"/>
      <path d="M44 62 L86 80 M156 62 L114 80" fill="none" stroke="#3b1408" stroke-width="10" stroke-linecap="round"/>
      <ellipse cx="70" cy="96" rx="10" ry="12" fill="#3b1408"/><ellipse cx="130" cy="96" rx="10" ry="12" fill="#3b1408"/>
      <path d="M62 152 Q100 118 138 152" fill="none" stroke="#3b1408" stroke-width="11" stroke-linecap="round"/>` },
  { key: "faceCool", label: "Cool face", tags: "emoji sunglasses face cool", color: "#ffcc33",
    box: "0 0 200 200", body: `<circle cx="100" cy="100" r="90" fill="{c}" stroke="#e3a600" stroke-width="5"/>
      <path d="M26 74 L174 74" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
      <path d="M34 72 L92 72 L88 100 Q84 114 66 114 Q42 114 38 98 Z M108 72 L166 72 L162 98 Q158 114 134 114 Q116 114 112 100 Z" fill="${INK}"/>
      <path d="M50 80 L70 80" stroke="#5a5a66" stroke-width="5" stroke-linecap="round"/>
      <path d="M66 140 Q104 166 140 134" fill="none" stroke="#3b2412" stroke-width="10" stroke-linecap="round"/>` },
  { key: "faceSad", label: "Sad face", tags: "emoji cry tear face sad", color: "#ffcc33",
    box: "0 0 200 200", body: `<circle cx="100" cy="100" r="90" fill="{c}" stroke="#e3a600" stroke-width="5"/>
      <path d="M50 62 Q64 54 82 62 M118 62 Q136 54 150 62" fill="none" stroke="#3b2412" stroke-width="7" stroke-linecap="round"/>
      <ellipse cx="70" cy="88" rx="10" ry="14" fill="#3b2412"/><ellipse cx="130" cy="88" rx="10" ry="14" fill="#3b2412"/>
      <path d="M140 104 Q152 126 140 134 Q128 126 140 104 Z" fill="#4fb6ff"/>
      <path d="M64 150 Q100 124 136 150" fill="none" stroke="#3b2412" stroke-width="10" stroke-linecap="round"/>` },
];

export function stickerSVG(key, color) {
  const s = STICKERS.find((x) => x.key === key);
  if (!s) throw new Error(`No sticker called ${key}.`);
  const [, , w, h] = s.box.split(" ").map(Number);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${s.box}" width="${w}" height="${h}">${s.body.replaceAll("{c}", color || s.color)}</svg>`;
}

export async function createSticker(key) {
  const s = STICKERS.find((x) => x.key === key);
  const g = await svgToGroup(stickerSVG(key), 260);
  g.set({ name: s.label, data: { kind: "sticker", sticker: key } });
  return g;
}
