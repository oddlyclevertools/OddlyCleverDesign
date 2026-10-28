// Background scenes, part of scenes.js (our own CC0 work). See scenes.js for the format.
import { TAU, clamp, HEX_RE, isHex, rgbOf, toHex, mix, lighten, darken, withAlpha, luma, rng, hash, cellRng, noise1, lattices, lattice, smooth, vnoise, fbm, makeCanvas, reset, fill, linear, softStops, glow, vignette, shadow, noShadow, roundRect, neon, tiles, tile, grainTile, blotchTile, speckTile, overlayTile, grain, blotch, C, def } from "./scene-kit.js";
import { polkaDots, gridLines, graphPaper, diagonalStripes, checker, halftone, waves, contours, topography, filmGrain, grainyGradient, sunburst, meshBlobs, gradientMesh, aurora, paperFibres, paperTexture, pinstripes, chevron, memphis, plusPattern, blueprint, retroRainbow, duotoneSplit, lowPoly, gingham, terrazzo } from "./scenes-patterns.js";
import { brickWall, neonSkyline, starrySky, deskTop, studioSpotlight, rainyStreet } from "./scenes-places-a.js";

export function sunsetHills(ctx, w, h, c, u) {
  const yH = h - Math.max(250 * u, h * 0.32);
  fill(ctx, w, h, linear(ctx, 0, 0, 0, yH, [[0, mix(c.sky, c.hills, 0.62)], [0.5, c.sky], [1, mix(c.sky, c.sun, 0.7)]]));
  // streak clouds
  const R = rng(81);
  ctx.save();
  for (let i = 0; i < 6; i++) {
    const cy = yH * (0.12 + R() * 0.4), cw = (240 + R() * 360) * u, cx = R() * w, ch = (8 + R() * 10) * u;
    if (Math.abs(cx - w / 2) < cw * 0.6 && Math.abs(cy - h / 2) < h * 0.18) continue;
    const p = new Path2D();
    p.moveTo(cx - cw / 2, cy);
    p.quadraticCurveTo(cx - cw * 0.1, cy - ch * 1.6, cx + cw / 2, cy);
    p.quadraticCurveTo(cx, cy + ch * 0.7, cx - cw / 2, cy);
    ctx.fillStyle = linear(ctx, 0, cy - ch, 0, cy + ch * 0.4, [[0, withAlpha(lighten(c.sky, 0.35), 0.55)], [1, withAlpha(mix(c.sky, c.sun, 0.7), 0.75)]]);
    ctx.fill(p);
  }
  ctx.restore();
  // sun
  const sx = w / 2, sy = yH - 6 * u, sr = 120 * u;
  glow(ctx, sx, sy, 640 * u, c.sun, 0.55, "screen");
  ctx.fillStyle = linear(ctx, 0, sy - sr, 0, sy + sr, [[0, lighten(c.sun, 0.45)], [1, c.sun]]);
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
  // birds
  ctx.save();
  ctx.strokeStyle = withAlpha(darken(c.hills, 0.4), 0.8);
  ctx.lineWidth = 2.4 * u; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  for (const [bx, by, bs] of [[0.16, 0.2, 1], [0.21, 0.24, 0.75], [0.12, 0.27, 0.6]]) {
    const x = w * bx, y = yH * by + 40 * u, s = 14 * u * bs;
    ctx.moveTo(x - s, y - s * 0.4); ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.6, x, y); ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.6, x + s, y - s * 0.4);
  }
  ctx.stroke();
  ctx.restore();
  // hill layers
  const layers = 4;
  for (let k = 0; k < layers; k++) {
    const nz = noise1(90 + k);
    const base = yH + (k / layers) * (h - yH) * 0.82 + 20 * u;
    const amp = (90 - k * 14) * u, freq = (300 - k * 30) * u;
    const t = k / (layers - 1);
    ctx.fillStyle = darken(mix(mix(c.sky, c.sun, 0.2), c.hills, 0.3 + t * 0.7), t * 0.4);
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w + 12 * u; x += 12 * u) ctx.lineTo(x, base - (nz(x / freq) * 0.5 + 0.5) * amp);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    if (k < layers - 1) {
      ctx.fillStyle = linear(ctx, 0, base - amp, 0, h, [[0, withAlpha(mix(c.sky, c.sun, 0.4), 0)], [1, withAlpha(mix(c.sky, c.sun, 0.4), 0.25)]]);
      ctx.fillRect(0, base - amp, w, h - base + amp);
    }
  }
  grain(ctx, w, h, u, 0.08);
  vignette(ctx, w, h, darken(c.hills, 0.4), 0.3);
}

