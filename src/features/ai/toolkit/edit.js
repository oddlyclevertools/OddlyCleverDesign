// Editing tools: update_objects, duplicate_objects and delete_objects. Each call is one undo step.
import { util } from "fabric";
import { newId } from "../../../core/editor.js";
import { sanitizeObjects } from "../../../core/sanitize.js";
import { LOOKS } from "../../characters/cast.js";
import { changeCharacter } from "../../characters/character.js";
import { updateChart } from "../../elements/charts.js";
import { rebuildBadge } from "../../elements/badges.js";
import { groupColors, replaceGroupColor } from "../../elements/vector.js";
import { setLeakColor } from "../../elements/decor.js";
import { refitGroups } from "../../styles/recorder.js";
import { ToolInputError } from "./validate.js";
import { chartPatch } from "./elements.js";
import { styleText } from "./text-style.js";
import {
  afterScale, brief, collisionNote, editorOf, findObjects, gradientFill, isCharacter, isText, json, keepOnPage, kindOf, moveTo, overlapWarning, resizeTo, step,
} from "./context.js";

const CHARACTER_KEYS = ["who", "expression", "facing", "look", "head_only", "sticker"];
const TEXT_KEYS = ["font", "font_size", "weight", "italic", "align", "line_height", "letter_spacing", "uppercase", "effect", "remove_effects", "curve"];
const FREE_KEYS = ["id", "locked", "name", "visible"]; // allowed on a locked object
const has = (ch, keys) => keys.some((k) => ch[k] !== undefined);

function guard(o, ch) {
  const kind = kindOf(o);
  const busy = Object.keys(ch).filter((k) => !FREE_KEYS.includes(k));
  if (o.isBg && busy.some((k) => k !== "opacity")) throw new ToolInputError(`"${o.id}" is the page background. Use set_background to change it.`);
  if (o.locked && ch.locked !== false && busy.length) {
    throw new ToolInputError(`"${o.id}" (${o.name}) is locked, so ${busy.join(", ")} can't change. Add locked: false to the change only if the user wants it unlocked.`);
  }
  if (has(ch, CHARACTER_KEYS) && !isCharacter(o)) throw new ToolInputError(`"${o.id}" is a ${kind}; ${CHARACTER_KEYS.filter((k) => ch[k] !== undefined).join(", ")} only work on characters.`);
  if (isCharacter(o) && has(ch, ["fill", "gradient", "stroke", "recolor", "color"])) throw new ToolInputError(`"${o.id}" is a character: the cast keeps its own colours. Change expression, facing or look instead.`);
  const texty = isText(o) || kind === "text_group" || kind === "badge";
  if (has(ch, TEXT_KEYS) && !texty) throw new ToolInputError(`"${o.id}" is a ${kind}; ${TEXT_KEYS.filter((k) => ch[k] !== undefined).join(", ")} only work on text.`);
  if (ch.text !== undefined && !texty) throw new ToolInputError(`"${o.id}" is a ${kind} and has no words. Use add_text for new words.`);
  if (ch.chart !== undefined && kind !== "chart") throw new ToolInputError(`"${o.id}" is a ${kind}, not a chart.`);
  if (ch.radius !== undefined && !(o.type === "rect" && o.data?.kind === "shape")) throw new ToolInputError(`"${o.id}": radius only works on rectangle shapes.`);
}

/** Rebuilds that replace the object (character, chart, badge words). Returns the new object. */
async function rebuild(app, o, ch) {
  let obj = o;
  if (has(ch, CHARACTER_KEYS)) {
    const patch = {};
    if (ch.who !== undefined) patch.who = ch.who;
    if (ch.expression !== undefined) patch.expr = ch.expression;
    if (ch.facing !== undefined) patch.dir = ch.facing === "left" ? -1 : 1;
    if (ch.look !== undefined) patch.look = LOOKS.find((l) => l.id === ch.look).look;
    if (ch.head_only !== undefined) patch.head = ch.head_only;
    if (ch.sticker !== undefined) patch.sticker = ch.sticker;
    obj = (await changeCharacter(app, obj, patch, "Change character")) || obj;
  }
  if (ch.chart !== undefined) obj = await updateChart(app, obj, chartPatch(ch.chart, obj.data.chart));
  if (kindOf(obj) === "badge" && (ch.text !== undefined || ch.uppercase)) {
    const words = ch.text ?? obj.getObjects().find(isText)?.text ?? "";
    obj = await rebuildBadge(app, obj, { text: ch.uppercase ? words.toUpperCase() : words });
  }
  return obj;
}

