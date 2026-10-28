// Background scenes, part of scenes.js (our own CC0 work). See scenes.js for the format.
import { TAU, clamp, HEX_RE, isHex, rgbOf, toHex, mix, lighten, darken, withAlpha, luma, rng, hash, cellRng, noise1, lattices, lattice, smooth, vnoise, fbm, makeCanvas, reset, fill, linear, softStops, glow, vignette, shadow, noShadow, roundRect, neon, tiles, tile, grainTile, blotchTile, speckTile, overlayTile, grain, blotch, C, def } from "./scene-kit.js";
import { polkaDots, gridLines, graphPaper, diagonalStripes, checker, halftone, waves, contours, topography, filmGrain, grainyGradient, sunburst, meshBlobs, gradientMesh, aurora, paperFibres, paperTexture, pinstripes, chevron, memphis, plusPattern, blueprint, retroRainbow, duotoneSplit, lowPoly, gingham, terrazzo } from "./scenes-patterns.js";

/* ================================================================= SCENES */

export function brickWall(ctx, w, h, c, u) {
  const floorH = 80 * u, floorY = h - floorH;
  fill(ctx, w, h, mix(darken(c.brick, 0.6), c.night, 0.3));
  const bw = 104 * u, bh = 38 * u, m = 5 * u;
  const dark = darken(c.brick, 0.42), light = lighten(c.brick, 0.14);
  const hiP = new Path2D(), loP = new Path2D();
  for (let r = 0; floorY - r * bh > -bh; r++) {
    const y = floorY - (r + 1) * bh, off = r & 1 ? bw / 2 : 0;
    const k0 = Math.floor((-w / 2 - off) / bw) - 1, k1 = Math.ceil((w / 2 - off) / bw) + 1;
    for (let k = k0; k <= k1; k++) {
      const x = w / 2 + k * bw + off - bw / 2;
      const R = cellRng(k, r, 3), t = R();
      let col = t < 0.16 ? mix(c.brick, light, 0.5 + R() * 0.5) : mix(c.brick, dark, t * 0.8);
      if (R() < 0.08) col = mix(col, "#2e2426", 0.4);
      ctx.fillStyle = col;
      ctx.fillRect(x + m / 2, y + m / 2, bw - m, bh - m);
      hiP.rect(x + m / 2, y + m / 2, bw - m, 2.2 * u);
      loP.rect(x + m / 2, y + bh - m / 2 - 3 * u, bw - m, 3 * u);
    }
  }
  ctx.fillStyle = withAlpha(lighten(c.brick, 0.5), 0.2); ctx.fill(hiP);
  ctx.fillStyle = withAlpha(darken(c.brick, 0.75), 0.4); ctx.fill(loP);
  blotch(ctx, w, h, u, 0.6, 1.2);
  grain(ctx, w, h, u, 0.32);
  // pavement
  ctx.fillStyle = linear(ctx, 0, floorY, 0, h, [[0, mix(c.night, "#8d8890", 0.45)], [1, mix(c.night, "#5d5862", 0.4)]]);
  ctx.fillRect(0, floorY, w, floorH);
  ctx.fillStyle = mix(c.night, "#b3adb2", 0.5);
  ctx.fillRect(0, floorY, w, 7 * u);
  ctx.fillStyle = withAlpha("#000000", 0.35);
  ctx.fillRect(0, floorY + 7 * u, w, 3 * u);
  ctx.beginPath();
  for (let x = (w / 2) % (230 * u); x < w; x += 230 * u) { ctx.moveTo(x, floorY + 10 * u); ctx.lineTo(x - 30 * u, h); }
  ctx.strokeStyle = withAlpha("#000000", 0.3);
  ctx.lineWidth = 2 * u;
  ctx.stroke();
  // light map, multiplied: warm near the lamp, night everywhere else
  const lx = w / 2, ly = Math.max(120 * u, h * 0.12);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.translate(lx, ly + 60 * u);
  ctx.scale(1, 1.45);
  const R0 = Math.max(560 * u, Math.max(w, h) * 0.42);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R0);
  g.addColorStop(0, lighten(c.light, 0.8));
  g.addColorStop(0.16, lighten(c.light, 0.3));
  g.addColorStop(0.42, mix(c.light, c.night, 0.7));
  g.addColorStop(0.75, lighten(c.night, 0.08));
  g.addColorStop(1, c.night);
  ctx.fillStyle = g;
  ctx.fillRect(-w * 2, -h * 2, w * 4, h * 4);
  ctx.restore();
  // cone + floor pool
  const spread = Math.min(w * 0.42, 380 * u);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = `blur(${Math.max(1, 22 * u)}px)`;
  ctx.fillStyle = linear(ctx, 0, ly, 0, floorY, [[0, withAlpha(c.light, 0.32)], [1, withAlpha(c.light, 0.05)]]);
  ctx.beginPath();
  ctx.moveTo(lx - 26 * u, ly + 16 * u); ctx.lineTo(lx + 26 * u, ly + 16 * u);
  ctx.lineTo(lx + spread, floorY); ctx.lineTo(lx - spread, floorY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  glow(ctx, lx, floorY + floorH * 0.45, spread * 1.2, c.light, 0.55, "screen", floorH * 0.7);
  glow(ctx, lx, ly + 24 * u, 300 * u, c.light, 0.5, "screen");
  // lamp
  const metal = mix(c.night, "#000000", 0.4);
  ctx.save();
  ctx.fillStyle = metal;
  ctx.fillRect(lx - 16 * u, ly - 78 * u, 32 * u, 18 * u);
  ctx.strokeStyle = metal;
  ctx.lineWidth = 6 * u;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(lx, ly - 68 * u); ctx.quadraticCurveTo(lx + 2 * u, ly - 40 * u, lx, ly - 16 * u); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(lx - 16 * u, ly - 18 * u); ctx.lineTo(lx + 16 * u, ly - 18 * u);
  ctx.lineTo(lx + 40 * u, ly + 12 * u); ctx.lineTo(lx - 40 * u, ly + 12 * u);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, lx - 40 * u, 0, lx + 40 * u, 0, [[0, metal], [0.6, mix(metal, c.light, 0.25)], [1, metal]]);
  ctx.fill();
  ctx.shadowColor = c.light;
  ctx.shadowBlur = 26 * u;
  ctx.fillStyle = lighten(c.light, 0.75);
  ctx.beginPath(); ctx.ellipse(lx, ly + 13 * u, 34 * u, 7 * u, 0, 0, TAU); ctx.fill();
  ctx.restore();
  vignette(ctx, w, h, "#000000", 0.5, 0.4);
}

