// Stock photos and videos (prefix sk-): the Photos panel, dropping results onto the page or into
// frames, credits, and functions for the AI and the video feature.
//   app.stock = { searchStock, addStock, getStockVideoBlob, setVideoHandler, credits, creditsText, showCredits, setBases }
import "./stock.css";
import { registerCommands, registerPanel } from "../../ui/shell.js";
import { toast } from "../../ui/kit.js";
import { frameAt } from "../elements/images.js";
import { STOCK_DRAG, renderStockPanel, showCredits } from "./panel.js";
import { addStock, designCredits, getStockVideoBlob, searchStock, setStockVideoHandler } from "./actions.js";
import { creditsText, setStockBases } from "./sources.js";

export { searchStock, addStock, getStockVideoBlob, setStockVideoHandler, designCredits, creditsText, showCredits };
export { setStockBases };

export function install(app) {
  registerPanel({ id: "photos", icon: "Images", label: "Photos", order: 42, render: renderStockPanel });
  registerCommands(() => [
    { id: "stock:credits", label: "Photo credits", hint: "Credits for stock pictures in this design", group: "Tool", icon: "Quote",
      keywords: "credits attribution stock pexels pixabay openverse description licence", run: (a) => showCredits(a) },
  ]);
  app.stock = {
    searchStock: (opts) => searchStock(app, opts),
    addStock: (id, place) => addStock(app, id, place),
    getStockVideoBlob,
    setVideoHandler: setStockVideoHandler,
    credits: () => designCredits(app),
    creditsText: () => creditsText(designCredits(app)),
    showCredits: () => showCredits(app),
    /** Point the services at other URLs (tests use a local mock); call with nothing to reset. */
    setBases: setStockBases,
  };
  wireDrop(app);
}

/** Dragging a result onto the page: outline the frame it would fill, then add it there. */
function wireDrop(app) {
  const host = app.shell.canvasHost, c = app.editor.canvas;
  let hover = null;
  const ours = (e) => [...(e.dataTransfer?.types || [])].includes(STOCK_DRAG);
  const pageAt = (e) => {
    const r = c.upperCanvasEl.getBoundingClientRect();
    return app.editor.toPage(e.clientX - r.left, e.clientY - r.top);
  };
  const setHover = (f) => { if (f !== hover) { hover = f; c.requestRenderAll(); } };
  c.on("after:render", ({ ctx }) => {
    if (!hover || !ctx) return;
    const v = c.viewportTransform, z = c.getZoom();
    ctx.save();
    ctx.setTransform(v[0], v[1], v[2], v[3], v[4], v[5]);
    const pts = hover.getCoords();
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.lineWidth = 4 / z;
    ctx.strokeStyle = "#8fe3ff";
    ctx.setLineDash([10 / z, 8 / z]);
    ctx.stroke();
    ctx.restore();
  });
  host.addEventListener("dragover", (e) => {
    if (!ours(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setHover(frameAt(app, pageAt(e)));
  });
  host.addEventListener("dragleave", (e) => { if (!host.contains(e.relatedTarget)) setHover(null); });
  host.addEventListener("drop", async (e) => {
    if (!ours(e)) return;
    e.preventDefault();
    setHover(null);
    const id = e.dataTransfer.getData(STOCK_DRAG);
    const at = pageAt(e);
    const t = toast("Downloading the picture…", { ms: 20000 });
    try { await addStock(app, id, at); } catch (err) { toast(err.message, { error: true }); } finally { t.remove(); }
  });
}
