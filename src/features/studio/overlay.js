// The safe-zone overlay and the "Show me" flash, painted on the editor's screen canvas after
// each render. Export renders use their own canvas context, so nothing here reaches a file.
import { autoKind, drawFlash, drawZones, zonesFor } from "./zones.js";

const PREF_KEY = "oc-studio-zones";
const FLASH_MS = 1600;

function readPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
    return { on: Boolean(p.on), kind: typeof p.kind === "string" ? p.kind : "auto" };
  } catch {
    return { on: false, kind: "auto" };
  }
}

export function createOverlay(app) {
  const ed = app.editor;
  let prefs = readPrefs();
  let flash = null; // { rect, start }
  const listeners = new Set();

  const save = () => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* private mode: keep it in memory */ }
  };

  /** The zone kind in use for the open design (auto resolves by page size). */
  const kind = () => (prefs.kind === "auto" ? autoKind(ed.width, ed.height) : prefs.kind);
  const zones = () => zonesFor(kind(), ed.width, ed.height);

  ed.canvas.on("after:render", ({ ctx }) => {
    if (ctx !== ed.canvas.getContext()) return; // export and top-layer renders: never draw
    const vpt = ed.canvas.viewportTransform;
    if (prefs.on && app.view === "editor") {
      const set = zones();
      if (set) drawZones(ctx, set, vpt);
    }
    if (flash) {
      const t = (performance.now() - flash.start) / FLASH_MS;
      if (t >= 1) flash = null;
      else {
        drawFlash(ctx, flash.rect, vpt, t);
        requestAnimationFrame(() => ed.canvas.requestRenderAll());
      }
    }
  });

  const changed = () => {
    ed.canvas.requestRenderAll();
    for (const fn of listeners) fn(prefs);
  };

  return {
    get on() { return prefs.on; },
    get kindPref() { return prefs.kind; },
    kind,
    zones,
    setOn(on) { prefs = { ...prefs, on: Boolean(on) }; save(); changed(); },
    toggle() { this.setOn(!prefs.on); },
    setKind(k) { prefs = { ...prefs, kind: k }; save(); changed(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    flash(rect) {
      flash = { rect, start: performance.now() };
      ed.canvas.requestRenderAll();
    },
  };
}
