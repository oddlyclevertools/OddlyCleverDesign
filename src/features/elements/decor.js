// Decorative graphics (our own artwork, CC0): blobs, waves, squiggles, sparkles, confetti,
// scribbles, brush strokes, hand-drawn arrows and circles, halftone, neon lines, plus two
// special overlays made as Fabric objects: film grain (a noise pattern) and light leaks
// (soft gradients in screen blend). Each SVG item has a main colour {c}, so it recolours.
import { Gradient, Pattern, Rect } from "fabric";
import { svgToGroup } from "./vector.js";
import { burstPath, rng } from "./art.js";
import { pageIsDark } from "./fill.js";

const f = (n) => Number(n).toFixed(1);

/** A rough brush stroke: a thick band with ragged edges. */
function brush(seed, w = 200, h = 46, x0 = 10, y0 = 70, bend = 10) {
  const r = rng(seed);
  const n = 22;
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + t * w;
    const mid = y0 + Math.sin(t * Math.PI) * -bend;
    const taper = Math.min(1, t * 6, (1 - t) * 4 + 0.15);
    const th = (h / 2) * taper;
    top.push(`${f(x)} ${f(mid - th - r() * 5)}`);
    bot.push(`${f(x)} ${f(mid + th + r() * 5)}`);
  }
  return `M${top.join(" L")} L${bot.reverse().join(" L")} Z`;
}

/** A scribble: loose overlapping loops, like a pen scratching something out. */
function scribble(seed) {
  const r = rng(seed);
  const pts = [];
  const turns = 7, n = 160;
  let amp = 46;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * turns * Math.PI * 2;
    if (i % 23 === 0) amp = 34 + r() * 26;
    const x = 34 + (i / n) * 132 + Math.cos(t) * 20;
    const y = 100 + Math.sin(t) * amp + (r() - 0.5) * 3;
    pts.push(`${f(x)} ${f(y)}`);
  }
  return `M${pts.join(" L")}`;
}

/** Halftone dots that shrink across the box. */
function halftone(cols, rows, shape = "corner") {
  let out = "";
  const s = 200 / cols;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cx = s / 2 + x * s, cy = s / 2 + y * s;
      let k;
      if (shape === "corner") k = 1 - (x + y) / (cols + rows - 2);
      else { const d = Math.hypot(cx - 100, cy - 100) / 100; k = 1 - d; }
      const rr = (s / 2) * 0.95 * k;
      if (rr > 0.8) out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rr)}" fill="{c}"/>`;
    }
  }
  return out;
}

function confetti(seed) {
  const r = rng(seed);
  const cols = ["{c}", "#ffc83d", "#8fe3ff", "#16121b"];
  let out = "";
  for (let i = 0; i < 26; i++) {
    const x = 14 + r() * 172, y = 14 + r() * 172, a = Math.round(r() * 180), c = cols[i % cols.length];
    const k = i % 3;
    if (k === 0) out += `<rect x="${f(x - 7)}" y="${f(y - 3)}" width="14" height="6" rx="2" fill="${c}" transform="rotate(${a} ${f(x)} ${f(y)})"/>`;
    else if (k === 1) out += `<circle cx="${f(x)}" cy="${f(y)}" r="4.5" fill="${c}"/>`;
    else out += `<path d="M${f(x - 8)} ${f(y)} q4 -7 8 0 t8 0" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" transform="rotate(${a} ${f(x)} ${f(y)})"/>`;
  }
  return out;
}

const sparkle = (cx, cy, r) => `M${cx} ${cy - r} Q${cx + r * 0.12} ${cy - r * 0.12} ${cx + r} ${cy} Q${cx + r * 0.12} ${cy + r * 0.12} ${cx} ${cy + r} Q${cx - r * 0.12} ${cy + r * 0.12} ${cx - r} ${cy} Q${cx - r * 0.12} ${cy - r * 0.12} ${cx} ${cy - r} Z`;

