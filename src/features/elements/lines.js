// Lines with arrowheads. OcLine is a two-point Polyline that draws itself at screen scale, so
// the stroke and the arrowheads keep their size when the line is resized, and it has two
// endpoint handles you can drag.
import { Polyline, classRegistry, controlsUtils } from "fabric";

export const CAPS = ["none", "arrow", "triangle", "circle", "square", "diamond", "bar"];
export const CAP_LABELS = {
  none: "None", arrow: "Arrow", triangle: "Filled arrow", circle: "Circle", square: "Square", diamond: "Diamond", bar: "Bar",
};
export const LINE_STYLES = ["solid", "dashed", "dotted"];

const HIT_PX = 14; // how close (screen px) a click must be to grab a thin line

function renderHandle(ctx, left, top) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(left, top, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 4;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ff2e7e";
  ctx.stroke();
  ctx.restore();
}

export class OcLine extends Polyline {
  static type = "OcLine";

  constructor(points = [{ x: 0, y: 0 }, { x: 400, y: 0 }], options = {}) {
    super(points, { strokeUniform: true, objectCaching: false, hasBorders: false, perPixelTargetFind: true, padding: 12, ...options });
    this.startCap ??= "none";
    this.endCap ??= "none";
    this.lineStyle ??= "solid";
    this.controls = controlsUtils.createPolyControls(this, {
      render: (ctx, left, top) => renderHandle(ctx, left, top),
      cursorStyle: "crosshair",
      sizeX: 22, sizeY: 22,
    });
  }

  toObject(props = []) {
    return super.toObject([...props, "startCap", "endCap", "lineStyle"]);
  }

  /** The two endpoints in object space, multiplied out to design pixels (scale undone). */
  _ends() {
    const [a, b] = this.points;
    const o = this.pathOffset;
    return [
      { x: (a.x - o.x) * this.scaleX, y: (a.y - o.y) * this.scaleY },
      { x: (b.x - o.x) * this.scaleX, y: (b.y - o.y) * this.scaleY },
    ];
  }