export function neonSkyline(ctx, w, h, c, u) {
  const v = Math.max(u, h / 880); // taller skyline on portrait pages
  fill(ctx, w, h, linear(ctx, 0, 0, 0, h, [[0, darken(c.sky, 0.55)], [0.5, c.sky], [0.82, mix(c.sky, c.neon, 0.38)], [1, mix(c.sky, c.neon, 0.5)]]));
  // stars
  const Rs = rng(5);
  const ns = Math.round(((w * h) / (u * u)) * 0.00022);
  ctx.fillStyle = withAlpha("#ffffff", 0.6);
  ctx.beginPath();
  for (let i = 0; i < ns; i++) {
    const x = Rs() * w, y = Rs() * Rs() * h * 0.6, r = (0.4 + Rs() * 1.1) * u;
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fill();
  glow(ctx, w / 2, h, w * 0.8, c.neon, 0.4, "screen", 420 * u);
  const edge = (x) => Math.abs(x / w - 0.5) * 2;
  // far layer
  const Rf = rng(9);
  const far = new Path2D(), farWin = new Path2D();
  for (let x = -20 * u; x < w;) {
    const bw = (40 + Rf() * 80) * u;
    const bh = (140 + Rf() * 170) * v * (0.7 + 0.5 * edge(x + bw / 2));
    far.rect(x, h - bh, bw + 1, bh);
    if (Rf() < 0.3) far.rect(x + bw / 2 - 1.5 * u, h - bh - 30 * u, 3 * u, 30 * u);
    for (let yy = h - bh + 14 * u; yy < h - 10 * u; yy += 16 * u) {
      for (let xx = x + 8 * u; xx < x + bw - 8 * u; xx += 12 * u) if (Rf() < 0.18) farWin.rect(xx, yy, 4 * u, 5 * u);
    }
    x += bw;
  }
  ctx.fillStyle = mix(darken(c.sky, 0.3), c.neon, 0.16);
  ctx.fill(far);
  ctx.fillStyle = withAlpha(mix(c.neon, "#ffd9a0", 0.5), 0.35);
  ctx.fill(farWin);
  glow(ctx, w / 2, h, w * 0.7, c.neon, 0.25, "screen", 220 * u);
  // near layer
  const Rn = rng(13);
  const near = [];
  for (let x = -10 * u; x < w;) {
    const bw = (64 + Rn() * 90) * u;
    let bh = (90 + Rn() * 150) * v;
    if (edge(x + bw / 2) > 0.5 && Rn() < 0.5) bh += (110 + Rn() * 140) * v;
    near.push({ x, bw, bh, tone: Rn() });
    x += bw + (Rn() < 0.25 ? 10 * u : 0);
  }
  const warm = new Path2D(), cool = new Path2D(), dim = new Path2D();
  for (const b of near) {
    const top = h - b.bh;
    ctx.fillStyle = mix(darken(c.sky, 0.66), c.neon, b.tone * 0.07);
    ctx.fillRect(b.x, top, b.bw, b.bh);
    ctx.fillStyle = withAlpha(lighten(c.sky, 0.2), 0.35);
    ctx.fillRect(b.x, top, b.bw, 3 * u);
    const R = rng(hash(Math.round(b.x / u), 1, 17));
    if (R() < 0.3) { ctx.fillStyle = darken(c.sky, 0.7); ctx.fillRect(b.x + b.bw * 0.2, top - 18 * u, b.bw * 0.3, 18 * u); }
    for (let yy = top + 16 * u; yy < h - 14 * u; yy += 19 * u) {
      const rowLit = R() < 0.55;
      for (let xx = b.x + 10 * u; xx < b.x + b.bw - 14 * u; xx += 14 * u) {
        const q = R();
        if (q < (rowLit ? 0.5 : 0.1)) (R() < 0.72 ? warm : cool).rect(xx, yy, 7 * u, 9 * u);
        else dim.rect(xx, yy, 7 * u, 9 * u);
      }
    }
  }
  ctx.fillStyle = withAlpha(lighten(c.sky, 0.1), 0.18); ctx.fill(dim);
  ctx.save();
  ctx.shadowColor = "#ffcf7a"; ctx.shadowBlur = 6 * u;
  ctx.fillStyle = mix("#ffe0a0", c.neon, 0.12); ctx.fill(warm);
  ctx.shadowColor = c.accent;
  ctx.fillStyle = lighten(c.accent, 0.3); ctx.fill(cool);
  ctx.restore();
  // neon signs + roof lights
  near.forEach((b, i) => {
    const R = rng(hash(i, 2, 19));
    const col = i % 2 ? c.accent : c.neon;
    const top = h - b.bh;
    if (b.bw > 80 * u && R() < 0.45) {
      const p = new Path2D();
      if (R() < 0.5 && b.bh > 170 * u) {
        const sx = b.x + b.bw * 0.68, sh = Math.min(150 * u, b.bh * 0.45);
        roundRect(p, sx, top + 24 * u, 24 * u, sh, 6 * u);
        for (let k = 1; k < 4; k++) { p.moveTo(sx + 6 * u, top + 24 * u + (sh * k) / 4); p.lineTo(sx + 18 * u, top + 24 * u + (sh * k) / 4); }
      } else {
        const sw = b.bw * 0.7, sx = b.x + (b.bw - sw) / 2;
        roundRect(p, sx, top - 34 * u, sw, 26 * u, 8 * u);
        for (let k = 0; k < 5; k++) { const xx = sx + 10 * u + ((sw - 20 * u) * k) / 4; p.moveTo(xx, top - 26 * u); p.lineTo(xx + 6 * u, top - 16 * u); }
      }
      neon(ctx, p, col, u, 2.6);
    } else if (b.bh > 240 * u && R() < 0.8) {
      ctx.save();
      ctx.strokeStyle = darken(c.sky, 0.6); ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.moveTo(b.x + b.bw / 2, top); ctx.lineTo(b.x + b.bw / 2, top - 46 * u); ctx.stroke();
      ctx.shadowColor = "#ff3b3b"; ctx.shadowBlur = 12 * u; ctx.fillStyle = "#ff5a5a";
      ctx.beginPath(); ctx.arc(b.x + b.bw / 2, top - 46 * u, 3 * u, 0, TAU); ctx.fill();
      ctx.restore();
    }
  });
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = linear(ctx, 0, h - 180 * u, 0, h, [[0, withAlpha(c.neon, 0)], [1, withAlpha(c.neon, 0.3)]]);
  ctx.fillRect(0, h - 180 * u, w, 180 * u);
  ctx.restore();
  grain(ctx, w, h, u, 0.08);
  vignette(ctx, w, h, "#000000", 0.35);
}

export function starrySky(ctx, w, h, c, u) {
  fill(ctx, w, h, linear(ctx, 0, 0, 0, h, [[0, c.top], [0.6, mix(c.top, c.horizon, 0.45)], [1, c.horizon]]));
  // milky way band
  ctx.save();
  ctx.translate(w / 2, h * 0.45);
  ctx.rotate(-0.55);
  ctx.scale(1, 0.16);
  const D = Math.hypot(w, h) * 0.6;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, D);
  softStops(g, lighten(c.horizon, 0.45), 0.3);
  ctx.fillStyle = g;
  ctx.fillRect(-D, -D, 2 * D, 2 * D);
  ctx.restore();
  // stars (field + band dust)
  const R = rng(21);
  const n = Math.round(((w * h) / (u * u)) * 0.0011);
  const buckets = [new Path2D(), new Path2D(), new Path2D()];
  const addStar = (x, y, r, b) => { buckets[b].moveTo(x + r, y); buckets[b].arc(x, y, r, 0, TAU); };
  for (let i = 0; i < n; i++) {
    const r = (0.35 + Math.pow(R(), 3) * 1.4) * u;
    addStar(R() * w, R() * h, r, Math.floor(R() * 3));
  }
  const ca = Math.cos(-0.55), sa = Math.sin(-0.55);
  for (let i = 0; i < n * 0.6; i++) {
    const t = (R() - 0.5) * D * 2, o = (R() + R() + R() - 1.5) * 70 * u;
    addStar(w / 2 + t * ca - o * sa, h * 0.45 + t * sa + o * ca, (0.3 + R() * 0.6) * u, Math.floor(R() * 3));
  }
  [0.35, 0.6, 0.95].forEach((a, i) => { ctx.fillStyle = withAlpha("#ffffff", a); ctx.fill(buckets[i]); });
  // bright stars with sparkle
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    const x = R() * w, y = R() * h * 0.75, s = (6 + R() * 8) * u;
    if (Math.abs(x - w / 2) < w * 0.22 && Math.abs(y - h / 2) < h * 0.2) continue;
    ctx.shadowColor = lighten(c.horizon, 0.6); ctx.shadowBlur = 10 * u;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(x, y, 1.6 * u, 0, TAU); ctx.fill();
    ctx.strokeStyle = withAlpha("#ffffff", 0.7); ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();
  }
  ctx.restore();
  // shooting star
  ctx.save();
  const sx = w * 0.18, sy = h * 0.16, L = 160 * u;
  ctx.strokeStyle = linear(ctx, sx, sy, sx + L, sy + L * 0.35, [[0, withAlpha("#ffffff", 0)], [1, withAlpha("#ffffff", 0.85)]]);
  ctx.lineWidth = 2 * u; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + L, sy + L * 0.35); ctx.stroke();
  ctx.restore();
  // moon
  const mx = w - 160 * u, my = 150 * u, mr = 56 * u;
  glow(ctx, mx, my, 340 * u, c.moon, 0.32, "screen");
  ctx.save();
  ctx.shadowColor = c.moon; ctx.shadowBlur = 40 * u;
  ctx.fillStyle = linear(ctx, mx - mr, my - mr, mx + mr, my + mr, [[0, lighten(c.moon, 0.4)], [1, darken(c.moon, 0.08)]]);
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = withAlpha(darken(c.moon, 0.25), 0.35);
  ctx.beginPath();
  for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [0.05, 0.45, 0.12], [0.4, -0.35, 0.1], [-0.35, 0.35, 0.09]]) {
    ctx.moveTo(mx + dx * mr + rr * mr, my + dy * mr); ctx.arc(mx + dx * mr, my + dy * mr, rr * mr, 0, TAU);
  }
  ctx.fill();
  // hills + pines
  glow(ctx, w * 0.35, h, w * 0.6, lighten(c.horizon, 0.3), 0.45, "screen", 200 * u);
  const back = noise1(23), front = noise1(29);
  ctx.fillStyle = mix(darken(c.top, 0.35), c.horizon, 0.25);
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w + 10 * u; x += 10 * u) ctx.lineTo(x, h - 150 * u + back(x / (260 * u)) * 50 * u);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  const fy = (x) => h - 80 * u + front(x / (200 * u)) * 26 * u;
  const fc = darken(c.top, 0.6);
  ctx.fillStyle = fc;
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w + 10 * u; x += 10 * u) ctx.lineTo(x, fy(x));
  ctx.lineTo(w, h); ctx.closePath();
  const Rt = rng(31);
  for (let x = 0; x < w; x += (18 + Rt() * 40) * u) {
    if (Rt() < 0.3) continue;
    const th = (34 + Rt() * 60) * u, tw = th * 0.32, by = fy(x) + 6 * u;
    for (let k = 0; k < 3; k++) {
      const yk = by - (th * k) / 3.2, wk = tw * (1 - k * 0.25);
      ctx.moveTo(x - wk, yk); ctx.lineTo(x, yk - th * 0.55); ctx.lineTo(x + wk, yk); ctx.closePath();
    }
  }
  ctx.fill();
  grain(ctx, w, h, u, 0.07);
}

