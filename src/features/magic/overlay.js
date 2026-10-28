// A drawing layer over the design canvas for the magic modes (brush, expand preview, compare,
// "working" shimmer). It follows zoom and pan (it redraws after every canvas render), passes the
// mouse wheel through to the editor (zoom and scroll keep working) and pans with Space-drag or
// the middle button, so the pointer handlers only ever see real painting.
const BODY_CLASS = "mg-active";

/**
 * @param {object} app
 * @param {{ draw(ctx: CanvasRenderingContext2D), interactive?: boolean, cursor?: string,
 *   down?(p, e), move?(p, e), up?(p, e), leave?() }} h  p = {x, y} in canvas (viewport) pixels
 * @returns {{ el: HTMLCanvasElement, redraw(): void, destroy(): void }}
 */
export function createOverlay(app, h) {
  const fc = app.editor.canvas;
  const host = fc.wrapperEl || fc.upperCanvasEl.parentNode;
  const cv = document.createElement("canvas");
  cv.className = "mg-overlay";
  cv.style.pointerEvents = h.interactive ? "auto" : "none";
  if (h.cursor) cv.style.cursor = h.cursor;
  host.append(cv);
  if (h.interactive) document.body.classList.add(BODY_CLASS);
  const ctx = cv.getContext("2d");
  let raf = 0, dead = false;

  const size = () => {
    const dpr = window.devicePixelRatio || 1;
    const w = fc.width, hh = fc.height;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(hh * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${hh}px`;
    }
    return dpr;
  };
  const paint = () => {
    raf = 0;
    if (dead) return;
    const dpr = size();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    try { h.draw(ctx); } finally { ctx.restore(); }
  };
  const redraw = () => { if (!raf && !dead) raf = requestAnimationFrame(paint); };
  fc.on("after:render", redraw);

  const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  let space = false, pan = null, painting = false;
  const onKey = (e) => {
    if (e.code !== "Space" || app.isTyping?.(e)) return;
    space = e.type === "keydown";
    cv.style.cursor = space ? "grab" : (h.cursor || "");
  };
  const down = (e) => {
    if (space || e.button === 1) {
      pan = { x: e.clientX, y: e.clientY };
      cv.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;
    painting = true;
    cv.setPointerCapture(e.pointerId);
    h.down?.(pt(e), e);
    redraw();
  };
  const move = (e) => {
    if (pan) {
      const v = fc.viewportTransform.slice();
      v[4] += e.clientX - pan.x;
      v[5] += e.clientY - pan.y;
      pan = { x: e.clientX, y: e.clientY };
      fc.setViewportTransform(v);
      app.editor.fitMode = false;
      app.bus.emit("pan");
      return;
    }
    h.move?.(pt(e), e, painting);
    redraw();
  };
  const up = (e) => {
    if (pan) { pan = null; return; }
    if (!painting) return;
    painting = false;
    h.up?.(pt(e), e);
    redraw();
  };
  const leave = () => { h.leave?.(); redraw(); };
  // Wheel: hand it to the editor's own zoom/scroll on the canvas underneath.
  const wheel = (e) => {
    e.preventDefault();
    fc.upperCanvasEl.dispatchEvent(new WheelEvent("wheel", {
      deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
      clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, bubbles: true, cancelable: true,
    }));
  };
  if (h.interactive) {
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("pointerleave", leave);
    cv.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
  }
  const onResize = () => redraw();
  window.addEventListener("resize", onResize);
  redraw();

  return {
    el: cv,
    redraw,
    destroy() {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(raf);
      fc.off("after:render", redraw);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("resize", onResize);
      cv.remove();
      if (h.interactive && !document.querySelector(".mg-overlay[style*='pointer-events: auto']")) document.body.classList.remove(BODY_CLASS);
    },
  };
}

/** Draw `fn` in the picture's own pixel space (for the given screen matrix). */
export function inPixels(ctx, m, fn) {
  ctx.save();
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  fn(ctx);
  ctx.restore();
}
