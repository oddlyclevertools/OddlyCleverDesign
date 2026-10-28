// Before/after on the photo itself: the "before" picture shows left of a divider you drag across
// the photo (it follows zoom, pan, rotation and crop). Plus the shimmer shown while an edit works.
import { el, icon } from "../../ui/kit.js";
import { loadElement } from "../elements/images.js";
import { pixelToScreen, sceneToPixel } from "./mask.js";
import { createOverlay, inPixels } from "./overlay.js";
import { util } from "fabric";

let open = null;
export const closeCompare = () => open?.();

/**
 * Show the before/after slider on a photo.
 * @param {object} app
 * @param {object} img the photo (showing the "after")
 * @param {{ before: string, rect: {x:number,y:number,w:number,h:number}, title?: string, onUndo?: () => void }} opts
 *   rect: where the before picture sits in the photo's current pixels
 */
export async function showCompare(app, img, { before, rect, title = "Before and after", onUndo = null }) {
  closeCompare();
  const fc = app.editor.canvas;
  const beforeEl = await loadElement(before);
  let split = 1, dragging = false, closed = false;
  const scale = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
  const box = () => ({ x: img.cropX || 0, y: img.cropY || 0, w: img.width, h: img.height });

  const overlay = createOverlay(app, {
    interactive: true,
    cursor: "ew-resize",
    draw(ctx) {
      if (!img.canvas) return;
      const m = pixelToScreen(img, fc), b = box(), sx = b.x + b.w * split, s = scale(m);
      inPixels(ctx, m, (c) => {
        c.save();
        c.beginPath();
        c.rect(b.x, b.y, sx - b.x, b.h);
        c.clip();
        c.fillStyle = "#16121b";
        c.fillRect(b.x, b.y, b.w, b.h);
        c.drawImage(beforeEl, rect.x, rect.y, rect.w, rect.h);
        c.restore();
        c.fillStyle = "#fff";
        c.fillRect(sx - 1.5 / s, b.y, 3 / s, b.h);
      });
      const knob = util.transformPoint({ x: sx, y: box().y + box().h / 2 }, m);
      ctx.beginPath();
      ctx.arc(knob.x, knob.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,.5)";
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ff2e7e";
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(knob.x + dir * 9, knob.y);
        ctx.lineTo(knob.x + dir * 3, knob.y - 5);
        ctx.lineTo(knob.x + dir * 3, knob.y + 5);
        ctx.fill();
      }
      const tag = (text, p, align) => {
        ctx.font = "600 12px Inter, system-ui, sans-serif";
        const w = ctx.measureText(text).width + 16;
        const x = align === "left" ? p.x + 8 : p.x - w - 8;
        ctx.fillStyle = "rgba(13,10,16,.8)";
        ctx.beginPath();
        ctx.roundRect(x, p.y + 8, w, 22, 11);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(text, x + 8, p.y + 23);
      };
      const corners = [{ x: box().x, y: box().y }, { x: box().x + box().w, y: box().y }].map((p) => util.transformPoint(p, m));
      if (split > 0.12) tag("Before", corners[0], "left");
      if (split < 0.88) tag("After", corners[1], "right");
    },
    down(p) { dragging = true; setFrom(p); },
    move(p, _e, painting) { if (dragging && painting) setFrom(p); },
    up() { dragging = false; },
  });
  function setFrom(p) {
    const q = sceneToPixel(img, util.transformPoint(p, util.invertTransform(fc.viewportTransform)));
    const b = box();
    set((q.x - b.x) / b.w);
  }
  function set(v) {
    split = Math.max(0, Math.min(1, v));
    range.value = String(Math.round(split * 100));
    overlay.redraw();
  }

  const range = el("input.mg-range.mg-wide", { type: "range", min: 0, max: 100, step: 1, value: 100, "aria-label": "Before and after divider",
    on: { input: () => set(Number(range.value) / 100) } });
  const bar = el("div.mg-bar.mg-compare", { role: "toolbar", "aria-label": title, tabindex: "-1" },
    el("div.mg-row", {},
      el("span.mg-title", {}, icon("SplitSquareHorizontal", 16), title),
      el("span.mg-hint", {}, "Drag across the photo to compare."),
      range,
      onUndo ? el("button.btn.small", { type: "button", on: { click: () => { close(); onUndo(); } } }, icon("Undo2", 15), "Undo this edit") : null,
      el("button.btn.primary.small", { type: "button", on: { click: () => close() } }, icon("Check", 15), "Keep it")));
  app.shell.canvasHost.append(bar);
  requestAnimationFrame(() => bar.classList.add("show"));
  bar.focus({ preventScroll: true });

  // slide in from "all before" to the middle, so it's obvious what changed
  const t0 = performance.now();
  const intro = (t) => {
    if (closed || dragging) return;
    const k = Math.min(1, (t - t0) / 700);
    set(1 - 0.5 * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(intro);
  };
  requestAnimationFrame(intro);

  const onKey = (e) => {
    if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); e.stopImmediatePropagation(); set(split + (e.key === "ArrowLeft" ? -0.05 : 0.05)); }
  };
  window.addEventListener("keydown", onKey, true);
  const offDoc = app.bus.on("doc", () => close());
  const offSel = app.bus.on("selection", (sel) => { if (!sel.includes(img)) close(); });

  function close() {
    if (closed) return;
    closed = true;
    open = null;
    window.removeEventListener("keydown", onKey, true);
    offDoc();
    offSel();
    overlay.destroy();
    bar.classList.remove("show");
    setTimeout(() => bar.remove(), 180);
  }
  open = close;
  return { close, set };
}

/** A soft shimmer over the photo and a status pill while an edit works. Returns stop(). */
export function working(app, img, text) {
  const fc = app.editor.canvas;
  let stopped = false;
  const t0 = performance.now();
  const overlay = createOverlay(app, {
    interactive: false,
    draw(ctx) {
      if (!img.canvas) return;
      const m = pixelToScreen(img, fc);
      const b = { x: img.cropX || 0, y: img.cropY || 0, w: img.width, h: img.height };
      const t = ((performance.now() - t0) / 1400) % 1;
      inPixels(ctx, m, (c) => {
        c.beginPath();
        c.rect(b.x, b.y, b.w, b.h);
        c.clip();
        c.fillStyle = "rgba(13,10,16,.28)";
        c.fillRect(b.x, b.y, b.w, b.h);
        const x = b.x - b.w * 0.5 + t * b.w * 2;
        const g = c.createLinearGradient(x - b.w * 0.3, 0, x + b.w * 0.3, 0);
        g.addColorStop(0, "rgba(255,46,126,0)");
        g.addColorStop(0.5, "rgba(255,120,170,.35)");
        g.addColorStop(1, "rgba(143,227,255,0)");
        c.fillStyle = g;
        c.fillRect(b.x, b.y, b.w, b.h);
      });
    },
  });
  const pill = el("div.mg-working", { role: "status" }, el("span.mg-spin"), text);
  app.shell.canvasHost.append(pill);
  requestAnimationFrame(() => pill.classList.add("show"));
  const loop = () => { if (stopped) return; overlay.redraw(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return () => {
    stopped = true;
    overlay.destroy();
    pill.classList.remove("show");
    setTimeout(() => pill.remove(), 180);
  };
}
