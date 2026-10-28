// Ported from the Oddly Clever kit: kit/cast/bighead/char_stick.js (wrapped as an ES module).
// One edit: the keeper honours `head: true` (hood + face, no cloak) like the HEROES2 rigs.
// (c) Oddly Clever. All rights reserved. See ../ASSETS.md.
import { G, U } from "./g.js";

// STICK (T01 look test): the reference Short's character style. A big white circle head with a heavy dark outline,
// two ring eyes with dot pupils, a tiny mouth, a tube body in a jacket, thin stick arms and legs with tiny feet.
// Two people: 'hero' (ginger spiky hair, mustard jacket with a white zip stripe and a frog pin) and 'keeper'
// (the hooded memory dealer: navy hood, small pale face in the dark, glowing eyes, a huge toothy grin).
// STICK.draw(p) -> SVG markup. p = {who, x, y (feet), s, t, dir (1 faces +x), expr, look [x, y] -1..1, blink 0..1,
//   eye 0..1 (keeper: shut -> glowing), grin 0..1 (keeper), lean (deg), head: true draws only head + shoulders (CU)}
// Figure space: feet on y = 0, head centre at -420, head radius 100, so a person is ~520 tall at s = 1.
// STICK.anchors(p) -> {head: [x, y], r, hand: [x, y]} in layer coords.
export const STICK = (() => {
  const { clamp } = U;
  const O = '#17131c', OW = 9;
  const f1 = v => (Math.round(v * 10) / 10).toString();
  const HEAD = { y: -420, r: 100 };

  function eyes(p, cx, cy, r) {
    const look = p.look || [0, 0], bl = clamp(p.blink || 0);
    let m = '';
    for (const s of [-1, 1]) {
      const ex = cx + s * r * 0.36 + look[0] * r * 0.08, ey = cy - r * 0.08;
      const er = r * 0.2;
      const sleepy = p.expr === 'sleepy' && s === -1;
      const ry = er * (1 - bl) * (p.expr === 'wide' ? 1.15 : 1);
      if (bl > 0.8) { m += G.path(`M ${f1(ex - er)} ${f1(ey)} Q ${f1(ex)} ${f1(ey + er * 0.4)} ${f1(ex + er)} ${f1(ey)}`, 'none', { stroke: O, sw: 6 }); continue; }
      m += G.ell(ex, ey, er, ry, '#ffffff', { stroke: O, sw: 6 });
      m += G.circ(ex + look[0] * er * 0.45, ey + look[1] * er * 0.45, er * (p.expr === 'wide' ? 0.3 : 0.38), O);
      if (sleepy) m += G.path(`M ${f1(ex - er - 3)} ${f1(ey - ry - 2)} L ${f1(ex + er + 3)} ${f1(ey - ry - 2)} L ${f1(ex + er + 3)} ${f1(ey + 2)} Q ${f1(ex)} ${f1(ey - 4)} ${f1(ex - er - 3)} ${f1(ey + 2)} Z`, '#e9e4da', { stroke: O, sw: 6 });
    }
    return m;
  }
  function mouth(p, cx, cy, r) {
    const my = cy + r * 0.42, w = r * 0.16;
    if (p.expr === 'wide') return G.ell(cx + 4, my, w * 0.55, w * 0.7, O);
    if (p.expr === 'worried') return G.path(`M ${f1(cx - w)} ${f1(my + 4)} Q ${f1(cx - w * 0.3)} ${f1(my - 6)} ${f1(cx)} ${f1(my + 2)} Q ${f1(cx + w * 0.4)} ${f1(my + 8)} ${f1(cx + w)} ${f1(my)}`, 'none', { stroke: O, sw: 6 });
    return G.path(`M ${f1(cx - w)} ${f1(my)} Q ${f1(cx)} ${f1(my + 6)} ${f1(cx + w)} ${f1(my - 2)}`, 'none', { stroke: O, sw: 6 });
  }
  function hair(cx, cy, r, t) {
    // a spiky ginger clump sitting over the top-left of the circle, a few loose strands
    const sw = 4 * Math.sin(t * 2.1);
    let d = `M ${f1(cx - r * 1.02)} ${f1(cy - r * 0.05)}`;
    const spikes = [[-1.1, -0.35], [-1.25, -0.7], [-0.85, -0.72], [-1.05, -1.12], [-0.5, -0.95], [-0.35, -1.45], [-0.05, -1.02], [0.35, -1.38], [0.32, -0.98], [0.9, -1.12], [0.62, -0.78], [1.22, -0.72], [0.9, -0.5]];
    spikes.forEach(([a, b], i) => { d += ` L ${f1(cx + a * r + (i % 2 ? sw : 0))} ${f1(cy + b * r)}`; });
    d += ` Q ${f1(cx + r * 0.4)} ${f1(cy - r * 0.58)} ${f1(cx - r * 0.1)} ${f1(cy - r * 0.5)} Q ${f1(cx - r * 0.6)} ${f1(cy - r * 0.42)} ${f1(cx - r * 1.02)} ${f1(cy - r * 0.05)} Z`;
    let m = G.path(d, '#e2611f', { stroke: O, sw: OW - 2 });
    for (let i = 0; i < 6; i++) {
      const a = -0.8 + i * 0.3;
      m += G.path(`M ${f1(cx + a * r)} ${f1(cy - r * 0.62)} Q ${f1(cx + (a + 0.1) * r)} ${f1(cy - r * 0.9)} ${f1(cx + (a + 0.05) * r)} ${f1(cy - r * 1.1)}`, 'none', { stroke: '#a33a12', sw: 4 });
    }
    m += G.path(`M ${f1(cx - r * 0.6)} ${f1(cy - r * 0.95)} Q ${f1(cx - r * 0.2)} ${f1(cy - r * 1.15)} ${f1(cx + r * 0.2)} ${f1(cy - r * 0.98)}`, 'none', { stroke: '#ff9a52', sw: 6, op: 0.8 });
    return m;
  }

  function hero(p) {
    const t = p.t || 0, br = 3 * Math.sin(t * 1.6);
    const hx = 0, hy = HEAD.y + br, r = HEAD.r;
    let m = '';
    if (!p.head) {
      // legs: thin navy sticks with tiny feet
      m += G.path(`M -18 -150 L -26 -8 L -6 -4`, 'none', { stroke: '#22264a', sw: 10 });
      m += G.path(`M 18 -150 L 24 -8 L 46 -4`, 'none', { stroke: '#22264a', sw: 10 });
    }
    // tube body: mustard jacket, white zip stripe, frog pin
    m += G.path(`M -62 ${f1(hy + r * 0.78)} C -74 -260 -70 -180 -58 -140 L 58 -140 C 70 -180 74 -260 62 ${f1(hy + r * 0.78)} Z`, '#f0ad1c', { stroke: O, sw: OW });
    m += G.path(`M 40 ${f1(hy + r * 0.86)} C 54 -260 54 -190 46 -142 L 58 -140 C 70 -180 74 -260 62 ${f1(hy + r * 0.78)} Z`, '#c9850e');
    m += G.rect(-8, hy + r * 0.82, 16, -140 - (hy + r * 0.82), '#fbf6e8', { stroke: O, sw: 4 });
    m += G.circ(-34, hy + r * 1.35, 12, '#57b84a', { stroke: O, sw: 4 }) + G.circ(-38, hy + r * 1.3, 3, O) + G.circ(-30, hy + r * 1.3, 3, O);
    // arms down at the sides (hands tucked)
    m += G.path(`M -60 ${f1(hy + r * 1.05)} Q -86 -220 -70 -170`, 'none', { stroke: O, sw: 8 });
    if (!p.reach) m += G.path(`M 60 ${f1(hy + r * 1.05)} Q 86 -220 70 -170`, 'none', { stroke: O, sw: 8 });
    // head
    m += G.circ(hx, hy, r, '#f3efe6', { stroke: O, sw: OW });
    m += G.path(`M ${f1(hx + r * 0.45)} ${f1(hy - r * 0.85)} A ${r} ${r} 0 0 1 ${f1(hx + r * 0.2)} ${f1(hy + r * 0.98)} A ${r * 1.1} ${r * 1.1} 0 0 0 ${f1(hx + r * 0.45)} ${f1(hy - r * 0.85)} Z`, '#d9d2c4');
    m += eyes(p, hx + r * 0.05, hy, r) + mouth(p, hx + r * 0.05, hy, r);
    if (p.sweat) m += G.path(`M ${f1(hx + r * 0.9)} ${f1(hy - r * 0.5)} q 10 18 0 26 q -10 -8 0 -26 Z`, '#9fd8ff', { stroke: O, sw: 3 });
    m += hair(hx, hy, r, t);
    if (p.reach) {
      // the near arm reaches to p.reach (figure space, +x = the way he faces): a bent stick arm, a small round hand
      const [ax, ay] = p.reach, sx0 = 54, sy0 = hy + r * 1.1;
      const ex = (sx0 + ax) / 2 + 26, ey = Math.max(sy0, ay) + 40;
      m += G.path(`M ${sx0} ${f1(sy0)} Q ${f1(ex)} ${f1(ey)} ${f1(ax)} ${f1(ay)}`, 'none', { stroke: O, sw: 9 });
      m += G.circ(ax, ay, 15, '#f3efe6', { stroke: O, sw: 6 });
    }
    return m;
  }

  function keeper(p) {
    const t = p.t || 0, br = 4 * Math.sin(t * 1.3);
    const hx = 0, hy = HEAD.y + br + 30, e = clamp(p.eye == null ? 1 : p.eye), g = clamp(p.grin == null ? 1 : p.grin);
    let m = `<defs>${G.lg('kHood', [[0, '#1c2044'], [0.6, '#10122a'], [1, '#07081a']])}${G.rg('kFace', [[0, '#e6e3ee'], [0.7, '#c9c5d8'], [1, '#9a95b2']], 0.45, 0.6, 0.6)}</defs>`;
    // cloak + shoulders
    if (!p.head) m += G.path(`M -200 40 C -190 -160 -120 -230 -70 -250 L 70 -250 C 120 -230 190 -160 200 40 Z`, '#151833', { stroke: O, sw: OW });
    // hood: a tall soft peak
    m += G.path(`M -140 -170 C -170 ${hy - 120} -110 ${hy - 190} 10 ${hy - 205} C 120 ${hy - 190} 175 ${hy - 100} 140 -170 Z`, 'url(#kHood)', { stroke: O, sw: OW });
    m += G.path(`M -60 ${hy - 170} C -20 ${hy - 195} 60 ${hy - 190} 100 ${hy - 140}`, 'none', { stroke: '#6f7bd0', sw: 7, op: 0.55 });
    m += G.path(`M 128 -180 C 160 ${hy - 90} 130 ${hy - 160} 60 ${hy - 196}`, 'none', { stroke: '#ffd99a', sw: 6, op: 0.45 });   // lamp rim
    m += G.ell(hx + 4, hy + 16, 92, 108, '#06070f');
    // face: a pale oval, lit from below by the counter
    m += G.ell(hx + 6, hy + 26, 74, 84, 'url(#kFace)', { stroke: O, sw: 6 });
    // eyes: glowing yellow almonds, heavy lids
    for (const s of [-1, 1]) {
      const ex = hx + 6 + s * 30, ey = hy + 4;
      if (e < 0.05) { m += G.path(`M ${ex - 16} ${ey} Q ${ex} ${ey + 6} ${ex + 16} ${ey}`, 'none', { stroke: O, sw: 5 }); continue; }
      m += G.ell(ex, ey, 17, 12 * e, '#fff3a6', { stroke: O, sw: 4 });
      m += G.circ(ex + 3, ey + 2, 5 * e, O);
      m += G.path(`M ${ex - 21} ${ey - 3} Q ${ex} ${ey - 13} ${ex + 21} ${ey - 3}`, 'none', { stroke: O, sw: 5 });
    }
    // grin: ear-to-ear crescent of teeth
    const w = 22 + 44 * g, my = hy + 52, dip = 8 + 30 * g;
    if (g < 0.08) m += G.path(`M ${hx + 6 - w} ${my} Q ${hx + 6} ${my + 8} ${hx + 6 + w} ${my - 4}`, 'none', { stroke: O, sw: 5 });
    else {
      m += G.path(`M ${f1(hx + 6 - w)} ${f1(my - 12 * g)} Q ${f1(hx + 6)} ${f1(my + 4)} ${f1(hx + 6 + w)} ${f1(my - 12 * g)} Q ${f1(hx + 6)} ${f1(my + dip * 1.7)} ${f1(hx + 6 - w)} ${f1(my - 12 * g)} Z`, '#fbf9f2', { stroke: O, sw: 5 });
      for (let i = 1; i < 7; i++) {
        const tx = hx + 6 - w + (2 * w * i) / 7;
        m += G.ln(tx, my - 8 * g + 4, tx, my + dip * (0.9 - 0.6 * Math.pow((i - 3.5) / 3.5, 2)), '#6d6880', 2.5);
      }
    }
    return m;
  }

  function draw(p) {
    const s = p.s || 1, dir = p.dir || 1, lean = p.lean || 0;
    const body = p.who === 'keeper' ? keeper(p) : hero(p);
    return `<g transform="translate(${f1(p.x)} ${f1(p.y)}) scale(${(s * dir).toFixed(4)} ${s.toFixed(4)}) rotate(${lean})">${body}</g>`;
  }
  function anchors(p) {
    const s = p.s || 1;
    const rc = p.reach || [70, -170];
    return { head: [p.x, p.y + HEAD.y * s], r: HEAD.r * s, hand: [p.x + rc[0] * s * (p.dir || 1), p.y + rc[1] * s] };
  }
  return { draw, anchors, HEAD };
})();
