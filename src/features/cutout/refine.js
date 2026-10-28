// Touch up a cut-out by hand: an erase brush and a restore brush (hard or soft), plus "draw a line
// around" tools that keep only what's inside the line or remove what's inside it. The whole edge
// can be softened or moved in or out at once (on the GPU), and a backdrop (checks, black, white,
// pink) makes leftover fringe easy to spot. Works on any photo (on one that still has its
// background it's a fully manual background remover). The untouched photo stays in
// data.cutout.original, so Restore background and Restore brush always have it.
// Space-drag pans, Ctrl+wheel zooms, [ ] brush size, Ctrl+Z takes back a stroke, Ctrl+Shift+Z or
// Ctrl+Y puts it back, Esc cancels. Done is one undo step.
import "../magic/magic.css";
import "./cutout.css";
import { util } from "fabric";
import { el, icon, toast } from "../../ui/kit.js";
import { loadElement } from "../elements/images.js";
import { canvasOf, naturalSize, pixelToScreen, sceneToPixel } from "../magic/mask.js";
import { createOverlay, inPixels } from "../magic/overlay.js";
import { refineEdge } from "./edge.js";

const SIZE_KEY = "oddlyclever.cutout.brush";
const HARD_KEY = "oddlyclever.cutout.hardness";
const TOOLS = [
  { id: "erase", icon: "Eraser", label: "Erase", tip: "Brush: paint to remove" },
  { id: "restore", icon: "Brush", label: "Restore", tip: "Brush: paint to bring the photo back" },
  { id: "keep", icon: "Lasso", label: "Keep inside line", tip: "Draw a line around what to keep; everything outside goes" },
  { id: "cut", icon: "LassoSelect", label: "Remove inside line", tip: "Draw a line around what to remove" },
];
/** Backdrops behind the cut-out while touching up: [id, label, fill]. "page" shows the design. */
const BACKDROPS = [["page", "Page", null], ["checks", "Checks", "checks"], ["black", "Black", "#000000"], ["white", "White", "#ffffff"], ["pink", "Pink", "#ff2e7e"]];

function savedNum(key, min, max, fallback) {
  try { const v = Number(localStorage.getItem(key)); return localStorage.getItem(key) !== null && v >= min && v <= max ? v : fallback; } catch { return fallback; }
}
function saveNum(key, v) { try { localStorage.setItem(key, String(v)); } catch { /* storage blocked */ } }

const screenScale = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;

/** White where the picture is visible, by its own transparency (the cut-out so far). */
function alphaOf(element, w, h) {
  const c = canvasOf(w, h), ctx = c.getContext("2d");
  ctx.drawImage(element, 0, 0, w, h);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** A soft brush: the hard core's radius and the blur around it, for a radius and hardness 0..100. */
const softParts = (r, hard) => ({ core: r * (0.65 + 0.35 * (hard / 100)), blur: r * (1 - hard / 100) * 0.25 });

/** A checkerboard pattern for the "Checks" backdrop, in picture pixels. */
function checksPattern(ctx, cell) {
  const c = canvasOf(cell * 2, cell * 2), g = c.getContext("2d");
  g.fillStyle = "#cfcfd6";
  g.fillRect(0, 0, cell * 2, cell * 2);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, cell, cell);
  g.fillRect(cell, cell, cell, cell);
  return ctx.createPattern(c, "repeat");
}

/**
 * Open touch-up mode on a photo. Resolves true when the change was kept.
 * @param {object} app
 * @param {object} img an image on the page
 * @returns {Promise<boolean>}
 */
