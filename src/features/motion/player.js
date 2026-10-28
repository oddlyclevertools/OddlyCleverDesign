// Preview playback in the editor at the display's frame rate (requestAnimationFrame).
// It changes the objects' real visual properties for the duration of the preview only:
// nothing is recorded in the history, autosave sees the resting design, and stop() puts
// every property back exactly as it was.
import { el } from "../../ui/kit.js";
import { applyState, captureBase, restoreBase } from "./render.js";
import { animOf, pageDuration, stateAt } from "./timeline.js";

/**
 * @param {object} app
 * @param {(playing: boolean, mode: string|null) => void} onChange
 */
export function createPlayer(app, onChange) {
  const ed = app.editor;
  let run = null; // { entries, mode, raf, t0, from, to, loop, lastT, cleanup[] }

  function frameAt(t) {
    if (!run) return;
    run.lastT = t;
    const env = { duration: run.duration, pw: run.pw, ph: run.ph };
    for (const e of run.entries) {
      applyState(e.obj, e.base, stateAt(e.obj, t, { ...env, anim: e.anim, geo: e.base.geo }));
    }
    run.onFrame?.(t);
    ed.canvas.renderAll();
  }

  function tick(now) {
    if (!run) return;
    let t = run.from + (now - run.t0) / 1000;
    if (t > run.to) {
      if (!run.loop) {
        stop();
        return;
      }
      run.t0 = now;
      t = run.from;
    }
    frameAt(t);
    run.raf = requestAnimationFrame(tick);
  }

  /**
   * Start a preview.
   * @param {{ mode?: "page"|"hover", objects?: object[], anim?: (obj) => object|null,
   *           from?: number, to?: number, loop?: boolean }} opts
   */
  function play({ mode = "page", objects, anim, from = 0, to, loop = false } = {}) {
    stop();
    if (app.view !== "editor") return false;
    const active = ed.canvas.getActiveObject();
    if (active?.isEditing) active.exitEditing();
    const duration = pageDuration(ed);
    const pw = ed.width, ph = ed.height;
    const list = (objects || ed.objects()).map((obj) => ({ obj, anim: anim ? anim(obj) : animOf(obj) }))
      .filter((e) => e.anim);
    if (!list.length) return false;
    const cleanup = [];
    if (mode === "page") {
      const selected = ed.selection();
      ed.canvas.discardActiveObject();
      const prevSel = ed.canvas.selection;
      ed.canvas.selection = false;
      const shield = el("div.mo-shield", { title: "Playing. Click to stop.", on: { pointerdown: (e) => { e.preventDefault(); stop(); } } });
      const bar = el("div.mo-scrub", {}, el("i"));
      const clock = el("span.mo-clock");
      shield.append(bar, clock);
      ed.host.append(shield);
      const keys = (e) => {
        if (["Alt", "Control", "Shift", "Meta"].includes(e.key)) return;
        if (e.key === "Escape" || e.key === " " || (e.altKey && e.key.toLowerCase() === "p")) {
          e.preventDefault();
          e.stopPropagation();
        }
        stop();
      };
      window.addEventListener("keydown", keys, true);
      cleanup.push(() => {
        window.removeEventListener("keydown", keys, true);
        shield.remove();
        ed.canvas.selection = prevSel;
        ed.select(selected.filter((o) => ed.canvas.getObjects().includes(o)));
      });
      cleanup.onFrame = (t) => {
        bar.firstChild.style.width = `${Math.min(100, (t / duration) * 100)}%`;
        clock.textContent = `${t.toFixed(1)} / ${duration} s`;
      };
    } else if (active) {
      const saved = { hasControls: active.hasControls, hasBorders: active.hasBorders };
      active.hasControls = false;
      active.hasBorders = false;
      cleanup.push(() => Object.assign(active, saved));
    }
    const entries = list.map((e) => ({ ...e, base: captureBase(e.obj, pw, ph) }));
    run = {
      entries, mode, duration, pw, ph, from, to: to ?? duration, loop, cleanup, onFrame: cleanup.onFrame,
      t0: performance.now(), lastT: from, raf: 0,
    };
    frameAt(from);
    run.raf = requestAnimationFrame(tick);
    onChange?.(true, mode);
    return true;
  }

  function stop() {
    if (!run) return;
    const r = run;
    run = null;
    cancelAnimationFrame(r.raf);
    for (const e of r.entries) restoreBase(e.obj, e.base);
    for (const fn of r.cleanup) fn();
    ed.canvas.requestRenderAll();
    onChange?.(false, null);
  }

  /** Run fn with the design at rest (for saving and thumbnails while a preview plays). */
  function atRest(fn) {
    if (!run) return fn();
    for (const e of run.entries) restoreBase(e.obj, e.base);
    try {
      return fn();
    } finally {
      if (run) frameAt(run.lastT);
    }
  }

  return {
    play, stop, atRest,
    get playing() { return Boolean(run); },
    get mode() { return run?.mode || null; },
  };
}