export function stageCurtains(ctx, w, h, c, u) {
  const back = mix("#0d0a10", c.curtain, 0.14);
  fill(ctx, w, h, linear(ctx, 0, 0, 0, h, [[0, darken(back, 0.4)], [1, back]]));
  const stageY = h - Math.max(110 * u, h * 0.13);
  glow(ctx, w / 2, stageY - 140 * u, 460 * u, c.light, 0.3, "screen");
  // stage floor
  ctx.fillStyle = linear(ctx, 0, stageY, 0, h, [[0, mix("#5a3420", c.curtain, 0.15)], [1, "#24140c"]]);
  ctx.fillRect(0, stageY, w, h - stageY);
  ctx.beginPath();
  for (let k = 1; k < 6; k++) { const y = stageY + ((h - stageY) * k * k) / 36; ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.strokeStyle = withAlpha("#000000", 0.35); ctx.lineWidth = 1.5 * u; ctx.stroke();
  ctx.fillStyle = withAlpha(lighten(c.light, 0.2), 0.35);
  ctx.fillRect(0, stageY, w, 2 * u);
  glow(ctx, w / 2, stageY + (h - stageY) * 0.35, 380 * u, c.light, 0.6, "screen", (h - stageY) * 0.5);
  // footlights
  for (let x = (w / 2) % (110 * u); x < w; x += 110 * u) glow(ctx, x, h - 4 * u, 50 * u, c.light, 0.55, "screen", 22 * u);
  // fold gradient
  const dark = darken(c.curtain, 0.6), lite = lighten(c.curtain, 0.16);
  const folds = (x0, x1, n) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    for (let i = 0; i < n; i++) {
      g.addColorStop(i / n, dark);
      g.addColorStop((i + 0.35) / n, c.curtain);
      g.addColorStop((i + 0.6) / n, lite);
      g.addColorStop((i + 0.85) / n, c.curtain);
    }
    g.addColorStop(1, dark);
    return g;
  };
  const cw = clamp(w * 0.22, 150 * u, w * 0.34);
  const gold = mix(c.light, "#c08a2a", 0.6);
  const side = () => {
    const p = new Path2D();
    p.moveTo(-2, -2); p.lineTo(cw, -2);
    p.bezierCurveTo(cw * 0.96, h * 0.3, cw * 0.7, h * 0.5, cw * 0.6, h * 0.58);
    p.quadraticCurveTo(cw * 0.62, h * 0.8, cw * 0.98, h + 2);
    p.lineTo(-2, h + 2); p.closePath();
    ctx.save();
    shadow(ctx, u, 0.6, 30, 10, 0, "#000000");
    ctx.fillStyle = folds(0, cw, 6);
    ctx.fill(p);
    noShadow(ctx);
    ctx.clip(p);
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, withAlpha("#000000", 0.45)], [0.3, withAlpha("#000000", 0)], [0.75, withAlpha("#000000", 0.05)], [1, withAlpha("#000000", 0.4)]]);
    ctx.fillRect(0, 0, cw, h);
    ctx.fillStyle = linear(ctx, 0, 0, cw, 0, [[0.6, withAlpha(c.light, 0)], [1, withAlpha(c.light, 0.18)]]);
    ctx.fillRect(0, 0, cw, h);
    ctx.restore();
    // tie-back
    ctx.save();
    ctx.strokeStyle = gold; ctx.lineWidth = 9 * u; ctx.lineCap = "round";
    shadow(ctx, u, 0.5, 8, 2, 4, "#000000");
    ctx.beginPath(); ctx.moveTo(-4 * u, h * 0.555); ctx.quadraticCurveTo(cw * 0.35, h * 0.6, cw * 0.64, h * 0.575); ctx.stroke();
    ctx.fillStyle = gold;
    ctx.beginPath(); ctx.moveTo(cw * 0.62, h * 0.58); ctx.lineTo(cw * 0.58, h * 0.66); ctx.lineTo(cw * 0.7, h * 0.66); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  side();
  ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); side(); ctx.restore();
  // valance with swags
  const vh = Math.max(64 * u, h * 0.08);
  ctx.save();
  shadow(ctx, u, 0.6, 26, 0, 10, "#000000");
  ctx.fillStyle = folds(0, w, Math.max(4, Math.round(w / (36 * u))));
  ctx.fillRect(0, 0, w, vh);
  noShadow(ctx);
  const sw = w / Math.max(3, Math.round(w / (300 * u)));
  for (let x = 0; x < w - 1; x += sw) {
    const p = new Path2D();
    p.moveTo(x, vh * 0.5); p.quadraticCurveTo(x + sw / 2, vh * 1.9, x + sw, vh * 0.5); p.lineTo(x + sw, 0); p.lineTo(x, 0); p.closePath();
    ctx.save();
    shadow(ctx, u, 0.55, 18, 0, 8, "#000000");
    ctx.fillStyle = linear(ctx, 0, vh * 0.3, 0, vh * 1.2, [[0, c.curtain], [0.6, lite], [1, dark]]);
    ctx.fill(p);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = gold; ctx.lineWidth = 7 * u;
    ctx.setLineDash([2 * u, 2.5 * u]);
    ctx.beginPath(); ctx.moveTo(x, vh * 0.5 + 3 * u); ctx.quadraticCurveTo(x + sw / 2, vh * 1.9 + 3 * u, x + sw, vh * 0.5 + 3 * u); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  grain(ctx, w, h, u, 0.1);
  vignette(ctx, w, h, "#000000", 0.5, 0.4);
}

