// Background scenes: shared helpers (colour, seeded noise, canvas, texture tiles). Our own CC0 work.

export const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- colour helpers */

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const isHex = (v) => typeof v === "string" && HEX_RE.test(v.trim());

export function rgbOf(hex) {
  let s = String(hex || "").trim().replace("#", "");
  if (s.length === 3) s = s.split("").map((ch) => ch + ch).join("");
  const n = parseInt(s.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const toHex = (rgb) => `#${rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("")}`;

export function mix(a, b, t) {
  const p = rgbOf(a), q = rgbOf(b);
  return toHex([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
}
export const lighten = (c, t) => mix(c, "#ffffff", t);
export const darken = (c, t) => mix(c, "#000000", t);
export function withAlpha(c, a) {
  const [r, g, b] = rgbOf(c);
  return `rgba(${r},${g},${b},${clamp(a)})`;
}
export function luma(c) {
  const [r, g, b] = rgbOf(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/* ---------------------------------------------------------------- randomness + noise */

/** Mulberry32: a tiny seeded PRNG returning [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Integer hash of a lattice cell, so jittered patterns match at every page size and aspect. */
export function hash(a, b, s = 0) {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1440662683)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return (x ^ (x >>> 16)) >>> 0;
}
export const cellRng = (i, j, s) => rng(hash(i, j, s));

/** Smooth 1D noise in about -1..1 (sum of seeded sines). */
export function noise1(seed) {
  const r = rng(seed);
  const ks = [0, 1, 2, 3].map((i) => ({ f: (0.7 + r() * 0.5) * Math.pow(2.13, i), p: r() * TAU, a: Math.pow(0.5, i) }));
  const norm = ks.reduce((s, k) => s + k.a, 0);
  return (x) => {
    let s = 0;
    for (const k of ks) s += Math.sin(x * k.f + k.p) * k.a;
    return s / norm;
  };
}

/** 2D value noise in 0..1, lattice 256 (optionally periodic), cached per seed. */
export const lattices = new Map();
export function lattice(seed) {
  let v = lattices.get(seed);
  if (!v) {
    const r = rng(seed);
    v = new Float32Array(65536);
    for (let i = 0; i < v.length; i++) v[i] = r();
    lattices.set(seed, v);
  }
  return v;
}
export const smooth = (t) => t * t * (3 - 2 * t);
export function vnoise(v, x, y, period = 256) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
  const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
  const a = v[(y0 << 8) | x0], b = v[(y0 << 8) | x1], c = v[(y1 << 8) | x0], d = v[(y1 << 8) | x1];
  const sx = smooth(xf), sy = smooth(yf);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export function fbm(v, x, y, oct = 4) {
  let s = 0, amp = 0.5, n = 0, f = 1;
  for (let o = 0; o < oct; o++) {
    s += vnoise(v, x * f + o * 17.3, y * f + o * 9.1) * amp;
    n += amp; amp *= 0.5; f *= 2.03;
  }
  return s / n;
}

/* ---------------------------------------------------------------- canvas helpers */

export function makeCanvas(w, h) {
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}

export function reset(ctx) {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.setLineDash([]);
  ctx.lineCap = "butt"; ctx.lineJoin = "miter";
  ctx.imageSmoothingEnabled = true;
}

export function fill(ctx, w, h, style) {
  ctx.fillStyle = style;
  ctx.fillRect(0, 0, w, h);
}
export function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, col] of stops) g.addColorStop(clamp(t), col);
  return g;
}
export function softStops(g, color, a) {
  g.addColorStop(0, withAlpha(color, a));
  g.addColorStop(0.2, withAlpha(color, a * 0.74));
  g.addColorStop(0.45, withAlpha(color, a * 0.36));
  g.addColorStop(0.7, withAlpha(color, a * 0.12));
  g.addColorStop(1, withAlpha(color, 0));
}
/** A soft round (or elliptical) glow. */
export function glow(ctx, x, y, rx, color, a = 1, mode = "source-over", ry = rx) {
  if (rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  softStops(g, color, a);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}
export function vignette(ctx, w, h, color = "#000000", a = 0.5, inner = 0.45) {
  const r = Math.hypot(w, h) / 2;
  const g = ctx.createRadialGradient(w / 2, h / 2, r * inner, w / 2, h / 2, r);
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(0.6, withAlpha(color, a * 0.45));
  g.addColorStop(1, withAlpha(color, a));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
export function shadow(ctx, u, a = 0.35, blur = 16, ox = 4, oy = 8, color = "#1a0f08") {
  ctx.shadowColor = withAlpha(color, a);
  ctx.shadowBlur = blur * u;
  ctx.shadowOffsetX = ox * u;
  ctx.shadowOffsetY = oy * u;
}
export function noShadow(ctx) {
  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
}
export function roundRect(path, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  path.moveTo(x + rr, y);
  path.arcTo(x + w, y, x + w, y + h, rr);
  path.arcTo(x + w, y + h, x, y + h, rr);
  path.arcTo(x, y + h, x, y, rr);
  path.arcTo(x, y, x + w, y, rr);
  path.closePath();
}
/** Glowing neon tube along a path. */
export function neon(ctx, path, color, u, width = 3.2) {
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.shadowColor = color; ctx.shadowBlur = 22 * u;
  ctx.strokeStyle = withAlpha(color, 0.9); ctx.lineWidth = width * 1.6 * u;
  ctx.stroke(path);
  ctx.shadowBlur = 8 * u;
  ctx.strokeStyle = lighten(color, 0.55); ctx.lineWidth = width * 0.6 * u;
  ctx.stroke(path);
  ctx.restore();
}

/* ---------------------------------------------------------------- texture tiles (cached) */

export const tiles = new Map();
export function tile(key, size, paint) {
  let t = tiles.get(key);
  if (!t) {
    t = makeCanvas(size, size);
    const c = t.getContext("2d");
    const img = c.createImageData(size, size);
    paint(img.data, size);
    c.putImageData(img, 0, 0);
    tiles.set(key, t);
  }
  return t;
}
/** Neutral-grey film grain (128 = no change under "overlay"). */
export const grainTile = () => tile("grain", 256, (d, n) => {
  const r = rng(7);
  for (let i = 0; i < n * n; i++) {
    const v = 128 + (r() + r() + r() - 1.5) * 110;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
});
/** Seamless soft blotches (periodic value noise), neutral grey around 128. */
export const blotchTile = () => tile("blotch", 256, (d, n) => {
  const v = lattice(31);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let s = 0, amp = 0.55;
      for (const p of [4, 8, 16, 32]) {
        s += (vnoise(v, (x / n) * p + p * 3, (y / n) * p + p * 5, p) - 0.5) * amp;
        amp *= 0.55;
      }
      const g = 128 + s * 170;
      const i = (y * n + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = g;
      d[i + 3] = 255;
    }
  }
});
/** Granules (cork, terrazzo dust): small light/dark specks on neutral grey. */
export const speckTile = () => tile("speck", 256, (d, n) => {
  for (let i = 0; i < n * n; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 128; d[i * 4 + 3] = 255; }
  const r = rng(77);
  for (let k = 0; k < 2600; k++) {
    const cx = r() * n, cy = r() * n, rad = 0.6 + r() * r() * 2.6;
    const g = r() < 0.6 ? 70 + r() * 40 : 170 + r() * 50;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
      for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
        const i = ((((y % n) + n) % n) * n + (((x % n) + n) % n)) * 4;
        d[i] = d[i + 1] = d[i + 2] = g;
      }
    }
  }
});

export function overlayTile(ctx, w, h, t, alpha, mode = "overlay", scale = 1) {
  const p = ctx.createPattern(t, "repeat");
  if (!p) return;
  if (scale !== 1 && p.setTransform && typeof DOMMatrix !== "undefined") p.setTransform(new DOMMatrix().scale(scale));
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
export const grain = (ctx, w, h, u, a = 0.12) => overlayTile(ctx, w, h, grainTile(), a, "overlay", Math.max(1, u * 0.8));
export const blotch = (ctx, w, h, u, a = 0.4, s = 1.6) => overlayTile(ctx, w, h, blotchTile(), a, "overlay", Math.max(0.3, u * s));

/* ---------------------------------------------------------------- entry builder */

export const C = (id, label, value) => ({ id, label, value });
export function def(key, label, group, tags, colors, paint) {
  const defaults = Object.fromEntries(colors.map((x) => [x.id, x.value]));
  return {
    key, label, group, tags, colors,
    draw(ctx, w, h, col = {}) {
      if (!ctx || !(w > 0) || !(h > 0)) return;
      const c = { ...defaults };
      for (const id of Object.keys(defaults)) if (isHex(col?.[id])) c[id] = col[id].trim();
      ctx.save();
      reset(ctx);
      try {
        paint(ctx, w, h, c, Math.min(w, h) / 720);
      } finally {
        ctx.restore();
      }
    },
  };
}