export function deskTop(ctx, w, h, c, u) {
  // planks
  const ph = 150 * u;
  const j0 = -Math.ceil(h / 2 / ph) - 1, j1 = Math.ceil(h / 2 / ph) + 1;
  for (let j = j0; j <= j1; j++) {
    const y0 = h / 2 + j * ph - ph / 2;
    const R = cellRng(j, 0, 40);
    const tone = R() < 0.5 ? lighten(c.wood, R() * 0.08) : darken(c.wood, R() * 0.14);
    ctx.fillStyle = tone;
    ctx.fillRect(0, y0, w, ph);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, w, ph); ctx.clip();
    const grainP = new Path2D(), darkP = new Path2D();
    for (let g = 0; g < 18; g++) {
      const nz = noise1(hash(j, g, 41));
      const yb = y0 + ((g + R() * 0.8) / 18) * ph;
      const p = R() < 0.3 ? darkP : grainP;
      for (let x = -20 * u; x <= w + 20 * u; x += 18 * u) {
        const yy = yb + nz(x / (340 * u)) * 12 * u;
        if (x === -20 * u) p.moveTo(x, yy); else p.lineTo(x, yy);
      }
    }
    ctx.lineWidth = 1.4 * u;
    ctx.strokeStyle = withAlpha(darken(tone, 0.35), 0.28); ctx.stroke(grainP);
    ctx.lineWidth = 2.4 * u;
    ctx.strokeStyle = withAlpha(darken(tone, 0.45), 0.32); ctx.stroke(darkP);
    if (R() < 0.55) {
      const kx = R() * w, ky = y0 + ph * (0.3 + R() * 0.4);
      ctx.strokeStyle = withAlpha(darken(tone, 0.5), 0.35);
      ctx.lineWidth = 1.5 * u;
      for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.ellipse(kx, ky, (10 + k * 9) * u, (4 + k * 3.2) * u, 0, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = withAlpha(darken(tone, 0.55), 0.6);
      ctx.beginPath(); ctx.ellipse(kx, ky, 9 * u, 3.6 * u, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = withAlpha(darken(c.wood, 0.7), 0.75);
    ctx.fillRect(0, y0 - 1.5 * u, w, 3 * u);
    ctx.fillStyle = withAlpha(lighten(c.wood, 0.4), 0.25);
    ctx.fillRect(0, y0 + 1.5 * u, w, 1.5 * u);
    const sx = w * (0.15 + R() * 0.7);
    ctx.fillStyle = withAlpha(darken(c.wood, 0.7), 0.6);
    ctx.fillRect(sx, y0, 2.5 * u, ph);
  }
  blotch(ctx, w, h, u, 0.35, 2);
  grain(ctx, w, h, u, 0.12);
  ctx.save();
  ctx.fillStyle = linear(ctx, 0, 0, w, h, [[0, withAlpha("#fff3dc", 0.18)], [0.5, withAlpha("#fff3dc", 0)], [1, withAlpha("#000000", 0.22)]]);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const paper = "#f7f1e3", ink = "#2a2433";
  // open notebook, top left
  ctx.save();
  ctx.translate(120 * u, 130 * u);
  ctx.rotate(-0.16);
  const NW = 440 * u, NH = 300 * u;
  shadow(ctx, u, 0.4, 24, 8, 14);
  ctx.fillStyle = mix(darken(c.wood, 0.75), "#1c1820", 0.5);
  ctx.fillRect(-NW / 2 - 9 * u, -NH / 2 - 9 * u, NW + 18 * u, NH + 18 * u);
  noShadow(ctx);
  ctx.fillStyle = paper;
  ctx.fillRect(-NW / 2, -NH / 2, NW, NH);
  ctx.beginPath();
  for (let y = -NH / 2 + 34 * u; y < NH / 2 - 8 * u; y += 17 * u) { ctx.moveTo(-NW / 2 + 10 * u, y); ctx.lineTo(NW / 2 - 10 * u, y); }
  ctx.strokeStyle = withAlpha("#6d8fb3", 0.4); ctx.lineWidth = 1 * u; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-NW / 2 + 40 * u, -NH / 2); ctx.lineTo(-NW / 2 + 40 * u, NH / 2);
  ctx.moveTo(40 * u, -NH / 2); ctx.lineTo(40 * u, NH / 2);
  ctx.strokeStyle = withAlpha(c.main, 0.55); ctx.stroke();
  ctx.fillStyle = linear(ctx, -24 * u, 0, 24 * u, 0, [[0, withAlpha("#000000", 0)], [0.5, withAlpha("#000000", 0.18)], [1, withAlpha("#000000", 0)]]);
  ctx.fillRect(-24 * u, -NH / 2, 48 * u, NH);
  const Rw = rng(43);
  ctx.strokeStyle = withAlpha(ink, 0.6); ctx.lineWidth = 1.6 * u; ctx.lineCap = "round";
  ctx.beginPath();
  for (let l = 0; l < 6; l++) {
    const y = -NH / 2 + 30 * u + l * 17 * u, len = (120 + Rw() * 50) * u;
    for (let x = 0; x < len; x += 5 * u) {
      const xx = 60 * u + x, yy = y - Math.abs(Math.sin(x / (3 * u) + l)) * 5 * u;
      if (x === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
  }
  ctx.stroke();
  ctx.fillStyle = c.main;
  ctx.fillRect(10 * u, NH / 2, 10 * u, 60 * u);
  ctx.restore();
  // sticky note, top right
  ctx.save();
  ctx.translate(w - 130 * u, 120 * u);
  ctx.rotate(0.08);
  const S = 170 * u;
  shadow(ctx, u, 0.3, 14, 4, 8);
  ctx.fillStyle = c.second;
  ctx.fillRect(-S / 2, -S / 2, S, S);
  noShadow(ctx);
  ctx.fillStyle = linear(ctx, 0, -S / 2, 0, S / 2, [[0, withAlpha("#000000", 0.08)], [0.2, withAlpha("#000000", 0)], [1, withAlpha("#ffffff", 0.12)]]);
  ctx.fillRect(-S / 2, -S / 2, S, S);
  ctx.strokeStyle = withAlpha(ink, 0.7); ctx.lineWidth = 2.4 * u; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-S * 0.32, -S * 0.18); ctx.lineTo(S * 0.3, -S * 0.2);
  ctx.moveTo(-S * 0.32, 0); ctx.lineTo(S * 0.18, -S * 0.01);
  ctx.moveTo(-S * 0.32, S * 0.18); ctx.lineTo(S * 0.05, S * 0.17);
  ctx.stroke();
  ctx.restore();
  // coffee ring stain
  ctx.save();
  ctx.strokeStyle = withAlpha("#4a2a12", 0.22);
  ctx.lineWidth = 5 * u;
  const rx = w - 250 * u, ry = 290 * u;
  ctx.beginPath(); ctx.arc(rx, ry, 60 * u, 0.3, TAU - 0.2); ctx.stroke();
  ctx.lineWidth = 2 * u;
  ctx.beginPath(); ctx.arc(rx + 3 * u, ry - 2 * u, 64 * u, 1.2, 4.4); ctx.stroke();
  ctx.restore();
  // mug, bottom right
  const mx = w - 140 * u, my = h - 140 * u, mr = 74 * u;
  ctx.save();
  shadow(ctx, u, 0.45, 26, 10, 16);
  ctx.save();
  ctx.translate(mx, my); ctx.rotate(2.55);
  const hp = new Path2D();
  roundRect(hp, mr * 0.7, -20 * u, mr * 0.75, 40 * u, 16 * u);
  ctx.strokeStyle = c.main; ctx.lineWidth = 12 * u;
  ctx.stroke(hp);
  ctx.restore();
  ctx.fillStyle = c.main;
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
  noShadow(ctx);
  ctx.fillStyle = lighten(c.main, 0.25);
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.arc(mx, my, mr * 0.84, 0, TAU, true); ctx.fill();
  ctx.fillStyle = linear(ctx, mx - mr, my - mr, mx + mr, my + mr, [[0, "#6e3f1f"], [1, "#2c160a"]]);
  ctx.beginPath(); ctx.arc(mx, my, mr * 0.8, 0, TAU); ctx.fill();
  ctx.strokeStyle = withAlpha("#c79062", 0.5); ctx.lineWidth = 4 * u;
  ctx.beginPath(); ctx.arc(mx, my, mr * 0.74, 0, TAU); ctx.stroke();
  ctx.fillStyle = withAlpha("#ffffff", 0.35);
  ctx.beginPath(); ctx.ellipse(mx - mr * 0.3, my - mr * 0.32, mr * 0.22, mr * 0.09, -0.7, 0, TAU); ctx.fill();
  ctx.restore();
  // pencil, bottom left
  ctx.save();
  ctx.translate(70 * u, h - 70 * u);
  ctx.rotate(-0.38);
  const L = 380 * u, W = 22 * u;
  shadow(ctx, u, 0.4, 10, 5, 9);
  ctx.fillStyle = c.second;
  ctx.fillRect(-60 * u, -W / 2, L - 10 * u, W);
  noShadow(ctx);
  ctx.fillStyle = lighten(c.second, 0.3); ctx.fillRect(0, -W / 2, L - 70 * u, W / 3);
  ctx.fillStyle = darken(c.second, 0.2); ctx.fillRect(0, W / 6, L - 70 * u, W / 3);
  ctx.fillStyle = "#e8c99c";
  ctx.beginPath(); ctx.moveTo(L - 70 * u, -W / 2); ctx.lineTo(L - 18 * u, -W * 0.17); ctx.lineTo(L - 18 * u, W * 0.17); ctx.lineTo(L - 70 * u, W / 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#3a3540";
  ctx.beginPath(); ctx.moveTo(L - 19 * u, -W * 0.18); ctx.lineTo(L, 0); ctx.lineTo(L - 19 * u, W * 0.18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = linear(ctx, 0, -W / 2, 0, W / 2, [[0, "#e9e7ea"], [0.5, "#a9a5ad"], [1, "#6f6b74"]]);
  ctx.fillRect(-30 * u, -W / 2, 30 * u, W);
  ctx.fillStyle = withAlpha("#000000", 0.25);
  for (let k = 1; k < 4; k++) ctx.fillRect(-30 * u + k * 7 * u, -W / 2, 1.5 * u, W);
  ctx.fillStyle = "#f08aa2";
  ctx.beginPath(); ctx.moveTo(-30 * u, -W / 2); ctx.lineTo(-56 * u, -W / 2); ctx.arcTo(-62 * u, -W / 2, -62 * u, 0, 6 * u); ctx.arcTo(-62 * u, W / 2, -56 * u, W / 2, 6 * u); ctx.lineTo(-30 * u, W / 2); ctx.closePath(); ctx.fill();
  ctx.restore();
  vignette(ctx, w, h, "#1a0d05", 0.45);
}

export function studioSpotlight(ctx, w, h, c, u) {
  const floorY = h * 0.72;
  fill(ctx, w, h, linear(ctx, 0, 0, 0, floorY, [[0, darken(c.dark, 0.3)], [1, mix(c.dark, c.light, 0.07)]]));
  ctx.fillStyle = linear(ctx, 0, floorY, 0, h, [[0, mix(c.dark, c.light, 0.12)], [1, darken(c.dark, 0.35)]]);
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = withAlpha("#000000", 0.4);
  ctx.fillRect(0, floorY - 1.5 * u, w, 3 * u);
  const cx = w / 2, topY = 46 * u, poolY = floorY + (h - floorY) * 0.42;
  const rx = Math.min(w * 0.44, 340 * u);
  glow(ctx, cx, floorY - 80 * u, 420 * u, c.light, 0.22, "screen", 300 * u);
  // cone
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = `blur(${Math.max(1, 20 * u)}px)`;
  const cone = new Path2D();
  cone.moveTo(cx - 34 * u, topY); cone.lineTo(cx + 34 * u, topY); cone.lineTo(cx + rx, poolY); cone.lineTo(cx - rx, poolY); cone.closePath();
  ctx.fillStyle = linear(ctx, 0, topY, 0, poolY, [[0, withAlpha(c.light, 0.42)], [1, withAlpha(c.light, 0.1)]]);
  ctx.fill(cone);
  const core = new Path2D();
  core.moveTo(cx - 20 * u, topY); core.lineTo(cx + 20 * u, topY); core.lineTo(cx + rx * 0.55, poolY); core.lineTo(cx - rx * 0.55, poolY); core.closePath();
  ctx.fillStyle = linear(ctx, 0, topY, 0, poolY, [[0, withAlpha(c.light, 0.3)], [1, withAlpha(c.light, 0.02)]]);
  ctx.fill(core);
  ctx.restore();
  glow(ctx, cx, poolY, rx * 1.15, c.light, 0.85, "screen", rx * 0.24);
  glow(ctx, cx, poolY, rx * 0.7, lighten(c.light, 0.5), 0.5, "screen", rx * 0.13);
  // dust motes in the beam
  ctx.save();
  ctx.clip(cone);
  const R = rng(51);
  ctx.fillStyle = withAlpha(lighten(c.light, 0.4), 0.5);
  ctx.beginPath();
  for (let i = 0; i < 160; i++) {
    const x = cx + (R() - 0.5) * rx * 2, y = topY + R() * (poolY - topY), r = (0.5 + R() * 1.4) * u;
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fill();
  ctx.restore();
  // fixture
  ctx.save();
  ctx.fillStyle = darken(c.dark, 0.5);
  ctx.fillRect(cx - 4 * u, 0, 8 * u, topY - 20 * u);
  ctx.beginPath(); ctx.moveTo(cx - 26 * u, topY - 26 * u); ctx.lineTo(cx + 26 * u, topY - 26 * u); ctx.lineTo(cx + 36 * u, topY); ctx.lineTo(cx - 36 * u, topY); ctx.closePath();
  ctx.fillStyle = mix(c.dark, c.light, 0.12); ctx.fill();
  ctx.shadowColor = c.light; ctx.shadowBlur = 24 * u;
  ctx.fillStyle = lighten(c.light, 0.6);
  ctx.beginPath(); ctx.ellipse(cx, topY, 30 * u, 5 * u, 0, 0, TAU); ctx.fill();
  ctx.restore();
  grain(ctx, w, h, u, 0.1);
  vignette(ctx, w, h, "#000000", 0.7, 0.35);
}

export function rainyStreet(ctx, w, h, c, u) {
  const yH = h * 0.64;
  fill(ctx, w, h, linear(ctx, 0, 0, 0, yH, [[0, lighten(c.night, 0.04)], [0.6, mix(c.night, c.neon1, 0.16)], [1, mix(c.night, c.neon1, 0.34)]]));
  glow(ctx, w / 2, yH, w * 0.6, c.neon1, 0.3, "screen", 200 * u);
  // buildings: tall at the sides, low in the middle
  const R = rng(61);
  const signs = [];
  const bodies = new Path2D(), win = new Path2D();
  for (let x = -10 * u; x < w;) {
    const bw = (70 + R() * 90) * u;
    const e = Math.abs((x + bw / 2) / w - 0.5) * 2;
    const bh = (70 + e * e * (yH - 110 * u) * (0.8 + R() * 0.3)) + R() * 30 * u;
    bodies.rect(x, yH - bh, bw + 1, bh);
    for (let yy = yH - bh + 18 * u; yy < yH - 40 * u; yy += 22 * u) {
      for (let xx = x + 12 * u; xx < x + bw - 16 * u; xx += 18 * u) if (R() < 0.12) win.rect(xx, yy, 8 * u, 11 * u);
    }
    if (e > 0.3 && bh > 140 * u) {
      const col = R() < 0.5 ? c.neon1 : c.neon2;
      const kind = R();
      if (kind < 0.5) {
        const sh = Math.min(170 * u, bh * 0.5), sx = x + bw * (0.25 + R() * 0.45), sy = yH - bh + 30 * u;
        signs.push({ x: sx + 13 * u, y: sy, w: 26 * u, h: sh, col, kind: 0 });
      } else {
        const sw = bw * 0.7, sx = x + bw * 0.15, sy = yH - bh * (0.35 + R() * 0.3);
        signs.push({ x: sx + sw / 2, y: sy, w: sw, h: 28 * u, col, kind: 1 });
      }
    }
    x += bw;
  }
  ctx.fillStyle = darken(c.night, 0.55);
  ctx.fill(bodies);
  ctx.save();
  ctx.clip(bodies);
  ctx.strokeStyle = withAlpha(mix(c.neon1, c.neon2, 0.5), 0.22);
  ctx.lineWidth = 3 * u;
  ctx.stroke(bodies);
  ctx.restore();
  ctx.fillStyle = withAlpha("#ffd49a", 0.35);
  ctx.fill(win);
  // street
  ctx.fillStyle = linear(ctx, 0, yH, 0, h, [[0, mix(c.night, c.neon1, 0.12)], [1, darken(c.night, 0.4)]]);
  ctx.fillRect(0, yH, w, h - yH);
  // reflections
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = `blur(${Math.max(1, 7 * u)}px)`;
  for (const s of signs) {
    const top = yH + (yH - (s.y + s.h)) * 0.15, len = Math.min(h - yH, (yH - s.y) * 1.1);
    ctx.fillStyle = linear(ctx, 0, top, 0, top + len, [[0, withAlpha(s.col, 0.55)], [1, withAlpha(s.col, 0)]]);
    ctx.fillRect(s.x - s.w * 0.6, top, s.w * 1.2, len);
  }
  ctx.restore();
  // ripples break the reflections up
  const Rr = rng(67);
  ctx.beginPath();
  for (let y = yH + 4 * u; y < h; y += (4 + Rr() * 4) * u) {
    for (let x = -Rr() * 200 * u; x < w;) {
      const len = (40 + Rr() * 220) * u;
      ctx.moveTo(x, y); ctx.lineTo(x + len, y);
      x += len + (20 + Rr() * 120) * u;
    }
  }
  ctx.strokeStyle = withAlpha(darken(c.night, 0.3), 0.55);
  ctx.lineWidth = 1.6 * u;
  ctx.stroke();
  ctx.fillStyle = withAlpha(lighten(c.night, 0.3), 0.5);
  ctx.fillRect(0, yH, w, 2 * u);
  // signs
  for (const s of signs) {
    const p = new Path2D();
    if (s.kind === 0) {
      roundRect(p, s.x - s.w / 2, s.y, s.w, s.h, 6 * u);
      for (let k = 1; k < 5; k++) { const yy = s.y + (s.h * k) / 5; p.moveTo(s.x - 6 * u, yy); p.lineTo(s.x + 6 * u, yy); }
    } else {
      roundRect(p, s.x - s.w / 2, s.y, s.w, s.h, 10 * u);
      p.moveTo(s.x - s.w * 0.36, s.y + s.h / 2);
      for (let k = 0; k <= 8; k++) p.lineTo(s.x - s.w * 0.36 + (s.w * 0.72 * k) / 8, s.y + s.h / 2 + (k & 1 ? -6 : 6) * u);
    }
    neon(ctx, p, s.col, u, 2.6);
    glow(ctx, s.x, s.y + s.h / 2, Math.max(s.w, s.h) * 1.4, s.col, 0.22, "screen");
  }
  glow(ctx, w / 2, yH, w * 0.55, mix(c.neon1, c.neon2, 0.5), 0.18, "screen", 70 * u);
  // rain
  const Rn = rng(71);
  const n = Math.round(((w * h) / (u * u)) * 0.0011);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = Rn() * (w + 60 * u) - 30 * u, y = Rn() * h, L = (14 + Rn() * 26) * u;
    ctx.moveTo(x, y); ctx.lineTo(x - L * 0.16, y + L);
  }
  ctx.strokeStyle = withAlpha(lighten(c.neon2, 0.6), 0.22);
  ctx.lineWidth = 1 * u;
  ctx.lineCap = "round";
  ctx.stroke();
  grain(ctx, w, h, u, 0.1);
  vignette(ctx, w, h, "#000000", 0.5);
}

