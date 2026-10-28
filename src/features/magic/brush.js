// Brush mode for Magic Eraser and Magic Edit: paint over part of a photo with a round brush and
// see it as a pink veil. Works at any zoom, pan, rotation, flip or crop, because every stroke is
// stored in the picture's own pixels. Space-drag pans, Ctrl+wheel zooms, [ and ] change the
// brush, Ctrl+Z takes back a stroke, Esc cancels. Resolves with the hole mask at the picture's
// natural size (or null when cancelled).
import { el, icon, toast } from "../../ui/kit.js";
import { canvasOf, naturalSize, pixelToScreen, sceneToPixel } from "./mask.js";
import { createOverlay, inPixels } from "./overlay.js";
import { util } from "fabric";

const PINK = "#ff2e7e";
const SIZE_KEY = "oddlyclever.magic.brush";

function savedSize() {
  try { const v = Number(localStorage.getItem(SIZE_KEY)); return v >= 4 && v <= 300 ? v : 48; } catch { return 48; }
}
function saveSize(v) { try { localStorage.setItem(SIZE_KEY, String(v)); } catch { /* storage blocked */ } }

/** How many screen pixels one picture pixel covers right now. */
const screenScale = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;

/**
 * Open brush mode on a picture.
 * @param {object} app
 * @param {object} img the photo
 * @param {{ mode: "erase"|"edit", cost: Node|string, prompt?: string }} opts
 * @returns {Promise<{ mask: HTMLCanvasElement|null, painted: boolean, prompt: string }|null>}
 */
