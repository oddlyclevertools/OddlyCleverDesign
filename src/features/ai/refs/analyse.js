// Measure a style reference picture on this PC, so every AI (even a small one) gets exact numbers
// to work from: the main colours and how much of the picture each covers, the accent colour,
// light or dark, vivid or muted, contrast, and where the bright, busy and calm parts sit.
// Pure pixel maths on a small copy of the picture: nothing is sent anywhere.

const SAMPLE_W = 96;   // the picture is measured at this width (enough for colour and layout)
const CLUSTERS = 6;    // colours found before similar ones are merged
const MIN_SHARE = 0.03;
const CELLS = [["top left", "top", "top right"], ["left", "centre", "right"], ["bottom left", "bottom", "bottom right"]];

const hex2 = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
const toHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lumOf = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
/** Colourfulness 0..1 (chroma): dark and grey colours score low, bright pure colours high. */
const chromaOf = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** k-means on RGB, started from evenly spaced brightness quantiles so it is repeatable. */
function clusters(px, k) {
  const byLum = [...px].sort((a, b) => lumOf(a) - lumOf(b));
  let cents = Array.from({ length: k }, (_, i) => [...byLum[Math.floor(((i + 0.5) / k) * byLum.length)]]);
  let owner = new Uint8Array(px.length);
  for (let it = 0; it < 10; it++) {
    const sum = cents.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => {
      let best = 0, bd = Infinity;
      cents.forEach((c, j) => { const d = dist2(p, c); if (d < bd) { bd = d; best = j; } });
      owner[i] = best;
      const s = sum[best]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
    });
    cents = cents.map((c, j) => (sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : c));
  }
  const counts = cents.map(() => 0);
  owner.forEach((o) => counts[o]++);
  return cents.map((c, j) => ({ rgb: c, share: counts[j] / px.length }));
}

/** Merge colours a viewer would call the same (closer than about 30 RGB steps). */
function merge(list) {
  const out = [];
  for (const c of [...list].sort((a, b) => b.share - a.share)) {
    const near = out.find((o) => dist2(o.rgb, c.rgb) < 30 * 30);
    if (!near) { out.push({ ...c }); continue; }
    const t = near.share + c.share;
    near.rgb = near.rgb.map((v, i) => (v * near.share + c.rgb[i] * c.share) / t);
    near.share = t;
  }
  return out.sort((a, b) => b.share - a.share);
}

/** Brightness and detail (edge strength) per cell of a 3x3 grid. */
function grid(lum, w, h) {
  const cells = Array.from({ length: 9 }, () => ({ lum: 0, edge: 0, n: 0 }));
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      const c = cells[Math.min(2, Math.floor((y / h) * 3)) * 3 + Math.min(2, Math.floor((x / w) * 3))];
      c.lum += lum[i];
      c.edge += Math.abs(lum[i + 1] - lum[i]) + Math.abs(lum[i + w] - lum[i]);
      c.n++;
    }
  }
  return cells.map((c, i) => ({ name: CELLS[Math.floor(i / 3)][i % 3], lum: c.lum / (c.n || 1), edge: c.edge / (c.n || 1) }));
}

function ratioName(w, h) {
  const r = w / h;
  const known = [["16:9", 16 / 9], ["9:16", 9 / 16], ["1:1", 1], ["4:5", 0.8], ["4:3", 4 / 3], ["3:4", 0.75], ["2:3", 2 / 3]];
  const hit = known.find(([, v]) => Math.abs(v - r) / v < 0.04);
  return hit ? hit[0] : `${r.toFixed(2)}:1`;
}

/**
 * @param {HTMLCanvasElement} canvas the picture
 * @returns {{ size: string, ratio: string, palette: {hex: string, share: number}[], accent: string|null,
 *   tone: string, colour: string, contrast: string, brightest: string, busiest: string, calmest: string }}
 */
export function analyseImage(canvas) {
  const w = Math.min(SAMPLE_W, canvas.width), h = Math.max(1, Math.round((w * canvas.height) / canvas.width));
  const small = document.createElement("canvas");
  small.width = w; small.height = h;
  const ctx = small.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const px = [], lum = new Float32Array(w * h);
  let satSum = 0;
  for (let i = 0; i < w * h; i++) {
    const p = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
    px.push(p);
    lum[i] = lumOf(p);
    satSum += chromaOf(p);
  }
  const palette = merge(clusters(px, CLUSTERS)).filter((c) => c.share >= MIN_SHARE);
  // The accent: the most colourful colour that is not the main background, even if it is small
  // (a thin neon word covers 1% of a thumbnail but is what the eye goes to).
  const vividPx = px.filter((p) => chromaOf(p) > 0.4);
  const background = palette[0]?.share > 0.4 ? palette[0].rgb : null;
  const vivid = vividPx.length >= px.length * 0.004
    ? merge(clusters(vividPx, Math.min(4, vividPx.length)))
      .filter((c) => !background || dist2(c.rgb, background) > 60 * 60)
      .sort((a, b) => chromaOf(b.rgb) * b.share ** 0.25 - chromaOf(a.rgb) * a.share ** 0.25)
    : [];
  const sorted = Array.from(lum).sort((a, b) => a - b);
  const meanLum = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const spread = sorted[Math.floor(sorted.length * 0.95)] - sorted[Math.floor(sorted.length * 0.05)];
  const meanSat = satSum / px.length;
  const cells = grid(lum, w, h);
  const by = (k, dir) => [...cells].sort((a, b) => dir * (a[k] - b[k]))[0].name;
  return {
    size: `${canvas.width}x${canvas.height}`,
    ratio: ratioName(canvas.width, canvas.height),
    palette: palette.slice(0, 6).map((c) => ({ hex: toHex(c.rgb), share: Math.round(c.share * 100) })),
    accent: vivid.length ? toHex(vivid[0].rgb) : null,
    tone: meanLum < 0.12 ? "dark" : meanLum > 0.45 ? "light" : "mid-tone",
    colour: meanSat > 0.45 ? "very vivid" : meanSat > 0.25 ? "vivid" : meanSat > 0.1 ? "soft" : "muted",
    contrast: spread > 0.6 ? "very high" : spread > 0.35 ? "high" : spread > 0.18 ? "medium" : "low",
    brightest: by("lum", -1),
    busiest: by("edge", -1),
    calmest: by("edge", 1),
  };
}

/** One plain line block per picture, for the AI. */
export function describeNotes(n, i) {
  if (!n) return `Picture ${i + 1}: (not measured)`;
  const cols = n.palette.map((c) => `${c.hex} ${c.share}%`).join(", ");
  return [
    `Picture ${i + 1} (${n.size}, ${n.ratio}): ${n.tone}, ${n.colour} colour, ${n.contrast} contrast.`,
    `  Main colours by area: ${cols}.${n.accent ? ` Accent (most vivid): ${n.accent}.` : ""}`,
    `  Brightest area: ${n.brightest}. Most detail (usually the subject or big text): ${n.busiest}. Calmest area: ${n.calmest}.`,
  ].join("\n");
}
