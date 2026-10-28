// Ported from the Oddly Clever kit: ep/T03_lotto/js/stage.js (G) and util.js (U.clamp).
// The helpers are copied verbatim so the characters stay pixel-faithful to the approved sheet.
// (c) Oddly Clever. All rights reserved. See ../ASSETS.md.
export const U = { clamp: (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)) };

// small SVG helpers shared by the sets
export const G = (() => {
  const f = v => (Math.round(v * 10) / 10).toString();
  const svg = (inner, w = 1920, h = 1080, extra = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="position:absolute;left:0;top:0;overflow:visible" ${extra}>${inner}</svg>`;
  const st = o => (o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 3}" stroke-linejoin="round"` : '') + (o.op != null ? ` opacity="${o.op}"` : '');
  const rect = (x, y, w, h, fill, o = {}) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${o.rx || 0}" fill="${fill}"${st(o)}/>`;
  const path = (d, fill, o = {}) => `<path d="${d}" fill="${fill}"${st(o)}/>`;
  const circ = (x, y, r, fill, o = {}) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"${st(o)}/>`;
  const ell = (x, y, rx, ry, fill, o = {}) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${st(o)}/>`;
  const ln = (x1, y1, x2, y2, col, w = 2, o = {}) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${o.op != null ? ` opacity="${o.op}"` : ''}/>`;
  const lg = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
  const rg = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
  const text = (x, y, t, size, fill, o = {}) => `<text x="${f(x)}" y="${f(y)}" font-family="${o.font || 'InterBlack'}" font-size="${size}" fill="${fill}" text-anchor="${o.anchor || 'middle'}"${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.op != null ? ` opacity="${o.op}"` : ''}>${t}</text>`;
  return { f, svg, rect, path, circ, ell, ln, lg, rg, text };
})();