/** Words and text style, on a text or on the texts inside a text group or badge. */
async function restyle(o, ch) {
  const texts = isText(o) ? [o] : o.getObjects().filter(isText);
  if (ch.text !== undefined && !isText(o) && kindOf(o) !== "badge") {
    if (texts.length !== 1) throw new ToolInputError(`"${o.id}" holds ${texts.length} texts. Ungroup it with arrange (action "ungroup"), then change each text by its own id.`);
  }
  for (const t of texts) {
    if (ch.text !== undefined && kindOf(o) !== "badge") t.set("text", ch.uppercase ? ch.text.toUpperCase() : ch.text);
    else if (ch.uppercase) t.set("text", t.text.toUpperCase());
    await styleText(t, ch.fill !== undefined && ch.color === undefined ? { ...ch, color: ch.fill } : ch);
  }
  if (!isText(o)) refitGroups(texts);
}

function paint(o, ch) {
  const kind = kindOf(o);
  const isGroup = Boolean(o._objects) && !isText(o);
  const color = ch.fill ?? ch.color;
  if (ch.recolor) {
    const before = isGroup ? groupColors(o) : [o.fill, o.stroke].filter((c) => typeof c === "string").map((c) => c.toLowerCase());
    if (!before.includes(ch.recolor.from.toLowerCase())) throw new ToolInputError(`"${o.id}" doesn't use ${ch.recolor.from}. Its colours: ${before.join(", ") || "none"}.`);
    if (isGroup) replaceGroupColor(o, ch.recolor.from, ch.recolor.to);
    else o.set(o.fill?.toLowerCase?.() === ch.recolor.from.toLowerCase() ? { fill: ch.recolor.to } : { stroke: ch.recolor.to });
  }
  if (isText(o) || kind === "text_group" || kind === "badge") return; // text colour is set by restyle
  if (kind === "line") {
    if (color) o.set("stroke", color);
    if (ch.stroke) o.set("stroke", ch.stroke);
    if (ch.stroke_width !== undefined) o.set("strokeWidth", Math.max(1, ch.stroke_width));
    return;
  }
  if (ch.gradient) {
    if (isGroup) throw new ToolInputError(`"${o.id}" is a ${kind}: gradients work on shapes and text. Use fill or recolor.`);
    o.set("fill", gradientFill(ch.gradient).fill);
  } else if (color) {
    if (o.data?.leak) setLeakColor(o, color);
    else if (isGroup) {
      const main = groupColors(o).find((c) => c !== "#16121b" && c !== "#ffffff" && c !== "#1b1b1f") || groupColors(o)[0];
      if (main) replaceGroupColor(o, main, color);
    } else o.set("fill", color);
  }
  if (ch.stroke !== undefined || ch.stroke_width !== undefined) {
    if (isGroup) throw new ToolInputError(`"${o.id}" is a ${kind}: borders work on shapes.`);
    o.set({ stroke: ch.stroke ?? (o.stroke || "#16121b"), strokeWidth: ch.stroke_width ?? (o.strokeWidth || 8), strokeUniform: true });
  }
  if (ch.radius !== undefined) {
    o.set("data", { ...o.data, radius: ch.radius });
    afterScale(o);
  }
  o.dirty = true;
}

const MOVES_OR_GROWS = ["x", "y", "cx", "cy", "w", "h", "angle", "text", "font_size", "font", "letter_spacing", "line_height", "effect", "flip_x", "flip_y"];
const fixes = new WeakMap();

