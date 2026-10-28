// Toolbars for the v0.2 graphics: badges (edit words, plate colours), charts (Edit chart),
// photo grids (spacing, corners, add photos) and light leaks (colour).
import { colorButton, el, popover, slider, toHex } from "../../ui/kit.js";
import { registerTool } from "../../ui/shell.js";
import { shadowButton, tbtn, throttledCommit } from "./controls.js";
import { cropState } from "./crop.js";
import { editBadgeText, isBadge } from "./badges.js";
import { isChart } from "./charts.js";
import { chartEditor } from "./chart-editor.js";
import { isGrid, relayGrid, fillCell } from "./grids.js";
import { setLeakColor } from "./decor.js";
import { pickImage } from "./toolbar-image.js";

const idle = () => !cropState();
const one = (sel, fn) => idle() && sel.length === 1 && fn(sel[0]);

// ---- badges -----------------------------------------------------------------------------

/** The distinct colours used by a badge's plate (text colour is in the text toolbar). */
function plateColors(g) {
  const seen = new Map();
  for (const o of g.getObjects()) {
    if (!o.data?.badgePlate) continue;
    for (const c of [o.fill, o.stroke]) {
      if (typeof c !== "string" || !c || c === "none" || c === "transparent") continue;
      const k = c.toLowerCase();
      seen.set(k, (seen.get(k) || 0) + 1);
    }
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

function recolorPlate(g, from, to) {
  for (const o of g.getObjects()) {
    if (!o.data?.badgePlate) continue;
    if (typeof o.fill === "string" && o.fill.toLowerCase() === from) o.set("fill", to);
    if (typeof o.stroke === "string" && o.stroke.toLowerCase() === from) o.set("stroke", to);
  }
  g.set("dirty", true);
}

registerTool({
  id: "el-badge", order: 36,
  match: (sel) => one(sel, isBadge),
  render(app, [g]) {
    const tiles = plateColors(g).slice(0, 4).map((c) => {
      let current = c;
      const commit = throttledCommit(app, "Badge colour", 200);
      return colorButton({
        value: c, title: "Badge colour",
        onChange: (v, done) => {
          if (typeof v !== "string") return;
          const next = (toHex(v) || v).toLowerCase();
          recolorPlate(g, current, next);
          current = next;
          app.editor.canvas.requestRenderAll();
          commit(done);
        },
      });
    });
    return el("div.tgroup", {},
      tbtn("PencilLine", "Edit words", () => editBadgeText(app, g), { text: true, cls: "accent" }),
      tiles, shadowButton(app, [g]));
  },
});

// ---- charts -----------------------------------------------------------------------------

export function openChartEditor(app, g, anchor) {
  const a = anchor || document.querySelector(".el-chart-btn") || app.shell?.canvasHost;
  if (!a) return;
  popover(a, chartEditor(app, g), { cls: "el-popover" });
}

registerTool({
  id: "el-chart", order: 36,
  match: (sel) => one(sel, isChart),
  render(app, [g]) {
    const b = tbtn("ChartColumn", "Edit chart", () => openChartEditor(app, app.editor.active() || g, b), { text: true, cls: "accent el-chart-btn" });
    return el("div.tgroup", {}, b, shadowButton(app, [g]));
  },
});

// ---- photo grids ------------------------------------------------------------------------

function gridPanel(app, g) {
  const commit = throttledCommit(app, "Grid spacing", 200);
  const grid = g.data.grid;
  const short = Math.min(grid.w, grid.h);
  const set = async (patch, done) => {
    await relayGrid(g, patch);
    app.editor.canvas.requestRenderAll();
    commit(done);
  };
  return el("div.el-pop", {}, el("h4.el-pop-title", {}, "Photo grid"),
    slider({ label: "Spacing", min: 0, max: Math.round(short * 0.12), value: Math.round(grid.gap), unit: "px",
      onInput: (v) => set({ gap: v }, false), onChange: (v) => set({ gap: v }, true) }),
    slider({ label: "Corners", min: 0, max: Math.round(short * 0.15), value: Math.round(grid.radius), unit: "px",
      onInput: (v) => set({ radius: v }, false), onChange: (v) => set({ radius: v }, true) }),
    el("p.el-hint", {}, "Drop photos onto the cells, or double-click a cell to pick one."));
}

/** Fill the next empty cell (or the first) with a picked photo. */
function addPhotos(app, g) {
  pickImage(async (p) => {
    const cells = g.getObjects();
    const cell = cells.find((c) => c.data?.empty) || cells[0];
    await fillCell(cell, p.src);
    app.editor.canvas.requestRenderAll();
    app.editor.commit("Fill grid cell");
  });
}

registerTool({
  id: "el-grid", order: 36,
  match: (sel) => one(sel, isGrid),
  render(app, [g]) {
    const sp = tbtn("Space", "Spacing and corners", () => popover(sp, gridPanel(app, g), { cls: "el-popover" }), { text: true });
    return el("div.tgroup", {}, tbtn("ImagePlus", "Add a photo", () => addPhotos(app, g), { text: true, cls: "accent" }), sp, shadowButton(app, [g]));
  },
});

// ---- light leaks ------------------------------------------------------------------------

registerTool({
  id: "el-leak", order: 36,
  match: (sel) => one(sel, (o) => Boolean(o.data?.leak)),
  render(app, [o]) {
    const commit = throttledCommit(app, "Light colour", 200);
    return el("div.tgroup", {}, colorButton({ value: o.data.leak, title: "Light colour", onChange: (v, done) => {
      if (typeof v !== "string") return;
      setLeakColor(o, toHex(v) || v);
      app.editor.canvas.requestRenderAll();
      commit(done);
    } }));
  },
});