export function paperHills(ctx, w, h, c, u) {
  fill(ctx, w, h, linear(ctx, 0, 0, 0, h, [[0, lighten(c.sky, 0.25)], [1, c.sky]]));
  const ground = Math.max(330 * u, h * 0.42);
  const top = h - ground;
  // sun and clouds, paper-cut
  const paperShadow = withAlpha(darken(c.land, 0.7), 1);
  ctx.save();
  ctx.shadowColor = withAlpha(paperShadow, 0.28); ctx.shadowBlur = 14 * u; ctx.shadowOffsetY = 5 * u;
  ctx.fillStyle = c.sun;
  ctx.beginPath(); ctx.arc(w - 170 * u, Math.max(150 * u, top * 0.4), 70 * u, 0, TAU); ctx.fill();
  ctx.fillStyle = lighten(c.sky, 0.7);
  const cloud = (x, y, s) => {
    ctx.beginPath();
    ctx.moveTo(x - s * 1.5, y);
    ctx.arc(x - s * 0.8, y, s * 0.6, Math.PI, Math.PI * 1.75);
    ctx.arc(x, y - s * 0.2, s * 0.8, Math.PI * 1.15, Math.PI * 1.9);
    ctx.arc(x + s * 0.9, y, s * 0.55, Math.PI * 1.25, 0);
    ctx.lineTo(x + s * 1.45, y); ctx.closePath(); ctx.fill();
  };
  cloud(180 * u, Math.max(130 * u, top * 0.3), 80 * u);
  cloud(w - 400 * u, Math.max(240 * u, top * 0.58), 52 * u);
  ctx.restore();
  // layers, back to front
  const n = 5;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    const nz = noise1(110 + k);
    const base = top + t * ground * 0.72 + 40 * u;
    const amp = (k < 2 ? 150 - k * 30 : 80 - k * 10) * u;
    const col = mix(mix(c.sky, c.land, 0.28), darken(c.land, 0.32), Math.pow(t, 0.85));
    const p = new Path2D();
    p.moveTo(-10, h + 10);
    if (k < 2) {
      const R = rng(120 + k);
      for (let x = (k ? -90 : -20) * u; x <= w + 200 * u; x += (150 + R() * 130) * u) {
        p.lineTo(x, base - amp * (0.55 + R() * 0.45));
        p.lineTo(x + (75 + R() * 50) * u, base - amp * (0.05 + R() * 0.25));
      }
    } else {
      for (let x = -10 * u; x <= w + 12 * u; x += 12 * u) p.lineTo(x, base - (nz(x / (260 * u)) * 0.5 + 0.5) * amp);
    }
    p.lineTo(w + 10, h + 10); p.closePath();
    ctx.save();
    ctx.shadowColor = withAlpha(paperShadow, 0.32); ctx.shadowBlur = 18 * u; ctx.shadowOffsetY = -4 * u;
    ctx.fillStyle = col;
    ctx.fill(p);
    ctx.restore();
  }
  blotch(ctx, w, h, u, 0.14, 2.4);
  paperFibres(ctx, w, h, c.sky, u, 13, 0.6);
  grain(ctx, w, h, u, 0.08);
}

