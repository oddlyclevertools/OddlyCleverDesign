// Ported from the Oddly Clever kit: kit/cast/bighead/char_heroes2.js (verbatim, wrapped as an ES module).
// (c) Oddly Clever. All rights reserved. See ../ASSETS.md.
import { G } from "./g.js";

// HEROES2 (T01 hero choice, round 2): four original leads built for APPEAL, not avatars.
// Rules: a huge head (about half the height) on a small tapered body with noodle limbs; a 3/4 attitude pose; one base
// shape per person (triangle / square / circle / tall rectangle); one signature that reads from across a room; lit like
// our 2.5D scenes: warm key from the front-right, a cool rim on the back edge, shadow-side shapes on every part.
//   sparks  guy, 23. Skin: warm tan. TRIANGLE. Wind-blown spiky white hair with a black tip, a long red scarf trailing
//           behind in an S, oversized black hoodie, light rolled jeans, red high-tops. Leans back, hands in pockets.
//   brick   guy, 26. Skin: deep brown. SQUARE. Tall hi-top fade, big yellow headphones round the neck, green varsity
//           jacket with cream sleeves and a chenille star, arms crossed, planted wide on chunky boots.
//   milo    guy, 21. Skin: pale, freckles. CIRCLE. A curly dark mop with one curl over the eye, swallowed by a giant
//           orange puffer (sleeves past his hands), skinny teal joggers, big lilac sneakers. Hunched, nervous.
//   rae     woman option, 24. Skin: medium brown. TALL RECTANGLE. A huge swinging high ponytail with a magenta tie,
//           oversized denim jacket covered in patches, mustard cargos, black boots. Hand on hip, peace sign.
// HEROES2.draw(p) -> SVG. p = {who, x, y (feet), s, dir, expr 'smug'|'worried'|'shock'|'grin', look [x,y], t, head: bool,
//   reach [x, y] (milo: the front sleeve reaches there, figure space, +x = the way he faces; hand at that point)}
// Figure space: feet y = 0, faces +x (three-quarter), head centre about -470, head radius ~128.
export const HEROES2 = (() => {
  const O = '#16121b', OW = 9, RIM = '#8fe3ff', KEY = '#fff1d6';
  const f1 = v => (Math.round(v * 10) / 10).toString();
  const P = (d, fill, o = {}) => G.path(d, fill, Object.assign({ stroke: O, sw: OW }, o));
  const L = (d, col = O, w = 6, op) => G.path(d, 'none', { stroke: col, sw: w, op });
  const rim = (d, w = 6) => L(d, RIM, w, 0.85);
  const lerp2 = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const hi = (d, w = 5, op = 0.7) => L(d, KEY, w, op);

  // ------------------------------------------------------------------ 3/4 faces: features shifted toward +x,
  // the near eye (screen-left) full size, the far eye narrower
  function face(o) {
    const { r, expr, look = [0.35, 0], skin, brow = O, eye = 'round', blush, freckles } = o;
    const cx = r * 0.2, cy = r * 0.02;
    let m = '';
    const eyesAt = [[cx - r * 0.3, cy, 1], [cx + r * 0.36, cy - r * 0.02, 0.82]];
    for (const [ex, ey, k] of eyesAt) {
      const er = r * 0.2, w = er * k, big = expr === 'shock' ? 1.3 : 1;
      if (expr === 'grin') { m += L(`M ${f1(ex - w)} ${f1(ey + 6)} Q ${f1(ex)} ${f1(ey - er * 1.1)} ${f1(ex + w)} ${f1(ey + 6)}`, O, 8); continue; }
      if (eye === 'cat') {
        m += P(`M ${f1(ex - w * 1.15)} ${f1(ey + 4)} Q ${f1(ex)} ${f1(ey - er * 1.3 * big)} ${f1(ex + w * 1.2)} ${f1(ey - er * 0.3)} Q ${f1(ex)} ${f1(ey + er * 1.0 * big)} ${f1(ex - w * 1.15)} ${f1(ey + 4)} Z`, '#ffffff', { sw: 6 });
        m += L(`M ${f1(ex + w * 1.2)} ${f1(ey - er * 0.3)} l ${f1(er * 0.6)} ${f1(-er * 0.55)}`, O, 7);
      } else m += G.ell(ex, ey, w * big, er * 1.12 * big, '#ffffff', { stroke: O, sw: 6 });
      const pr = er * (expr === 'shock' ? 0.26 : 0.46) * Math.min(1, k + 0.1);
      const px = ex + look[0] * w * 0.42, py = ey + look[1] * er * 0.45 + (expr === 'worried' ? er * 0.2 : 0);
      m += G.circ(px, py, pr, O) + G.circ(px - pr * 0.35, py - pr * 0.4, pr * 0.32, '#ffffff');
      if (expr === 'smug') m += P(`M ${f1(ex - w * 1.2)} ${f1(ey - er * 1.3)} L ${f1(ex + w * 1.2)} ${f1(ey - er * 1.3)} L ${f1(ex + w * 1.2)} ${f1(ey - er * 0.15)} Q ${f1(ex)} ${f1(ey + er * 0.05)} ${f1(ex - w * 1.2)} ${f1(ey - er * 0.15)} Z`, skin, { sw: 6 });
    }
    // brows: thick and acting
    const bs = [[eyesAt[0][0], eyesAt[0][1] - r * 0.36, 1], [eyesAt[1][0], eyesAt[1][1] - r * 0.36, 0.8]];
    bs.forEach(([bx, by, k], i) => {
      const w = r * 0.2 * k, sd = i === 0 ? -1 : 1;
      let a = 0, lift = 0;
      if (expr === 'worried') a = 14 * -sd;
      if (expr === 'smug') { lift = i === 1 ? -16 : 4; a = i === 0 ? -6 : 0; }
      if (expr === 'shock') lift = -18;
      if (expr === 'grin') lift = -8;
      m += L(`M ${f1(bx - w)} ${f1(by + lift + a * 0.5 * -sd)} Q ${f1(bx)} ${f1(by + lift - 10)} ${f1(bx + w)} ${f1(by + lift - a * 0.5 * -sd)}`, brow, 13);
    });
    // nose: a small hook toward +x
    m += L(`M ${f1(cx + r * 0.08)} ${f1(cy + r * 0.12)} Q ${f1(cx + r * 0.24)} ${f1(cy + r * 0.26)} ${f1(cx + r * 0.06)} ${f1(cy + r * 0.3)}`, O, 6);
    if (blush) m += G.ell(cx - r * 0.42, cy + r * 0.38, r * 0.16, r * 0.08, '#ff7a8a', { op: 0.55 }) + G.ell(cx + r * 0.52, cy + r * 0.34, r * 0.1, r * 0.07, '#ff7a8a', { op: 0.45 });
    if (freckles) for (let i = 0; i < 7; i++) m += G.circ(cx - r * 0.5 + (i % 4) * r * 0.08 + (i > 3 ? r * 0.82 : 0), cy + r * 0.3 + (i % 2) * r * 0.06, 3.5, '#b5643c', { op: 0.7 });
    // mouth
    const mx = cx + r * 0.04, my = cy + r * 0.5, w = r * 0.3;
    if (expr === 'grin') {
      m += P(`M ${f1(mx - w * 1.3)} ${f1(my - 12)} Q ${f1(mx)} ${f1(my)} ${f1(mx + w * 1.3)} ${f1(my - 18)} Q ${f1(mx + w)} ${f1(my + w * 1.5)} ${f1(mx)} ${f1(my + w * 1.5)} Q ${f1(mx - w * 1.1)} ${f1(my + w * 1.3)} ${f1(mx - w * 1.3)} ${f1(my - 12)} Z`, '#3a1420', { sw: 6 });
      m += G.path(`M ${f1(mx - w * 1.15)} ${f1(my - 9)} Q ${f1(mx)} ${f1(my + 3)} ${f1(mx + w * 1.15)} ${f1(my - 15)} L ${f1(mx + w * 1.0)} ${f1(my + 10)} Q ${f1(mx)} ${f1(my + 18)} ${f1(mx - w * 1.0)} ${f1(my + 10)} Z`, '#ffffff');
      if (o.gap) m += G.rect(mx - 3, my - 6, 7, 18, '#3a1420');
      m += G.ell(mx + 4, my + w * 1.1, w * 0.55, w * 0.25, '#ec6a84');
    } else if (expr === 'shock') {
      m += P(`M ${f1(mx - w * 0.5)} ${f1(my - 4)} Q ${f1(mx)} ${f1(my - 14)} ${f1(mx + w * 0.55)} ${f1(my - 4)} Q ${f1(mx + w * 0.62)} ${f1(my + w * 1.5)} ${f1(mx)} ${f1(my + w * 1.55)} Q ${f1(mx - w * 0.6)} ${f1(my + w * 1.5)} ${f1(mx - w * 0.5)} ${f1(my - 4)} Z`, '#3a1420', { sw: 6 });
      m += G.ell(mx, my + w * 1.1, w * 0.32, w * 0.2, '#ec6a84');
    } else if (expr === 'worried') {
      m += L(`M ${f1(mx - w)} ${f1(my + 8)} Q ${f1(mx - w * 0.5)} ${f1(my - 8)} ${f1(mx)} ${f1(my + 4)} Q ${f1(mx + w * 0.5)} ${f1(my + 16)} ${f1(mx + w)} ${f1(my)}`, O, 7);
      m += P(`M ${f1(-r * 0.62)} ${f1(-r * 0.3)} q 12 22 0 32 q -12 -10 0 -32 Z`, '#a8e4ff', { sw: 4 });
    } else {
      m += L(`M ${f1(mx - w)} ${f1(my + 2)} Q ${f1(mx + w * 0.2)} ${f1(my + 14)} ${f1(mx + w * 1.15)} ${f1(my - 14)}`, O, 8);
      m += L(`M ${f1(mx + w * 1.05)} ${f1(my - 22)} q 10 4 8 14`, O, 5);                                        // dimple
    }
    return m;
  }
  // head disc with shadow side, a warm key highlight and a cool rim on the back edge
  function head(r, skin, shade, shape = 'round') {
    let m = '';
    if (shape === 'square') m += G.rect(-r * 1.05, -r * 0.98, r * 2.1, r * 1.98, skin, { rx: r * 0.55, stroke: O, sw: OW });
    else if (shape === 'chin') m += P(`M ${-r} ${-r * 0.1} C ${-r} ${-r * 1.15} ${r} ${-r * 1.15} ${r} ${-r * 0.1} C ${r} ${r * 0.55} ${r * 0.45} ${r * 1.02} ${r * 0.1} ${r * 1.06} C ${-r * 0.5} ${r * 1.0} ${-r} ${r * 0.55} ${-r} ${-r * 0.1} Z`, skin);
    else if (shape === 'oval') m += G.ell(0, 0, r * 0.94, r * 1.06, skin, { stroke: O, sw: OW });
    else m += G.circ(0, 0, r, skin, { stroke: O, sw: OW });
    m += G.path(`M ${-r * 0.55} ${-r * 0.78} C ${-r * 1.02} ${-r * 0.3} ${-r * 0.95} ${r * 0.55} ${-r * 0.35} ${r * 0.9} C ${-r * 0.8} ${r * 0.45} ${-r * 0.82} ${-r * 0.3} ${-r * 0.55} ${-r * 0.78} Z`, shade, { op: 0.9 });
    m += rim(`M ${-r * 0.72} ${-r * 0.62} C ${-r * 1.0} ${-r * 0.2} ${-r * 0.98} ${r * 0.3} ${-r * 0.7} ${r * 0.66}`, 7);
    m += G.ell(r * 0.42, -r * 0.5, r * 0.22, r * 0.12, '#ffffff', { op: 0.4 });
    return m;
  }
  const shoe = (x, y, col, toe, lace, flip = 1) => P(`M ${x - 30} ${y} Q ${x - 34} ${y - 50} ${x} ${y - 52} L ${x + 26} ${y - 40} Q ${x + 66} ${y - 30} ${x + 66} ${y - 6} L ${x + 64} ${y + 4} L ${x - 30} ${y + 4} Z`, col, { sw: 7 }) +
    G.rect(x - 30, y - 8, 96, 13, toe, { rx: 6, stroke: O, sw: 5 }) + (lace ? L(`M ${x - 4} ${y - 44} L ${x + 14} ${y - 30} M ${x + 4} ${y - 48} L ${x + 22} ${y - 34}`, lace, 4) : '');

  // ================================================================== SPARKS (triangle)
  function sparks(p) {
    const skin = '#c98c5a', sh = '#a06a3c', r = 128, hy = -470, e = p.expr || 'smug', t = p.t || 0;
    let m = '';
    const flow = 10 * Math.sin(t * 2.2);
    if (!p.head) {
      // the scarf tail streams out behind (drawn first, behind everything)
      m += P(`M -40 -300 C -150 ${-300 + flow} -190 ${-210 - flow} -260 ${-230 + flow} C -320 ${-250 + flow} -350 ${-190} -400 ${-205 + flow} L -392 ${-160 + flow} C -340 -150 -300 ${-205 + flow} -250 ${-188 + flow} C -180 ${-165 - flow} -130 -250 -30 -262 Z`, '#e8343c');
      m += G.path(`M -60 -290 C -150 ${-285 + flow} -200 ${-200 - flow} -260 ${-218 + flow}`, 'none', { stroke: '#ff7a7a', sw: 6, op: 0.7 });
      for (let i = 0; i < 5; i++) m += L(`M ${-398 + i * 2} ${-200 + flow + i * 9} l -26 ${4 + i * 2}`, '#e8343c', 7) + L(`M ${-398 + i * 2} ${-200 + flow + i * 9} l -26 ${4 + i * 2}`, O, 2);
    }
    if (!p.head) {
      // legs: contrapposto, near leg straight, far knee bent forward; light rolled jeans, red high-tops
      m += P('M 10 -190 L 44 -100 L 30 -40 L 58 -40 L 74 -104 L 46 -196 Z', '#4f7fb8', { sw: 7 });                 // far leg (darker)
      m += P('M -52 -196 L -46 -40 L -14 -40 L -8 -190 Z', '#6fa0d8', { sw: 7 });                                   // near leg
      m += G.rect(-52, -66, 42, 20, '#9cc4ec', { rx: 5, stroke: O, sw: 5 }) + G.rect(28, -66, 40, 20, '#7aa6d4', { rx: 5, stroke: O, sw: 5 });
      m += shoe(40, -2, '#c42a32', '#f4f2ee', '#ffffff') + shoe(-36, 4, '#e8343c', '#ffffff', '#ffffff');
      // oversized black hoodie, leaning back; arms bent, hands jammed in the jeans pockets
      m += P('M -96 -340 Q -134 -260 -112 -170 Q -20 -150 92 -176 Q 116 -260 82 -344 Q 0 -372 -96 -340 Z', '#25222e');
      m += G.path('M 30 -352 Q 104 -300 96 -180 L 92 -176 Q 116 -260 82 -344 Z', '#16141c');
      m += rim('M -98 -334 Q -132 -260 -112 -176', 7);
      m += P('M -96 -330 Q -150 -270 -120 -196 L -90 -194 Q -108 -250 -72 -298 Z', '#2c2936', { sw: 7 });          // near arm, elbow out
      m += P('M 82 -336 Q 132 -276 98 -198 L 70 -200 Q 96 -250 64 -300 Z', '#1c1a24', { sw: 7 });                  // far arm
      m += L('M -70 -196 Q -40 -200 -20 -186', O, 5) + L('M 30 -190 Q 52 -200 76 -194', O, 5);                     // pocket slits
      m += L('M -10 -330 L -16 -260 M 14 -330 L 18 -262', '#f4f2ee', 5);                                           // drawstrings
    }
    // scarf wrap at the neck: a fat rolled band
    m += P('M -86 -348 Q 0 -300 96 -350 Q 104 -320 90 -300 Q 0 -262 -90 -300 Q -100 -322 -86 -348 Z', '#e8343c');
    m += L('M -70 -322 Q 0 -290 80 -324', '#a81e26', 5) + hi('M -40 -332 Q 10 -312 60 -334', 5, 0.6);
    m += `<g transform="translate(0 ${hy}) rotate(-6)">`;
    // hair: ONE solid wind-swept mass, a jagged back edge streaming up and back (-x); bleached white, cool cyan shade
    const HP = [[-0.98, 0.02], [-1.32, -0.28], [-1.08, -0.42], [-1.78, -0.86], [-1.02, -0.82], [-1.42, -1.42], [-0.62, -1.12], [-0.78, -1.86],
      [-0.08, -1.28], [0.12, -1.72], [0.42, -1.1], [0.86, -1.18], [0.9, -0.62], [0.96, -0.34]];
    const hp = HP.map(([x, y]) => [x * r + (y < -1.3 ? flow * 0.35 : 0), y * r]);
    m += P('M ' + hp.map(q => f1(q[0]) + ' ' + f1(q[1])).join(' L ') + ` Q ${f1(r * 0.2)} ${f1(-r * 0.62)} ${f1(hp[0][0])} ${f1(hp[0][1])} Z`, '#f2f5ff', { sw: OW });
    const inner = HP.slice(2, 11).map(([x, y]) => [x * r * 0.78 + r * 0.05 + (y < -1.3 ? flow * 0.3 : 0), y * r * 0.82]);
    m += G.path('M ' + inner.map(q => f1(q[0]) + ' ' + f1(q[1])).join(' L ') + ` Q ${f1(-r * 0.2)} ${f1(-r * 0.7)} ${f1(inner[0][0])} ${f1(inner[0][1])} Z`, '#bfd0f2', { op: 0.8 });
    m += L(`M ${-r * 1.0} ${-r * 0.6} Q ${-r * 0.6} ${-r * 1.2} ${r * 0.2} ${-r * 1.3}`, '#ffffff', 7, 0.9);
    m += rim(`M ${-r * 1.7} ${-r * 0.84} L ${-r * 1.06} ${-r * 0.44}`, 5) + rim(`M ${-r * 1.4} ${-r * 1.4} L ${-r * 1.0} ${-r * 0.84}`, 5);
    m += head(r, skin, sh, 'chin');
    // fringe: three swoops falling forward over the brow
    m += P(`M ${-r * 0.92} ${-r * 0.3} Q ${-r * 0.7} ${-r * 1.0} ${r * 0.1} ${-r * 0.98} Q ${r * 0.85} ${-r * 0.92} ${r * 0.92} ${-r * 0.42} Q ${r * 0.78} ${-r * 0.55} ${r * 0.62} ${-r * 0.36} Q ${r * 0.5} ${-r * 0.62} ${r * 0.2} ${-r * 0.5} Q ${0} ${-r * 0.7} ${-r * 0.32} ${-r * 0.52} Q ${-r * 0.6} ${-r * 0.62} ${-r * 0.92} ${-r * 0.3} Z`, '#f4f6ff');
    m += L(`M ${-r * 0.55} ${-r * 0.78} Q ${-r * 0.1} ${-r * 0.9} ${r * 0.4} ${-r * 0.8}`, '#b9c4e8', 5, 0.8);
    m += face({ r, expr: e, look: p.look, skin, brow: '#1a1420' });
    return m + '</g>';
  }
  // ================================================================== BRICK (square)
  function brick(p) {
    const skin = '#4e2c1a', sh = '#38200f', r = 130, hy = -440, e = p.expr || 'grin';
    let m = '';
    if (!p.head) {
      // wide stance, short dark legs, chunky tan boots
      m += P('M -78 -170 L -92 -44 L -46 -44 L -32 -170 Z', '#2a2f44', { sw: 7 }) + P('M 30 -170 L 52 -44 L 98 -44 L 78 -170 Z', '#222638', { sw: 7 });
      m += P('M -120 6 L -120 -56 L -48 -56 L -40 -26 Q -2 -22 -2 6 Z', '#c48a4a', { sw: 7 }) + G.rect(-124, -6, 126, 14, '#5a3a20', { rx: 5, stroke: O, sw: 5 });
      m += P('M 40 6 L 40 -56 L 112 -56 L 120 -26 Q 158 -22 158 6 Z', '#b07a3c', { sw: 7 }) + G.rect(36, -6, 126, 14, '#5a3a20', { rx: 5, stroke: O, sw: 5 });
      // varsity jacket: green body, cream sleeves, striped rib hem; boxy and wide
      m += P('M -128 -330 Q -150 -250 -128 -168 L 130 -168 Q 152 -250 128 -330 Q 0 -370 -128 -330 Z', '#1f7a4a');
      m += G.path('M 50 -350 Q 132 -300 130 -172 L 130 -168 Q 152 -250 128 -330 Z', '#14583a');
      m += G.rect(-128, -192, 258, 26, '#efe6cf', { stroke: O, sw: 6 }) + G.rect(-128, -184, 258, 8, '#1f7a4a');
      // the chenille star patch
      const st = (cx, cy, R) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; d += (i ? ' L ' : 'M ') + f1(cx + rr * Math.cos(a)) + ' ' + f1(cy + rr * Math.sin(a)); } return d + ' Z'; };
      m += P(st(-62, -262, 40), '#efe6cf', { sw: 6 }) + P(st(-62, -262, 26), '#ffc21a', { sw: 0 });
      // crossed arms: cream sleeves folded across the chest, fists tucked
      m += P('M -132 -320 Q -170 -250 -120 -222 L 70 -246 Q 96 -250 98 -228 Q 92 -206 64 -206 L -110 -196 Q -170 -206 -150 -300 Z', '#efe6cf', { sw: 7 });
      m += P('M 128 -322 Q 170 -262 120 -214 L -40 -236 Q -66 -238 -66 -258 Q -62 -278 -36 -276 L 100 -262 Q 120 -290 104 -330 Z', '#e2d6bc', { sw: 7 });
      m += G.rect(64, -236, 40, 30, '#efe6cf', { rx: 6, stroke: O, sw: 5 }) + G.rect(64, -228, 40, 6, '#1f7a4a');      // cuff
      m += G.circ(110, -222, 20, skin, { stroke: O, sw: 6 });
      m += rim('M -132 -322 Q -158 -250 -134 -176', 7);
    }
    // big yellow headphones round the neck
    m += `<g transform="translate(0 ${hy})">`;
    // the hi-top: a flat-top block, crisp corners, sheen + texture lines, faded lower band
    m += `<defs>${G.lg('bkHT', [[0, '#2a2438'], [0.5, '#141018'], [1, '#0a080e']], 1, 0)}</defs>`;
    m += P(`M ${-r * 0.98} ${-r * 0.5} L ${-r * 0.94} ${-r * 1.42} Q ${-r * 0.92} ${-r * 1.52} ${-r * 0.8} ${-r * 1.52} L ${r * 0.82} ${-r * 1.52} Q ${r * 0.94} ${-r * 1.52} ${r * 0.96} ${-r * 1.42} L ${r * 1.0} ${-r * 0.5} Z`, 'url(#bkHT)');
    for (let i = 0; i < 26; i++) {                                                                       // tight coils
      const cx = -r * 0.82 + (i % 9) * r * 0.2 + (Math.floor(i / 9) % 2) * r * 0.1, cy = -r * 1.36 + Math.floor(i / 9) * r * 0.24;
      m += L(`M ${f1(cx - 8)} ${f1(cy + 4)} q 8 -12 16 0`, '#3a3250', 4, 0.9);
    }
    m += L(`M ${-r * 0.78} ${-r * 1.46} Q 0 ${-r * 1.56} ${r * 0.8} ${-r * 1.46}`, '#6a6090', 6, 0.7);           // sheen on the flat top
    m += head(r, skin, sh, 'square');
    m += P(`M ${-r * 1.0} ${-r * 0.45} Q ${-r * 0.98} ${-r * 0.95} ${-r * 0.6} ${-r * 0.97} L ${r * 0.62} ${-r * 0.97} Q ${r * 1.0} ${-r * 0.95} ${r * 1.02} ${-r * 0.45} Q ${r * 0.85} ${-r * 0.72} ${r * 0.4} ${-r * 0.7} L ${-r * 0.4} ${-r * 0.7} Q ${-r * 0.85} ${-r * 0.72} ${-r * 1.0} ${-r * 0.45} Z`, '#141018', { sw: 6 });   // crisp hairline
    m += L(`M ${-r * 0.55} ${-r * 0.74} L ${-r * 0.3} ${-r * 0.96}`, '#5a3a28', 6);                       // shaved part line
    m += face({ r, expr: e, look: p.look, skin, brow: '#0c0806', gap: true });
    m += '</g>';
    // big yellow headphones resting on the shoulders, cups out wide where they read
    if (!p.head) m += P('M -136 -296 Q 0 -232 140 -298 L 132 -276 Q 0 -212 -128 -274 Z', '#2a2a32', { sw: 6 })
      + G.ell(-138, -284, 40, 48, '#ffc21a', { stroke: O, sw: 7 }) + G.ell(-138, -284, 22, 28, '#d99a10') + hi('M -160 -310 Q -150 -326 -132 -326', 5, 0.8)
      + G.ell(140, -288, 34, 44, '#e8aa12', { stroke: O, sw: 7 }) + G.ell(140, -288, 18, 24, '#c48a0c');
    return m;
  }
  // ================================================================== MILO (circle)
  function milo(p) {
    const skin = '#f6dcc6', sh = '#e2b89a', r = 126, hy = -430, e = p.expr || 'worried';
    let m = '';
    if (!p.head) {
      m += L('M -26 -150 L -36 -40', '#1e5a5e', 18) + L('M 26 -150 L 40 -40', '#184a4e', 18);
      m += shoe(42, 0, '#9a84e8', '#ffffff', '#ffffff') + shoe(-40, 4, '#b8a4ff', '#ffffff', '#ffffff');
      // the giant orange puffer: bulging quilted rings, collar up to the chin, sleeves swallowing the hands
      const ring = (y, w, h, col) => P(`M ${-w} ${y} Q ${-w - 14} ${y - h / 2} ${-w} ${y - h} Q 0 ${y - h - 18} ${w} ${y - h} Q ${w + 14} ${y - h / 2} ${w} ${y} Q 0 ${y + 18} ${-w} ${y} Z`, col, { sw: 8 });
      m += ring(-140, 138, 70, '#ff7a1a') + ring(-205, 150, 74, '#ff8a2a') + ring(-275, 146, 74, '#ff7a1a') + ring(-340, 124, 66, '#ff8a2a');
      m += G.path('M 70 -400 Q 160 -300 150 -150 L 140 -140 Q 150 -300 60 -390 Z', '#d95a0a', { op: 0.75 });
      for (const y of [-180, -248, -318]) m += hi(`M -90 ${y} Q -30 ${y - 14} 30 ${y - 10}`, 6, 0.55);
      m += rim('M -150 -330 Q -170 -240 -140 -150', 7);
      // sleeves: fat, drooping past the hands
      m += P('M -132 -320 Q -200 -250 -186 -150 Q -170 -122 -140 -136 Q -150 -220 -100 -280 Z', '#ff8a2a', { sw: 8 }) + G.ell(-164, -138, 24, 14, '#2a1a10');
      if (!p.reach) m += P('M 132 -320 Q 196 -250 180 -150 Q 160 -124 134 -140 Q 146 -220 100 -280 Z', '#e8661a', { sw: 8 }) + G.ell(158, -140, 22, 13, '#2a1a10');
      m += P('M -96 -400 Q 0 -350 100 -400 L 92 -340 Q 0 -306 -92 -340 Z', '#ff9a3a', { sw: 7 });                 // collar
      m += G.rect(-6, -360, 12, 210, '#c94e0a') + G.rect(-9, -350, 18, 26, '#e0e4ec', { rx: 4, stroke: O, sw: 3 });
      if (p.reach) {
        // the front sleeve reaches to p.reach (figure space): a fat quilted tube, the cuff drooping, fingertips peeking out
        const [ax, ay] = p.reach, sx0 = 110, sy0 = -300, ex = (sx0 + ax) / 2 + 20, ey = Math.max(sy0, ay) + 50;
        const arm = `M ${sx0} ${sy0} Q ${f1(ex)} ${f1(ey)} ${f1(ax - 18)} ${f1(ay)}`;
        m += L(arm, O, 74) + L(arm, '#ff8a2a', 58) + L(arm, '#ffb06a', 10, 0.5);
        m += L(`M ${f1(lerp2([sx0, sy0], [ex, ey])[0])} ${f1(lerp2([sx0, sy0], [ex, ey])[1] - 30)} l 8 54`, '#d95a0a', 5, 0.8);   // quilt seam
        m += G.circ(ax + 4, ay + 4, 16, skin, { stroke: O, sw: 6 }) + G.ell(ax - 16, ay, 30, 34, '#ff8a2a', { stroke: O, sw: 7 });
      }
    }
    m += `<g transform="translate(0 ${hy}) rotate(4)">`;
    // curly mop behind + on top: overlapping circles, one curl dropping over the near eye
    const curls = [[-0.95, -0.35, 0.34], [-0.82, -0.78, 0.36], [-0.45, -1.02, 0.38], [0, -1.12, 0.38], [0.45, -1.02, 0.36], [0.82, -0.72, 0.34], [0.98, -0.32, 0.3]];
    curls.forEach(([cx, cy, cr]) => { m += G.circ(cx * r, cy * r, cr * r, '#3a2418', { stroke: O, sw: OW }); });
    m += head(r, skin, sh, 'round');
    curls.forEach(([cx, cy, cr], i) => { if (i > 0 && i < 6) m += G.circ(cx * r * 0.9, cy * r * 0.82 + r * 0.1, cr * r * 0.8, '#3a2418'); });
    for (const [cx, cy] of [[-0.5, -0.7], [0.1, -0.85], [0.6, -0.6]]) m += L(`M ${f1(cx * r - 14)} ${f1(cy * r)} q 14 -16 28 0`, '#6a4430', 5);
    m += P(`M ${-r * 0.32} ${-r * 0.6} C ${-r * 0.5} ${-r * 0.3} ${-r * 0.1} ${-r * 0.2} ${-r * 0.22} ${r * 0.05} C ${0} ${-r * 0.2} ${-r * 0.1} ${-r * 0.5} ${-r * 0.32} ${-r * 0.6} Z`, '#3a2418', { sw: 6 });   // the curl
    m += face({ r, expr: e, look: p.look, skin, brow: '#3a2418', blush: true, freckles: true });
    return m + '</g>';
  }
  // ================================================================== RAE (tall rectangle)
  function rae(p) {
    const skin = '#a86d48', sh = '#8a5434', r = 120, hy = -500, e = p.expr || 'smug', t = p.t || 0;
    const sw = 8 * Math.sin(t * 2.6);
    let m = '';
    // the ponytail: a big swinging arc behind, magenta tie
    m += `<g transform="translate(0 ${hy})">`;
    m += P(`M ${-r * 0.3} ${-r * 0.95} C ${-r * 1.4} ${-r * 1.5 + sw} ${-r * 2.0} ${-r * 0.6 + sw} ${-r * 1.75} ${r * 0.6 + sw} C ${-r * 1.6} ${r * 1.0 + sw} ${-r * 1.3} ${r * 0.8 + sw} ${-r * 1.35} ${r * 0.3 + sw} C ${-r * 1.45} ${-r * 0.4 + sw} ${-r * 0.9} ${-r * 0.9} ${-r * 0.2} ${-r * 0.7} Z`, '#141020');
    m += L(`M ${-r * 0.7} ${-r * 1.1 + sw * 0.5} C ${-r * 1.4} ${-r * 1.0 + sw} ${-r * 1.65} ${-r * 0.3 + sw} ${-r * 1.55} ${r * 0.4 + sw}`, '#4a4470', 6, 0.8);
    m += rim(`M ${-r * 1.2} ${-r * 1.15 + sw} C ${-r * 1.8} ${-r * 0.8 + sw} ${-r * 1.95} ${-r * 0.1 + sw} ${-r * 1.78} ${r * 0.5 + sw}`, 6);
    m += G.ell(-r * 0.42, -r * 0.98, 26, 18, '#ff2fa0', { stroke: O, sw: 6 });
    m += '</g>';
    if (!p.head) {
      // long legs in baggy mustard cargos, black boots
      m += P('M -60 -230 L -72 -48 L -18 -48 L -10 -230 Z', '#e0b030', { sw: 7 }) + P('M 10 -230 L 30 -48 L 84 -48 L 62 -230 Z', '#c99a20', { sw: 7 });
      m += G.rect(-82, -170, 26, 40, '#c99a20', { rx: 5, stroke: O, sw: 4 }) + G.rect(70, -170, 24, 40, '#b0861a', { rx: 5, stroke: O, sw: 4 });
      m += P('M -86 6 L -84 -60 L -14 -60 L -8 -24 Q 18 -18 18 6 Z', '#1d1a22', { sw: 7 }) + P('M 22 6 L 24 -60 L 92 -60 L 98 -24 Q 126 -18 126 6 Z', '#16141a', { sw: 7 });
      m += G.rect(-90, -6, 110, 14, '#3a3640', { rx: 4, stroke: O, sw: 4 }) + G.rect(18, -6, 112, 14, '#3a3640', { rx: 4, stroke: O, sw: 4 });
      // oversized denim jacket, white tee, patches + pins
      m += P('M -104 -378 Q -126 -300 -110 -214 L 112 -214 Q 128 -300 104 -378 Q 0 -404 -104 -378 Z', '#4f7dc8');
      m += G.path('M 44 -392 Q 114 -330 110 -216 L 112 -214 Q 128 -300 104 -378 Z', '#355ea4');
      m += P('M -34 -390 L 0 -290 L 34 -390 Z', '#f4f2ee', { sw: 6 });
      m += L('M -100 -300 L 104 -300', '#8fb0e8', 4, 0.8) + L('M -6 -296 L -6 -214', '#8fb0e8', 4, 0.8);
      m += P('M -80 -272 L -48 -272 L -64 -244 Z', '#ffc21a', { sw: 4 }) + G.circ(52, -262, 16, '#ff2fa0', { stroke: O, sw: 4 }) + G.rect(-74, -246, 34, 22, '#2fd0ff', { rx: 4, stroke: O, sw: 4 });
      m += P('M 40 -236 l 10 -16 l 4 10 l 12 -4 l -10 18 l -4 -10 Z', '#ffffff', { sw: 3 });                      // lightning pin
      m += rim('M -104 -372 Q -124 -300 -110 -220', 7);
      // near arm: hand on hip (elbow out)
      m += P('M -100 -370 Q -170 -300 -132 -226 L -100 -232 Q -126 -296 -76 -340 Z', '#5a88d4', { sw: 7 });
      m += G.rect(-150, -252, 40, 24, '#8fb0e8', { rx: 6, stroke: O, sw: 5 }) + G.circ(-104, -222, 18, skin, { stroke: O, sw: 6 });
      // far arm up: peace sign beside the head
      m += P('M 98 -372 Q 152 -420 150 -500 L 124 -500 Q 128 -430 76 -392 Z', '#355ea4', { sw: 7 });
      m += G.rect(118, -520, 40, 26, '#7a9ad8', { rx: 6, stroke: O, sw: 5 });
      m += G.circ(138, -536, 20, skin, { stroke: O, sw: 6 });
      m += P('M 126 -548 L 116 -604 Q 126 -612 134 -602 L 138 -552 Z', skin, { sw: 5 }) + P('M 144 -550 L 156 -604 Q 166 -608 168 -596 L 154 -546 Z', skin, { sw: 5 });
    }
    m += `<g transform="translate(0 ${hy}) rotate(-4)">`;
    m += head(r, skin, sh, 'oval');
    // hair pulled back tight, a sleek cap with a shine + two face-framing strands
    m += P(`M ${-r * 0.96} ${-r * 0.1} Q ${-r * 1.02} ${-r * 1.2} 0 ${-r * 1.15} Q ${r * 0.95} ${-r * 1.15} ${r * 0.94} ${-r * 0.3} Q ${r * 0.4} ${-r * 0.82} ${-r * 0.3} ${-r * 0.72} Q ${-r * 0.75} ${-r * 0.55} ${-r * 0.96} ${-r * 0.1} Z`, '#141020');
    m += L(`M ${-r * 0.5} ${-r * 0.95} Q ${0} ${-r * 1.1} ${r * 0.5} ${-r * 0.95}`, '#5a5480', 6, 0.8);
    m += L(`M ${r * 0.86} ${-r * 0.35} Q ${r * 1.0} ${r * 0.1} ${r * 0.86} ${r * 0.5}`, '#141020', 8);
    m += G.circ(-r * 0.93, r * 0.32, 14, 'none', { stroke: '#f2c14e', sw: 5 });
    m += face({ r, expr: e, look: p.look, skin, brow: '#141020', eye: 'cat' });
    return m + '</g>';
  }

  const WHO = { sparks, brick, milo, rae };
  function draw(p) {
    const s = p.s || 1, dir = p.dir || 1;
    return `<g transform="translate(${f1(p.x)} ${f1(p.y)}) scale(${(s * dir).toFixed(4)} ${s.toFixed(4)})">${WHO[p.who](p)}</g>`;
  }
  return { draw, WHO: Object.keys(WHO) };
})();
