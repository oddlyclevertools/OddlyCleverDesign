// Drawing an animated state. applyState() sets an object's real transform from a stateAt()
// result, and a small render hook draws the extras Fabric has no property for: blur and glow
// (a canvas filter, which the browser runs on the GPU), wipes (a clip) and per-letter text
// reveals. restoreBase() puts every property back exactly as it was.
import { FabricObject, Point } from "fabric";

let patched = false;

/** Install the render hook once. Objects without `_moFx` render exactly as before. */
export function installRenderHook() {
  if (patched) return;
  patched = true;
  const proto = FabricObject.prototype;
  const render = proto.render;
  proto.render = function moRender(ctx) {
    const fx = this._moFx;
    if (!fx) return render.call(this, ctx);
    ctx.save();
    const m = ctx.getTransform();
    const k = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; // design units -> device pixels
    const filters = [];
    if (fx.blur > 0.05) filters.push(`blur(${(fx.blur * k).toFixed(2)}px)`);
    if (fx.glow && fx.glow.b > 0.1) filters.push(`drop-shadow(0 0 ${(fx.glow.b * k).toFixed(2)}px ${fx.glow.color})`);
    if (filters.length) ctx.filter = filters.join(" ");
    if (fx.clip) clipTo(ctx, this, fx.clip, m);
    const charsOn = Boolean(fx.chars);
    if (charsOn) {
      this._moChars = fx.chars;
      this._renderChar = moRenderChar;
      if (!this._ocCurve && !this.path) this._renderChars = moRenderChars;
    }
    try {
      render.call(this, ctx);
    } finally {
      if (charsOn) {
        delete this._renderChar;
        delete this._renderChars;
        delete this._moChars;
      }
      ctx.restore();
    }
  };
}

/** Clip to the part of the object a wipe has revealed, in the object's own space. */
function clipTo(ctx, obj, clip, m) {
  const t = obj.calcTransformMatrix();
  ctx.transform(t[0], t[1], t[2], t[3], t[4], t[5]);
  const W = obj.width + (obj.strokeWidth || 0), H = obj.height + (obj.strokeWidth || 0);
  ctx.beginPath();
  if (clip.type === "wipe") {
    const pad = W * 0.2, span = W + pad * 2;
    const reveal = span * clip.p;
    if (clip.dir >= 0) ctx.rect(-W / 2 - pad, -H * 2, reveal, H * 4);
    else ctx.rect(W / 2 + pad - reveal, -H * 2, reveal, H * 4);
  } else {
    // "below": hide anything under the text box (letters rising up from their baseline)
    ctx.rect(-W * 3, -H * 4, W * 6, H * 4 + H / 2 + H * 0.06);
  }
  ctx.clip();
  ctx.setTransform(m);
}

// Text: draw each character on its own so it can fade, rise or pop.
function moRenderChars(method, ctx, line, left, top, lineIndex) {
  const bounds = this.__charBounds?.[lineIndex];
  if (!bounds) return;
  ctx.save();
  const baseTop = top - this.getHeightOfLineImpl(lineIndex) * this._fontSizeFraction;
  for (let i = 0; i < line.length; i++) {
    const b = bounds[i];
    if (!b) continue;
    this._renderChar(method, ctx, lineIndex, i, line[i], left + b.left, baseTop);
  }
  ctx.restore();
}

function moRenderChar(method, ctx, lineIndex, charIndex, ch, left, top) {
  const s = this._moChars?.(lineIndex, charIndex);
  const proto = Object.getPrototypeOf(this);
  if (!s) return proto._renderChar.call(this, method, ctx, lineIndex, charIndex, ch, left, top);
  const a = s.a ?? 1;
  if (a <= 0.001) return undefined;
  const w = this.__charBounds?.[lineIndex]?.[charIndex]?.width || this.fontSize * 0.5;
  const cx = left + w / 2, cy = top - this.fontSize * 0.33;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, a);
  ctx.translate(cx + (s.dx || 0), cy + (s.dy || 0));
  const sc = s.s ?? 1;
  if (sc !== 1) ctx.scale(Math.max(0.001, sc), Math.max(0.001, sc));
  ctx.translate(-cx, -cy);
  try {
    return proto._renderChar.call(this, method, ctx, lineIndex, charIndex, ch, left, top);
  } finally {
    ctx.restore();
  }
}

// ---- base state -------------------------------------------------------------------------

const KEYS = ["left", "top", "scaleX", "scaleY", "angle", "skewX", "opacity"];

/** Remember everything applyState changes, plus the resting geometry stateAt measures. */
export function captureBase(obj, pw, ph) {
  const base = {};
  for (const k of KEYS) base[k] = obj[k];
  const c = obj.getRelativeCenterPoint();
  base.cx = c.x;
  base.cy = c.y;
  const w = Math.abs(obj.getScaledWidth()), h = Math.abs(obj.getScaledHeight());
  base.geo = { w, h, pw, ph, D: Math.min(pw, ph) };
  return base;
}

/** Show a stateAt() result on the object (temporary: restoreBase undoes it exactly). */
export function applyState(obj, base, st) {
  obj.set({
    scaleX: base.scaleX * st.sx,
    scaleY: base.scaleY * st.sy,
    angle: base.angle + st.rot,
    skewX: base.skewX + st.skewX,
    opacity: base.opacity * Math.max(0, Math.min(1, st.op)),
  });
  obj.setPositionByOrigin(new Point(base.cx + st.dx, base.cy + st.dy), "center", "center");
  const hadChars = Boolean(obj._moFx?.chars);
  const fx = st.blur > 0.05 || st.glow || st.clip || st.chars
    ? { blur: st.blur, glow: st.glow, clip: st.clip, chars: st.chars } : null;
  obj._moFx = fx;
  if (fx?.chars || hadChars) obj.dirty = true; // the text cache must redraw its letters
}

export function restoreBase(obj, base) {
  const props = {};
  for (const k of KEYS) props[k] = base[k];
  obj.set(props);
  const hadChars = Boolean(obj._moFx?.chars);
  obj._moFx = null;
  if (hadChars) obj.dirty = true;
  obj.setCoords();
}