export function synthwave(ctx, w, h, c, u) {
  const yH = h * 0.62;
  const sky = linear(ctx, 0, 0, 0, yH, [[0, darken(c.sky, 0.45)], [0.6, c.sky], [1, mix(c.sky, c.grid, 0.55)]]);
  fill(ctx, w, h, sky);
  const R = rng(131);
  ctx.fillStyle = withAlpha("#ffffff", 0.65);
  ctx.beginPath();
  const ns = Math.round(((w * yH) / (u * u)) * 0.0004);
  for (let i = 0; i < ns; i++) {
    const x = R() * w, y = R() * R() * yH * 0.8, r = (0.4 + R() * 1.1) * u;
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fill();
  // sun
  const sx = w / 2, sr = 170 * u, sy = yH - sr * 0.35;
  glow(ctx, sx, sy, 520 * u, c.sun, 0.45, "screen");
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, yH); ctx.clip();
  ctx.save();
  ctx.shadowColor = c.grid; ctx.shadowBlur = 40 * u;
  ctx.fillStyle = linear(ctx, 0, sy - sr, 0, sy + sr, [[0, lighten(c.sun, 0.2)], [0.55, mix(c.sun, c.grid, 0.5)], [1, c.grid]]);
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(sx, sy, sr + 2, 0, TAU); ctx.clip();
  ctx.fillStyle = sky;
  for (let i = 0; i < 7; i++) {
    const y = sy - sr * 0.08 + i * sr * 0.16, bh = (2 + i * 2.2) * u;
    ctx.fillRect(sx - sr - 4, y, sr * 2 + 8, bh);
  }
  ctx.restore();
  // mountains at the sides
  const range = (x0, x1, seed) => {
    const Rm = rng(seed);
    const p = new Path2D();
    p.moveTo(x0, yH);
    let x = x0;
    while (x < x1) {
      const step = (40 + Rm() * 70) * u;
      const peak = (50 + Rm() * 140) * u * (1 - Math.abs((x - (x0 + x1) / 2) / (x1 - x0)) * 0.9);
      p.lineTo(Math.min(x1, x + step / 2), yH - peak);
      x += step;
      p.lineTo(Math.min(x1, x), yH - peak * (0.3 + Rm() * 0.3));
    }
    p.lineTo(x1, yH); p.closePath();
    ctx.fillStyle = linear(ctx, 0, yH - 200 * u, 0, yH, [[0, mix(darken(c.sky, 0.5), c.grid, 0.25)], [1, darken(c.sky, 0.55)]]);
    ctx.fill(p);
    ctx.save();
    ctx.strokeStyle = withAlpha(c.grid, 0.7); ctx.lineWidth = 1.6 * u; ctx.lineJoin = "round";
    ctx.shadowColor = c.grid; ctx.shadowBlur = 10 * u;
    ctx.stroke(p);
    ctx.restore();
  };
  range(-20 * u, w * 0.38, 141);
  range(w * 0.62, w + 20 * u, 147);
  // floor + grid
  ctx.fillStyle = linear(ctx, 0, yH, 0, h, [[0, darken(c.sky, 0.6)], [1, mix(darken(c.sky, 0.4), c.grid, 0.12)]]);
  ctx.fillRect(0, yH, w, h - yH);
  const grid = new Path2D();
  const depth = h - yH;
  for (let i = 0; i < 30; i++) {
    const y = yH + (depth * 1.25) / (1 + i * 0.55);
    if (y > h + 2) continue;
    grid.moveTo(0, y); grid.lineTo(w, y);
  }
  const S = 110 * u, nV = Math.ceil(w / S) * 3;
  for (let k = -nV; k <= nV; k++) { grid.moveTo(w / 2 + k * S * 0.12, yH); grid.lineTo(w / 2 + k * S, h + depth * 0.05); }
  ctx.save();
  ctx.beginPath(); ctx.rect(0, yH, w, depth); ctx.clip();
  ctx.lineCap = "round";
  ctx.shadowColor = c.grid; ctx.shadowBlur = 12 * u;
  ctx.strokeStyle = c.grid; ctx.lineWidth = 2.2 * u;
  ctx.stroke(grid);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = lighten(c.grid, 0.55); ctx.lineWidth = 0.9 * u;
  ctx.stroke(grid);
  ctx.fillStyle = linear(ctx, 0, yH, 0, yH + depth * 0.4, [[0, darken(c.sky, 0.6)], [1, withAlpha(darken(c.sky, 0.6), 0)]]);
  ctx.fillRect(0, yH, w, depth * 0.4);
  ctx.restore();
  glow(ctx, w / 2, yH, w * 0.55, c.grid, 0.55, "screen", 40 * u);
  ctx.fillStyle = lighten(c.grid, 0.5);
  ctx.fillRect(0, yH - 1 * u, w, 2 * u);
  grain(ctx, w, h, u, 0.09);
  vignette(ctx, w, h, "#000000", 0.4);
}

