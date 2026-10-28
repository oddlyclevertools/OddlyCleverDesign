// Photo grids (collage frames): 2–6 cells in one group. Each cell is an empty frame (an OcImage
// with a placeholder picture). Drop a photo on a cell, or double-click one, to fill it; the
// toolbar's Spacing and Corners sliders re-lay the cells inside the same outer box.
import { Group } from "fabric";
import { OcImage, applyMask, framePlaceholder, loadElement } from "./images.js";

/** Layouts as cells in a unit box: [x, y, w, h]. `ratio` is the grid's width / height. */
export const GRID_LAYOUTS = [
  { key: "g2h", label: "2 side by side", ratio: 16 / 9, cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  { key: "g2v", label: "2 stacked", ratio: 4 / 5, cells: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  { key: "g3l", label: "1 big + 2", ratio: 16 / 9, cells: [[0, 0, 0.62, 1], [0.62, 0, 0.38, 0.5], [0.62, 0.5, 0.38, 0.5]] },
  { key: "g3c", label: "3 columns", ratio: 16 / 9, cells: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
  { key: "g3t", label: "1 wide + 2", ratio: 1, cells: [[0, 0, 1, 0.55], [0, 0.55, 0.5, 0.45], [0.5, 0.55, 0.5, 0.45]] },
  { key: "g4", label: "2 × 2", ratio: 1, cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { key: "g4l", label: "1 big + 3", ratio: 16 / 9, cells: [[0, 0, 0.66, 1], [0.66, 0, 0.34, 1 / 3], [0.66, 1 / 3, 0.34, 1 / 3], [0.66, 2 / 3, 0.34, 1 / 3]] },
  { key: "g5", label: "2 + 3", ratio: 1, cells: [[0, 0, 0.5, 0.55], [0.5, 0, 0.5, 0.55], [0, 0.55, 1 / 3, 0.45], [1 / 3, 0.55, 1 / 3, 0.45], [2 / 3, 0.55, 1 / 3, 0.45]] },
  { key: "g3m", label: "Tall middle + 2 sides", ratio: 16 / 9, cells: [[0, 0, 0.28, 1], [0.28, 0, 0.44, 1], [0.72, 0, 0.28, 1]] },
  { key: "g5s", label: "2 + tall middle + 2", ratio: 16 / 9, cells: [[0, 0, 0.3, 0.5], [0, 0.5, 0.3, 0.5], [0.3, 0, 0.4, 1], [0.7, 0, 0.3, 0.5], [0.7, 0.5, 0.3, 0.5]] },
  { key: "g6", label: "3 × 2", ratio: 3 / 2, cells: [0, 1, 2].flatMap((x) => [0, 1].map((y) => [x / 3, y / 2, 1 / 3, 1 / 2])) },
  { key: "g6v", label: "2 × 3", ratio: 2 / 3, cells: [0, 1].flatMap((x) => [0, 1, 2].map((y) => [x / 2, y / 3, 1 / 2, 1 / 3])) },
];

const layoutOf = (key) => GRID_LAYOUTS.find((l) => l.key === key) || GRID_LAYOUTS[0];

/** Cell boxes in grid units (centre x/y, width, height), relative to the grid's centre. */
function cellBoxes(layout, W, H, gap) {
  const e = 1e-6;
  return layout.cells.map(([x, y, w, h]) => {
    const l = x * W + (x > e ? gap / 2 : 0), r = (x + w) * W - (x + w < 1 - e ? gap / 2 : 0);
    const t = y * H + (y > e ? gap / 2 : 0), b = (y + h) * H - (y + h < 1 - e ? gap / 2 : 0);
    return { cx: (l + r) / 2 - W / 2, cy: (t + b) / 2 - H / 2, w: Math.max(8, r - l), h: Math.max(8, b - t) };
  });
}

/** Size a cell to w x h at (cx, cy): an empty cell gets a new placeholder, a photo is re-covered. */
async function fitCell(cell, box, radius) {
  if (cell.data?.empty) {
    await cell.setElement(framePlaceholder(Math.round(box.w), Math.round(box.h)));
    cell.set({ width: box.w, height: box.h, cropX: 0, cropY: 0, scaleX: 1, scaleY: 1 });
  } else {
    const { width: nw, height: nh } = cell.getOriginalSize();
    const s = Math.max(box.w / nw, box.h / nh);
    const w = box.w / s, h = box.h / s;
    const fx = cell.data?.focus?.x ?? 0.5, fy = cell.data?.focus?.y ?? 0.5;
    cell.set({ width: w, height: h, cropX: (nw - w) * fx, cropY: (nh - h) * fy, scaleX: s, scaleY: s });
  }
  cell.set({ left: box.cx, top: box.cy, originX: "center", originY: "center", data: { ...cell.data, mask: { shape: "roundRect", radius } } });
  applyMask(cell);
}

/**
 * A new grid. Without `box` it keeps the layout's shape at 86% of the page; with `box` it fills
 * exactly box.w x box.h (a collage covering the page), with the given gap and corner radius.
 */
export async function createGrid(key, app, box = null) {
  const layout = layoutOf(key);
  const short = Math.min(app.editor.width, app.editor.height);
  const long = Math.min(app.editor.width, app.editor.height * layout.ratio) * 0.86;
  const W = box?.w ?? (layout.ratio >= 1 ? long : short * 0.86 * layout.ratio);
  const H = box?.h ?? W / layout.ratio;
  const gap = box?.gap ?? Math.round(short * 0.016), radius = box?.radius ?? Math.round(short * 0.012);
  const cells = [];
  for (const [i, box] of cellBoxes(layout, W, H, gap).entries()) {
    const img = new OcImage(framePlaceholder(Math.round(box.w), Math.round(box.h)), {
      data: { kind: "frame", frame: true, empty: true, gridCell: i, mask: { shape: "roundRect", radius } },
    });
    await fitCell(img, box, radius);
    img.set({ left: box.cx + W / 2, top: box.cy + H / 2 });
    cells.push(img);
  }
  const g = new Group(cells, { objectCaching: false, subTargetCheck: true });
  g.set({ name: `Photo grid (${layout.label})`, data: { kind: "grid", grid: { layout: key, w: W, h: H, gap, radius } } });
  return g;
}

export const isGrid = (o) => o?.type === "group" && o.data?.kind === "grid";

/** Re-lay a grid with a new gap and/or corner radius (keeps photos and the outer box). */
export async function relayGrid(g, patch) {
  const grid = { ...g.data.grid, ...patch };
  const layout = layoutOf(grid.layout);
  const boxes = cellBoxes(layout, grid.w, grid.h, grid.gap);
  const cells = g.getObjects();
  await Promise.all(cells.map((cell, i) => (boxes[i] ? fitCell(cell, boxes[i], grid.radius) : null)));
  g.set({ data: { ...g.data, grid } });
  g.set("dirty", true);
  g.setCoords();
}

/** The cell of a grid under a page point. */
export function cellAt(g, pt) {
  const cells = g.getObjects();
  for (let i = cells.length - 1; i >= 0; i--) {
    cells[i].setCoords();
    if (cells[i].containsPoint(pt)) return cells[i];
  }
  return null;
}

/**
 * Put a picture into a grid cell (cover-fit, keeps the cell's place and size). `focus` (0..1 each
 * way) is the point of the picture kept in view when the cell crops it.
 */
export async function fillCell(cell, src, focus = { x: 0.5, y: 0.5 }) {
  const el = typeof src === "string" ? await loadElement(src) : src;
  const g = cell.parent || cell.group;
  const grid = g?.data?.grid;
  const box = { cx: cell.left, cy: cell.top, w: cell.width * cell.scaleX, h: cell.height * cell.scaleY };
  await cell.setElement(el);
  cell.set("data", { ...cell.data, empty: false, focus });
  await fitCell(cell, box, grid?.radius ?? cell.data?.mask?.radius ?? 0);
  if (g) g.set("dirty", true);
}

/** Panel preview: the layout as rounded boxes. */
export function gridPreview(key) {
  const l = layoutOf(key);
  const W = l.ratio >= 1 ? 88 : 88 * l.ratio, H = W / l.ratio;
  const ox = (100 - W) / 2, oy = (100 - H) / 2;
  const cells = cellBoxes(l, W, H, 4).map((b) => `<rect x="${(ox + b.cx + W / 2 - b.w / 2).toFixed(1)}" y="${(oy + b.cy + H / 2 - b.h / 2).toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" rx="3"/>`).join("");
  return `<svg viewBox="0 0 100 100" class="el-grid-svg" aria-hidden="true">${cells}</svg>`;
}
