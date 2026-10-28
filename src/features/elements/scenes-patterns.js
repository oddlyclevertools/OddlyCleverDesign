// Background scenes, part of scenes.js (our own CC0 work). See scenes.js for the format.
import { TAU, clamp, HEX_RE, isHex, rgbOf, toHex, mix, lighten, darken, withAlpha, luma, rng, hash, cellRng, noise1, lattices, lattice, smooth, vnoise, fbm, makeCanvas, reset, fill, linear, softStops, glow, vignette, shadow, noShadow, roundRect, neon, tiles, tile, grainTile, blotchTile, speckTile, overlayTile, grain, blotch, C, def } from "./scene-kit.js";

/* ================================================================= PATTERNS */

export function polkaDots(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  const s = 64 * u, r = s * 0.17;
  const nx = Math.ceil(w / s / 2) + 1, ny = Math.ceil(h / s) + 2;
  ctx.fillStyle = c.fg;
  ctx.beginPath();
  for (let j = -ny; j <= ny; j++) {
    for (let i = -nx; i <= nx; i++) {
      const x = w / 2 + i * s + (j & 1 ? s / 2 : 0), y = h / 2 + (j * s) / 2;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
  }
  ctx.fill();
  grain(ctx, w, h, u, 0.07);
}

export function gridLines(ctx, w, h, step, style, lw) {
  ctx.beginPath();
  for (let x = (w / 2) % step; x <= w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = (h / 2) % step; y <= h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.strokeStyle = style;
  ctx.lineWidth = lw;
  ctx.stroke();
}

export function graphPaper(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  blotch(ctx, w, h, u, 0.12);
  const minor = 18 * u, lw = Math.max(0.6, 0.9 * u);
  gridLines(ctx, w, h, minor, withAlpha(c.fg, 0.32), lw);
  gridLines(ctx, w, h, minor * 5, withAlpha(c.fg, 0.7), lw * 1.7);
  grain(ctx, w, h, u, 0.05);
}

export function diagonalStripes(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 4);
  const D = Math.hypot(w, h) / 2 + 4, p = 60 * u, sw = p * 0.45;
  ctx.fillStyle = c.fg;
  ctx.beginPath();
  for (let x = -Math.ceil(D / p) * p; x < D; x += p) ctx.rect(x - sw / 2, -D, sw, 2 * D);
  ctx.fill();
  ctx.restore();
  grain(ctx, w, h, u, 0.08);
}

export function checker(ctx, w, h, c, u) {
  fill(ctx, w, h, c.a);
  const s = 72 * u;
  const nx = Math.ceil(w / s / 2) + 1, ny = Math.ceil(h / s / 2) + 1;
  ctx.fillStyle = c.b;
  ctx.beginPath();
  for (let j = -ny; j <= ny; j++) {
    for (let i = -nx; i <= nx; i++) {
      if ((i + j) & 1) ctx.rect(w / 2 + i * s, h / 2 + j * s, s, s);
    }
  }
  ctx.fill();
  grain(ctx, w, h, u, 0.08);
}

export function halftone(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  const s = 22 * u, maxR = s * 0.74;
  const ca = Math.cos(Math.PI / 4), sa = Math.sin(Math.PI / 4);
  const D = Math.hypot(w, h) / 2 + s, n = Math.ceil(D / s);
  ctx.fillStyle = c.fg;
  ctx.beginPath();
  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      const a = i * s, b = j * s;
      const x = w / 2 + a * ca - b * sa, y = h / 2 + a * sa + b * ca;
      if (x < -s || y < -s || x > w + s || y > h + s) continue;
      const t = clamp(((x / w + y / h) / 2 - 0.22) / 0.78);
      const r = maxR * Math.pow(t, 1.35);
      if (r < 0.3) continue;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
  }
  ctx.fill();
  grain(ctx, w, h, u, 0.1);
}

