// Arrange, palette, font pairing, animation and undo tools.
import { align, distribute, group, order, ungroup } from "../../arrange/ops.js";
import { Recorder } from "../../styles/recorder.js";
import { recolor, rememberMap } from "../../styles/recolor.js";
import { applyPairing, loadPairing } from "../../styles/pairing.js";
import { PALETTES, PAIRINGS } from "../../styles/palettes.js";
import { PAGE_PRESETS, TEXT_MOTIONS } from "../../motion/catalog.js";
import { applyPreset } from "../../motion/presets.js";
import { animOf, makePhase, pageDuration, writeAnim, writePageDuration } from "../../motion/timeline.js";
import { ToolInputError } from "./validate.js";
import { pick } from "./rules.js";
import { resolveFamily } from "./text-style.js";
import { aiSnaps, brief, editorOf, findObjects, isText, json, kindOf, step } from "./context.js";

// ---- arrange -----------------------------------------------------------------------------

const ORDER = { bring_to_front: "front", send_to_back: "back", bring_forward: "forward", send_backward: "backward" };

export async function arrange(app, inp, { signal }) {
  const ed = editorOf(app);
  const objs = findObjects(ed, inp.ids);
  const fixed = objs.find((o) => o.isBg || o.locked);
  if (fixed) throw new ToolInputError(`"${fixed.id}" is ${fixed.isBg ? "the page background" : "locked"} and can't be arranged.`);
  const a = inp.action;
  if (a.startsWith("distribute") && objs.length < 3) throw new ToolInputError("Spacing evenly needs at least 3 objects.");
  if (a === "group" && objs.length < 2) throw new ToolInputError("Grouping needs at least 2 objects.");
  if (a === "ungroup" && (objs.length !== 1 || kindOf(objs[0]) !== "group" && kindOf(objs[0]) !== "text_group")) {
    throw new ToolInputError("ungroup takes exactly one group (kind group or text_group). Charts, badges and graphics are single elements.");
  }
  const result = await step(app, a.replace(/_/g, " "), () => {
    if (ORDER[a]) { ed.select(objs); order(app, ORDER[a]); return objs; }
    if (a.startsWith("align_")) {
      const how = a.slice(6);
      const toPage = inp.relative_to === "page" || (inp.relative_to !== "selection" && objs.length === 1);
      if (toPage) for (const o of objs) { ed.select([o]); align(app, how); }
      else { ed.select(objs); align(app, how); }
      return objs;
    }
    if (a.startsWith("distribute")) { ed.select(objs); distribute(app, a.endsWith("horizontally") ? "x" : "y"); return objs; }
    if (a === "group") { ed.select(objs); group(app); return ed.selection(); }
    ed.select(objs);
    ungroup(app);
    return ed.selection();
  }, { signal });
  ed.canvas.discardActiveObject();
  ed.canvas.requestRenderAll();
  const stack = ed.objects().map((o) => o.id);
  return { text: json({ done: a, objects: result.map(brief), ...(ORDER[a] ? { layer_order_bottom_to_top: stack } : {}) }) };
}

// ---- palettes and font pairings --------------------------------------------------------------

export async function applyPalette(app, inp, { signal }) {
  const ed = editorOf(app);
  if (Boolean(inp.palette_id) === Boolean(inp.colors)) throw new ToolInputError("apply_palette: give palette_id or colors (not both).");
  const pal = inp.palette_id ? pick(PALETTES, inp.palette_id, (p) => p.id, { what: "palette", catalog: "palettes" })
    : { id: "custom", name: "Custom", mood: "", ...inp.colors };
  const changed = await step(app, `Palette ${pal.name}`, () => {
    const rec = new Recorder(ed.canvas);
    const out = recolor(app, pal, inp.variation || 0, rec);
    if (rec.size) rememberMap(app, out.map);
    return rec.size;
  }, { signal });
  return { text: changed ? json({ palette: pal.id, objects_recoloured: changed }) : "Nothing to recolour yet: add text or shapes first." };
}

