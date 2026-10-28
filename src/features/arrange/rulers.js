// Rulers (top and left, in page px, following zoom and pan) and ruler guides: drag from a
// ruler to make a guide, drag a guide to move it, drag it back onto a ruler to delete it.
import { el } from "../../ui/kit.js";
import { getGuides, getPrefs, live, setGuides, setPref } from "./state.js";
import { COLORS, selectionExtent } from "./overlay.js";

export const RULER = 20; // px
const HIT_PX = 4;
const SNAP_PX = 6;
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];

export function createRulers(app, overlay) {
  const ed = app.editor, host = app.shell.canvasHost, c = ed.canvas;
  const top = el("canvas.ar-ruler.ar-ruler-top", { title: "Drag down to add a horizontal guide" });
  const left = el("canvas.ar-ruler.ar-ruler-left", { title: "Drag right to add a vertical guide" });
  const corner = el("div.ar-ruler-corner", { "aria-hidden": "true" });
  host.append(top, left, corner);

  const show = () => {
    const on = getPrefs().rulers;
    for (const n of [top, left, corner]) n.classList.toggle("on", on);
    overlay.request();
  };

  // ---- drawing --------------------------------------------------------------------------
  const paint = () => {
    if (!getPrefs().rulers || app.view !== "editor") return;
    const dpr = window.devicePixelRatio || 1, W = host.clientWidth, H = host.clientHeight;
    const v = c.viewportTransform, z = v[0];
    const ext = selectionExtent(ed);
    drawRuler(top, "x", W, RULER, dpr, z, v[4], ext && [ext.l, ext.r]);
    drawRuler(left, "y", RULER, H, dpr, z, v[5], ext && [ext.t, ext.b]);
  };
  overlay.addPainter(paint);

  function drawRuler(cv, axis, w, h, dpr, z, off, band) {
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#151622";
    ctx.fillRect(0, 0, w, h);
    const len = axis === "x" ? w : h;
    const toS = (p) => p * z + off;
    // Page extent and selection band.
    const pageLen = axis === "x" ? ed.width : ed.height;
    ctx.fillStyle = "#1d1f2e";
    fillSpan(ctx, axis, toS(0), toS(pageLen), w, h);
    if (band) {
      ctx.fillStyle = "rgba(255, 46, 126, 0.35)";
      fillSpan(ctx, axis, toS(band[0]), toS(band[1]), w, h);
    }
    const step = STEPS.find((s) => s * z >= 56) || STEPS.at(-1);
    const minor = step / (step % 5 === 0 || step === 1 ? 5 : 4);
    const from = Math.floor((0 - off) / z / minor) * minor, to = (len - off) / z;
    ctx.strokeStyle = "rgba(255,255,255,.28)";
    ctx.fillStyle = "rgba(236,234,245,.75)";
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let p = from; p <= to; p += minor) {
      const s = Math.round(toS(p)) + 0.5, major = Math.abs(p / step - Math.round(p / step)) < 1e-6;
      const tick = major ? RULER : RULER * 0.3;
      if (axis === "x") { ctx.moveTo(s, RULER); ctx.lineTo(s, RULER - tick); } else { ctx.moveTo(RULER, s); ctx.lineTo(RULER - tick, s); }
      if (major) {
        const label = String(Math.round(p));
        if (axis === "x") ctx.fillText(label, s + 3, 10);
        else {
          ctx.save();
          ctx.translate(10, s + 3);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = "right";
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.stroke();
    // Guide markers on the ruler.
    ctx.fillStyle = COLORS.guide;
    for (const g of getGuides(ed)) {
      if (g.axis !== axis) continue;
      const s = toS(g.pos);
      ctx.beginPath();
      if (axis === "x") { ctx.moveTo(s - 4, RULER - 6); ctx.lineTo(s + 4, RULER - 6); ctx.lineTo(s, RULER); }
      else { ctx.moveTo(RULER - 6, s - 4); ctx.lineTo(RULER - 6, s + 4); ctx.lineTo(RULER, s); }
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.beginPath();
    if (axis === "x") { ctx.moveTo(0, h - 0.5); ctx.lineTo(w, h - 0.5); } else { ctx.moveTo(w - 0.5, 0); ctx.lineTo(w - 0.5, h); }
    ctx.stroke();
  }

  // ---- guide dragging --------------------------------------------------------------------
  const local = (e) => {
    const r = host.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pagePos = (axis, e) => {
    const p = local(e), pt = ed.toPage(p.x, p.y);
    let pos = axis === "x" ? pt.x : pt.y;
    const len = axis === "x" ? ed.width : ed.height, th = SNAP_PX / ed.zoom;
    for (const s of [0, len / 2, len]) if (Math.abs(pos - s) <= th) pos = s;
    return Math.round(pos);
  };
  const overRuler = (axis, e) => {
    const p = local(e), r = host.getBoundingClientRect();
    const outside = p.x < 0 || p.y < 0 || p.x > r.width || p.y > r.height;
    // Dropping on the ruler it belongs to (or outside the work area) deletes it.
    return outside || (axis === "y" ? p.y < RULER : p.x < RULER);
  };

  /** Start dragging a guide. index = -1 for a new one. */
  function dragGuide(axis, index, e, captureEl) {
    live.hideGuide = index;
    live.guideDrag = { axis, pos: pagePos(axis, e), remove: false };
    overlay.request();
    captureEl.setPointerCapture?.(e.pointerId);
    const move = (ev) => {
      live.guideDrag = { axis, pos: pagePos(axis, ev), remove: overRuler(axis, ev) };
      overlay.request();
    };
    const up = (ev) => {
      captureEl.removeEventListener("pointermove", move);
      captureEl.removeEventListener("pointerup", up);
      captureEl.removeEventListener("pointercancel", up);
      const g = live.guideDrag;
      live.guideDrag = null;
      live.hideGuide = -1;
      const list = getGuides(ed);
      const remove = ev.type === "pointercancel" || overRuler(axis, ev);
      if (index >= 0) {
        const next = list.filter((_, i) => i !== index);
        setGuides(ed, remove ? next : [...next, { axis, pos: g.pos }], remove ? "Delete guide" : "Move guide");
      } else if (!remove) {
        if (!getPrefs().guides) setPref("guides", true);
        setGuides(ed, [...list, { axis, pos: g.pos }], "Add guide");
      }
      overlay.request();
    };
    captureEl.addEventListener("pointermove", move);
    captureEl.addEventListener("pointerup", up);
    captureEl.addEventListener("pointercancel", up);
  }

  for (const [cv, axis] of [[top, "y"], [left, "x"]]) {
    cv.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragGuide(axis, -1, e, cv);
    });
  }

  // Existing guides: grab them on the canvas (before Fabric sees the event).
  const hitGuide = (e) => {
    if (!getPrefs().guides || c._currentTransform || e.target !== c.upperCanvasEl) return -1;
    const p = local(e), v = c.viewportTransform;
    return getGuides(ed).findIndex((g) => Math.abs((g.axis === "x" ? p.x - (g.pos * v[0] + v[4]) : p.y - (g.pos * v[3] + v[5]))) <= HIT_PX);
  };
  host.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const i = hitGuide(e);
    if (i < 0) return;
    e.stopPropagation();
    e.preventDefault(); // also stops the compatibility mousedown Fabric listens to
    dragGuide(getGuides(ed)[i].axis, i, e, host);
  }, true);
  host.addEventListener("mousedown", (e) => { if (live.guideDrag) e.stopPropagation(); }, true);
  host.addEventListener("mousemove", (e) => {
    if (e.buttons || live.guideDrag) return;
    const i = hitGuide(e);
    if (i < 0) return;
    c.upperCanvasEl.style.cursor = getGuides(ed)[i].axis === "x" ? "col-resize" : "row-resize";
    e.stopPropagation();
  }, true);

  show();
  return { show, paint };
}

function fillSpan(ctx, axis, a, b, w, h) {
  if (axis === "x") ctx.fillRect(a, 0, b - a, h);
  else ctx.fillRect(0, a, w, b - a);
}
