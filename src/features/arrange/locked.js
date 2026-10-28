// Locked objects on the canvas. They can't be selected or moved, but the pointer still finds
// them (the editor keeps them evented): resting on one shows a lock badge that unlocks it in one
// click, and right-clicking one offers Unlock. A left click or drag passes through a locked
// object to whatever is under it, so locking a decoration never traps the things below it.
import { el, icon, toast } from "../../ui/kit.js";
import { isFixed } from "./geom.js";
import { lock } from "./ops.js";

const BADGE = 26;       // px, the badge button
const HIDE_DELAY = 260; // ms the badge waits after the pointer leaves, so it can be reached
const PRESS = /down|up|click/;

/** A locked object the user can unlock from the canvas (not the page or its background). */
export const isLockedTarget = (o) => Boolean(o && o.locked && !isFixed(o) && o.canvas);

/** Unlock one locked object (one undo step) and select it. */
export function unlockObject(app, obj) {
  if (!isLockedTarget(obj)) return false;
  lock(app, [obj], false);
  app.editor.select([obj]);
  toast("Unlocked. Ctrl+Z locks it again.");
  return true;
}

export function wireLocked(app) {
  const ed = app.editor, c = ed.canvas, host = app.shell.canvasHost;

  // ---- presses pass through locked objects ----------------------------------------------------
  const find = c.findTarget.bind(c);
  c.findTarget = (e) => {
    const info = find(e);
    const left = e && PRESS.test(e.type || "") && (e.button === 0 || e.button === undefined);
    if (!left || !isLockedTarget(info?.target)) return info;
    const p = c.getScenePoint(e);
    const active = c.getActiveObject();
    if (active) {
      const hit = c.searchPossibleTargets([active], p);
      if (hit.target) return { ...info, ...hit, target: active };
    }
    const below = c.searchPossibleTargets(c.getObjects().filter((o) => !o.locked && !o.isPage), p);
    return below.target ? { ...info, ...below } : info;
  };

  // ---- the lock badge ---------------------------------------------------------------------------
  let shown = null, hideTimer = 0;
  const badge = el("button.ar-lockbadge", {
    type: "button", title: "Locked: click to unlock", "aria-label": "Unlock this object", tabindex: -1,
    on: {
      click: () => { const o = shown; hide(true); unlockObject(app, o); },
      pointerenter: () => clearTimeout(hideTimer),
      pointerleave: () => hide(),
    },
  }, icon("Lock", 14));
  host.append(badge);

  function place() {
    if (!shown?.canvas) return hide(true);
    const v = c.viewportTransform;
    const r = shown.getBoundingRect();
    const x = Math.min(host.clientWidth - BADGE - 4, Math.max(4, (r.left + r.width) * v[0] + v[4] - BADGE / 2));
    const y = Math.min(host.clientHeight - BADGE - 4, Math.max(4, r.top * v[3] + v[5] - BADGE / 2));
    badge.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  function show(o) {
    clearTimeout(hideTimer);
    shown = o;
    badge.setAttribute("aria-label", `Unlock ${o.name || "this object"}`);
    place();
    badge.classList.add("show");
  }
  function hide(now = false) {
    clearTimeout(hideTimer);
    const go = () => { shown = null; badge.classList.remove("show"); };
    if (now) go(); else hideTimer = setTimeout(go, HIDE_DELAY);
  }

  const hover = ({ target, e }) => {
    if (!isLockedTarget(target) || c._currentTransform || e?.buttons) return;
    if (target !== shown || !badge.classList.contains("show")) show(target);
    else clearTimeout(hideTimer);
  };
  c.on("mouse:over", hover);
  c.on("mouse:move", hover);
  c.on("mouse:out", ({ target }) => { if (target && target === shown) hide(); });
  c.on("mouse:down", () => hide(true));
  for (const ev of ["zoom", "pan", "doc", "history", "view"]) app.bus.on(ev, () => (shown ? place() : null));

  // A double-click on a locked object says how to unlock it (once per session).
  let told = false;
  c.on("mouse:dblclick", (opt) => {
    const t = c.searchPossibleTargets(c.getObjects().filter((o) => isLockedTarget(o)), c.getScenePoint(opt.e)).target;
    if (!t || told || ed.selection().length) return;
    told = true;
    toast("That's locked. Click its lock badge, or right-click it and pick Unlock.");
  });

  return { unlock: (o) => unlockObject(app, o) };
}