export async function refineCutout(app, img) {
  const fc = app.editor.canvas;
  const { w, h } = naturalSize(img);
  const originalSrc = img.data?.cutout?.original || img.getSrc();
  const original = await loadElement(originalSrc);
  const start = alphaOf(img._originalElement || img.getElement(), w, h);
  const alpha = canvasOf(w, h), actx = alpha.getContext("2d");
  const comp = canvasOf(w, h), cctx = comp.getContext("2d");
  // soft strokes: the stroke's hard shape, and the mask as it was before the stroke began
  let strokeCv = null, beforeCv = null;
  const strokes = [], redo = [];
  const unit = Math.max(w, h) / 1000; // edge sliders count in "pixels of a 1000 px photo"
  let tool = "erase", size = savedNum(SIZE_KEY, 4, 300, 40), hard = savedNum(HARD_KEY, 0, 100, 100);
  let ghost = true, backdrop = "page", cur = null, hover = null, dirty = true, painting = false;
  let edge = { feather: 0, shift: 0 }, edged = null, edgeDirty = true;

  const scratch = () => {
    if (!strokeCv) { strokeCv = canvasOf(w, h); beforeCv = canvasOf(w, h); }
    return strokeCv.getContext("2d");
  };
  const hardPath = (ctx, s, from = 0, r = s.r) => {
    const p = s.pts;
    ctx.strokeStyle = ctx.fillStyle = "#fff";
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.lineWidth = r * 2;
    if (p.length === 1 || from === 0) { ctx.beginPath(); ctx.arc(p[0].x, p[0].y, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath();
    ctx.moveTo(p[Math.max(0, from - 1)].x, p[Math.max(0, from - 1)].y);
    for (let i = Math.max(1, from); i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.stroke();
  };
  /** The area a soft stroke can touch (its points, radius and blur), clamped to the picture. */
  const strokeBox = (s, pad) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of s.pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad));
    x1 = Math.min(w, Math.ceil(x1 + pad)); y1 = Math.min(h, Math.ceil(y1 + pad));
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  };
  /** Soft stroke: draw its hard shape once, then lay it on the mask blurred (no build-up where it overlaps itself). */
  const softStroke = (s, from, live) => {
    const sctx = scratch();
    const { core, blur } = softParts(s.r, s.hard);
    if (from === 0) {
      sctx.clearRect(0, 0, w, h);
      if (live) { const b = beforeCv.getContext("2d"); b.globalCompositeOperation = "copy"; b.drawImage(alpha, 0, 0); b.globalCompositeOperation = "source-over"; }
    }
    hardPath(sctx, s, from, core);
    const box = strokeBox(s, core + blur * 3 + 2);
    actx.save();
    if (live || from > 0) { actx.clearRect(box.x, box.y, box.w, box.h); actx.drawImage(beforeCv, box.x, box.y, box.w, box.h, box.x, box.y, box.w, box.h); }
    actx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    if (blur > 0.3) actx.filter = `blur(${blur}px)`;
    actx.drawImage(strokeCv, box.x, box.y, box.w, box.h, box.x, box.y, box.w, box.h);
    actx.restore();
  };

  const drawStroke = (s, from = 0, live = false) => {
    actx.save();
    if (s.kind === "brush" && (s.hard ?? 100) < 100) {
      actx.restore();
      softStroke(s, from, live);
    } else if (s.kind === "brush") {
      actx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
      hardPath(actx, s, from);
      actx.restore();
    } else {
      if (s.pts.length > 2) {
        actx.globalCompositeOperation = s.keep ? "destination-in" : "destination-out";
        actx.fillStyle = "#fff";
        actx.beginPath();
        s.pts.forEach((q, i) => (i ? actx.lineTo(q.x, q.y) : actx.moveTo(q.x, q.y)));
        actx.closePath();
        actx.fill();
      }
      actx.restore();
    }
    dirty = true;
    edgeDirty = true;
  };
  const replay = () => {
    actx.globalCompositeOperation = "copy";
    actx.drawImage(start, 0, 0);
    actx.globalCompositeOperation = "source-over";
    for (const s of strokes) drawStroke(s);
    dirty = true;
    edgeDirty = true;
  };
  const edgeOn = () => Boolean(edge.feather || edge.shift);
  /** The mask with the whole-edge settings applied (worked out again only when something changed). */
  const finalAlpha = () => {
    if (!edgeOn() || painting) return alpha;
    if (edgeDirty || !edged) {
      try { edged = refineEdge(alpha, { feather: edge.feather * unit, shift: edge.shift * unit }); } catch (e) { toast(`Couldn't change the edge: ${e.message}`, { error: true }); edged = alpha; }
      edgeDirty = false;
      dirty = true;
    }
    return edged;
  };
  let shown = null;
  const composite = () => {
    const a = finalAlpha();
    if (!dirty && shown === a) return comp;
    cctx.globalCompositeOperation = "copy";
    cctx.drawImage(original, 0, 0, w, h);
    cctx.globalCompositeOperation = "destination-in";
    cctx.drawImage(a, 0, 0);
    cctx.globalCompositeOperation = "source-over";
    dirty = false;
    shown = a;
    return comp;
  };
  replay();

  const toPixel = (p) => sceneToPixel(img, util.transformPoint(p, util.invertTransform(fc.viewportTransform)));
  const brushing = () => tool === "erase" || tool === "restore";

  const wasVisible = img.visible;
  img.visible = false; // the overlay shows the live result in its place
  fc.requestRenderAll();

  return new Promise((resolve) => {
    let finished = false;
    let pattern = null;
    const overlay = createOverlay(app, {
      interactive: true,
      cursor: "crosshair",
      draw(ctx) {
        const m = pixelToScreen(img, fc);
        const k = screenScale(m);
        inPixels(ctx, m, (c) => {
          const cx = img.cropX || 0, cy = img.cropY || 0;
          c.beginPath();
          c.rect(cx, cy, img.width, img.height);
          c.clip();
          const fill = BACKDROPS.find((b) => b[0] === backdrop)?.[2];
          if (fill) {
            if (fill === "checks") pattern = pattern || checksPattern(c, Math.max(6, Math.round(Math.max(w, h) / 60)));
            c.fillStyle = fill === "checks" ? pattern : fill;
            c.fillRect(cx, cy, img.width, img.height);
          }
          if (ghost) { c.globalAlpha = fill ? 0.14 : 0.22; c.drawImage(original, 0, 0, w, h); c.globalAlpha = 1; }
          c.drawImage(composite(), 0, 0);
          c.setLineDash([6 / k, 5 / k]);
          c.lineWidth = 1.5 / k;
          c.strokeStyle = "rgba(255,255,255,.7)";
          c.strokeRect(cx, cy, img.width, img.height);
          if (cur && cur.kind === "line" && cur.pts.length > 1) {
            c.setLineDash([]);
            c.beginPath();
            cur.pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)));
            c.lineWidth = 3 / k;
            c.strokeStyle = "rgba(0,0,0,.6)";
            c.stroke();
            c.lineWidth = 1.6 / k;
            c.strokeStyle = cur.keep ? "#8fe3ff" : "#ff2e7e";
            c.stroke();
          }
        });
        if (hover && brushing()) {
          const col = tool === "erase" ? "#ff2e7e" : "#8fe3ff";
          ctx.beginPath();
          ctx.arc(hover.x, hover.y, size / 2, 0, Math.PI * 2);
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,.55)";
          ctx.stroke();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = col;
          ctx.stroke();
          // A soft tint inside the ring (stronger while painting) and a centre dot to aim with.
          ctx.globalAlpha = painting ? 0.17 : 0.08;
          ctx.fillStyle = col;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(hover.x, hover.y, 1.6, 0, Math.PI * 2);
          ctx.fill();
          if (hard < 100) {
            // the inner ring: where a soft brush works at full strength
            ctx.beginPath();
            const sp = softParts(size / 2, hard);
            ctx.arc(hover.x, hover.y, Math.max(1, sp.core - sp.blur), 0, Math.PI * 2);
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = col;
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      },
      down(p) {
        const q = toPixel(p);
        painting = true;
        cur = brushing()
          ? { kind: "brush", erase: tool === "erase", r: size / 2 / screenScale(pixelToScreen(img, fc)), hard, pts: [q] }
          : { kind: "line", keep: tool === "keep", pts: [q] };
        if (cur.kind === "brush") { strokes.push(cur); redo.length = 0; drawStroke(cur, 0, true); }
      },
      move(p, _e, down) {
        hover = p;
        if (!down || !cur) return;
        const q = toPixel(p), last = cur.pts.at(-1);
        const min = cur.kind === "brush" ? cur.r * 0.15 : 2 / screenScale(pixelToScreen(img, fc));
        if (Math.hypot(q.x - last.x, q.y - last.y) < min) return;
        cur.pts.push(q);
        if (cur.kind === "brush") drawStroke(cur, cur.pts.length - 1, true);
      },
      up() {
        if (cur?.kind === "line") {
          if (cur.pts.length > 2) { strokes.push(cur); redo.length = 0; drawStroke(cur); } else toast("Hold the mouse down and draw all the way around.");
        }
        cur = null;
        painting = false;
        edgeDirty = true;
        sync();
        overlay.redraw();
      },
      leave() { hover = null; },
    });

    // ---- the bar ------------------------------------------------------------------------
    const toolBtns = TOOLS.map((t) => el("button.mg-btn", { type: "button", title: t.tip, "aria-pressed": "false", "data-tool": t.id,
      on: { click: () => setTool(t.id) } }, icon(t.icon, 16), el("span", {}, t.label)));
    const sizeNum = el("span.mg-num", {}, String(size));
    const range = el("input.mg-range", { type: "range", min: 4, max: 300, step: 1, value: size, "aria-label": "Brush size",
      on: { input: () => { size = Number(range.value); sizeNum.textContent = String(size); saveNum(SIZE_KEY, size); overlay.redraw(); } } });
    const sizeBox = el("label.mg-size", { title: "Brush size" }, icon("Circle", 15), range, sizeNum);
    const hardNum = el("span.mg-num", {}, `${hard}`);
    const hardRange = el("input.mg-range.co-hard", { type: "range", min: 0, max: 100, step: 5, value: hard, "aria-label": "Brush hardness",
      on: { input: () => { hard = Number(hardRange.value); hardNum.textContent = `${hard}`; saveNum(HARD_KEY, hard); overlay.redraw(); } } });
    const hardBox = el("label.mg-size", { title: "Brush hardness: lower makes a soft edge, good for hair and fur" }, el("span.co-lbl", {}, "Hardness"), hardRange, hardNum);
    const ghostBtn = el("button.mg-btn.on", { type: "button", title: "Show the removed parts faintly", "aria-pressed": "true",
      on: { click: () => { ghost = !ghost; ghostBtn.classList.toggle("on", ghost); ghostBtn.setAttribute("aria-pressed", String(ghost)); overlay.redraw(); } } },
    icon("Eye", 16));
    const undoBtn = el("button.mg-btn", { type: "button", title: "Take back the last stroke (Ctrl+Z)", "aria-label": "Undo stroke", on: { click: () => undoStroke() } }, icon("Undo2", 16));
    const redoBtn = el("button.mg-btn", { type: "button", title: "Put the stroke back (Ctrl+Shift+Z or Ctrl+Y)", "aria-label": "Redo stroke", on: { click: () => redoStroke() } }, icon("Redo2", 16));
    const resetBtn = el("button.mg-btn", { type: "button", title: "Start again from where you began", on: { click: () => {
      strokes.length = 0; redo.length = 0; setEdge({ feather: 0, shift: 0 }); replay(); sync(); overlay.redraw();
    } } }, icon("RotateCcw", 16), el("span", {}, "Reset"));

    // whole edge
    const edgeSlider = (key, label, min, max, tip) => {
      const num = el("span.mg-num", {}, "0");
      const input = el("input.mg-range", { type: "range", min, max, step: 1, value: 0, "aria-label": label, dataset: { edge: key },
        on: { input: () => { num.textContent = (key === "shift" && input.value > 0 ? "+" : "") + input.value; setEdge({ ...edge, [key]: Number(input.value) }, false); } } });
      const box = el("label.mg-size", { title: tip }, el("span.co-lbl", {}, label), input, num);
      box._set = (v) => { input.value = String(v); num.textContent = (key === "shift" && v > 0 ? "+" : "") + v; };
      return box;
    };
    const featherBox = edgeSlider("feather", "Soften edge", 0, 30, "Soften the whole edge of the cut-out");
    const shiftBox = edgeSlider("shift", "Shrink / grow", -15, 15, "Move the whole edge in (removes a thin halo) or out");
    let edgeTimer = 0;
    function setEdge(next, now = true) {
      edge = next;
      edgeDirty = true;
      if (now) { featherBox._set(edge.feather); shiftBox._set(edge.shift); }
      clearTimeout(edgeTimer);
      edgeTimer = setTimeout(() => { sync(); overlay.redraw(); }, now ? 0 : 60); // let a dragged slider settle a moment
    }
    const backBtns = BACKDROPS.map(([id, label, fill]) => el("button.co-back", { type: "button", title: `${label} backdrop`, "aria-label": `${label} backdrop`,
      "aria-pressed": String(id === backdrop), dataset: { backdrop: id }, class: id === backdrop ? "on" : null,
      on: { click: () => setBackdrop(id) } }, el("span.co-swatch", { class: id, style: fill && fill !== "checks" ? { background: fill } : null })));
    const backBox = el("div.co-backs", { role: "group", "aria-label": "Backdrop" }, el("span.co-lbl", {}, "Backdrop"), ...backBtns);

    const doneBtn = el("button.btn.primary.small", { type: "button", on: { click: () => finish(true) } }, icon("Check", 15), "Done");
    const cancelBtn = el("button.btn.small", { type: "button", on: { click: () => finish(false) } }, "Cancel");
    const hint = el("div.mg-hint");
    const bar = el("div.mg-bar", { tabindex: "-1", role: "toolbar", "aria-label": "Touch up the cut-out" },
      el("div.mg-row", {}, el("span.mg-title", {}, icon("Wand2", 16), "Touch up"), el("span.mg-cost", {}, "Free · by hand"), ...toolBtns),
      el("div.mg-row", {}, sizeBox, hardBox, ghostBtn, undoBtn, redoBtn, resetBtn),
      el("div.mg-row", {}, el("span.co-edge-title", {}, icon("Feather", 15), "Whole edge"), featherBox, shiftBox, backBox),
      el("div.mg-row.end", {}, hint, cancelBtn, doneBtn));
    app.shell.canvasHost.append(bar);
    requestAnimationFrame(() => bar.classList.add("show"));
    bar.focus({ preventScroll: true });

    function setTool(id) {
      tool = id;
      for (const b of toolBtns) { const on = b.dataset.tool === id; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }
      sizeBox.hidden = !brushing();
      hardBox.hidden = !brushing();
      hint.textContent = {
        erase: "Paint over what should go. Lower the hardness for hair and fur. Space-drag moves around, Ctrl+wheel zooms, [ ] brush size.",
        restore: "Paint over parts that went missing to bring them back.",
        keep: "Hold the mouse down and draw all the way around what to keep.",
        cut: "Hold the mouse down and draw around what to remove.",
      }[id];
      overlay.redraw();
    }
    function setBackdrop(id) {
      backdrop = id;
      for (const b of backBtns) { const on = b.dataset.backdrop === id; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }
      overlay.redraw();
    }
    function sync() {
      undoBtn.disabled = !strokes.length;
      redoBtn.disabled = !redo.length;
      resetBtn.disabled = !strokes.length && !edgeOn();
    }
    function undoStroke() {
      if (!strokes.length) return;
      redo.push(strokes.pop());
      replay();
      sync();
      overlay.redraw();
    }
    function redoStroke() {
      if (!redo.length) return;
      const s = redo.pop();
      strokes.push(s);
      drawStroke(s);
      sync();
      overlay.redraw();
    }
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); finish(false); return; }
      if (app.isTyping?.(e)) return;
      if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); finish(true); return; }
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); e.stopImmediatePropagation(); redoStroke(); return; }
      if (mod && k === "z") { e.preventDefault(); e.stopImmediatePropagation(); undoStroke(); return; }
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        e.stopImmediatePropagation();
        size = Math.max(4, Math.min(300, Math.round(size * (e.key === "]" ? 1.2 : 1 / 1.2))));
        range.value = String(size);
        sizeNum.textContent = String(size);
        saveNum(SIZE_KEY, size);
        overlay.redraw();
        return;
      }
      // keep the editor's own shortcuts (delete, arrows, copy...) away from the photo meanwhile
      if (!mod && e.code !== "Space") e.stopImmediatePropagation();
      else if (mod && !["=", "+", "-", "0"].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener("keydown", onKey, true);
    const offDoc = app.bus.on("doc", () => finish(false)); // undo, redo or another page: the photo is gone
    setTool("erase");
    sync();

    async function finish(keep) {
      if (finished) return;
      finished = true;
      clearTimeout(edgeTimer);
      window.removeEventListener("keydown", onKey, true);
      offDoc();
      overlay.destroy();
      bar.classList.remove("show");
      setTimeout(() => bar.remove(), 180);
      img.visible = wasVisible;
      if (!keep || (!strokes.length && !edgeOn()) || !img.canvas) {
        fc.requestRenderAll();
        resolve(false);
        return;
      }
      try {
        painting = false;
        await img.setElement(await loadElement(composite().toDataURL("image/png")));
        if (img.filters?.length) img.applyFilters();
        img.set({ data: { ...(img.data || {}), cutout: { original: originalSrc } }, dirty: true });
        fc.requestRenderAll();
        app.editor.commit("Touch up cut-out");
        app.refreshToolbar?.();
        resolve(true);
      } catch (e) {
        fc.requestRenderAll();
        toast(`Couldn't keep the change: ${e.message}`, { error: true });
        resolve(false);
      }
    }
  });
}