export async function applyFontPairing(app, inp, { signal }) {
  const ed = editorOf(app);
  if (Boolean(inp.pairing_id) === Boolean(inp.heading || inp.body)) throw new ToolInputError("apply_font_pairing: give pairing_id, or heading and body (not both).");
  let pair;
  if (inp.pairing_id) pair = pick(PAIRINGS, inp.pairing_id, (p) => p.id, { what: "font pairing", catalog: "font_pairings" });
  else {
    if (!inp.heading || !inp.body) throw new ToolInputError("apply_font_pairing: give both heading and body.");
    pair = {
      id: "custom", name: "Custom",
      head: { family: resolveFamily(inp.heading.font), weight: inp.heading.weight || 700, style: inp.heading.italic ? "italic" : "normal" },
      body: { family: resolveFamily(inp.body.font), weight: inp.body.weight || 400 },
    };
  }
  await loadPairing(pair);
  const n = await step(app, `Fonts ${pair.name}`, () => applyPairing(app, pair, new Recorder(ed.canvas)), { signal });
  return { text: n ? json({ pairing: pair.id, heading: pair.head.family, body: pair.body.family, texts: n }) : "There's no text to restyle yet." };
}

// ---- animate --------------------------------------------------------------------------------

export async function animate(app, inp, { signal }) {
  const ed = editorOf(app);
  const perObject = ["intro", "loop", "outro", "remove", "delay"].some((k) => inp[k] !== undefined);
  if (!inp.page_preset && !perObject && inp.duration === undefined) throw new ToolInputError("animate: give page_preset, or ids with intro/loop/outro/remove, or duration.");
  if (inp.page_preset && perObject) throw new ToolInputError("animate: page_preset animates everything; don't mix it with per-object fields in one call.");
  const objs = perObject ? findObjects(ed, inp.ids || []) : [];
  if (perObject && !objs.length) throw new ToolInputError("animate: give the ids of the objects to animate.");
  if (inp.intro && TEXT_MOTIONS[inp.intro]) {
    const bad = objs.find((o) => !isText(o));
    if (bad) throw new ToolInputError(`"${inp.intro}" is a text-only intro and "${bad.id}" is a ${kindOf(bad)}. Use fade, rise, pop or wipe for it.`);
  }
  const speed = inp.speed || "medium";
  await step(app, inp.page_preset ? `Animate page (${inp.page_preset})` : "Animate", () => {
    if (inp.duration !== undefined) writePageDuration(ed, inp.duration);
    if (inp.page_preset) applyPreset(ed, pick(PAGE_PRESETS, inp.page_preset, (p) => p.id, { what: "page animation", catalog: "animations" }).id);
    for (const o of objs) {
      if (inp.remove) { writeAnim(o, null); continue; }
      const { preset: _p, ...old } = animOf(o) || {};
      const next = { ...old };
      if (inp.intro) next.in = inp.intro === "none" ? null : makePhase(inp.intro, { speed, delay: inp.delay ?? old.in?.delay ?? 0 });
      else if (inp.delay !== undefined && old.in) next.in = { ...old.in, delay: inp.delay };
      if (inp.loop) next.loop = inp.loop === "none" ? null : { type: inp.loop, speed };
      if (inp.outro) next.out = inp.outro === "none" ? null : makePhase(inp.outro, { speed });
      writeAnim(o, next);
    }
  }, { signal });
  const list = (inp.page_preset ? ed.objects() : objs).map((o) => ({ id: o.id, ...(animOf(o) ? {
    intro: animOf(o).in?.type, loop: animOf(o).loop?.type, outro: animOf(o).out?.type } : { anim: "none" }) }));
  return { text: json({ page_seconds: pageDuration(ed), objects: list, hint: "The user can press Play to preview and export MP4 or GIF from Download." }) };
}

// ---- undo -------------------------------------------------------------------------------------

export async function undo(app, inp) {
  const ed = editorOf(app);
  const h = ed.history;
  const want = inp.steps || 1;
  let done = 0, stopped = "";
  for (let i = 0; i < want; i++) {
    if (!h.canUndo) { stopped = "There is nothing more to undo."; break; }
    if (!inp.force && !aiSnaps(h).has(h.stack[h.index])) {
      stopped = "The latest change wasn't made by the AI (the user edited since, or it was before this session), so it was left alone.";
      break;
    }
    await h.undo();
    done++;
  }
  return { text: json({ undone: done, ...(stopped ? { stopped } : {}), objects: ed.objects().length }) };
}
