// Basic shapes: native Fabric objects (Rect, Circle, Path) with editable fill and border.
import { Circle, Path, Rect } from "fabric";
import { OUTLINES, defaultSize, outlinePath } from "./geometry.js";

export const SHAPE_FILL = "#ff2e7e";

/** The shapes listed in the panel, in order. */
export const SHAPES = [
  { key: "rect", label: "Square" },
  { key: "roundRect", label: "Rounded square", tags: "rectangle rounded corners" },
  ...["circle", "triangle", "rtriangle", "diamond", "pentagon", "hexagon", "octagon", "star5", "star8", "star4",
    "heart", "plus", "parallelogram", "bubble", "bubbleRound", "arrowRight", "arrowDouble", "arrowUp", "chevron",
    "burst", "seal", "cloud", "blob", "arch"].map((key) => ({ key, label: OUTLINES[key].label, tags: OUTLINES[key].tags })),
];

const BASE = {
  fill: SHAPE_FILL, stroke: null, strokeWidth: 0, strokeUniform: true,
  strokeLineJoin: "round", strokeLineCap: "round", objectCaching: true,
};

/** Make the Fabric object for a shape key. */
export function createShape(key) {
  if (key === "rect" || key === "roundRect") {
    const radius = key === "roundRect" ? 48 : 0;
    return new Rect({ ...BASE, width: 320, height: 320, rx: radius, ry: radius,
      name: key === "rect" ? "Square" : "Rounded square",
      data: { kind: "shape", shape: "rect", radius } });
  }
  if (key === "circle") {
    return new Circle({ ...BASE, radius: 160, name: "Circle", data: { kind: "shape", shape: "circle" } });
  }
  const { w, h } = defaultSize(key);
  return new Path(outlinePath(key, w, h), { ...BASE, name: OUTLINES[key]?.label || "Shape",
    data: { kind: "shape", shape: key } });
}

/** The outline key a shape object was made from (null for other objects). */
export function shapeKeyOf(obj) {
  const d = obj?.data;
  if (d?.kind !== "shape") return null;
  if (d.shape === "rect") return d.radius ? "roundRect" : "rect";
  return d.shape;
}

/** SVG markup for a panel tile. */
export function shapePreview(key) {
  const box = 100, pad = 10;
  let body;
  if (key === "rect" || key === "roundRect") {
    body = `<rect x="${pad}" y="${pad}" width="${box - pad * 2}" height="${box - pad * 2}" rx="${key === "roundRect" ? 16 : 0}"/>`;
  } else {
    const { w, h } = defaultSize(key, box - pad * 2);
    body = `<path d="${outlinePath(key, w, h, (box - w) / 2, (box - h) / 2)}"/>`;
  }
  return `<svg viewBox="0 0 ${box} ${box}" class="el-shape-svg" aria-hidden="true">${body}</svg>`;
}
