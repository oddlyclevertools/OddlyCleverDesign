// OcText: the app's text object. A Fabric Textbox that also paints the text effects in
// obj.data.effect (extra drawing passes in _render) and bends the text on an arc when
// obj.data.curve is set (-100..100). While a curved text is being edited it shows flat, so
// the cursor and selection line up; it curves again when editing ends.
import { Textbox, classRegistry, Gradient } from "fabric";
import { ensureFont } from "../../core/fonts.js";
import {
  normalizeEffect, effectPad, outlineWidth, hollowWidth, offsetDist, dirVec, shadowBlur, bgPad,
  extrudeDist, longDist, stickerWidth, stickerEdge, tubeWidth,
} from "./effects.js";

const FAR = 30000; // device px: draw the shape far away and keep only its shadow

/** A solid colour that stands for a fill (a gradient's first stop). */
export function solidOf(fill, fallback = "#000000") {
  if (typeof fill === "string" && fill && fill !== "transparent") return fill;
  if (fill instanceof Gradient || fill?.colorStops) return fill.colorStops?.[0]?.color || fallback;
  return fallback;
}

/** Mix a CSS hex colour with white (t = 0..1). */
function tint(hex, t) {
  const m = /^#?([0-9a-f]{6})/i.exec(hex || "");
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

/** Mix a CSS hex colour with black (t = 0..1). Non-hex colours fall back to a dark grey. */
function darken(hex, t) {
  const m = /^#?([0-9a-f]{6})/i.exec(hex || "");
  if (!m) return "#333333";
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c * (1 - t));
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

function withAlpha(color, a) {
  const m = /^#([0-9a-f]{6})/i.exec(color || "");
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Every [family, weight, style] a saved text uses: the box's own and its styled letters'. */
export function faceKeys(object) {
  const base = [object.fontFamily, object.fontWeight || 400, object.fontStyle || "normal"];
  const out = new Map([[base.join("|"), base]]);
  const add = (st) => {
    if (!st || !(st.fontWeight || st.fontFamily || st.fontStyle)) return;
    const k = [st.fontFamily || base[0], st.fontWeight || base[1], st.fontStyle || base[2]];
    out.set(k.join("|"), k);
  };
  const styles = object.styles;
  if (Array.isArray(styles)) styles.forEach((r) => add(r?.style)); // saved form: [{ start, end, style }]
  else if (styles && typeof styles === "object") {
    for (const line of Object.values(styles)) for (const st of Object.values(line || {})) add(st);
  }
  return [...out.values()];
}

export class OcText extends Textbox {
  static type = "OcText";

  /** Load the fonts first (the box's and any styled letters'), so the text is measured with them. */
  static async fromObject(object, options) {
    if (object?.fontFamily) {
      await Promise.all(faceKeys(object).map(([f, w, st]) => ensureFont(f, w, st, object.text)));
    }
    return super.fromObject(object, options);
  }

  get effect() { return normalizeEffect(this.data?.effect); }
  get curve() { return Math.max(-100, Math.min(100, Number(this.data?.curve) || 0)); }

  // ---- layout: curve ----------------------------------------------------------------------

  initDimensions() {
    super.initDimensions();
    if (!this.initialized) return;
    this._ocCurve = null;
    const c = this.curve;
    if (!c || this._ocFlat || this.isEditing || !this._textLines?.length) return;
    this._layoutCurve(c);
  }

  _layoutCurve(c) {
    const n = this._textLines.length;
    const widths = [];
    for (let i = 0; i < n; i++) widths.push(this.getLineWidth(i));
    const L = Math.max(1, ...widths);
    const theta = Math.pow(Math.abs(c) / 100, 1.3) * Math.PI * 1.9;
    const R0 = L / theta;
    const arch = c > 0;
    const fs = this.fontSize;
    const asc = fs * (1 - this._fontSizeFraction) * 0.92, desc = fs * this._fontSizeFraction;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const pos = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const R = arch ? Math.max(fs * 0.3, R0 - acc) : R0 + acc;
      acc += this.getHeightOfLine(i);
      const bounds = this.__charBounds[i] || [];
      const left = -widths[i] / 2; // curved lines are centred on the arc
      const row = [];
      for (let j = 0; j < this._textLines[i].length; j++) {
        const b = bounds[j];
        if (!b) continue;
        const phi = (left + b.left + b.width / 2) / R;
        const x = R * Math.sin(phi);
        const y = arch ? -R * Math.cos(phi) : R * Math.cos(phi);
        const rot = arch ? phi : -phi;
        row[j] = { x, y, rot, w: b.width };
        const cs = Math.cos(rot), sn = Math.sin(rot);
        for (const [px, py] of [[-b.width / 2, -asc], [b.width / 2, -asc], [-b.width / 2, desc], [b.width / 2, desc]]) {
          const X = x + px * cs - py * sn, Y = y + px * sn + py * cs;
          if (X < minX) minX = X;
          if (X > maxX) maxX = X;
          if (Y < minY) minY = Y;
          if (Y > maxY) maxY = Y;
        }
      }
      pos.push(row);
    }
    if (!Number.isFinite(minY)) return;
    const ox = -(minX + maxX) / 2, oy = -(minY + maxY) / 2;
    for (const row of pos) for (const p of row) if (p) { p.x += ox; p.y += oy; }
    this._ocCurve = { pos, contentW: maxX - minX, overflowX: Math.max(0, (maxX - minX) / 2 - this.width / 2) };
    this.height = Math.max(fs * 0.5, maxY - minY);
  }

  _renderChars(method, ctx, line, left, top, lineIndex) {
    const row = this._ocCurve?.pos[lineIndex];
    if (!row) return super._renderChars(method, ctx, line, left, top, lineIndex);
    for (let j = 0; j < line.length; j++) {
      const p = row[j];
      if (!p) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      this._renderChar(method, ctx, lineIndex, j, line[j], -p.w / 2, 0);
      ctx.restore();
    }
  }

  _renderTextDecoration(ctx, type) {
    if (this._ocCurve) return; // no underline on an arc
    super._renderTextDecoration(ctx, type);
  }

  _renderTextLinesBackground(ctx) {
    if (this._ocCurve) return;
    super._renderTextLinesBackground(ctx);
  }

  // Edit curved text flat (the cursor maths is for straight lines), keeping its centre still.
  _ocReflow(flat) {
    const c = this.getCenterPoint();
    this._ocFlat = flat;
    this.initDimensions();
    this.setPositionByOrigin(c, "center", "center");
    this.setCoords();
    this.dirty = true;
  }

  enterEditing(e) {
    if (!this.isEditing && this.editable && this.curve) this._ocReflow(true);
    return super.enterEditing(e);
  }

  exitEditingImpl() {
    super.exitEditingImpl();
    if (this._ocFlat) this._ocReflow(false);
  }

  // ---- effects ----------------------------------------------------------------------------

  /** Effects that paint outside the box also make a parent group skip its cache. */
  willDrawShadow() {
    return super.willDrawShadow() || Boolean(this.effect) || Boolean(this._ocCurve?.overflowX);
  }

  _getCacheCanvasDimensions() {
    const d = super._getCacheCanvasDimensions();
    const pad = effectPad(this.effect, this.fontSize) + (this._ocCurve?.overflowX || 0);
    if (!pad) return d;
    const px = 2 * pad * d.zoomX, py = 2 * pad * d.zoomY;
    return { ...d, width: Math.ceil(d.width + px), height: Math.ceil(d.height + py), x: d.x + px, y: d.y + py };
  }

  // Force every glyph to one colour during a silhouette pass (char styles are ignored then).
  getCompleteStyleDeclaration(lineIndex, charIndex) {
    const d = super.getCompleteStyleDeclaration(lineIndex, charIndex);
    return this._ocForce ? { ...d, ...this._ocForce } : d;
  }

  /** Paint the text once with temporary paint settings. */
  _ocPaint(ctx, { fill = null, stroke = null, strokeWidth = 0, force = false }) {
    const saved = {
      fill: this.fill, stroke: this.stroke, strokeWidth: this.strokeWidth, paintFirst: this.paintFirst,
      strokeDashArray: this.strokeDashArray, shadow: this.shadow, strokeLineJoin: this.strokeLineJoin,
      _ocForce: this._ocForce,
    };
    this.fill = fill;
    this.stroke = stroke;
    this.strokeWidth = strokeWidth;
    this.strokeDashArray = null;
    this.shadow = null;
    this.strokeLineJoin = "round";
    this._ocForce = force ? { fill, stroke, strokeWidth } : null;
    try {
      if (stroke && strokeWidth) this._renderTextStroke(ctx);
      if (fill) this._renderTextFill(ctx);
    } finally {
      Object.assign(this, saved);
    }
  }

  /** The letters as one solid shape (outline included) in `color`. */
  _ocSilhouette(ctx, color, outline) {
    this._ocPaint(ctx, { fill: color, stroke: outline ? color : null, strokeWidth: outline, force: true });
  }

  /** Draw only the shadow of `draw()`: offset/blur are in object units. */
  _ocShadowOnly(ctx, color, blur, dx, dy, draw) {
    const m = ctx.getTransform();
    const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
    ctx.save();
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e + FAR, m.f);
    ctx.shadowColor = color;
    ctx.shadowBlur = blur * scale;
    ctx.shadowOffsetX = m.a * dx + m.c * dy - FAR;
    ctx.shadowOffsetY = m.b * dx + m.d * dy;
    draw();
    ctx.restore();
  }

  _ocBackground(ctx, p) {
    const fs = this.fontSize, pad = bgPad(p, fs);
    const rects = [];
    if (this._ocCurve) {
      const w = this._ocCurve.contentW + pad * 1.2;
      rects.push([-w / 2, -this.height / 2 - pad * 0.5, w, this.height + pad]);
    } else {
      const top = this._getTopOffset(), left = this._getLeftOffset(), n = this._textLines.length;
      let acc = 0;
      for (let i = 0; i < n; i++) {
        const h = this.getHeightOfLine(i), w = this.getLineWidth(i);
        const lineTop = top + acc;
        acc += h;
        if (!w) continue;
        const padY = pad * 0.45;
        const y0 = lineTop - (i === 0 ? padY : 0) + (i === 0 ? h * 0.06 : 0);
        const y1 = lineTop + h + (i === n - 1 ? padY : 0);
        rects.push([left + this._getLineLeftOffset(i) - pad, y0, w + pad * 2, y1 - y0]);
      }
    }
    if (!rects.length) return;
    ctx.save();
    ctx.globalAlpha *= 1 - p.transparency / 100;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    for (const [x, y, w, h] of rects) {
      const r = Math.min(h / 2, w / 2, (p.roundness / 100) * Math.min(h, fs) * 0.6);
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
    }
    ctx.fill("nonzero");
    ctx.restore();
  }

  /** Copies of the letter shape stepped back along a direction (3D extrude, long shadow). */
  _ocExtrude(ctx, dist, direction, color, ow, shaded) {
    const fs = this.fontSize;
    const [ux, uy] = dirVec(direction, 1);
    const n = Math.max(2, Math.min(60, Math.ceil(dist / (fs * 0.016))));
    for (let i = n; i >= 1; i--) {
      const t = i / n;
      ctx.save();
      ctx.translate(ux * dist * t, uy * dist * t);
      this._ocSilhouette(ctx, shaded ? darken(color, 0.38 * t) : color, ow);
      ctx.restore();
    }
  }

  /** A die-cut sticker: soft shadow, dark edge, then the sticker colour around the letters. */
  _ocSticker(ctx, p, ow) {
    const fs = this.fontSize;
    const w = stickerWidth(p, fs) + ow, e = stickerEdge(fs);
    if (p.shadow > 0) {
      const k = p.shadow / 100;
      this._ocShadowOnly(ctx, `rgba(0, 0, 0, ${0.25 + 0.4 * k})`, fs * (0.04 + 0.14 * k), 0, fs * (0.02 + 0.07 * k),
        () => this._ocSilhouette(ctx, "#000", w + e * 2));
    }
    this._ocSilhouette(ctx, p.edge, w + e * 2);
    this._ocSilhouette(ctx, p.color, w);
  }

  /** A metal gradient: a bright top, a dark horizon line just under the middle, a warm-up below. */
  _ocChrome(ctx, p) {
    const fs = this.fontSize, k = p.shine / 100, m = p.tint || "#c9ced6";
    const band = [
      [0, tint(m, 0.88)], [0.42, tint(m, 0.25)], [0.5, darken(m, 0.3 + 0.45 * k)],
      [0.56, darken(m, 0.15 + 0.2 * k)], [0.8, tint(m, 0.45)], [1, darken(m, 0.1)],
    ];
    if (this._ocCurve) {
      const g = ctx.createLinearGradient(0, -fs * 0.74, 0, fs * 0.04);
      for (const [o, c] of band) g.addColorStop(o, c);
      return { fill: g, edge: darken(m, 0.55) };
    }
    const top = this._getTopOffset(), n = this._textLines.length;
    const bands = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const base = top + acc + this.getHeightOfLineImpl(i) * (1 - this._fontSizeFraction);
      bands.push([base - fs * 0.74, base + fs * 0.04]);
      acc += this.getHeightOfLine(i);
    }
    const y0 = bands[0][0], y1 = bands[n - 1][1], span = Math.max(1, y1 - y0);
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    let last = -1;
    for (const [a, b] of bands) {
      for (const [o, c] of band) {
        const off = Math.min(1, Math.max(last, (a + (b - a) * o - y0) / span));
        g.addColorStop(off, c);
        last = off;
      }
    }
    return { fill: g, edge: darken(m, 0.55) };
  }

  /** Two glowing neon tubes: an offset second tube, then the main one in the text colour. */
  _ocDouble(ctx, p, base) {
    const fs = this.fontSize, tw = tubeWidth(fs), k = 0.4 + (p.glow / 100) * 1.2;
    const [dx, dy] = dirVec(p.direction, offsetDist(p, fs, 0.32));
    for (const [ox, oy, color] of [[dx, dy, p.color], [0, 0, base]]) {
      ctx.save();
      ctx.translate(ox, oy);
      for (const b of [0.05, 0.16, 0.34]) {
        this._ocShadowOnly(ctx, color, fs * b * k, 0, 0, () => this._ocPaint(ctx, { stroke: "#000", strokeWidth: tw, force: true }));
      }
      this._ocPaint(ctx, { stroke: color, strokeWidth: tw, force: true });
      this._ocPaint(ctx, { stroke: tint(color, 0.7), strokeWidth: tw * 0.38, force: true });
      ctx.restore();
    }
  }

  _render(ctx) {
    const fx = this.effect;
    if (!fx) {
      super._render(ctx);
      return;
    }
    const fs = this.fontSize;
    const base = solidOf(this.fill, "#000000");
    const ow = fx.outline ? outlineWidth(fx.outline, fs) : 0;
    this._setTextStyles(ctx);

    // 1. highlight box behind the lines, and any highlighted letters
    if (fx.background) this._ocBackground(ctx, fx.background);
    if (fx.sticker) this._ocSticker(ctx, fx.sticker, ow);
    this._renderTextLinesBackground(ctx);

    // 2. looks painted behind the letters
    if (fx.lift) {
      const k = fx.lift.intensity / 100;
      this._ocShadowOnly(ctx, `rgba(0, 0, 0, ${0.18 + 0.4 * k})`, fs * (0.06 + 0.3 * k), 0, fs * (0.02 + 0.05 * k),
        () => this._ocSilhouette(ctx, "#000", ow));
    }
    if (fx.echo) {
      const [dx, dy] = dirVec(fx.echo.direction, offsetDist(fx.echo, fs, 0.3));
      const color = fx.echo.color || base;
      for (const [k, a] of [[2, 0.3], [1, 0.6]]) {
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate(dx * k, dy * k);
        if (fx.hollow) this._ocPaint(ctx, { stroke: color, strokeWidth: hollowWidth(fx.hollow, fs), force: true });
        else this._ocSilhouette(ctx, color, ow);
        ctx.restore();
      }
    }
    if (fx.glitch) {
      const [dx, dy] = dirVec(fx.glitch.direction, offsetDist(fx.glitch, fs, 0.12));
      for (const [s, color] of [[1, fx.glitch.colorA], [-1, fx.glitch.colorB]]) {
        ctx.save();
        ctx.translate(dx * s, dy * s);
        this._ocSilhouette(ctx, color, ow);
        ctx.restore();
      }
    }
    if (fx.extrude) this._ocExtrude(ctx, extrudeDist(fx.extrude, fs), fx.extrude.direction, fx.extrude.color || darken(base, 0.45), ow, true);
    if (fx.longshadow) this._ocExtrude(ctx, longDist(fx.longshadow, fs), fx.longshadow.direction, fx.longshadow.color || darken(base, 0.6), ow, false);
    if (fx.splice) {
      const [dx, dy] = dirVec(fx.splice.direction, offsetDist(fx.splice, fs));
      ctx.save();
      ctx.translate(dx, dy);
      this._ocSilhouette(ctx, fx.splice.color, ow);
      ctx.restore();
    }

    // 3. drop shadow of the whole letter shape (outline included)
    if (fx.shadow) {
      const p = fx.shadow;
      const [dx, dy] = dirVec(p.direction, offsetDist(p, fs));
      const color = withAlpha(p.color, 1 - p.transparency / 100);
      const hollow = fx.hollow || fx.splice;
      this._ocShadowOnly(ctx, color, shadowBlur(p, fs), dx, dy, () => {
        if (hollow) this._ocPaint(ctx, { stroke: "#000", strokeWidth: Math.max(ow, hollowWidth(hollow, fs)), force: true });
        else this._ocSilhouette(ctx, "#000", ow);
      });
    }

    // 4. neon glow
    if (fx.neon) {
      const k = 0.35 + (fx.neon.intensity / 100) * 1.3;
      const color = fx.neon.color || base;
      for (const b of [0.05, 0.16, 0.38]) {
        this._ocShadowOnly(ctx, color, fs * b * k, 0, 0, () => this._ocSilhouette(ctx, "#000", ow));
      }
    }

    // 5. the letters
    const hollow = fx.hollow || fx.splice;
    if (fx.outline && !hollow) {
      this._ocPaint(ctx, { stroke: fx.outline.color, strokeWidth: ow, force: true });
    }
    if (fx.double) {
      this._ocDouble(ctx, fx.double, base);
    } else if (fx.chrome && !hollow) {
      const { fill, edge } = this._ocChrome(ctx, fx.chrome);
      this._ocPaint(ctx, { stroke: edge, strokeWidth: fs * 0.03, force: true });
      this._ocPaint(ctx, { fill, force: true });
    } else if (hollow) {
      const hw = hollowWidth(hollow, fs);
      if (fx.outline) this._ocPaint(ctx, { stroke: fx.outline.color, strokeWidth: hw + ow, force: true });
      this._ocPaint(ctx, { stroke: this.fill, strokeWidth: hw });
    } else {
      const tube = fx.neon ? fx.neon.tube / 100 : 0;
      const fill = tube > 0 ? tint(solidOf(this.fill, "#ffffff"), Math.min(0.85, tube * 0.8)) : this.fill;
      this._ocPaint(ctx, { fill, force: tube > 0 });
      // A stroke set on the object itself (not an effect) still paints.
      if (this.stroke && this.strokeWidth) this._ocPaint(ctx, { stroke: this.stroke, strokeWidth: this.strokeWidth });
    }
    this._renderTextDecoration(ctx, "underline");
    this._renderTextDecoration(ctx, "overline");
    this._renderTextDecoration(ctx, "linethrough");
  }
}

classRegistry.setClass(OcText);
classRegistry.setSVGClass?.(OcText);