async function applyChange(app, ed, o, ch) {
  guard(o, ch);
  if (ch.locked === false && o.locked) { o.set("locked", false); ed._applyLock(o); }
  let obj = await rebuild(app, o, ch);
  if (isText(obj) || ["text_group", "badge"].includes(kindOf(obj))) await restyle(obj, ch);
  paint(obj, ch);
  if (ch.flip_x !== undefined) obj.set("flipX", ch.flip_x);
  if (ch.flip_y !== undefined) obj.set("flipY", ch.flip_y);
  if (ch.opacity !== undefined) obj.set("opacity", ch.opacity);
  if (ch.visible !== undefined) obj.set("visible", ch.visible);
  if (ch.name) obj.set({ name: ch.name, data: { ...obj.data, keepName: true } });
  if (ch.angle !== undefined) obj.rotate(ch.angle);
  resizeTo(obj, ch);
  moveTo(obj, ch);
  // Only re-check the border when this change could move or grow it, so a recolour never
  // drags a deliberately bled object back onto the page.
  if (MOVES_OR_GROWS.some((k) => ch[k] !== undefined)) {
    const fix = keepOnPage(ed, obj, ch);
    if (fix) fixes.set(obj, fix);
  }
  if (ch.locked === true) { obj.set("locked", true); ed._applyLock(obj); }
  obj.setCoords();
  return obj;
}

export async function updateObjects(app, inp, { signal }) {
  const ed = editorOf(app);
  const targets = findObjects(ed, inp.changes.map((c) => c.id));
  const dupe = inp.changes.map((c) => c.id).find((id, i, a) => a.indexOf(id) !== i);
  if (dupe) throw new ToolInputError(`"${dupe}" appears twice in changes. Put all its fields in one entry.`);
  inp.changes.forEach((ch, i) => guard(targets[i], ch)); // fail before anything changes
  const selected = ed.selection().map((o) => o.id);
  const label = inp.changes.length === 1 ? `Edit ${targets[0].name || kindOf(targets[0])}` : `Edit ${inp.changes.length} objects`;
  const done = await step(app, label, async () => {
    ed.canvas.discardActiveObject();
    const out = [];
    for (const [i, ch] of inp.changes.entries()) out.push(await applyChange(app, ed, targets[i], ch));
    ed.canvas.discardActiveObject();
    return out;
  }, { signal });
  ed.select(ed.objects().filter((o) => selected.includes(o.id)));
  const notes = done.map((o, i) => {
    const moved = MOVES_OR_GROWS.some((k) => inp.changes[i][k] !== undefined);
    const n = [fixes.get(o) || overlapWarning(ed, o), moved && collisionNote(ed, o)].filter(Boolean).join(" ");
    return n && `${o.id}: ${n}`;
  }).filter(Boolean);
  return { text: json({ updated: done.map(brief), page: { w: ed.width, h: ed.height }, ...(notes.length ? { notes } : {}) }) };
}

function reId(o) {
  o.set("id", newId());
  o._objects?.forEach(reId);
}

export async function duplicateObjects(app, inp, { signal }) {
  const ed = editorOf(app);
  const objs = findObjects(ed, inp.ids);
  const bg = objs.find((o) => o.isBg);
  if (bg) throw new ToolInputError(`"${bg.id}" is the page background and can't be copied.`);
  const dx = inp.dx ?? 30, dy = inp.dy ?? 30;
  const all = ed.canvas.getObjects();
  const ordered = [...objs].sort((a, b) => all.indexOf(a) - all.indexOf(b));
  const copies = await util.enlivenObjects(sanitizeObjects(ordered.map((o) => o.toObject())).objects);
  const made = await step(app, `Duplicate ${copies.length}`, () => {
    for (const c of copies) {
      reId(c);
      c.set({ left: c.left + dx, top: c.top + dy, locked: false });
      ed._applyLock(c);
      ed.canvas.add(c);
      c.setCoords();
    }
    return copies;
  }, { signal });
  return { text: json({ copies: made.map(brief) }) };
}

export async function deleteObjects(app, inp, { signal }) {
  const ed = editorOf(app);
  const objs = findObjects(ed, inp.ids);
  const locked = objs.find((o) => o.locked && !o.isBg);
  if (locked) throw new ToolInputError(`"${locked.id}" (${locked.name}) is locked. Unlock it with update_objects locked: false first, only if the user wants it gone.`);
  const names = objs.map((o) => `${o.id} (${o.name || kindOf(o)})`);
  await step(app, objs.length === 1 ? `Delete ${objs[0].name || kindOf(objs[0])}` : `Delete ${objs.length} objects`, () => {
    ed.canvas.discardActiveObject();
    ed.canvas.remove(...objs);
  }, { signal });
  return { text: json({ deleted: names, left: ed.objects().length }) };
}