export function waves(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  const gap = 26 * u, amp = 11 * u, wl = 190 * u, step = Math.max(2, 6 * u);
  ctx.beginPath();
  const k0 = -Math.ceil(h / 2 / gap) - 2, k1 = Math.ceil(h / 2 / gap) + 2;
  for (let k = k0; k <= k1; k++) {
    const y0 = h / 2 + k * gap;
    for (let x = -step; x <= w + step; x += step) {
      const y = y0 + Math.sin(((x - w / 2) / wl) * TAU + k * 0.42) * amp;
      if (x === -step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = c.fg;
  ctx.lineWidth = 3 * u;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  grain(ctx, w, h, u, 0.05);
}

/** Contour lines of a smooth field, by marching squares on a coarse grid (scaled with u). */
export function contours(ctx, w, h, u, field, levels, cell) {
  const nx = Math.ceil(w / cell) + 1, ny = Math.ceil(h / cell) + 1;
  const v = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) v[j * nx + i] = field(i * cell, j * cell);
  const paths = levels.map(() => new Path2D());
  levels.forEach((L, li) => {
    const p = paths[li];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], d = v[(j + 1) * nx + i];
        const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x = i * cell, y = j * cell;
        const T = () => [x + ((L - a) / (b - a)) * cell, y];
        const Rt = () => [x + cell, y + ((L - b) / (c - b)) * cell];
        const B = () => [x + ((L - d) / (c - d)) * cell, y + cell];
        const Lf = () => [x, y + ((L - a) / (d - a)) * cell];
        const seg = (P, Q) => { const p1 = P(), q1 = Q(); p.moveTo(p1[0], p1[1]); p.lineTo(q1[0], q1[1]); };
        switch (idx) {
          case 1: case 14: seg(Lf, B); break;
          case 2: case 13: seg(B, Rt); break;
          case 3: case 12: seg(Lf, Rt); break;
          case 4: case 11: seg(T, Rt); break;
          case 6: case 9: seg(T, B); break;
          case 7: case 8: seg(Lf, T); break;
          case 5: seg(T, Rt); seg(Lf, B); break;
          case 10: seg(Lf, T); seg(B, Rt); break;
          default: break;
        }
      }
    }
  });
  return paths;
}

export function topography(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  glow(ctx, w * 0.82, h * 0.12, 620 * u, lighten(c.bg, 0.1), 0.8);
  glow(ctx, w * 0.12, h * 0.95, 520 * u, mix(c.bg, c.fg, 0.12), 0.8);
  const v = lattice(41), sc = 1 / (360 * u);
  const field = (x, y) => fbm(v, (x - w / 2) * sc + 60.5, (y - h / 2) * sc + 40.5, 3);
  const levels = [];
  for (let L = 0.16; L < 0.86; L += 0.024) levels.push(L);
  const paths = contours(ctx, w, h, u, field, levels, 8 * u);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  paths.forEach((p, i) => {
    const major = i % 4 === 0;
    ctx.save();
    if (major) { ctx.shadowColor = c.fg; ctx.shadowBlur = 9 * u; }
    ctx.strokeStyle = withAlpha(c.fg, major ? 0.92 : 0.42);
    ctx.lineWidth = (major ? 2 : 1.1) * u;
    ctx.stroke(p);
    ctx.restore();
  });
  grain(ctx, w, h, u, 0.1);
  vignette(ctx, w, h, "#000000", luma(c.bg) < 0.4 ? 0.45 : 0.15);
}

export function filmGrain(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  glow(ctx, w * 0.5, h * 0.42, Math.max(w, h) * 0.6, lighten(c.bg, 0.16), 0.9);
  blotch(ctx, w, h, u, 0.3, 2.4);
  grain(ctx, w, h, u, 0.32);
  vignette(ctx, w, h, "#000000", 0.6, 0.3);
}

