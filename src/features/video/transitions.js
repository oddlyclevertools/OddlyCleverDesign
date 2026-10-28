// How a picture moves during a transition: the new one ("in") comes over the old one ("out").
// transitionFx is pure (tested); withFx applies it around a draw on a 2D context, so the preview
// and the MP4 export move exactly the same way. Dip to black is drawn by the compositor.

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (x) => x * x * (3 - 2 * x);                    // smooth start and end
const easeOut = (x) => 1 - (1 - x) ** 3;

/**
 * The look of one picture at progress p (0..1) of a transition.
 * @param {string} type a TRANSITIONS id
 * @param {number} p progress of the transition
 * @param {"in"|"out"} role the incoming or the outgoing picture
 * @param {number} w frame width
 * @param {number} h frame height
 * @returns {{ alpha: number, dx: number, dy: number, scale: number, rot: number, clip: number[]|null, blur: number }}
 */
export function transitionFx(type, p, role, w, h) {
  const fx = { alpha: 1, dx: 0, dy: 0, scale: 1, rot: 0, clip: null, blur: 0 };
  const q = clamp01(p);
  const inc = role === "in";
  switch (type) {
    case "crossfade":
      if (inc) fx.alpha = q;
      break;
    case "slide": {
      // The new picture pushes the old one out to the left.
      const e = ease(q);
      fx.dx = inc ? (1 - e) * w : -e * w;
      break;
    }
    case "wipe":
      // A hard edge sweeps from left to right, uncovering the new picture.
      if (inc) fx.clip = [0, 0, ease(q) * w, h];
      break;
    case "zoom": {
      // The old picture rushes towards you and fades; the new one settles from slightly big.
      const e = ease(q);
      if (inc) { fx.scale = 1.35 - 0.35 * easeOut(q); fx.alpha = clamp01(q * 1.6); }
      else { fx.scale = 1 + 0.6 * e; fx.alpha = 1 - clamp01((q - 0.3) / 0.7); }
      break;
    }
    case "whip": {
      // A fast pan with motion blur: fastest in the middle.
      const e = ease(q);
      const speed = Math.sin(Math.PI * q);
      fx.dx = inc ? (1 - e) * w : -e * w;
      fx.blur = speed * w * 0.035;
      break;
    }
    case "spin":
      if (inc) {
        const e = easeOut(q);
        fx.rot = (1 - e) * -Math.PI * 0.75;
        fx.scale = 0.35 + 0.65 * e;
        fx.alpha = clamp01(q * 2.2);
      } else {
        fx.rot = ease(q) * Math.PI * 0.4;
        fx.scale = 1 - 0.3 * ease(q);
        fx.alpha = 1 - clamp01((q - 0.4) / 0.6);
      }
      break;
    default:
      break;
  }
  return fx;
}

/** True when fx changes nothing (draw straight away). */
const plain = (fx) => fx.alpha === 1 && !fx.dx && !fx.dy && fx.scale === 1 && !fx.rot && !fx.clip && !fx.blur;

/** Run draw() on ctx with the transition look applied (about the frame's centre). */
export function withFx(ctx, fx, w, h, draw) {
  if (!fx || plain(fx)) { draw(); return; }
  ctx.save();
  ctx.globalAlpha *= fx.alpha;
  if (fx.clip) {
    ctx.beginPath();
    ctx.rect(...fx.clip);
    ctx.clip();
  }
  if (fx.blur > 0.5) ctx.filter = `blur(${fx.blur.toFixed(1)}px)`;
  ctx.translate(w / 2 + fx.dx, h / 2 + fx.dy);
  if (fx.rot) ctx.rotate(fx.rot);
  if (fx.scale !== 1) ctx.scale(fx.scale, fx.scale);
  ctx.translate(-w / 2, -h / 2);
  draw();
  ctx.restore();
}
