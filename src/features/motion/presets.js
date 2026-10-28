// Applying animations: to the selection, to the whole page (one-click presets), and removing them.
// Every change replaces obj.data.anim (never mutates it) and is committed as one undo step.
import { FabricImage, Group } from "fabric";
import { LOOPS, PAGE_PRESETS, isTextType } from "./catalog.js";
import { animOf, introEnd, isText, makePhase, pageDuration, writeAnim } from "./timeline.js";

export function kindOf(obj) {
  if (obj.isBg) return "bg";
  if (isText(obj)) return "text";
  if (obj instanceof FabricImage || obj instanceof Group) return "image";
  return "shape";
}

/** Objects a page preset animates (bottom to top). */
const animatable = (editor) => editor.objects().filter((o) => !o.data?.guide && o.visible !== false);

/**
 * The animations a page preset gives every object, without writing them.
 * @returns {Map<object, object|null>}
 */
export function presetPlan(editor, presetId) {
  const preset = PAGE_PRESETS.find((p) => p.id === presetId);
  const plan = new Map();
  if (!preset) return plan;
  const objs = animatable(editor);
  const D = pageDuration(editor);
  const movers = objs.filter((o) => !o.isBg).length;
  const stagger = movers > 1 ? Math.min(preset.stagger, Math.max(0.04, (D * 0.4 - 0.1) / (movers - 1))) : 0;
  let i = 0, images = 0;
  for (const o of objs) {
    const kind = kindOf(o);
    const pick = preset.pick(kind, kind === "image" ? images++ : 0);
    if (!pick) {
      plan.set(o, null);
      continue;
    }
    const delay = kind === "bg" ? 0 : Math.round((0.1 + i++ * stagger) * 100) / 100;
    const inType = pick.in && (isTextType(pick.in) && kind !== "text" ? null : pick.in);
    plan.set(o, {
      in: inType ? makePhase(inType, { speed: preset.speed, delay }) : null,
      out: pick.out ? makePhase(pick.out, { speed: "fast" }) : null,
      loop: pick.loop && LOOPS[pick.loop] ? { type: pick.loop, speed: "medium" } : null,
      preset: preset.id,
    });
  }
  return plan;
}

export function applyPreset(editor, presetId) {
  const plan = presetPlan(editor, presetId);
  for (const [o, anim] of plan) writeAnim(o, anim);
  editor.canvas.requestRenderAll();
  editor.commit("Animate page");
}

/** The phase spec a tile click/hover would give an object (keeps its other phases). */
export function withPhase(obj, phase, type, { speed } = {}) {
  const old = animOf(obj) || {};
  const prev = old[phase];
  const sp = speed || prev?.speed || "medium";
  let next;
  if (!type) next = null;
  else if (phase === "loop") next = { type, speed: sp };
  else next = makePhase(type, { speed: sp, delay: phase === "in" ? prev?.delay || 0 : 0 });
  const { preset: _p, ...rest } = old;
  return { ...rest, [phase]: next };
}

export function applyPhase(editor, objs, phase, type) {
  for (const o of objs) writeAnim(o, withPhase(o, phase, type));
  editor.canvas.requestRenderAll();
  editor.commit(type ? "Animate" : "Remove animation");
}

/** Change timing fields of one phase on several objects. */
export function setTiming(editor, objs, phase, fields, { merge = false } = {}) {
  for (const o of objs) {
    const old = animOf(o);
    if (!old?.[phase]) continue;
    writeAnim(o, { ...old, [phase]: { ...old[phase], ...fields } });
  }
  editor.commit("Animation timing", { merge });
}

export function removeAnimations(editor, objs) {
  const list = objs.filter((o) => animOf(o));
  if (!list.length) return false;
  for (const o of list) writeAnim(o, null);
  editor.canvas.requestRenderAll();
  editor.commit("Remove animation");
  return true;
}

/** How long a preview of these objects' intros needs. */
export function previewLength(anims) {
  return Math.max(0.6, ...anims.map((a) => (a ? introEnd(a) : 0))) + 0.6;
}
