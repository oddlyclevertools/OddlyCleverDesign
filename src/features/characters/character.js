// OcCharacter: a cast member on the page. It is a real vector group (the rig's SVG loaded with
// Fabric's loadSVGFromString), but it saves only its parameters (obj.data.character) and its
// transform: the paths are rebuilt from the rig when a design, an undo step or a paste loads.
// That keeps every history snapshot small (a character is ~150 paths).
import { Group, Point, Shadow, classRegistry, loadSVGFromString, util } from "fabric";
import { castOf, characterSVG, normalize } from "./cast.js";

/** The die-cut sticker's drop shadow (as in the channel avatar). */
export const stickerShadow = () => new Shadow({ color: "rgba(0,0,0,0.5)", blur: 28, offsetX: 0, offsetY: 12 });

export class OcCharacter extends Group {
  static type = "OcCharacter";

  /** Children are rebuilt from data.character, so they are never saved. */
  toObject(props = []) {
    const { objects, layoutManager, ...rest } = super.toObject(props);
    return rest;
  }

  toDatalessObject(props = []) {
    return this.toObject(props);
  }

  /** A sticker's shadow must fall from the whole cut-out, so it always renders from its own cache. */
  needsItsOwnCache() {
    return Boolean(this.shadow) || super.needsItsOwnCache();
  }

  static async fromObject(object, abortable) {
    const { type, objects, layoutManager, width, height, ...rest } = object || {};
    const [built, hydrated] = await Promise.all([
      createCharacter(rest.data?.character),
      util.enlivenObjectEnlivables(rest, abortable),
    ]);
    built.set({ ...rest, ...hydrated });
    built.setCoords();
    return built;
  }
}
classRegistry.setClass(OcCharacter);

/** True for a character object. */
export const isCharacter = (o) => o instanceof OcCharacter;

/**
 * Build a character at scale 1, centred on the origin of its own SVG space.
 * `_chFeet` is where the figure's feet point sits in the group's local (centre-based) space.
 * @param {object} params see normalize()
 * @returns {Promise<OcCharacter>}
 */
export async function createCharacter(params) {
  const p = normalize(params);
  const { svg, box } = characterSVG(p);
  const { objects } = await loadSVGFromString(svg);
  const kids = objects.filter(Boolean);
  if (!kids.length) throw new Error("This character couldn't be drawn.");
  const g = new OcCharacter(kids, { objectCaching: p.sticker, subTargetCheck: false, interactive: false });
  const c = g.getCenterPoint();
  g._chFeet = { x: -box.x - c.x, y: -box.y - c.y };
  g.set({ data: { character: p }, shadow: p.sticker ? stickerShadow() : null });
  return g;
}

/** The head centre in the group's local space (it stays put when the character changes). */
export function headLocal(g) {
  const p = normalize(g.data?.character);
  const f = g._chFeet || { x: 0, y: 0 };
  return new Point(f.x, f.y + castOf(p.who).headY);
}

/** Page point of a local point of a top-level object. */
export const toPagePoint = (g, local) => util.transformPoint(local, g.calcTransformMatrix());

/** Move `g` (keeping its scale, angle and flips) so that its local point `local` lands on page point `at`. */
export function pinLocalTo(g, local, at) {
  g.setPositionByOrigin(new Point(0, 0), "center", "center");
  const off = util.transformPoint(local, g.calcTransformMatrix());
  g.setPositionByOrigin(new Point(at.x - off.x, at.y - off.y), "center", "center");
  g.setCoords();
}

/** A good default scale for a page: full body ~70% of the page height, a head ~half. */
export function fitScale(g, W, H, head) {
  const k = head ? 0.5 : 0.72;
  return Math.min((k * H) / g.height, (0.8 * W) / g.width);
}

/**
 * Make a character for a template or a drop: feet (or head centre for head-only) at `at`,
 * `height` page px tall.
 */
export async function makePlaced(params, { at, height, by = "feet" }) {
  const g = await createCharacter(params);
  const k = height / g.height;
  g.set({ scaleX: k, scaleY: k });
  const local = by === "head" ? headLocal(g) : by === "center" ? new Point(0, 0) : new Point(g._chFeet.x, g._chFeet.y);
  pinLocalTo(g, local, at);
  g.set("name", castOf(g.data.character.who).name);
  return g;
}

/** Add a character to the open design (centred, or centred on a drop point). */
export async function addCharacter(app, params, at = null) {
  const ed = app.editor;
  const g = await createCharacter(params);
  const k = fitScale(g, ed.width, ed.height, g.data.character.head);
  g.set({ scaleX: k, scaleY: k });
  if (at) pinLocalTo(g, new Point(0, 0), at);
  ed.add(g, { center: !at, name: castOf(g.data.character.who).name });
  return g;
}

const busy = new Set();
const KEEP = ["scaleX", "scaleY", "angle", "flipX", "flipY", "skewX", "skewY", "opacity", "visible", "id",
  "locked", "globalCompositeOperation", "clipPath", "originX", "originY"];

/**
 * Change a selected character's parameters. It's rebuilt in place: same head position, size,
 * angle, flips and layer, other feature data kept. One undo step.
 */
export async function changeCharacter(app, obj, patch, label = "Change character") {
  if (!isCharacter(obj) || obj.group || busy.has(obj)) return null;
  const ed = app.editor, c = ed.canvas;
  busy.add(obj);
  try {
    const before = normalize(obj.data?.character);
    const params = normalize({ ...before, ...patch });
    const next = await createCharacter(params);
    const idx = c.getObjects().indexOf(obj);
    if (idx < 0) return null; // deleted (or undone) while we were building
    const anchor = toPagePoint(obj, headLocal(obj));
    for (const k of KEEP) if (obj[k] !== undefined) next.set(k, obj[k]);
    // The sticker owns its shadow; a shadow the user set themselves stays.
    const shadow = params.sticker ? stickerShadow() : before.sticker ? null : obj.shadow;
    const wasDefaultName = !obj.name || obj.name === castOf(before.who).name;
    next.set({
      shadow,
      data: { ...obj.data, character: params },
      name: wasDefaultName ? castOf(params.who).name : obj.name,
    });
    pinLocalTo(next, headLocal(next), anchor);
    const wasActive = ed.selection().includes(obj);
    c.discardActiveObject();
    c.remove(obj);
    c.insertAt(idx, next);
    if (next.locked) ed._applyLock?.(next);
    if (wasActive && !next.locked) c.setActiveObject(next);
    c.requestRenderAll();
    ed.commit(label);
    app.bus.emit("objects:changed", [next]);
    return next;
  } finally {
    busy.delete(obj);
  }
}
