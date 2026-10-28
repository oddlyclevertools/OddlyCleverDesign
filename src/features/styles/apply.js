// Applying a style: hover previews (changes made through a Recorder, put back on leave) and
// one-click applies (one undo step each). Shared by the palette, pairing and brand kit cards.
import { ActiveSelection } from "fabric";
import { toast } from "../../ui/kit.js";
import { Recorder } from "./recorder.js";
import { recolor, rememberMap } from "./recolor.js";
import { applyPairing, loadPairing } from "./pairing.js";

const HOVER_MS = 140;

export function createApplier(app) {
  const ed = app.editor;
  let preview = null; // { key, rec, map }
  let timer = null;
  let hoverKey = null;
  let busy = false;

  const end = () => {
    clearTimeout(timer);
    timer = null;
    hoverKey = null;
    if (preview) {
      preview.rec.restore();
      preview = null;
    }
  };

  /** Run `fn(rec)` as a preview after a short hover. fn may be async. */
  const hover = (key, fn) => {
    if (app.view !== "editor" || busy) return;
    end();
    hoverKey = key;
    timer = setTimeout(async () => {
      try {
        const prep = await fn.prepare?.();
        if (hoverKey !== key || busy) return;
        const rec = new Recorder(ed.canvas);
        const out = fn(rec, prep);
        preview = { key, rec, out };
      } catch { /* a preview is optional: say nothing */ }
    }, HOVER_MS);
  };

  /** Apply for real: one undo step labelled `label`. */
  const apply = async (fn, label, { quiet = false } = {}) => {
    if (app.view !== "editor") return toast("Open a design first.");
    if (busy) return null;
    busy = true;
    end();
    try {
      const prep = await fn.prepare?.();
      const active = ed.canvas.getActiveObject();
      const reselect = active instanceof ActiveSelection ? active.getObjects() : null;
      if (reselect) ed.canvas.discardActiveObject();
      const rec = new Recorder(ed.canvas);
      const out = fn(rec, prep);
      if (!rec.size) {
        if (!quiet) toast("Nothing here to restyle yet. Add some text or shapes first.");
        return null;
      }
      ed.commit(label);
      app.bus.emit("objects:changed", [...rec.saved.keys()].filter((o) => !o.isPage));
      if (reselect) ed.select(reselect);
      app.refreshToolbar?.();
      return out;
    } catch (e) {
      toast(`Couldn't apply that style: ${e.message}`, { error: true });
      return null;
    } finally {
      busy = false;
    }
  };

  return { hover, leave: end, apply, end };
}

/** A palette job (for hover or apply). */
export function paletteJob(app, palette, variation = 0, { remember = false } = {}) {
  const job = (rec) => {
    const out = recolor(app, palette, variation, rec);
    if (remember) rememberMap(app, out.map);
    return out;
  };
  return job;
}

/** A font pairing job (loads the fonts first). */
export function pairingJob(app, pair) {
  const job = (rec) => applyPairing(app, pair, rec);
  job.prepare = () => loadPairing(pair);
  return job;
}