export function woodFrame(ctx, w, h, f, wood, u) {
  const R = rng(151);
  const bars = [
    [[0, 0], [w, 0], [w - f, f], [f, f], true],
    [[0, h], [w, h], [w - f, h - f], [f, h - f], true],
    [[0, 0], [f, f], [f, h - f], [0, h], false],
    [[w, 0], [w - f, f], [w - f, h - f], [w, h], false],
  ];
  for (const [a, b, cc, d, horiz] of bars) {
    const p = new Path2D();
    p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); p.lineTo(cc[0], cc[1]); p.lineTo(d[0], d[1]); p.closePath();
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, w, h);
    ctx.beginPath();
    const len = horiz ? w : h;
    for (let k = 0; k < 9; k++) {
      const off = (k + 0.5) * (f / 9), wob = noise1(hash(k, horiz ? 1 : 2, 152));
      for (let s = 0; s <= len; s += 16 * u) {
        const o = off + wob(s / (200 * u)) * 3 * u;
        const xa = horiz ? s : (a[0] === 0 ? o : w - o), ya = horiz ? (a[1] === 0 ? o : h - o) : s;
        if (s === 0) ctx.moveTo(xa, ya); else ctx.lineTo(xa, ya);
      }
    }
    ctx.strokeStyle = withAlpha(darken(wood, 0.4), 0.35 + R() * 0.1); ctx.lineWidth = 1.3 * u; ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = withAlpha(lighten(wood, 0.4), 0.5); ctx.lineWidth = 2 * u;
  ctx.strokeRect(u, u, w - 2 * u, h - 2 * u);
  ctx.strokeStyle = withAlpha("#000000", 0.55); ctx.lineWidth = 4 * u;
  ctx.strokeRect(f, f, w - 2 * f, h - 2 * f);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(f, f); ctx.moveTo(w, 0); ctx.lineTo(w - f, f); ctx.moveTo(0, h); ctx.lineTo(f, h - f); ctx.moveTo(w, h); ctx.lineTo(w - f, h - f);
  ctx.strokeStyle = withAlpha("#000000", 0.3); ctx.lineWidth = 1.2 * u; ctx.stroke();
  ctx.restore();
}

