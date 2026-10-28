// SVG for text with effects or a curve. OcText paints its effects (outline, shadow, neon, 3D,
// sticker, chrome…) and its curved letters in extra canvas passes that Fabric's toSVG doesn't
// know about. Here the text's own _render runs against a recording 2D context that writes each
// pass as SVG instead of pixels, so the SVG matches the PNG: the letters stay real text (with
// the embedded fonts), canvas shadows and glows become blur filters, gradients stay gradients.
// Nothing here edits the text class; buildSVG swaps in textMarkup() only while exporting.

const FAR = 10000; // OcText draws shadow-only shapes 30000 px away: past this, keep only the shadow
const STATE = [
  "fillStyle", "strokeStyle", "lineWidth", "lineJoin", "lineCap", "miterLimit", "lineDashOffset",
  "globalAlpha", "font", "textAlign", "textBaseline", "direction", "shadowColor", "shadowBlur",
  "shadowOffsetX", "shadowOffsetY", "globalCompositeOperation",
];

let scratch = null;
function scratchCtx() {
  if (!scratch) scratch = document.createElement("canvas").getContext("2d");
  return scratch;
}

const num = (v) => {
  const n = Math.round(Number(v) * 1000) / 1000;
  return Number.isFinite(n) ? String(n) : "0";
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const mtx = (m) => `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(num).join(" ")})`;

/** Any CSS colour as { color: "rgb(…)" | "#rrggbb", alpha }, through the browser's own parser. */
export function splitColor(css) {
  if (typeof css !== "string" || !css || css === "transparent") return { color: "none", alpha: 0 };
  const ctx = scratchCtx();
  ctx.fillStyle = "#000000";
  ctx.fillStyle = css;
  const v = ctx.fillStyle;
  const m = /^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/.exec(v);
  if (m) return { color: `rgb(${m[1]}, ${m[2]}, ${m[3]})`, alpha: m[4] === undefined ? 1 : Number(m[4]) };
  return { color: v, alpha: 1 };
}

/** Fabric's font declaration ("normal 900 120px \"Anton\"") as SVG attributes. */
function fontAttrs(font) {
  const m = /^(\S+)\s+(\S+)\s+([\d.e+-]+)px\s+(.+)$/.exec(font || "");
  if (!m) return `style="font:${esc(font || "16px sans-serif")}"`;
  const family = m[4].replace(/"/g, "'");
  return `font-family="${esc(family)}" font-size="${num(m[3])}" font-weight="${esc(m[2])}" font-style="${esc(m[1])}"`;
}

/** A canvas gradient made through the recorder: kept as data until something fills with it. */
class RecGradient {
  constructor(type, coords) { this.type = type; this.coords = coords; this.stops = []; }
  addColorStop(offset, color) { this.stops.push([offset, color]); }
}

const stopsMarkup = (stops) => stops.map(([o, c, op = 1]) => {
  const { color, alpha } = splitColor(c);
  return `<stop offset="${num(Math.max(0, Math.min(1, o)))}" stop-color="${color}" stop-opacity="${num(alpha * op)}"/>`;
}).join("");

/**
 * A 2D context look-alike that records drawing as SVG elements. Coordinates are the text's own
 * object space (centre origin), the same space Fabric wraps in the object's transform.
 */
class SvgRecorder {
  constructor(obj, ids) {
    this.obj = obj;
    this.ids = ids;
    this.out = [];
    this.defs = [];
    this.stack = [];
    this.path = [];
    this.m = new DOMMatrix();
    this.canvas = { setAttribute() {}, getAttribute() { return null; } };
    Object.assign(this, {
      fillStyle: "#000000", strokeStyle: "#000000", lineWidth: 1, lineJoin: "miter", lineCap: "butt", miterLimit: 10,
      lineDashOffset: 0, globalAlpha: 1, font: "10px sans-serif", textAlign: "start", textBaseline: "alphabetic",
      direction: "ltr", shadowColor: "rgba(0, 0, 0, 0)", shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
      globalCompositeOperation: "source-over",
    });
    this.dash = [];
  }

  // ---- state and transforms ---------------------------------------------------------------
  save() {
    const s = { m: this.m, dash: this.dash };
    for (const k of STATE) s[k] = this[k];
    this.stack.push(s);
  }
  restore() {
    const s = this.stack.pop();
    if (!s) return;
    for (const k of STATE) this[k] = s[k];
    this.m = s.m;
    this.dash = s.dash;
  }
  translate(x, y) { this.m = this.m.translate(x, y); }
  rotate(a) { this.m = this.m.rotate((a * 180) / Math.PI); }
  scale(x, y) { this.m = this.m.scale(x, y); }
  transform(a, b, c, d, e, f) { this.m = this.m.multiply(new DOMMatrix([a, b, c, d, e, f])); }
  setTransform(a, b, c, d, e, f) {
    this.m = typeof a === "object" && a ? new DOMMatrix([a.a, a.b, a.c, a.d, a.e, a.f]) : new DOMMatrix([a, b, c, d, e, f]);
  }
  resetTransform() { this.m = new DOMMatrix(); }
  getTransform() { return DOMMatrix.fromMatrix(this.m); }
  setLineDash(d) { this.dash = Array.isArray(d) ? d.slice() : []; }
  getLineDash() { return this.dash.slice(); }
  measureText(t) {
    const c = scratchCtx();
    c.font = this.font;
    return c.measureText(t);
  }
  createLinearGradient(x0, y0, x1, y1) { return new RecGradient("linear", { x0, y0, x1, y1 }); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new RecGradient("radial", { x0, y0, r0, x1, y1, r1 }); }
  createPattern() { return null; }
  clearRect() {}
  drawImage() {}
  clip() {}

  // ---- paths --------------------------------------------------------------------------------
  beginPath() { this.path = []; }
  _sub() {
    const last = this.path.at(-1);
    if (last && last.m === this.m) return last;
    const s = { m: this.m, d: [] };
    this.path.push(s);
    return s;
  }
  moveTo(x, y) { this._sub().d.push(`M${num(x)} ${num(y)}`); }
  lineTo(x, y) { this._sub().d.push(`L${num(x)} ${num(y)}`); }
  closePath() { if (this.path.length) this._sub().d.push("Z"); }
  rect(x, y, w, h) { this._sub().d.push(`M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}Z`); }
  roundRect(x, y, w, h, r = 0) {
    const rr = Math.max(0, Math.min(Array.isArray(r) ? Number(r[0]) || 0 : Number(r) || 0, Math.abs(w) / 2, Math.abs(h) / 2));
    if (!rr) { this.rect(x, y, w, h); return; }
    const a = `A${num(rr)} ${num(rr)} 0 0 1`;
    this._sub().d.push(`M${num(x + rr)} ${num(y)}H${num(x + w - rr)}${a} ${num(x + w)} ${num(y + rr)}V${num(y + h - rr)}`
      + `${a} ${num(x + w - rr)} ${num(y + h)}H${num(x + rr)}${a} ${num(x)} ${num(y + h - rr)}V${num(y + rr)}${a} ${num(x + rr)} ${num(y)}Z`);
  }
  fill(rule) {
    for (const s of this.path) {
      const d = s.d.join("");
      if (d) this._emit((m, over) => `<path transform="${mtx(m)}" d="${d}" ${this._paint("fill", over, m)}${rule === "evenodd" ? ' fill-rule="evenodd"' : ""}/>`, s.m);
    }
  }
  stroke() {
    for (const s of this.path) {
      const d = s.d.join("");
      if (d) this._emit((m, over) => `<path transform="${mtx(m)}" d="${d}" ${this._paint("stroke", over, m)}/>`, s.m);
    }
  }
  fillRect(x, y, w, h) {
    this._emit((m, over) => `<rect transform="${mtx(m)}" x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" ${this._paint("fill", over, m)}/>`);
  }
  strokeRect(x, y, w, h) {
    this._emit((m, over) => `<rect transform="${mtx(m)}" x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" ${this._paint("stroke", over, m)}/>`);
  }

  // ---- text ---------------------------------------------------------------------------------
  fillText(t, x, y) { this._text("fill", t, x, y); }
  strokeText(t, x, y) { this._text("stroke", t, x, y); }
  _text(kind, t, x, y) {
    if (!String(t).length) return;
    const rtl = this.direction === "rtl";
    const side = { start: rtl ? "right" : "left", end: rtl ? "left" : "right" }[this.textAlign] || this.textAlign;
    const anchor = side === "center" ? "middle" : (side === "right") !== rtl ? "end" : "start";
    const base = { middle: "central", top: "text-before-edge", hanging: "hanging", bottom: "text-after-edge", ideographic: "ideographic" }[this.textBaseline];
    const extra = `${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}${base ? ` dominant-baseline="${base}"` : ""}${rtl ? ' direction="rtl"' : ""}`;
    const font = fontAttrs(this.font);
    this._emit((m, over) => `<text xml:space="preserve" transform="${mtx(m)}" x="${num(x)}" y="${num(y)}" ${font}${extra} ${this._paint(kind, over, m)}>${esc(t)}</text>`);
  }

  // ---- painting -----------------------------------------------------------------------------
  /** fill/stroke attributes for the current style; `over` replaces the colour (shadows). */
  _paint(kind, over, m) {
    const style = kind === "fill" ? this.fillStyle : this.strokeStyle;
    const { paint, alpha } = over ? { paint: over.color, alpha: over.alpha } : this._resolve(style, kind, m);
    if (kind === "fill") return `fill="${paint}"${alpha < 1 ? ` fill-opacity="${num(alpha)}"` : ""} stroke="none"`;
    const dash = this.dash.length ? ` stroke-dasharray="${this.dash.map(num).join(" ")}"${this.lineDashOffset ? ` stroke-dashoffset="${num(this.lineDashOffset)}"` : ""}` : "";
    return `fill="none" stroke="${paint}"${alpha < 1 ? ` stroke-opacity="${num(alpha)}"` : ""} stroke-width="${num(this.lineWidth)}"`
      + ` stroke-linejoin="${this.lineJoin}" stroke-linecap="${this.lineCap}" stroke-miterlimit="${num(this.miterLimit)}"${dash}`;
  }

  _resolve(style, kind, m) {
    if (typeof style === "string") {
      const { color, alpha } = splitColor(style);
      return { paint: color, alpha };
    }
    if (style instanceof RecGradient) return { paint: `url(#${this._recGradient(style)})`, alpha: 1 };
    // A canvas pattern: Fabric turns "percentage" gradients into one. Rebuild that gradient
    // from the object (fill or stroke) in object space, mapped into this element's space.
    const g = kind === "fill" ? this.obj.fill : this.obj.stroke;
    if (g && typeof g === "object" && Array.isArray(g.colorStops)) return { paint: `url(#${this._fabricGradient(g, m)})`, alpha: 1 };
    return { paint: "#000000", alpha: 1 };
  }

  _recGradient(g) {
    const id = this.ids.next("ocg");
    const c = g.coords;
    const head = g.type === "linear"
      ? `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(c.x0)}" y1="${num(c.y0)}" x2="${num(c.x1)}" y2="${num(c.y1)}">`
      : `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" fx="${num(c.x0)}" fy="${num(c.y0)}" fr="${num(c.r0)}" cx="${num(c.x1)}" cy="${num(c.y1)}" r="${num(c.r1)}">`;
    this.defs.push(`${head}${stopsMarkup([...g.stops].sort((a, b) => a[0] - b[0]))}</${g.type}Gradient>`);
    return id;
  }

  _fabricGradient(g, m) {
    const id = this.ids.next("ocg");
    const o = this.obj, w = o.width, h = o.height;
    const pct = g.gradientUnits === "percentage";
    const X = (v) => (pct ? -w / 2 + v * w : v - w / 2 + (g.offsetX || 0));
    const Y = (v) => (pct ? -h / 2 + v * h : v - h / 2 + (g.offsetY || 0));
    const c = g.coords || {};
    let gt = m.inverse();
    if (Array.isArray(g.gradientTransform)) gt = gt.multiply(new DOMMatrix(g.gradientTransform));
    const head = g.type === "radial"
      ? `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" gradientTransform="${mtx(gt)}" cx="${num(X(c.x2 ?? 0.5))}" cy="${num(Y(c.y2 ?? 0.5))}" r="${num((c.r2 ?? 0.5) * (pct ? Math.max(w, h) : 1))}" fx="${num(X(c.x1 ?? 0.5))}" fy="${num(Y(c.y1 ?? 0.5))}">`
      : `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" gradientTransform="${mtx(gt)}" x1="${num(X(c.x1 ?? 0))}" y1="${num(Y(c.y1 ?? 0))}" x2="${num(X(c.x2 ?? 1))}" y2="${num(Y(c.y2 ?? 0))}">`;
    const stops = [...g.colorStops].sort((a, b) => a.offset - b.offset).map((s) => [s.offset, s.color, s.opacity ?? 1]);
    this.defs.push(`${head}${stopsMarkup(stops)}</${g.type === "radial" ? "radial" : "linear"}Gradient>`);
    return id;
  }

  /** Write one element (and its canvas shadow, if one is set). `make(m, over)` builds it. */
  _emit(make, m = this.m) {
    const op = this.globalAlpha < 1 ? ` opacity="${num(this.globalAlpha)}"` : "";
    const sh = splitColor(this.shadowColor);
    const hasShadow = sh.alpha > 0 && (this.shadowBlur > 0 || this.shadowOffsetX || this.shadowOffsetY);
    if (hasShadow) {
      const ms = new DOMMatrix([m.a, m.b, m.c, m.d, m.e + this.shadowOffsetX, m.f + this.shadowOffsetY]);
      const shape = make(ms, { color: sh.color, alpha: sh.alpha });
      if (this.shadowBlur > 0) {
        const id = this.ids.next("ocb");
        // A canvas shadowBlur of B is a Gaussian with a standard deviation of B / 2.
        this.defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">`
          + `<feGaussianBlur stdDeviation="${num(this.shadowBlur / 2)}"/></filter>`);
        this.out.push(`<g filter="url(#${id})"${op}>${shape}</g>`);
      } else {
        this.out.push(op ? `<g${op}>${shape}</g>` : shape);
      }
    }
    if (Math.abs(m.e) > FAR || Math.abs(m.f) > FAR) return; // the far-away caster of a shadow-only pass
    const shape = make(m, null);
    this.out.push(op ? `<g${op}>${shape}</g>` : shape);
  }
}

/** True for a text whose look Fabric's own SVG would lose (effects or a curve). */
export function needsTextSVG(o) {
  return typeof o?.text === "string" && typeof o._render === "function" && Boolean(o.effect || o._ocCurve);
}

/** An id maker shared by one export, so filter and gradient ids never clash. */
export function idMaker() {
  let n = 0;
  return { next: (p) => `${p}${(n++).toString(36)}` };
}

/**
 * The object's _toSVG markup (Fabric wraps it with the object's transform, opacity and
 * shadow): every pass of its canvas rendering, as SVG.
 */
export function textMarkup(obj, ids) {
  const rec = new SvgRecorder(obj, ids);
  obj._render(rec);
  const label = esc((obj.text || "").replace(/\s+/g, " ").trim().slice(0, 200));
  return [
    "\t\t<g ", "COMMON_PARTS", ` data-text="${label}">\n`,
    rec.defs.length ? `<defs>${rec.defs.join("")}</defs>\n` : "",
    rec.out.join("\n"), "\n\t\t</g>\n",
  ];
}

/** Use textMarkup for these objects while fn runs (sync), then put Fabric's own back. */
export function withTextSVG(objects, fn) {
  const ids = idMaker();
  const list = [];
  const walk = (o) => {
    if (needsTextSVG(o)) list.push(o);
    else o?._objects?.forEach(walk);
  };
  objects.forEach(walk);
  for (const o of list) o._toSVG = () => textMarkup(o, ids);
  try {
    return { result: fn(), count: list.length };
  } finally {
    for (const o of list) delete o._toSVG;
  }
}
