// Elements feature: the Elements, Uploads and Background panels, shapes, lines, icons,
// stickers, frames and images, with their toolbars. Images and image files come in from the
// panels, drops on the canvas and pastes (the arrange feature handles object paste).
import "./el.css";
import { registerPanel } from "../../ui/shell.js";
import { toast } from "../../ui/kit.js";
import "./toolbar-shapes.js";
import "./toolbar-graphics.js";
import { editBadgeText, isBadge } from "./badges.js";
import { cellAt, fillCell, isGrid } from "./grids.js";
import { isChart } from "./charts.js";
import { openChartEditor } from "./toolbar-graphics.js";
import { refitScene } from "./scene-apply.js";
import { renderElementsPanel } from "./panel-elements.js";
import { renderUploadsPanel } from "./panel-uploads.js";
import { renderBackgroundPanel } from "./panel-background.js";
import { DRAG_TYPE, insertItem, uploadFiles } from "./actions.js";
import { OcLine } from "./lines.js";
import { applyMask, backgroundImage, coverPage, fillWithSource, frameAt, isEmptyFrame, isImage } from "./images.js";
import { cropState, startCrop } from "./crop.js";
import { pickImage } from "./toolbar-image.js";
import { installBgPhoto } from "./bgphoto.js";

export function install(app) {
  registerPanel({ id: "elements", icon: "Shapes", label: "Elements", order: 20, render: renderElementsPanel });
  registerPanel({ id: "uploads", icon: "Upload", label: "Uploads", order: 40, render: renderUploadsPanel });
  registerPanel({ id: "background", icon: "PaintBucket", label: "Background", order: 45, render: renderBackgroundPanel });
  wireCanvas(app);
  wireDrop(app);
  wirePaste(app);
  installBgPhoto(app);
  app.elements = { insertItem: (item, at) => insertItem(app, item, at), uploadFiles: (files, opts) => uploadFiles(app, files, opts) };
}

function wireCanvas(app) {
  const ed = app.editor, c = ed.canvas;
  // Double-click an image to crop it (or reposition inside a frame); an empty frame asks for a picture.
  c.on("mouse:dblclick", (opt) => {
    const { target } = opt;
    if (target && !target.locked && !cropState()) {
      // Badges: type the words in place. Charts: open the data editor. Grids: fill a cell.
      if (isBadge(target)) return editBadgeText(app, target);
      if (isChart(target)) return openChartEditor(app, target);
      if (isGrid(target)) {
        const cell = cellAt(target, c.getScenePoint(opt.e));
        if (!cell) return;
        pickImage(async (p) => {
          await fillCell(cell, p.src);
          c.setActiveObject(target);
          c.requestRenderAll();
          ed.commit("Fill grid cell");
          app.refreshToolbar();
        });
        return;
      }
    }
    if (!target || cropState() || !isImage(target) || target.locked || target.isBg) return;
    if (isEmptyFrame(target)) {
      pickImage(async (p) => {
        await fillWithSource(target, p.src);
        c.setActiveObject(target);
        c.requestRenderAll();
        ed.commit("Fill frame");
        app.refreshToolbar();
      });
      return;
    }
    startCrop(app, target);
  });
  // Keep rounded corners and masks true while resizing.
  c.on("object:scaling", ({ target }) => {
    for (const o of target?._objects || [target]) {
      if (!o) continue;
      if (o.type === "rect" && o.data?.kind === "shape" && o.data.radius) o.set({ rx: o.data.radius / o.scaleX, ry: o.data.radius / o.scaleY });
      if (isImage(o) && o.data?.mask) applyMask(o);
    }
  });
  // Lines fold their scale into their points after a resize (keeps arrowheads and handles right).
  c.on("object:modified", ({ target }) => {
    const list = target?._objects ? [] : [target];
    let changed = false;
    for (const o of list) if (o instanceof OcLine) changed = o.bakeScale() || changed;
    if (changed) { c.requestRenderAll(); ed.commit("Transform", { merge: true }); }
  });
  // Keep a background image covering the page when the page size changes.
  app.bus.on("doc", () => {
    for (const o of ed.objects()) if (o.data?.overlay && !o.locked) o.set({ evented: false });
    const bg = backgroundImage(app);
    if (!bg) return;
    if (bg.data?.scene) {
      refitScene(app).catch(() => { /* keep the old picture; it still covers the page */ });
      return;
    }
    if (Math.abs(bg.getScaledWidth() - ed.width) > 0.5 || Math.abs(bg.getScaledHeight() - ed.height) > 0.5) {
      coverPage(app, bg);
      c.requestRenderAll();
    }
  });
}

/** Drops on the canvas: panel items (our drag type) and image files. */
function wireDrop(app) {
  const host = app.shell.canvasHost, c = app.editor.canvas;
  let hover = null;
  const pageAt = (e) => {
    const r = c.upperCanvasEl.getBoundingClientRect();
    return app.editor.toPage(e.clientX - r.left, e.clientY - r.top);
  };
  const ours = (e) => {
    const t = [...(e.dataTransfer?.types || [])];
    return t.includes(DRAG_TYPE) || t.includes("Files");
  };
  c.on("after:render", ({ ctx }) => {
    if (!hover || !ctx) return;
    const v = c.viewportTransform;
    ctx.save();
    ctx.setTransform(v[0], v[1], v[2], v[3], v[4], v[5]);
    const pts = hover.getCoords();
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.lineWidth = 4 / c.getZoom();
    ctx.strokeStyle = "#ff7aa8";
    ctx.setLineDash([10 / c.getZoom(), 8 / c.getZoom()]);
    ctx.stroke();
    ctx.restore();
  });
  const setHover = (f) => { if (f !== hover) { hover = f; c.requestRenderAll(); } };
  host.addEventListener("dragover", (e) => {
    if (!ours(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    host.classList.add("el-drop-on");
    setHover(frameAt(app, pageAt(e)));
  });
  host.addEventListener("dragleave", (e) => {
    if (host.contains(e.relatedTarget)) return;
    host.classList.remove("el-drop-on");
    setHover(null);
  });
  host.addEventListener("drop", async (e) => {
    if (!ours(e)) return;
    e.preventDefault();
    host.classList.remove("el-drop-on");
    setHover(null);
    const at = pageAt(e);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (raw) {
      try { await insertItem(app, JSON.parse(raw), at); } catch (err) { toast(err.message, { error: true }); }
      return;
    }
    const files = [...(e.dataTransfer.files || [])];
    if (files.length) await uploadFiles(app, files, { at });
  });
  // Don't let a file dropped beside the canvas open in the browser tab.
  window.addEventListener("dragover", (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) e.preventDefault(); });
  window.addEventListener("drop", (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files") && !e.defaultPrevented) e.preventDefault(); });
}

/** Paste with image files: upload and place (object paste belongs to the arrange feature). */
function wirePaste(app) {
  document.addEventListener("paste", (e) => {
    if (app.view !== "editor" || app.isTyping(e)) return;
    const files = [...(e.clipboardData?.files || [])].filter((f) => /^image\//.test(f.type));
    if (!files.length) return;
    e.preventDefault();
    uploadFiles(app, files);
  });
}