export function grainyGradient(ctx, w, h, c, u) {
  fill(ctx, w, h, linear(ctx, 0, 0, w, h, [[0, c.a], [0.55, mix(c.a, c.b, 0.55)], [1, c.b]]));
  glow(ctx, w * 0.1, h * 0.1, Math.max(w, h) * 0.55, lighten(c.a, 0.3), 0.55);
  glow(ctx, w * 0.95, h * 0.9, Math.max(w, h) * 0.5, lighten(c.b, 0.35), 0.6);
  glow(ctx, w * 0.85, h * 0.05, Math.max(w, h) * 0.4, darken(c.a, 0.35), 0.4);
  grain(ctx, w, h, u, 0.42);
}

export function sunburst(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  const cx = w / 2, cy = h / 2, R = Math.hypot(w, h);
  const n = 32, half = Math.PI / n;
  ctx.fillStyle = c.fg;
  ctx.beginPath();
  for (let i = 0; i < n; i += 1) {
    if (i & 1) continue;
    const a = (i / n) * TAU - Math.PI / 2;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a - half) * R, cy + Math.sin(a - half) * R);
    ctx.lineTo(cx + Math.cos(a + half) * R, cy + Math.sin(a + half) * R);
    ctx.closePath();
  }
  ctx.fill();
  glow(ctx, cx, cy, Math.min(w, h) * 0.62, lighten(mix(c.bg, c.fg, 0.5), 0.45), 0.85);
  vignette(ctx, w, h, darken(c.bg, 0.5), 0.55, 0.35);
  grain(ctx, w, h, u, 0.1);
}

export function meshBlobs(ctx, w, h, blobs, u, mode = "source-over") {
  const M = Math.max(w, h);
  for (const [fx, fy, rr, col, a] of blobs) glow(ctx, fx * w, fy * h, rr * M, col, a, mode);
  grain(ctx, w, h, u, 0.08);
}

export function gradientMesh(ctx, w, h, c, u) {
  fill(ctx, w, h, lighten(mix(mix(c.a, c.b, 0.5), c.c, 0.33), 0.35));
  meshBlobs(ctx, w, h, [
    [0.08, 0.12, 0.75, c.a, 0.95], [0.95, 0.2, 0.7, c.b, 0.95], [0.25, 0.98, 0.7, c.c, 0.95],
    [0.9, 0.95, 0.55, c.a, 0.7], [0.55, 0.45, 0.4, lighten(c.c, 0.4), 0.5],
  ], u);
}

export function aurora(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  meshBlobs(ctx, w, h, [
    [0.02, 0.0, 0.6, c.a, 0.9], [1.0, 0.08, 0.5, c.b, 0.75], [0.88, 1.02, 0.62, c.a, 0.7],
    [0.12, 1.0, 0.45, c.b, 0.6], [0.55, -0.1, 0.35, mix(c.a, c.b, 0.5), 0.35],
  ], u, "screen");
  glow(ctx, w * 0.04, h * 0.02, Math.max(w, h) * 0.3, lighten(c.a, 0.15), 0.45, "screen");
  glow(ctx, w * 0.97, h * 0.1, Math.max(w, h) * 0.26, lighten(c.b, 0.15), 0.4, "screen");
  grain(ctx, w, h, u, 0.12);
  vignette(ctx, w, h, "#000000", 0.25, 0.45);
}

export function paperFibres(ctx, w, h, c, u, seed = 3, density = 1) {
  const R = rng(seed);
  const n = Math.round(((w * h) / (u * u)) * 0.0009 * density);
  const dark = new Path2D(), light = new Path2D();
  for (let i = 0; i < n; i++) {
    const p = R() < 0.6 ? dark : light;
    const x = R() * w, y = R() * h, len = (5 + R() * R() * 26) * u, a = R() * TAU, bend = (R() - 0.5) * len * 0.7;
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    p.moveTo(x, y);
    p.quadraticCurveTo((x + ex) / 2 - Math.sin(a) * bend, (y + ey) / 2 + Math.cos(a) * bend, ex, ey);
  }
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 0.8 * u;
  ctx.strokeStyle = withAlpha(darken(c, 0.35), 0.16);
  ctx.stroke(dark);
  ctx.strokeStyle = withAlpha(lighten(c, 0.7), 0.4);
  ctx.stroke(light);
  ctx.restore();
}