export function chalkboard(ctx, w, h, c, u) {
  const f = 34 * u;
  fill(ctx, w, h, c.board);
  const R = rng(161);
  for (let i = 0; i < 26; i++) glow(ctx, R() * w, R() * h, (120 + R() * 260) * u, "#ffffff", 0.04 + R() * 0.04);
  ctx.save();
  ctx.filter = `blur(${Math.max(1, 10 * u)}px)`;
  ctx.strokeStyle = withAlpha("#ffffff", 0.05);
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    ctx.lineWidth = (50 + R() * 40) * u;
    const x = R() * w, y = R() * h, r = (180 + R() * 260) * u, a = R() * TAU;
    ctx.beginPath(); ctx.arc(x, y, r, a, a + 0.8 + R()); ctx.stroke();
  }
  ctx.restore();
  blotch(ctx, w, h, u, 0.35, 1.5);
  grain(ctx, w, h, u, 0.18);
  // chalk doodles in the corners
  const chalk = (draw) => {
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = withAlpha("#f4f1ea", 0.65); ctx.lineWidth = 3 * u;
    ctx.beginPath(); draw(0); ctx.stroke();
    ctx.strokeStyle = withAlpha("#f4f1ea", 0.25); ctx.lineWidth = 2 * u;
    ctx.beginPath(); draw(1.8 * u); ctx.stroke();
    ctx.restore();
  };
  const sx = f + 90 * u, sy = f + 80 * u;
  chalk((o) => { for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5; const x = sx + o + Math.cos(a) * 32 * u, y = sy + Math.sin(a) * 32 * u; if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } });
  chalk((o) => { const x = w - f - 210 * u, y = f + 70 * u; ctx.moveTo(x + o, y); ctx.bezierCurveTo(x + 60 * u, y - 20 * u, x + 120 * u, y + 10 * u, x + 150 * u, y + 70 * u + o); ctx.moveTo(x + 136 * u, y + 52 * u); ctx.lineTo(x + 150 * u, y + 72 * u); ctx.lineTo(x + 166 * u, y + 52 * u); });
  chalk((o) => { const x = w - f - 260 * u, y = f + 30 * u; for (let k = 0; k < 7; k++) { const xx = x + k * 18 * u; ctx.lineTo(xx, y + (k & 1 ? 6 : -2) * u + o); } });
  const gx = f + 60 * u, gy = h - f - 70 * u;
  chalk((o) => { ctx.moveTo(gx, gy - 140 * u); ctx.lineTo(gx + o, gy); ctx.lineTo(gx + 170 * u, gy + o); for (let k = 0; k <= 12; k++) { const t = k / 12; const x = gx + 10 * u + t * 150 * u, y = gy - 10 * u - Math.pow(t, 2) * 120 * u; if (k === 0) ctx.moveTo(x, y + o); else ctx.lineTo(x, y + o); } });
  const tx = w - f - 200 * u, ty = h - f - 120 * u;
  chalk((o) => { for (let k = 0; k < 4; k++) { ctx.moveTo(tx + k * 18 * u + o, ty); ctx.lineTo(tx + k * 18 * u, ty + 60 * u); } ctx.moveTo(tx - 12 * u, ty + 46 * u); ctx.lineTo(tx + 70 * u, ty + 12 * u + o); });
  // tray, chalk and eraser
  const trayY = h - f - 6 * u;
  ctx.save();
  shadow(ctx, u, 0.5, 10, 0, -2, "#000000");
  ctx.fillStyle = darken(c.frame, 0.15);
  ctx.fillRect(f - 6 * u, trayY - 14 * u, w - 2 * f + 12 * u, 20 * u);
  noShadow(ctx);
  ctx.fillStyle = withAlpha(lighten(c.frame, 0.3), 0.6);
  ctx.fillRect(f - 6 * u, trayY - 14 * u, w - 2 * f + 12 * u, 3 * u);
  ctx.restore();
  ctx.save();
  shadow(ctx, u, 0.4, 4, 1, 2, "#000000");
  ctx.fillStyle = "#f2efe8";
  ctx.fillRect(w * 0.26, trayY - 24 * u, 64 * u, 10 * u);
  ctx.fillStyle = "#ffc9da";
  ctx.fillRect(w * 0.26 + 80 * u, trayY - 23 * u, 40 * u, 9 * u);
  ctx.fillStyle = "#3a3236";
  ctx.fillRect(w * 0.68, trayY - 34 * u, 110 * u, 20 * u);
  ctx.fillStyle = mix(c.frame, "#e8d3b0", 0.5);
  ctx.fillRect(w * 0.68, trayY - 38 * u, 110 * u, 8 * u);
  ctx.restore();
  vignette(ctx, w, h, "#000000", 0.4, 0.4);
  woodFrame(ctx, w, h, f, c.frame, u);
}