export function brushMode(app, img, { mode = "erase", cost = "", prompt = "" } = {}) {
  return new Promise((resolve) => {
    const fc = app.editor.canvas;
    const { w, h } = naturalSize(img);
    const mask = canvasOf(w, h), tint = canvasOf(w, h);
    const mctx = mask.getContext("2d"), tctx = tint.getContext("2d");
    const strokes = [];
    let size = savedSize(), eraseBrush = false, cur = null, hover = null, finished = false;

    const drawSeg = (s, a, b) => {
      for (const [ctx, color] of [[mctx, "#fff"], [tctx, PINK]]) {
        ctx.save();
        ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
        ctx.strokeStyle = ctx.fillStyle = color;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.lineWidth = s.r * 2;
        if (!b || (a.x === b.x && a.y === b.y)) {
          ctx.beginPath();
          ctx.arc(a.x, a.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    };
    const replay = () => {
      mctx.clearRect(0, 0, w, h);
      tctx.clearRect(0, 0, w, h);
      for (const s of strokes) {
        drawSeg(s, s.pts[0]);
        for (let i = 1; i < s.pts.length; i++) drawSeg(s, s.pts[i - 1], s.pts[i]);
      }
    };
    const toPixel = (p) => sceneToPixel(img, util.transformPoint(p, util.invertTransform(fc.viewportTransform)));

    const overlay = createOverlay(app, {
      interactive: true,
      cursor: "none",
      draw(ctx) {
        const m = pixelToScreen(img, fc);
        inPixels(ctx, m, (c) => {
          c.beginPath();
          c.rect(img.cropX || 0, img.cropY || 0, img.width, img.height);
          c.clip();
          c.globalAlpha = 0.55;
          c.drawImage(tint, 0, 0);
          c.globalAlpha = 1;
          c.setLineDash([6 / screenScale(m), 5 / screenScale(m)]);
          c.lineWidth = 1.5 / screenScale(m);
          c.strokeStyle = "rgba(255,255,255,.75)";
          c.strokeRect(img.cropX || 0, img.cropY || 0, img.width, img.height);
        });
        if (hover) {
          ctx.beginPath();
          ctx.arc(hover.x, hover.y, size / 2, 0, Math.PI * 2);
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,.55)";
          ctx.stroke();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = eraseBrush ? "#8fe3ff" : "#fff";
          ctx.stroke();
          // A soft tint inside the ring (stronger while painting) and a centre dot to aim with.
          ctx.fillStyle = eraseBrush ? `rgba(143,227,255,${cur ? 0.16 : 0.08})` : `rgba(255,46,126,${cur ? 0.18 : 0.09})`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(hover.x, hover.y, 1.6, 0, Math.PI * 2);
          ctx.fillStyle = eraseBrush ? "#8fe3ff" : "#fff";
          ctx.fill();
        }
      },
      down(p) {
        const r = size / 2 / screenScale(pixelToScreen(img, fc));
        cur = { r, erase: eraseBrush, pts: [toPixel(p)] };
        strokes.push(cur);
        drawSeg(cur, cur.pts[0]);
        sync();
      },
      move(p, _e, painting) {
        hover = p;
        if (!painting || !cur) return;
        const q = toPixel(p), last = cur.pts.at(-1);
        if (Math.hypot(q.x - last.x, q.y - last.y) < cur.r * 0.15) return;
        cur.pts.push(q);
        drawSeg(cur, last, q);
      },
      up() { cur = null; sync(); },
      leave() { hover = null; },
    });

    // ---- the bar ------------------------------------------------------------------------
    const range = el("input.mg-range", { type: "range", min: 4, max: 300, step: 1, value: size, "aria-label": "Brush size",
      on: { input: () => { size = Number(range.value); sizeNum.textContent = String(size); saveSize(size); overlay.redraw(); } } });
    const sizeNum = el("span.mg-num", {}, String(size));
    const eraseBtn = el("button.mg-btn", { type: "button", title: "Erase my brush: paint to take pink away", "aria-pressed": "false",
      on: { click: () => { eraseBrush = !eraseBrush; eraseBtn.classList.toggle("on", eraseBrush); eraseBtn.setAttribute("aria-pressed", String(eraseBrush)); overlay.redraw(); } } },
    icon("Eraser", 16), el("span", {}, "Erase brush"));
    const undoBtn = el("button.mg-btn", { type: "button", title: "Take back the last stroke (Ctrl+Z)", "aria-label": "Undo stroke", on: { click: () => undoStroke() } }, icon("Undo2", 16));
    const clearBtn = el("button.mg-btn", { type: "button", title: "Clear all the pink", on: { click: () => { strokes.length = 0; replay(); sync(); overlay.redraw(); } } }, icon("RotateCcw", 16), el("span", {}, "Clear"));
    const input = mode === "edit" ? el("input.mg-prompt", { type: "text", value: prompt, maxLength: 600,
      placeholder: "What should it become? e.g. make the jacket red", "aria-label": "What should it become?" }) : null;
    const doneBtn = el("button.btn.primary.small", { type: "button", on: { click: () => done() } },
      icon(mode === "edit" ? "Sparkles" : "Eraser", 15), mode === "edit" ? "Make it" : "Erase it");
    const cancelBtn = el("button.btn.small", { type: "button", on: { click: () => finish(null) } }, "Cancel");
    const hint = el("div.mg-hint", {}, mode === "edit"
      ? "Paint over the part to change, or paint nothing to change the whole picture."
      : "Paint over what to remove. Space-drag moves around, Ctrl+wheel zooms, [ ] brush size, Esc cancels.");
    const bar = el("div.mg-bar", { tabindex: "-1", role: "toolbar", "aria-label": mode === "edit" ? "Magic edit" : "Magic eraser" },
      el("div.mg-row", {},
        el("span.mg-title", {}, icon(mode === "edit" ? "Sparkles" : "Eraser", 16), mode === "edit" ? "Magic edit" : "Magic eraser"),
        typeof cost === "string" ? el("span.mg-cost", {}, cost) : cost,
        el("label.mg-size", { title: "Brush size" }, icon("Brush", 15), range, sizeNum),
        eraseBtn, undoBtn, clearBtn),
      input ? el("div.mg-row", {}, input) : null,
      el("div.mg-row.end", {}, hint, cancelBtn, doneBtn));
    app.shell.canvasHost.append(bar);
    requestAnimationFrame(() => bar.classList.add("show"));
    (input || bar).focus({ preventScroll: true });

    function sync() {
      const any = strokes.some((s) => !s.erase);
      undoBtn.disabled = !strokes.length;
      clearBtn.disabled = !strokes.length;
      if (mode === "erase") doneBtn.disabled = !any;
    }
    function undoStroke() {
      if (!strokes.length) return;
      strokes.pop();
      replay();
      sync();
      overlay.redraw();
    }
    function done() {
      const painted = strokes.some((s) => !s.erase);
      const text = input ? input.value.trim() : "";
      if (mode === "erase" && !painted) { toast("Paint over what to remove first."); return; }
      if (mode === "edit" && !text) { toast("Type what it should become."); input.focus(); return; }
      finish({ mask: painted ? mask : null, painted, prompt: text });
    }
    const onKey = (e) => {
      const inPrompt = e.target === input;
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); finish(null); return; }
      if (e.key === "Enter" && (inPrompt || !app.isTyping?.(e))) { e.preventDefault(); e.stopImmediatePropagation(); done(); return; }
      if (inPrompt || app.isTyping?.(e)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.stopImmediatePropagation(); undoStroke(); return; }
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        e.stopImmediatePropagation();
        size = Math.max(4, Math.min(300, Math.round(size * (e.key === "]" ? 1.2 : 1 / 1.2))));
        range.value = String(size);
        sizeNum.textContent = String(size);
        saveSize(size);
        overlay.redraw();
        return;
      }
      // keep the editor's own shortcuts (delete, arrows, copy...) away from the photo while painting
      if (!e.ctrlKey && !e.metaKey && e.code !== "Space") e.stopImmediatePropagation();
      else if ((e.ctrlKey || e.metaKey) && !["=", "+", "-", "0"].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener("keydown", onKey, true);
    const offDoc = app.bus.on("doc", () => finish(null)); // undo, redo or another page: the photo is gone
    sync();

    function finish(result) {
      if (finished) return;
      finished = true;
      window.removeEventListener("keydown", onKey, true);
      offDoc();
      overlay.destroy();
      bar.classList.remove("show");
      setTimeout(() => bar.remove(), 180);
      resolve(result && img.canvas ? result : null);
    }
  });
}
