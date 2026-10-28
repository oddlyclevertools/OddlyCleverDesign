// Shape outlines drawn in code. Each shape is a list of path segments in a unit box (0..1),
// scaled to any w x h on demand, so the same outline serves shapes, frame masks, borders and
// the panel previews. Only M, L, C and Z are used, so scaling is exact.

const K = 0.5523; // bezier circle constant

/** Points on a regular polygon or star, stretched to fill the unit box. */
function radial(n, inner = null, rot = -Math.PI / 2) {
  const pts = [];
  const count = inner == null ? n : n * 2;
  for (let i = 0; i < count; i++) {
    const r = inner == null || i % 2 === 0 ? 1 : inner;
    const a = rot + (i * Math.PI * 2) / count;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return fit(pts);
}

/** Stretch points so their bounding box is exactly the unit box. */
function fit(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 || 1, h = Math.max(...ys) - y0 || 1;
  return pts.map(([x, y]) => [(x - x0) / w, (y - y0) / h]);
}

const poly = (pts) => [["M", ...pts[0]], ...pts.slice(1).map((p) => ["L", ...p]), ["Z"]];

/** A smooth closed curve through points (Catmull-Rom as cubic beziers). */
function smooth(pts) {
  const n = pts.length, segs = [["M", ...pts[0]]];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    segs.push(["C", p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]]);
  }
  segs.push(["Z"]);
  return segs;
}

const ELLIPSE = [
  ["M", 0.5, 0], ["C", 0.5 + K / 2, 0, 1, 0.5 - K / 2, 1, 0.5], ["C", 1, 0.5 + K / 2, 0.5 + K / 2, 1, 0.5, 1],
  ["C", 0.5 - K / 2, 1, 0, 0.5 + K / 2, 0, 0.5], ["C", 0, 0.5 - K / 2, 0.5 - K / 2, 0, 0.5, 0], ["Z"],
];

const HEART = [
  ["M", 0.5, 0.2], ["C", 0.44, 0.06, 0.34, 0, 0.24, 0], ["C", 0.1, 0, 0, 0.12, 0, 0.3],
  ["C", 0, 0.56, 0.24, 0.74, 0.5, 1], ["C", 0.76, 0.74, 1, 0.56, 1, 0.3],
  ["C", 1, 0.12, 0.9, 0, 0.76, 0], ["C", 0.66, 0, 0.56, 0.06, 0.5, 0.2], ["Z"],
];

// Speech bubbles: body from y=0 to 0.8, tail down to y=1.
const BUBBLE = [
  ["M", 0.1, 0], ["L", 0.9, 0], ["C", 0.955, 0, 1, 0.045, 1, 0.1], ["L", 1, 0.7], ["C", 1, 0.755, 0.955, 0.8, 0.9, 0.8],
  ["L", 0.42, 0.8], ["L", 0.2, 1], ["L", 0.24, 0.8], ["L", 0.1, 0.8], ["C", 0.045, 0.8, 0, 0.755, 0, 0.7],
  ["L", 0, 0.1], ["C", 0, 0.045, 0.045, 0, 0.1, 0], ["Z"],
];
const BUBBLE_ROUND = [
  ["M", 0.5, 0], ["C", 0.78, 0, 1, 0.18, 1, 0.41], ["C", 1, 0.64, 0.78, 0.82, 0.5, 0.82],
  ["C", 0.44, 0.82, 0.38, 0.81, 0.33, 0.8], ["L", 0.12, 1], ["L", 0.18, 0.74],
  ["C", 0.07, 0.67, 0, 0.55, 0, 0.41], ["C", 0, 0.18, 0.22, 0, 0.5, 0], ["Z"],
];
const ARCH = [
  ["M", 0, 1], ["L", 0, 0.5], ["C", 0, 0.5 - K / 2, 0.5 - K / 2, 0, 0.5, 0],
  ["C", 0.5 + K / 2, 0, 1, 0.5 - K / 2, 1, 0.5], ["L", 1, 1], ["Z"],
];
const BLOB = smooth([[0.52, 0], [0.86, 0.1], [1, 0.42], [0.88, 0.8], [0.55, 1], [0.18, 0.9], [0, 0.6], [0.1, 0.18]]);
const CLOUD = smooth([[0.2, 0.42], [0.32, 0.16], [0.58, 0.06], [0.8, 0.24], [0.98, 0.5], [0.86, 0.86],
  [0.5, 0.96], [0.14, 0.9], [0, 0.66]]);
const SEAL = (() => {
  const pts = [];
  for (let i = 0; i < 240; i++) {
    const a = (i / 240) * Math.PI * 2;
    const r = 0.94 + 0.06 * Math.cos(a * 24);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return poly(fit(pts));
})();

/** Rounded rectangle path for an exact pixel size and corner radius. */
export function roundRectPath(w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!r) return `M0 0 L${w} 0 L${w} ${h} L0 ${h} Z`;
  const k = r * (1 - K);
  return [
    `M${r} 0`, `L${w - r} 0`, `C${w - k} 0 ${w} ${k} ${w} ${r}`, `L${w} ${h - r}`, `C${w} ${h - k} ${w - k} ${h} ${w - r} ${h}`,
    `L${r} ${h}`, `C${k} ${h} 0 ${h - k} 0 ${h - r}`, `L0 ${r}`, `C0 ${k} ${k} 0 ${r} 0`, "Z",
  ].join(" ");
}