export function pushpin(ctx, x, y, col, u) {
  ctx.save();
  ctx.fillStyle = withAlpha("#000000", 0.35);
  ctx.beginPath(); ctx.ellipse(x + 6 * u, y + 8 * u, 11 * u, 8 * u, 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = darken(col, 0.3);
  ctx.beginPath(); ctx.arc(x, y, 12 * u, 0, TAU); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x - 1.5 * u, y - 1.5 * u, 10 * u, 0, TAU); ctx.fill();
  ctx.fillStyle = withAlpha("#ffffff", 0.55);
  ctx.beginPath(); ctx.arc(x - 4.5 * u, y - 4.5 * u, 3.4 * u, 0, TAU); ctx.fill();
  ctx.restore();
}

export function corkBoard(ctx, w, h, c, u) {
  const f = 30 * u;
  fill(ctx, w, h, c.cork);
  blotch(ctx, w, h, u, 0.25, 3);
  overlayTile(ctx, w, h, speckTile(), 0.85, "overlay", Math.max(0.35, u * 0.8));
  grain(ctx, w, h, u, 0.2);
  vignette(ctx, w, h, darken(c.cork, 0.6), 0.45, 0.4);
  const ink = "#2a2433";
  const card = (x, y, rot, cw, ch, body) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    shadow(ctx, u, 0.4, 16, 4, 9, "#2a1505");
    body(cw, ch);
    ctx.restore();
  };
  // polaroid
  card(f + 150 * u, f + 160 * u, -0.1, 200 * u, 236 * u, (cw, ch) => {
    ctx.fillStyle = "#fbf8f2"; ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    noShadow(ctx);
    const px = -cw / 2 + 14 * u, py = -ch / 2 + 14 * u, pw = cw - 28 * u, phh = ch - 66 * u;
    ctx.fillStyle = linear(ctx, 0, py, 0, py + phh, [[0, lighten(c.pin, 0.55)], [1, mix(c.pin, "#ffc83d", 0.5)]]);
    ctx.fillRect(px, py, pw, phh);
    ctx.fillStyle = lighten("#ffe9a8", 0.2);
    ctx.beginPath(); ctx.arc(px + pw * 0.65, py + phh * 0.45, 22 * u, 0, TAU); ctx.fill();
    ctx.fillStyle = darken(c.pin, 0.45);
    ctx.beginPath(); ctx.moveTo(px, py + phh); ctx.lineTo(px, py + phh * 0.7); ctx.lineTo(px + pw * 0.35, py + phh * 0.5); ctx.lineTo(px + pw * 0.7, py + phh * 0.78); ctx.lineTo(px + pw, py + phh * 0.62); ctx.lineTo(px + pw, py + phh); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = withAlpha(ink, 0.6); ctx.lineWidth = 2 * u; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-cw * 0.3, ch / 2 - 26 * u); ctx.bezierCurveTo(-cw * 0.1, ch / 2 - 34 * u, cw * 0.05, ch / 2 - 18 * u, cw * 0.25, ch / 2 - 28 * u); ctx.stroke();
  });
  pushpin(ctx, f + 150 * u + 10 * u, f + 160 * u - 110 * u, c.pin, u);
  // sticky note
  card(w - f - 140 * u, f + 130 * u, 0.07, 180 * u, 180 * u, (cw, ch) => {
    ctx.fillStyle = "#ffd95a"; ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    noShadow(ctx);
    ctx.fillStyle = linear(ctx, 0, -ch / 2, 0, ch / 2, [[0, withAlpha("#000000", 0.1)], [0.25, withAlpha("#000000", 0)], [1, withAlpha("#ffffff", 0.15)]]);
    ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    ctx.strokeStyle = withAlpha(ink, 0.7); ctx.lineWidth = 2.6 * u; ctx.lineCap = "round";
    ctx.beginPath();
    for (let k = 0; k < 4; k++) { const y = -ch * 0.18 + k * 24 * u; ctx.moveTo(-cw * 0.32, y); ctx.lineTo(cw * (0.3 - k * 0.08), y - 2 * u); }
    ctx.stroke();
  });
  pushpin(ctx, w - f - 140 * u, f + 130 * u - 74 * u, mix(c.pin, "#8fe3ff", 0.7), u);
  // index card
  card(f + 190 * u, h - f - 130 * u, 0.05, 280 * u, 170 * u, (cw, ch) => {
    ctx.fillStyle = "#fdfcf7"; ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    noShadow(ctx);
    ctx.beginPath();
    for (let y = -ch / 2 + 50 * u; y < ch / 2 - 8 * u; y += 20 * u) { ctx.moveTo(-cw / 2, y); ctx.lineTo(cw / 2, y); }
    ctx.strokeStyle = withAlpha("#6d8fb3", 0.5); ctx.lineWidth = 1.2 * u; ctx.stroke();
    ctx.strokeStyle = withAlpha("#e0475f", 0.7);
    ctx.beginPath(); ctx.moveTo(-cw / 2, -ch / 2 + 30 * u); ctx.lineTo(cw / 2, -ch / 2 + 30 * u); ctx.stroke();
  });
  pushpin(ctx, f + 190 * u, h - f - 130 * u - 64 * u, mix(c.pin, "#ffc83d", 0.8), u);
  // receipt
  card(w - f - 120 * u, h - f - 160 * u, -0.12, 130 * u, 230 * u, (cw, ch) => {
    const p = new Path2D();
    p.moveTo(-cw / 2, -ch / 2); p.lineTo(cw / 2, -ch / 2); p.lineTo(cw / 2, ch / 2);
    for (let k = 0; k <= 10; k++) p.lineTo(cw / 2 - (cw * k) / 10, ch / 2 - (k & 1 ? 7 * u : 0));
    p.closePath();
    ctx.fillStyle = "#f4f2ec"; ctx.fill(p);
    noShadow(ctx);
    ctx.fillStyle = withAlpha(ink, 0.45);
    for (let k = 0; k < 8; k++) { const y = -ch / 2 + 40 * u + k * 18 * u; ctx.fillRect(-cw * 0.36, y, cw * (0.35 + ((k * 37) % 25) / 100), 3 * u); ctx.fillRect(cw * 0.18, y, cw * 0.18, 3 * u); }
  });
  pushpin(ctx, w - f - 120 * u, h - f - 160 * u - 96 * u, c.pin, u);
  woodFrame(ctx, w, h, f, c.frame, u);
}