  _render(ctx) {
    const [a, b] = this._ends();
    let w = this.strokeWidth || 1;
    // Fatter strokes when the canvas tests what's under the pointer, so thin lines are easy to grab.
    if (this.canvas && ctx === this.canvas.pixelFindContext) w += HIT_PX / (this.canvas.getZoom() || 1);
    const color = typeof this.stroke === "string" ? this.stroke : "#000000";
    ctx.save();
    ctx.scale(1 / (this.scaleX || 1), 1 / (this.scaleY || 1));
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const head = capSize(w);
    const cutA = capInset(this.startCap, head, w), cutB = capInset(this.endCap, head, w);
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineJoin = "round";
    const dots = this.lineStyle === "dotted";
    ctx.lineCap = this.lineStyle === "dashed" ? "butt" : "round";
    if (this.lineStyle === "dashed") ctx.setLineDash([w * 3, w * 2]);
    else if (dots) ctx.setLineDash([0.001, w * 2]);
    if (len > cutA + cutB) {
      ctx.beginPath();
      ctx.moveTo(a.x + ux * cutA, a.y + uy * cutA);
      ctx.lineTo(b.x - ux * cutB, b.y - uy * cutB);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    drawCap(ctx, this.startCap, a, -ux, -uy, head, w);
    drawCap(ctx, this.endCap, b, ux, uy, head, w);
    ctx.restore();
  }

  /** Lines never keep a scale: fold it into the points (keeps the handles honest). */
  bakeScale() {
    if (this.scaleX === 1 && this.scaleY === 1) return false;
    const center = this.getCenterPoint();
    const o = this.pathOffset, sx = this.scaleX, sy = this.scaleY;
    this.points = this.points.map((p) => ({ x: (p.x - o.x) * sx, y: (p.y - o.y) * sy }));
    this.set({ scaleX: 1, scaleY: 1 });
    this.setDimensions();
    this.setPositionByOrigin(center, "center", "center");
    this.setCoords();
    return true;
  }
}
classRegistry.setClass(OcLine);

const capSize = (w) => Math.max(10, w * 3.2 + 4);

function capInset(cap, head, w) {
  if (cap === "triangle") return head * 0.82;
  if (cap === "arrow") return w * 0.4;
  if (cap === "circle" || cap === "square" || cap === "diamond") return head * 0.3;
  return 0;
}

function drawCap(ctx, cap, tip, ux, uy, head, w) {
  if (!cap || cap === "none") return;
  const px = -uy, py = ux; // perpendicular
  ctx.beginPath();
  if (cap === "triangle") {
    const half = head * 0.55;
    const bx = tip.x - ux * head, by = tip.y - uy * head;
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(bx + px * half, by + py * half);
    ctx.lineTo(bx - px * half, by - py * half);
    ctx.closePath();
    ctx.lineWidth = Math.max(1, w * 0.4);
    ctx.fill();
    ctx.stroke();
  } else if (cap === "arrow") {
    const back = head * 0.95, half = head * 0.6;
    const bx = tip.x - ux * back, by = tip.y - uy * back;
    ctx.moveTo(bx + px * half, by + py * half);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(bx - px * half, by - py * half);
    ctx.lineWidth = w;
    ctx.stroke();
  } else if (cap === "circle") {
    ctx.arc(tip.x - ux * head * 0.3, tip.y - uy * head * 0.3, head * 0.38, 0, Math.PI * 2);
    ctx.fill();
  } else if (cap === "square" || cap === "diamond") {
    const s = head * 0.34;
    const cx = tip.x - ux * head * 0.3, cy = tip.y - uy * head * 0.3;
    const rot = cap === "diamond" ? Math.PI / 4 : 0;
    const ang = Math.atan2(uy, ux) + rot;
    for (let i = 0; i < 4; i++) {
      const a = ang + Math.PI / 4 + (i * Math.PI) / 2;
      const x = cx + Math.cos(a) * s * Math.SQRT2, y = cy + Math.sin(a) * s * Math.SQRT2;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else if (cap === "bar") {
    const half = head * 0.5;
    ctx.moveTo(tip.x + px * half, tip.y + py * half);
    ctx.lineTo(tip.x - px * half, tip.y - py * half);
    ctx.lineWidth = w;
    ctx.stroke();
  }
}

/** The line presets in the panel. */
export const LINES = [
  { key: "line", label: "Line", style: "solid", start: "none", end: "none" },
  { key: "dashed", label: "Dashed line", style: "dashed", start: "none", end: "none" },
  { key: "dotted", label: "Dotted line", style: "dotted", start: "none", end: "none" },
  { key: "arrow", label: "Arrow line", style: "solid", start: "none", end: "triangle", tags: "pointer" },
  { key: "openArrow", label: "Open arrow", style: "solid", start: "none", end: "arrow", tags: "pointer" },
  { key: "double", label: "Double arrow line", style: "solid", start: "triangle", end: "triangle", tags: "both ends" },
  { key: "dashedArrow", label: "Dashed arrow", style: "dashed", start: "none", end: "arrow" },
  { key: "dotLine", label: "Dot to arrow", style: "solid", start: "circle", end: "triangle", tags: "connector" },
];

export function createLine(key) {
  const p = LINES.find((l) => l.key === key) || LINES[0];
  return new OcLine([{ x: 0, y: 0 }, { x: 420, y: 0 }], {
    stroke: "#1b1b1f", strokeWidth: 8, startCap: p.start, endCap: p.end, lineStyle: p.style,
    name: p.label, data: { kind: "line" },
  });
}

/** SVG preview of a line preset. */
export function linePreview(key) {
  const p = LINES.find((l) => l.key === key) || LINES[0];
  const dash = p.style === "dashed" ? ` stroke-dasharray="9 6"` : p.style === "dotted" ? ` stroke-dasharray="0.1 9" stroke-linecap="round"` : ` stroke-linecap="round"`;
  const x1 = p.start === "none" ? 12 : p.start === "circle" ? 18 : 24, x2 = p.end === "none" ? 88 : 76;
  const cap = (c, x, dir) => {
    if (c === "triangle") return `<path d="M${x + dir * 14} 50 L${x} 41 L${x} 59 Z" class="f"/>`;
    if (c === "arrow") return `<path d="M${x} 40 L${x + dir * 12} 50 L${x} 60" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (c === "circle") return `<circle cx="${x - dir * 2}" cy="50" r="6" class="f"/>`;
    return "";
  };
  return `<svg viewBox="0 0 100 100" class="el-line-svg" aria-hidden="true" stroke-width="5">
    <line x1="${x1}" y1="50" x2="${x2}" y2="50"${dash}/>${cap(p.start, x1, -1)}${cap(p.end, x2, 1)}</svg>`;
}