/** Neon: a path drawn as layered glow strokes and a hot core. */
const neon = (d, extra = "") => `<g fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra}>
  <path d="${d}" stroke="{c}" stroke-width="30" opacity="0.12"/><path d="${d}" stroke="{c}" stroke-width="18" opacity="0.25"/>
  <path d="${d}" stroke="{c}" stroke-width="9"/><path d="${d}" stroke="#fff3fa" stroke-width="3"/></g>`;

/** key, label, tags, main colour, viewBox, SVG body (with {c} for the main colour). */
export const DECOR = [
  { key: "blob1", label: "Blob", tags: "blob shape organic splash", color: "#ff2e7e", box: "0 0 200 200",
    body: `<path d="M140 28 C178 38 192 84 172 116 C156 142 178 172 140 184 C104 194 92 158 60 160 C26 162 8 128 22 96 C34 68 18 40 52 28 C84 16 108 20 140 28 Z" fill="{c}"/>` },
  { key: "blob2", label: "Blob pair", tags: "blob shape organic two layered", color: "#8fe3ff", box: "0 0 200 200",
    body: `<path d="M146 30 C182 50 176 104 150 126 C122 150 80 140 60 116 C36 88 50 46 82 32 C104 22 128 20 146 30 Z" fill="#ffc83d"/>
      <path d="M120 84 C158 98 164 150 134 172 C104 194 50 186 30 156 C12 128 26 92 58 82 C80 74 100 76 120 84 Z" fill="{c}"/>` },
  { key: "blobRing", label: "Blob outline", tags: "blob outline shape organic ring", color: "#16121b", box: "0 0 200 200",
    body: `<path d="M150 44 C182 70 184 122 156 150 C126 180 72 186 44 156 C14 124 24 72 56 46 C86 22 122 22 150 44 Z" fill="none" stroke="{c}" stroke-width="7"/>` },
  { key: "wave", label: "Wave band", tags: "wave water band flow divider", color: "#8fe3ff", box: "0 0 300 120",
    body: `<path d="M0 50 C40 20 80 20 120 50 C160 80 200 80 240 50 C260 35 280 28 300 30 L300 120 L0 120 Z" fill="{c}"/>
      <path d="M0 80 C40 54 80 54 120 80 C160 106 200 106 240 80 C260 68 280 62 300 64 L300 120 L0 120 Z" fill="#16121b" opacity="0.18"/>` },
  { key: "squiggle", label: "Squiggle", tags: "squiggle wavy line doodle", color: "#ff2e7e", box: "0 0 240 80",
    body: `<path d="M14 40 q16 -26 32 0 t32 0 t32 0 t32 0 t32 0 t32 0 t32 0" fill="none" stroke="{c}" stroke-width="10" stroke-linecap="round"/>` },
  { key: "zigzag", label: "Zigzag", tags: "zigzag line memphis doodle", color: "#ffc83d", box: "0 0 240 80",
    body: `<path d="M14 54 L40 22 L66 54 L92 22 L118 54 L144 22 L170 54 L196 22 L222 54" fill="none" stroke="{c}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: "sparkle", label: "Sparkle", tags: "sparkle star shine twinkle glint", color: "#ffc83d", box: "0 0 200 200",
    body: `<path d="${sparkle(100, 100, 86)}" fill="{c}"/>` },
  { key: "sparkles3", label: "Sparkle cluster", tags: "sparkles stars shine twinkle magic", color: "#8fe3ff", box: "0 0 200 200",
    body: `<path d="${sparkle(84, 96, 64)}" fill="{c}"/><path d="${sparkle(158, 48, 28)}" fill="{c}"/><path d="${sparkle(156, 150, 20)}" fill="{c}"/>` },
  { key: "confetti", label: "Confetti", tags: "confetti party celebrate pieces", color: "#ff2e7e", box: "0 0 200 200", body: confetti(7) },
  { key: "scribble", label: "Scribble", tags: "scribble doodle messy hand drawn", color: "#16121b", box: "0 0 200 200",
    body: `<path d="${scribble(3)}" fill="none" stroke="{c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: "brush", label: "Brush stroke", tags: "brush stroke paint swipe highlight marker", color: "#ff2e7e", box: "0 0 220 140",
    body: `<path d="${brush(11)}" fill="{c}"/>` },
  { key: "brushBold", label: "Paint swipe", tags: "brush paint swipe stroke bold behind text", color: "#ffc83d", box: "0 0 220 140",
    body: `<path d="${brush(5, 200, 70, 10, 74, 4)}" fill="{c}"/><path d="${brush(9, 150, 14, 40, 104, 2)}" fill="{c}" opacity="0.7"/>` },
  { key: "handArrow", label: "Hand-drawn arrow", tags: "arrow hand drawn doodle pointer curve", color: "#16121b", box: "0 0 220 160",
    body: `<path d="M20 130 C40 60 110 30 182 52" fill="none" stroke="{c}" stroke-width="7" stroke-linecap="round"/>
      <path d="M156 30 L186 52 L160 80" fill="none" stroke="{c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: "loopArrow", label: "Loop arrow", tags: "arrow loop hand drawn doodle twirl", color: "#ff2e7e", box: "0 0 240 160",
    body: `<path d="M16 120 C50 120 70 100 86 76 C104 46 88 20 70 30 C50 42 70 84 112 96 C150 106 186 94 208 70" fill="none" stroke="{c}" stroke-width="7" stroke-linecap="round"/>
      <path d="M182 60 L210 68 L200 96" fill="none" stroke="{c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: "handCircle", label: "Hand-drawn ring", tags: "circle ring hand drawn highlight mark scribble", color: "#ff2e7e", box: "0 0 240 170",
    body: `<path d="M60 40 C110 14 200 22 214 72 C226 120 150 152 90 146 C34 140 12 104 26 74 C38 48 80 30 130 28" fill="none" stroke="{c}" stroke-width="7" stroke-linecap="round"/>
      <path d="M50 54 C100 26 190 36 204 80" fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>` },
  { key: "handUnderline", label: "Swoosh underline", tags: "underline swoosh hand drawn highlight", color: "#ffc83d", box: "0 0 240 70",
    body: `<path d="M12 46 C70 22 160 18 228 30 C170 30 110 38 60 56" fill="none" stroke="{c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: "halftoneCorner", label: "Halftone corner", tags: "halftone dots comic corner pattern", color: "#16121b", box: "0 0 200 200", body: halftone(14, 14, "corner") },
  { key: "halftoneRound", label: "Halftone circle", tags: "halftone dots comic circle pattern", color: "#ff2e7e", box: "0 0 200 200", body: halftone(16, 16, "round") },
  { key: "dotGrid", label: "Dot grid", tags: "dots grid pattern patch", color: "#16121b", box: "0 0 200 200",
    body: Array.from({ length: 36 }, (_, i) => `<circle cx="${25 + (i % 6) * 30}" cy="${25 + Math.floor(i / 6) * 30}" r="5" fill="{c}"/>`).join("") },
  { key: "speedLines", label: "Speed lines", tags: "speed lines motion fast action comic", color: "#16121b", box: "0 0 240 140",
    body: [20, 44, 64, 86, 106, 124].map((y, i) => `<path d="M${30 + (i % 3) * 22} ${y} L${200 - (i % 2) * 30} ${y}" stroke="{c}" stroke-width="${6 - (i % 3)}" stroke-linecap="round"/>`).join("") },
  { key: "rays", label: "Burst rays", tags: "rays burst sun shine behind spotlight", color: "#ffc83d", box: "0 0 200 200",
    body: Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2, b = a + 0.12; return `<path d="M100 100 L${f(100 + Math.cos(a - 0.12) * 98)} ${f(100 + Math.sin(a - 0.12) * 98)} L${f(100 + Math.cos(b) * 98)} ${f(100 + Math.sin(b) * 98)} Z" fill="{c}"/>`; }).join("") },
  { key: "starDoodles", label: "Star doodles", tags: "stars doodles hand drawn sparkle", color: "#16121b", box: "0 0 200 200",
    body: `<path d="${burstPath(60, 70, 34, 14, 5)}" fill="none" stroke="{c}" stroke-width="5" stroke-linejoin="round"/>
      <path d="${burstPath(146, 128, 26, 10, 5, 0.3)}" fill="none" stroke="{c}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M150 40 L150 70 M135 55 L165 55 M56 140 L56 164 M44 152 L68 152" stroke="{c}" stroke-width="5" stroke-linecap="round"/>` },
  { key: "neonLine", label: "Neon line", tags: "neon glow line light wave night", color: "#ff2e7e", box: "0 0 300 100",
    body: neon("M24 60 C70 20 110 20 150 50 C190 80 230 80 276 40") },
  { key: "neonRing", label: "Neon ring", tags: "neon glow circle ring light night", color: "#8fe3ff", box: "0 0 200 200",
    body: neon("M100 28 A72 72 0 1 1 99.9 28 Z") },
  { key: "neonArrow", label: "Neon arrow", tags: "neon glow arrow sign light night", color: "#ffc83d", box: "0 0 260 140",
    body: neon("M30 70 L210 70 M170 32 L216 70 L170 108") },
  { key: "neonBolt", label: "Neon bolt", tags: "neon glow lightning bolt sign night", color: "#ff2e7e", box: "0 0 200 220",
    body: neon("M118 24 L62 118 L104 118 L82 196 L146 92 L104 92 Z") },
  // Special overlays (made as Fabric objects, see makeSpecial).
  { key: "grain", label: "Film grain overlay", tags: "grain noise film texture overlay vintage", special: true, color: "#808080" },
  { key: "leakPink", label: "Light leak (pink)", tags: "light leak glow film flare overlay", special: true, color: "#ff2e7e" },
  { key: "leakAmber", label: "Light leak (amber)", tags: "light leak glow warm flare overlay sun", special: true, color: "#ff9f1c" },
  { key: "vignette", label: "Dark vignette", tags: "vignette dark edges overlay cinematic", special: true, color: "#0d0a10" },
];

const PREVIEW = {
  grain: `<rect width="200" height="200" rx="14" fill="#3a3346"/><g fill="#fff" opacity=".5">${(() => { const r = rng(5); return Array.from({ length: 160 }, () => `<rect x="${f(r() * 196)}" y="${f(r() * 196)}" width="2.6" height="2.6"/>`).join(""); })()}</g>`,
  leakPink: `<defs><radialGradient id="lkp"><stop offset="0" stop-color="#ff2e7e"/><stop offset=".55" stop-color="#ff2e7e" stop-opacity=".45"/><stop offset="1" stop-color="#ff2e7e" stop-opacity="0"/></radialGradient></defs><rect width="200" height="200" rx="14" fill="#1d1824"/><circle cx="60" cy="60" r="120" fill="url(#lkp)"/>`,
  leakAmber: `<defs><radialGradient id="lka"><stop offset="0" stop-color="#ffd27a"/><stop offset=".5" stop-color="#ff9f1c" stop-opacity=".5"/><stop offset="1" stop-color="#ff9f1c" stop-opacity="0"/></radialGradient></defs><rect width="200" height="200" rx="14" fill="#1d1824"/><circle cx="150" cy="150" r="120" fill="url(#lka)"/>`,
  vignette: `<defs><radialGradient id="vg"><stop offset=".45" stop-color="#0d0a10" stop-opacity="0"/><stop offset="1" stop-color="#0d0a10" stop-opacity=".95"/></radialGradient></defs><rect width="200" height="200" rx="14" fill="#c9b8a0"/><rect width="200" height="200" rx="14" fill="url(#vg)"/>`,
};

export function decorSVG(key, color) {
  const d = DECOR.find((x) => x.key === key);
  if (!d) throw new Error(`No graphic called ${key}.`);
  if (d.special) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${PREVIEW[key]}</svg>`;
  const [, , w, h] = d.box.split(" ").map(Number);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${d.box}" width="${w}" height="${h}">${d.body.replaceAll("{c}", color || d.color)}</svg>`;
}

for (const d of DECOR) d.svg = () => decorSVG(d.key);

// ---- special overlays -------------------------------------------------------------------

let grainTile = null;
/** One small grey noise tile (256 px, made once), repeated as a pattern. */
function grainCanvas() {
  if (grainTile) return grainTile;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(256, 256);
  const r = rng(42);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 200;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

function leakGradient(color) {
  return new Gradient({
    type: "radial", gradientUnits: "percentage",
    coords: { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.5 },
    colorStops: [
      { offset: 0, color: hexA(color, 0.95) }, { offset: 0.45, color: hexA(color, 0.45) }, { offset: 1, color: hexA(color, 0) },
    ],
  });
}

/** Make a special overlay sized for the page. */
function makeSpecial(key, app) {
  const W = app.editor.width, H = app.editor.height;
  if (key === "grain") {
    return new Rect({
      width: W, height: H, fill: new Pattern({ source: grainCanvas(), repeat: "repeat" }), opacity: 0.3,
      globalCompositeOperation: "overlay", name: "Film grain", data: { kind: "decor", decor: key, overlay: true },
    });
  }
  if (key === "vignette") {
    return new Rect({
      width: W, height: H, name: "Vignette", data: { kind: "decor", decor: key, overlay: true },
      fill: new Gradient({ type: "radial", gradientUnits: "percentage", coords: { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.75 },
        colorStops: [{ offset: 0.45, color: "rgba(13, 10, 16, 0)" }, { offset: 1, color: "rgba(13, 10, 16, 0.85)" }] }),
    });
  }
  const color = key === "leakAmber" ? "#ff9f1c" : "#ff2e7e";
  const s = Math.max(W, H) * 0.9;
  return new Rect({
    width: s, height: s, fill: leakGradient(color), globalCompositeOperation: "screen",
    name: key === "leakAmber" ? "Light leak (amber)" : "Light leak (pink)", data: { kind: "decor", decor: key, leak: color },
  });
}

/** Recolour a light leak (keeps its soft fade). */
export function setLeakColor(obj, color) {
  obj.set({ fill: leakGradient(color), data: { ...obj.data, leak: color } });
  obj.set("dirty", true);
}

/** Make the object for a decorative item. `at` positions are handled by the caller. */
export async function createDecor(key, app) {
  const d = DECOR.find((x) => x.key === key);
  if (!d) throw new Error(`No graphic called ${key}.`);
  if (d.special) {
    const o = makeSpecial(key, app);
    // Full-page overlays sit exactly on the page; leaks start in a corner.
    if (d.key === "grain" || d.key === "vignette") o._place = { x: app.editor.width / 2, y: app.editor.height / 2 };
    else o._place = d.key === "leakAmber" ? { x: app.editor.width * 0.92, y: app.editor.height * 0.9 } : { x: app.editor.width * 0.08, y: app.editor.height * 0.1 };
    return o;
  }
  const short = Math.min(app.editor.width, app.editor.height);
  // Ink-coloured doodles turn paper-coloured on a dark page, so they show up.
  const color = d.color === "#16121b" && pageIsDark(app) ? "#f3ead8" : null;
  const g = await svgToGroup(decorSVG(key, color), Math.round(short * 0.42));
  g.set({ name: d.label, data: { kind: "decor", decor: key } });
  return g;
}