export function cloudsDay(ctx, w, h, c, u) {
  fill(ctx, w, h, linear(ctx, 0, 0, 0, h, [[0, darken(c.sky, 0.12)], [0.65, c.sky], [1, lighten(c.sky, 0.5)]]));
  glow(ctx, w * 0.1, h * 0.06, 520 * u, "#ffffff", 0.5, "screen");
  const shade = mix(c.cloud, c.sky, 0.3);
  const puff = (x, y, s, a = 1, toBottom = false) => {
    const parts = [[0, 0, 1], [-0.95, 0.25, 0.72], [0.95, 0.22, 0.78], [-0.45, -0.38, 0.78], [0.5, -0.3, 0.7], [-1.65, 0.48, 0.48], [1.7, 0.46, 0.52]];
    const p = new Path2D();
    for (const [dx, dy, r] of parts) { p.moveTo(x + dx * s + r * s, y + dy * s); p.arc(x + dx * s, y + dy * s, r * s, 0, TAU); }
    if (toBottom) p.rect(x - 1.9 * s, y + 0.3 * s, 3.8 * s, h);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.rect(x - 3 * s, y - 2 * s, 6 * s, toBottom ? h : 2.7 * s); ctx.clip();
    ctx.shadowColor = withAlpha(darken(c.sky, 0.3), 0.25); ctx.shadowBlur = 20 * u; ctx.shadowOffsetY = 8 * u;
    ctx.fillStyle = shade; ctx.fill(p);
    noShadow(ctx);
    ctx.translate(-s * 0.06, -s * 0.12);
    ctx.fillStyle = linear(ctx, 0, y - s, 0, y + s * 0.6, [[0, c.cloud], [1, mix(c.cloud, shade, 0.4)]]);
    ctx.fill(p);
    ctx.restore();
  };
  puff(w * 0.85, h * 0.1 + 30 * u, 70 * u);
  puff(w * 0.12, h * 0.2 + 20 * u, 52 * u, 0.95);
  puff(w * 0.62, h * 0.28, 22 * u, 0.6);
  puff(w * 0.3, h * 0.12, 26 * u, 0.7);
  const R = rng(171);
  for (let x = -60 * u; x < w + 120 * u; x += (180 + R() * 120) * u) puff(x, h - (40 + R() * 50) * u, (60 + R() * 50) * u, 1, true);
  grain(ctx, w, h, u, 0.04);
}