export function paperTexture(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  blotch(ctx, w, h, u, 0.5, 2.2);
  blotch(ctx, w, h, u, 0.25, 0.6);
  paperFibres(ctx, w, h, c.bg, u);
  grain(ctx, w, h, u, 0.1);
  vignette(ctx, w, h, darken(c.bg, 0.45), 0.35, 0.4);
}

export function pinstripes(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 4);
  const D = Math.hypot(w, h) / 2;
  ctx.beginPath();
  for (let x = -Math.ceil(D / (3 * u)) * 3 * u; x < D; x += 3 * u) { ctx.moveTo(x, -D); ctx.lineTo(x, D); }
  ctx.strokeStyle = withAlpha(lighten(c.bg, 0.3), 0.05);
  ctx.lineWidth = 1.2 * u;
  ctx.stroke();
  ctx.restore();
  const s = 26 * u;
  ctx.beginPath();
  for (let x = (w / 2) % s; x < w; x += s) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  ctx.strokeStyle = withAlpha(c.fg, 0.55);
  ctx.lineWidth = Math.max(0.6, 1.3 * u);
  ctx.setLineDash([5 * u, 2.2 * u]);
  ctx.stroke();
  ctx.setLineDash([]);
  blotch(ctx, w, h, u, 0.25, 2);
  grain(ctx, w, h, u, 0.14);
  vignette(ctx, w, h, "#000000", 0.4);
}

export function chevron(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  const half = 46 * u, amp = 34 * u, band = 30 * u, gap = 84 * u;
  const K = Math.ceil(w / 2 / half) + 2;
  ctx.fillStyle = c.fg;
  ctx.beginPath();
  const r0 = -Math.ceil(h / 2 / gap) - 2, r1 = Math.ceil(h / 2 / gap) + 2;
  for (let r = r0; r <= r1; r++) {
    const y0 = h / 2 + r * gap;
    for (let k = -K; k <= K; k++) {
      const x = w / 2 + k * half, y = y0 + (k & 1 ? amp : 0);
      if (k === -K) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let k = K; k >= -K; k--) ctx.lineTo(w / 2 + k * half, y0 + (k & 1 ? amp : 0) + band);
    ctx.closePath();
  }
  ctx.fill();
  grain(ctx, w, h, u, 0.09);
}

export function memphis(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  const ink = luma(c.bg) > 0.5 ? darken(c.bg, 0.88) : lighten(c.bg, 0.88);
  const cols = [c.a, c.b, ink, c.a, c.b];
  const cs = 124 * u;
  const nx = Math.ceil(w / cs / 2) + 1, ny = Math.ceil(h / cs / 2) + 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let j = -ny; j <= ny; j++) {
    for (let i = -nx; i <= nx; i++) {
      const R = cellRng(i, j, 5);
      const x = w / 2 + (i + 0.5) * cs + (R() - 0.5) * cs * 0.55;
      const y = h / 2 + (j + 0.5) * cs + (R() - 0.5) * cs * 0.55;
      const type = Math.floor(R() * 7), col = cols[Math.floor(R() * cols.length)];
      const s = (20 + R() * 14) * u, rot = R() * TAU;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineWidth = 6 * u;
      ctx.beginPath();
      if (type === 0) { ctx.moveTo(0, -s); ctx.lineTo(s * 0.9, s * 0.6); ctx.lineTo(-s * 0.9, s * 0.6); ctx.closePath(); ctx.fill(); }
      else if (type === 1) { ctx.arc(0, 0, s * 0.75, 0, TAU); ctx.stroke(); }
      else if (type === 2) { for (let k = 0; k <= 5; k++) ctx.lineTo(-s * 1.2 + k * s * 0.48, k & 1 ? -s * 0.35 : s * 0.35); ctx.stroke(); }
      else if (type === 3) { ctx.moveTo(-s * 0.7, 0); ctx.lineTo(s * 0.7, 0); ctx.moveTo(0, -s * 0.7); ctx.lineTo(0, s * 0.7); ctx.stroke(); }
      else if (type === 4) { for (const [dx, dy] of [[-0.6, 0], [0, -0.4], [0.6, 0.1]]) { ctx.moveTo(dx * s + s * 0.2, dy * s); ctx.arc(dx * s, dy * s, s * 0.2, 0, TAU); } ctx.fill(); }
      else if (type === 5) { ctx.arc(0, 0, s * 0.8, 0, Math.PI); ctx.closePath(); ctx.fill(); }
      else { ctx.moveTo(-s, 0); ctx.bezierCurveTo(-s * 0.4, -s * 0.8, s * 0.4, s * 0.8, s, 0); ctx.stroke(); }
      ctx.restore();
    }
  }
  grain(ctx, w, h, u, 0.07);
}

