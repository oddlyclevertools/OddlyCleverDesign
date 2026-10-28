// The timeline's keyboard, CapCut style: J / K / L play backwards, pause and play; Q and W trim
// the clip to the playhead; Shift+Delete removes a clip and closes the gap; , and . step one
// frame; Alt + arrows nudge the clip a frame. The list feeds the "Keys" tooltip on the bar.
import { el, icon, popover } from "../../ui/kit.js";
import * as api from "./api.js";
import * as M from "./model.js";
import { readTimeline } from "./store.js";

export const FRAME = 1 / 30;

export const KEYS = [
  ["Space", "Play or pause"],
  ["J", "Play backwards (press again to go faster)"],
  ["K", "Pause"],
  ["L", "Play"],
  [", or ←", "Back one frame (Shift: one second)"],
  [". or →", "Forward one frame (Shift: one second)"],
  ["Q", "Trim the clip's start to the playhead"],
  ["W", "Trim the clip's end to the playhead"],
  ["S", "Split the clip at the playhead"],
  ["Delete", "Remove the clip (leaves a gap)"],
  ["Shift + Delete", "Remove the clip and close the gap"],
  ["Alt + ← →", "Nudge the clip one frame (Shift: ten frames)"],
  ["Enter", "Clip or caption settings"],
];

/** The "Keys" tooltip: every timeline key in one list. */
export function openKeys(anchor) {
  popover(anchor, el("div.vd-insp.vd-keys", {},
    el("h4.vd-insp-title", {}, icon("Keyboard", 15), "Timeline keys"),
    el("p.vd-note", {}, "Click the timeline first, then:"),
    el("dl.vd-keylist", {}, KEYS.flatMap(([k, what]) => [el("dt", {}, ...k.split(" ").map((p) => (/^(or|\+)$/.test(p) ? ` ${p} ` : el("kbd", {}, p)))), el("dd", {}, what)]))),
  { cls: "vd-pop" });
}

/** The clip Q / W / Alt+arrows work on: the selected one, else the one under the playhead. */
export function targetClip(tl, sel, t) {
  if (sel?.kind === "clip") return M.findClip(tl, sel.id);
  for (const track of ["video", "voice", "music", "sfx"]) {
    const c = M.clipsOn(tl, track).find((x) => t > x.start && t < M.clipEnd(x));
    if (c) return c;
  }
  return null;
}

/**
 * Keyboard handling for the dock. `ctx` = { app, preview, sel(), select(next), deleteSelected(),
 * splitSelected(), openSettings() }. Returns true when the key was used.
 */
export function createKeys(ctx) {
  const { app, preview } = ctx;
  let shuttle = null; // { speed, raf, last }

  function stopShuttle() {
    if (!shuttle) return;
    cancelAnimationFrame(shuttle.raf);
    shuttle = null;
  }
  // J: the playhead runs backwards (silent, frame by frame); each press doubles the speed up to 8x.
  function reverse() {
    if (preview.playing) preview.pause();
    if (shuttle) { shuttle.speed = Math.min(8, shuttle.speed * 2); return; }
    shuttle = { speed: 1, last: performance.now(), raf: 0 };
    const step = (now) => {
      if (!shuttle) return;
      const dt = (now - shuttle.last) / 1000;
      shuttle.last = now;
      const t = Math.max(0, preview.time - dt * shuttle.speed);
      preview.seek(t);
      if (t <= 0) { stopShuttle(); return; }
      shuttle.raf = requestAnimationFrame(step);
    };
    shuttle.raf = requestAnimationFrame(step);
  }
  const trim = (side) => {
    const tl = readTimeline(app), t = preview.time;
    const c = targetClip(tl, ctx.sel(), t);
    if (!c) throw new Error("Select a clip (or put the playhead over one) to trim it.");
    if (!(t > c.start && t < M.clipEnd(c))) throw new Error("Put the playhead inside the clip to trim it there.");
    ctx.select({ kind: "clip", id: c.id });
    return api.trimClip(app, side === "l" ? { id: c.id, startAt: t } : { id: c.id, endAt: t });
  };

  /** Handle a keydown on the dock. */
  return function onKey(e) {
    const k = e.key, low = k.length === 1 ? k.toLowerCase() : k;
    const plainKey = !e.ctrlKey && !e.metaKey && !e.altKey;
    const sel = ctx.sel();
    if (k !== "j" && k !== "J") stopShuttle();
    if ((k === "Delete" || k === "Backspace") && sel?.kind === "cue") {
      ctx.select(null);
      ctx.run(() => api.removeCaption(app, { index: sel.index }));
      return true;
    }
    if ((k === "Delete" || k === "Backspace") && sel?.kind === "clip") {
      if (e.shiftKey) ctx.ripple(sel.id);
      else ctx.deleteSelected();
      return true;
    }
    if (e.altKey && (k === "ArrowLeft" || k === "ArrowRight")) {
      const c = targetClip(readTimeline(app), sel, preview.time);
      if (!c) return true;
      ctx.select({ kind: "clip", id: c.id });
      ctx.run(() => api.nudgeClip(app, { id: c.id, by: (k === "ArrowLeft" ? -1 : 1) * FRAME * (e.shiftKey ? 10 : 1) }));
      return true;
    }
    if (!plainKey) return false;
    switch (low) {
      case " ": preview.toggle(); return true;
      case "j": reverse(); return true;
      case "k": preview.pause(); return true;
      case "l": if (!preview.playing) preview.play(); return true;
      case "q": ctx.run(() => trim("l")); return true;
      case "w": ctx.run(() => trim("r")); return true;
      case "s": if (sel?.kind === "clip") { ctx.splitSelected(); return true; } return false;
      case ",": case ".": case "<": case ">":
      case "ArrowLeft": case "ArrowRight": {
        const back = low === "," || low === "<" || k === "ArrowLeft";
        preview.seek(Math.max(0, preview.time + (back ? -1 : 1) * (e.shiftKey ? 1 : FRAME)));
        return true;
      }
      case "Enter": if (sel) { ctx.openSettings(); return true; } return false;
      default: return false;
    }
  };
}