/**
 * Every outline. ratio = default width / height. tags help the panel search.
 * @type {Record<string, {label: string, segs?: any[], ratio?: number, tags?: string}>}
 */
export const OUTLINES = {
  rect: { label: "Square", segs: poly([[0, 0], [1, 0], [1, 1], [0, 1]]), tags: "rectangle box" },
  circle: { label: "Circle", segs: ELLIPSE, tags: "round oval ellipse dot" },
  triangle: { label: "Triangle", segs: poly([[0.5, 0], [1, 1], [0, 1]]) },
  rtriangle: { label: "Right triangle", segs: poly([[0, 0], [1, 1], [0, 1]]), tags: "triangle" },
  diamond: { label: "Diamond", segs: poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]), tags: "rhombus" },
  pentagon: { label: "Pentagon", segs: poly(radial(5)) },
  hexagon: { label: "Hexagon", segs: poly(radial(6, null, 0)), ratio: 1.15 },
  octagon: { label: "Octagon", segs: poly(radial(8, null, Math.PI / 8)), tags: "stop" },
  star5: { label: "Star", segs: poly(radial(5, 0.45)), ratio: 1.05 },
  star8: { label: "8-point star", segs: poly(radial(8, 0.62)), tags: "star" },
  star4: { label: "Sparkle", segs: poly(radial(4, 0.3)), tags: "star twinkle" },
  heart: { label: "Heart", segs: HEART, ratio: 1.08, tags: "love" },
  plus: { label: "Plus", segs: poly([[0.34, 0], [0.66, 0], [0.66, 0.34], [1, 0.34], [1, 0.66], [0.66, 0.66], [0.66, 1], [0.34, 1], [0.34, 0.66], [0, 0.66], [0, 0.34], [0.34, 0.34]]), tags: "cross add" },
  parallelogram: { label: "Parallelogram", segs: poly([[0.25, 0], [1, 0], [0.75, 1], [0, 1]]), ratio: 1.5 },
  bubble: { label: "Speech bubble", segs: BUBBLE, ratio: 1.25, tags: "talk chat comment callout" },
  bubbleRound: { label: "Round speech bubble", segs: BUBBLE_ROUND, ratio: 1.2, tags: "talk chat callout" },
  arrowRight: { label: "Arrow", segs: poly([[0, 0.3], [0.6, 0.3], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.7], [0, 0.7]]), ratio: 1.7, tags: "right pointer" },
  arrowDouble: { label: "Double arrow", segs: poly([[0, 0.5], [0.28, 0], [0.28, 0.3], [0.72, 0.3], [0.72, 0], [1, 0.5], [0.72, 1], [0.72, 0.7], [0.28, 0.7], [0.28, 1]]), ratio: 2, tags: "arrow left right" },
  arrowUp: { label: "Up arrow", segs: poly([[0.5, 0], [1, 0.42], [0.7, 0.42], [0.7, 1], [0.3, 1], [0.3, 0.42], [0, 0.42]]), ratio: 0.62, tags: "arrow" },
  chevron: { label: "Chevron", segs: poly([[0, 0], [0.62, 0], [1, 0.5], [0.62, 1], [0, 1], [0.38, 0.5]]), ratio: 1.2, tags: "arrow" },
  burst: { label: "Burst", segs: poly(radial(16, 0.78)), tags: "badge starburst sale explosion" },
  seal: { label: "Badge", segs: SEAL, tags: "seal burst sticker award" },
  cloud: { label: "Cloud", segs: CLOUD, ratio: 1.45, tags: "weather" },
  blob: { label: "Blob", segs: BLOB, tags: "organic" },
  arch: { label: "Arch", segs: ARCH, ratio: 0.78, tags: "window door" },
};

/** SVG path data for an outline scaled to w x h (optionally offset). */
export function outlinePath(key, w, h, dx = 0, dy = 0) {
  const o = OUTLINES[key] || OUTLINES.rect;
  return o.segs.map(([cmd, ...v]) => {
    if (cmd === "Z") return "Z";
    const out = [];
    for (let i = 0; i < v.length; i += 2) out.push(`${round(v[i] * w + dx)} ${round(v[i + 1] * h + dy)}`);
    return `${cmd}${out.join(" ")}`;
  }).join(" ");
}

const round = (n) => Math.round(n * 100) / 100;

/** Default size for an outline, `base` px on the long side. */
export function defaultSize(key, base = 320) {
  const r = OUTLINES[key]?.ratio || 1;
  return r >= 1 ? { w: base, h: Math.round(base / r) } : { w: Math.round(base * r), h: base };
}

/**
 * Path data for a mask: the outline, or a rounded rectangle when the key is "roundRect".
 * @param {{shape: string, radius?: number}} mask
 */
export function maskPath(mask, w, h, dx = 0, dy = 0) {
  if (!mask || mask.shape === "roundRect" || mask.shape === "rect") {
    const r = mask?.radius || 0;
    const d = roundRectPath(w, h, r);
    if (!dx && !dy) return d;
    return d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${round(+x + dx)} ${round(+y + dy)}`);
  }
  return outlinePath(mask.shape, w, h, dx, dy);
}