export function plusPattern(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  const s = 52 * u, arm = 8 * u;
  const nx = Math.ceil(w / s / 2) + 1, ny = Math.ceil(h / s) + 2;
  ctx.beginPath();
  for (let j = -ny; j <= ny; j++) {
    for (let i = -nx; i <= nx; i++) {
      const x = w / 2 + i * s + (j & 1 ? s / 2 : 0), y = h / 2 + (j * s) / 2;
      ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y);
      ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm);
    }
  }
  ctx.strokeStyle = c.fg;
  ctx.lineWidth = 3.2 * u;
  ctx.lineCap = "round";
  ctx.stroke();
  grain(ctx, w, h, u, 0.07);
}

export function blueprint(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  glow(ctx, w / 2, h / 2, Math.max(w, h) * 0.6, lighten(c.bg, 0.12), 0.8);
  blotch(ctx, w, h, u, 0.2, 2);
  const lw = Math.max(0.6, 0.9 * u);
  gridLines(ctx, w, h, 20 * u, withAlpha(c.fg, 0.14), lw);
  gridLines(ctx, w, h, 100 * u, withAlpha(c.fg, 0.32), lw * 1.5);
  const ink = withAlpha(c.fg, 0.6);
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 1.4 * u;
  ctx.lineCap = "round";
  // bottom right: gear-ish circles with centre marks
  const gx = w - 150 * u, gy = h - 150 * u;
  ctx.beginPath();
  ctx.arc(gx, gy, 92 * u, 0, TAU); ctx.moveTo(gx + 58 * u, gy); ctx.arc(gx, gy, 58 * u, 0, TAU);
  ctx.moveTo(gx + 16 * u, gy); ctx.arc(gx, gy, 16 * u, 0, TAU);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    ctx.moveTo(gx + Math.cos(a) * 92 * u, gy + Math.sin(a) * 92 * u);
    ctx.lineTo(gx + Math.cos(a) * 106 * u, gy + Math.sin(a) * 106 * u);
  }
  ctx.stroke();
  ctx.setLineDash([12 * u, 5 * u, 2 * u, 5 * u]);
  ctx.beginPath();
  ctx.moveTo(gx - 130 * u, gy); ctx.lineTo(gx + 130 * u, gy); ctx.moveTo(gx, gy - 130 * u); ctx.lineTo(gx, gy + 130 * u);
  ctx.stroke();
  ctx.setLineDash([]);
  // top left: dimension lines
  const dx = 60 * u, dy = 70 * u, L = 280 * u;
  const arrow = (x, y, dir) => { ctx.moveTo(x, y); ctx.lineTo(x + dir * 10 * u, y - 4 * u); ctx.lineTo(x + dir * 10 * u, y + 4 * u); ctx.closePath(); };
  ctx.beginPath();
  ctx.moveTo(dx, dy - 16 * u); ctx.lineTo(dx, dy + 16 * u); ctx.moveTo(dx + L, dy - 16 * u); ctx.lineTo(dx + L, dy + 16 * u);
  ctx.moveTo(dx, dy); ctx.lineTo(dx + L, dy);
  ctx.moveTo(dy, dx + 40 * u); ctx.lineTo(dy, dx + 220 * u);
  ctx.stroke();
  ctx.beginPath(); arrow(dx, dy, 1); arrow(dx + L, dy, -1); ctx.fill();
  ctx.beginPath();
  ctx.rect(dx + 70 * u, dy + 40 * u, 140 * u, 90 * u);
  ctx.moveTo(dx + 70 * u, dy + 40 * u); ctx.lineTo(dx + 210 * u, dy + 130 * u);
  ctx.stroke();
  // bottom left: title block
  ctx.beginPath();
  ctx.rect(40 * u, h - 110 * u, 250 * u, 70 * u);
  ctx.moveTo(40 * u, h - 75 * u); ctx.lineTo(290 * u, h - 75 * u); ctx.moveTo(170 * u, h - 110 * u); ctx.lineTo(170 * u, h - 40 * u);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.fillRect(52 * u, h - 98 * u, 90 * u, 5 * u); ctx.fillRect(52 * u, h - 62 * u, 70 * u, 5 * u); ctx.fillRect(182 * u, h - 62 * u, 90 * u, 5 * u);
  ctx.restore();
  grain(ctx, w, h, u, 0.08);
  vignette(ctx, w, h, darken(c.bg, 0.6), 0.5);
}

export function retroRainbow(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  const bands = 5, bw = 36 * u, r0 = 110 * u;
  const corner = (x, y) => {
    for (let k = bands - 1; k >= 0; k--) {
      ctx.fillStyle = mix(c.a, c.b, k / (bands - 1));
      ctx.beginPath();
      ctx.arc(x, y, r0 + (k + 1) * bw, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = c.bg;
    ctx.beginPath();
    ctx.arc(x, y, r0, 0, TAU);
    ctx.fill();
  };
  corner(0, h);
  corner(w, 0);
  paperFibres(ctx, w, h, c.bg, u, 9, 0.5);
  grain(ctx, w, h, u, 0.1);
}

export function duotoneSplit(ctx, w, h, c, u) {
  fill(ctx, w, h, c.a);
  const ang = (68 * Math.PI) / 180, dxv = Math.cos(ang), dyv = Math.sin(ang);
  const D = Math.hypot(w, h);
  const P = (off) => [w / 2 + dyv * off, h / 2 - dxv * off];
  const edge = (off) => { const [px, py] = P(off); return [[px - dxv * D, py - dyv * D], [px + dxv * D, py + dyv * D]]; };
  const [e0, e1] = edge(0);
  ctx.fillStyle = c.b;
  ctx.beginPath();
  ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]);
  ctx.lineTo(e1[0] + dyv * D, e1[1] - dxv * D); ctx.lineTo(e0[0] + dyv * D, e0[1] - dxv * D);
  ctx.closePath();
  ctx.fill();
  // halftone fade off the edge, on the dark side
  ctx.fillStyle = withAlpha(c.a, 0.85);
  ctx.beginPath();
  const s = 16 * u, steps = Math.ceil(D / s);
  for (let i = 1; i < 9; i++) {
    const r = s * 0.42 * (1 - i / 9);
    for (let k = -steps; k <= steps; k++) {
      const [px, py] = P(i * s);
      const x = px + dxv * k * s + (i & 1 ? (dxv * s) / 2 : 0), y = py + dyv * k * s + (i & 1 ? (dyv * s) / 2 : 0);
      if (x < -s || y < -s || x > w + s || y > h + s) continue;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
  }
  ctx.fill();
  ctx.strokeStyle = c.line;
  ctx.lineCap = "butt";
  for (const [off, lw] of [[-22, 5], [-38, 2]]) {
    const [p0, p1] = edge(off * u);
    ctx.lineWidth = lw * u;
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
  }
  grain(ctx, w, h, u, 0.14);
}

export function lowPoly(ctx, w, h, c, u) {
  fill(ctx, w, h, c.base);
  const s = 120 * u, rh = s * 0.866, v = lattice(57);
  const nx = Math.ceil(w / s / 2) + 2, ny = Math.ceil(h / rh / 2) + 2;
  const vert = (i, j) => {
    const R = cellRng(i, j, 8);
    return [w / 2 + (i + (j & 1 ? 0.5 : 0)) * s + (R() - 0.5) * s * 0.38, h / 2 + j * rh + (R() - 0.5) * rh * 0.38];
  };
  const tri = (p, q, r, i, j, k) => {
    const cx = (p[0] + q[0] + r[0]) / 3, cy = (p[1] + q[1] + r[1]) / 3;
    const f = fbm(v, (cx - w / 2) / (420 * u) + 20, (cy - h / 2) / (420 * u) + 20, 3);
    const t = clamp((cx / w) * 0.45 + (cy / h) * 0.55);
    const R = cellRng(i * 2 + k, j, 9);
    let col = mix(c.base, c.accent, clamp(0.05 + t * 0.75 * (0.6 + f * 0.8)));
    col = R() < 0.5 ? lighten(col, R() * 0.07) : darken(col, R() * 0.12);
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(r[0], r[1]); ctx.closePath();
    ctx.fill(); ctx.stroke();
  };
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  for (let j = -ny; j < ny; j++) {
    for (let i = -nx; i < nx; i++) {
      const a = vert(i, j), b = vert(i + 1, j), cc = vert(i + (j & 1 ? 1 : 0), j + 1), d = vert(i + (j & 1 ? 0 : -1), j + 1);
      tri(a, b, cc, i, j, 0);
      tri(a, cc, d, i, j, 1);
    }
  }
  grain(ctx, w, h, u, 0.08);
  vignette(ctx, w, h, "#000000", 0.3);
}

export function gingham(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  const p = 64 * u, b = p / 2;
  ctx.fillStyle = withAlpha(c.fg, 0.42);
  ctx.beginPath();
  for (let x = (w / 2) % p - p; x < w; x += p) ctx.rect(x, 0, b, h);
  ctx.fill();
  ctx.beginPath();
  for (let y = (h / 2) % p - p; y < h; y += p) ctx.rect(0, y, w, b);
  ctx.fill();
  // fine weave
  ctx.beginPath();
  for (let x = (w / 2) % (4 * u); x < w; x += 4 * u) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  ctx.strokeStyle = withAlpha(darken(c.fg, 0.3), 0.06);
  ctx.lineWidth = 1.2 * u;
  ctx.stroke();
  grain(ctx, w, h, u, 0.08);
}

export function terrazzo(ctx, w, h, c, u) {
  fill(ctx, w, h, c.bg);
  overlayTile(ctx, w, h, speckTile(), 0.35, "overlay", Math.max(0.5, u * 0.9));
  const cols = [c.a, c.b, mix(c.a, c.bg, 0.45), darken(c.bg, 0.45), lighten(c.b, 0.35), mix(c.a, c.b, 0.5)];
  const cs = 64 * u;
  const nx = Math.ceil(w / cs / 2) + 1, ny = Math.ceil(h / cs / 2) + 1;
  for (let j = -ny; j <= ny; j++) {
    for (let i = -nx; i <= nx; i++) {
      const R = cellRng(i, j, 12);
      const count = R() < 0.35 ? 2 : 1;
      for (let q = 0; q < count; q++) {
        const x = w / 2 + (i + R()) * cs, y = h / 2 + (j + R()) * cs;
        const rad = (R() < 0.75 ? 3 + R() * 6 : 9 + R() * 9) * u;
        const n = 5 + Math.floor(R() * 3), rot = R() * TAU;
        ctx.fillStyle = cols[Math.floor(R() * cols.length)];
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const a = rot + (k / n) * TAU, rr = rad * (0.6 + R() * 0.5);
          if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  grain(ctx, w, h, u, 0.07);
}

