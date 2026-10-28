// Building tools: new_design, apply_template, set_background, add_text, add_shape, add_line,
// add_element and add_character. Each change is one "AI: ..." undo step (see step()).
import { SIZES } from "../../../core/sizes.js";
import { TEMPLATES } from "../../templates/registry.js";
import { applyTemplate } from "../../templates/engine.js";
import { PRESETS } from "../../text/presets.js";
import { makeText, pageUnit, fitWidth } from "../../text/helpers.js";
import { createShape, SHAPES } from "../../elements/shapes.js";
import { OcLine } from "../../elements/lines.js";
import { SCENES } from "../../elements/scenes.js";
import { applyScene } from "../../elements/scene-apply.js";
import { pageIsDark, toFabricFill } from "../../elements/fill.js";
import { CAST, LOOKS } from "../../characters/cast.js";
import { createCharacter, fitScale } from "../../characters/character.js";
import { ToolInputError } from "./validate.js";
import { pick } from "./rules.js";
import { mainPart } from "./assets.js";
import { buildElement } from "./elements.js";
import { brief, collisionNote, editorOf, gradientFill, json, overlapWarning, place, step } from "./context.js";
import { faceFor, hugWidth, resolveFamily, styleText } from "./text-style.js";

/** An add_* result: the new object's box, the page size, and any border fix or warning. */
const added = (ed, o, extra = {}, fix = "") => {
  const note = [fix || overlapWarning(ed, o), collisionNote(ed, o)].filter(Boolean).join(" ");
  return { text: json({ added: brief(o), page: { w: ed.width, h: ed.height }, ...extra, ...(note ? { note } : {}) }) };
};

// ---- new_design / apply_template --------------------------------------------------------

async function waitForEditor(app, oldId, ms = 15000) {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    if (app.view === "editor" && app.project && app.project.id !== oldId && !app.editor.history.busy) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("The new design didn't open in time. Ask the user to check the app.");
}

export async function newDesign(app, inp) {
  if (inp.size && (inp.width || inp.height)) throw new ToolInputError("new_design: give a size preset or width and height, not both.");
  if ((inp.width === undefined) !== (inp.height === undefined)) throw new ToolInputError("new_design: give both width and height.");
  const tpl = inp.template ? pick(TEMPLATES, inp.template, (t) => t.id, { what: "template", catalog: "templates" }) : null;
  let size = inp.width ? { w: inp.width, h: inp.height } : inp.size || (tpl ? tpl.size : "yt-thumb");
  if (typeof size === "string" && !tpl) size = pick(SIZES, size, (s) => s.id, { what: "size preset", catalog: "sizes" }).id;
  const oldId = app.project?.id || null;
  const background = inp.background;
  await app.newDesign({
    size,
    name: inp.name || tpl?.name || "Untitled design",
    template: tpl || background ? async (a) => {
      if (tpl) await applyTemplate(a.editor, tpl, { record: false });
      if (background) {
        a.editor.page.set("data", { ...(a.editor.page.data || {}), fill: background });
        a.editor.setBackground(background);
      }
    } : null,
  });
  await waitForEditor(app, oldId);
  const ed = app.editor;
  return {
    text: json({
      opened: { id: app.project.id, name: app.project.name, width: ed.width, height: ed.height, objects: ed.objects().length },
      note: oldId ? "The previous design was saved and is still in the user's Home list." : undefined,
    }),
  };
}

export async function applyTemplateTool(app, inp, { signal }) {
  const ed = editorOf(app);
  const tpl = pick(TEMPLATES, inp.template_id, (t) => t.id, { what: "template", catalog: "templates" });
  const n = ed.objects().filter((o) => !o.data?.guide).length;
  if (n && !inp.replace) {
    throw new ToolInputError(`The page has ${n} object${n > 1 ? "s" : ""}; apply_template would replace them. Pass replace: true only if the user wants that, or use new_design with template "${tpl.id}".`);
  }
  await step(app, `Template ${tpl.name}`, () => applyTemplate(ed, tpl, { record: false }), { signal });
  return { text: json({ applied: tpl.id, objects: ed.objects().length, hint: "Call get_design to see the new objects and their ids." }) };
}

// ---- set_background ----------------------------------------------------------------------

export async function setBackground(app, inp, { signal }) {
  const ed = editorOf(app);
  const given = ["color", "gradient", "scene"].filter((k) => inp[k] !== undefined);
  if (given.length !== 1) throw new ToolInputError("set_background: give exactly one of color, gradient or scene.");
  if (inp.scene_colors && !inp.scene) throw new ToolInputError("set_background: scene_colors goes with scene.");
  if (inp.scene) {
    const s = pick(SCENES, inp.scene, (x) => x.key, { what: "scene", catalog: "scenes" });
    const slots = s.colors.map((c) => c.id);
    for (const k of Object.keys(inp.scene_colors || {})) {
      if (!slots.includes(k)) throw new ToolInputError(`The scene "${s.key}" has no colour slot "${k}". Its slots: ${slots.join(", ")}.`);
    }
    await step(app, `Background ${s.label}`, async () => {
      const img = await applyScene(app, s.key, inp.scene_colors || null, { commit: false });
      if (!img) throw new Error("The scene couldn't be drawn.");
    }, { signal });
    return { text: json({ background: { scene: s.key } }) };
  }
  const value = inp.gradient ? gradientFill(inp.gradient).value : inp.color;
  await step(app, "Background", () => {
    const imgs = ed.objects().filter((o) => o.isBg && typeof o.getOriginalSize === "function");
    if (imgs.length) ed.canvas.remove(...imgs);
    ed.page.set("data", { ...(ed.page.data || {}), fill: value });
    ed.setBackground(toFabricFill(value));
  }, { signal });
  return { text: json({ background: inp.gradient ? { gradient: value } : { color: value } }) };
}

// ---- add_text -----------------------------------------------------------------------------

export async function addText(app, inp, { signal }) {
  const ed = editorOf(app);
  const u = pageUnit(ed);
  let base = {};
  if (inp.preset) {
    const p = pick(PRESETS, inp.preset, (x) => x.id, { what: "text preset", catalog: "text_presets" });
    const { data, ...props } = mainPart(p)[1];
    base = { ...props, fontSize: Math.round(props.fontSize * u), data: data ? structuredClone(data) : undefined };
  }
  const family = resolveFamily(inp.font ?? base.fontFamily ?? "Inter");
  const face = await faceFor(family, inp.weight ?? base.fontWeight ?? (family === "Inter" ? 800 : 400), inp.italic ?? base.fontStyle === "italic");
  const words = inp.uppercase ? inp.text.toUpperCase() : inp.text;
  const t = makeText(words, {
    ...base, ...face,
    fontSize: inp.font_size ?? base.fontSize ?? Math.round(72 * u),
    fill: base.fill ?? (pageIsDark(app) ? "#ffffff" : "#16121b"),
    textAlign: base.textAlign ?? "center",
    angle: 0,
  });
  await styleText(t, { ...inp, font: undefined, weight: undefined, italic: undefined, font_size: undefined }, { keepCenter: false });
  if (inp.w !== undefined) {
    t.set("width", inp.w);
    t.initDimensions();
  } else {
    hugWidth(t, ed.width * 0.9);
    if (inp.font_size === undefined) fitWidth(t, ed.width * 0.92);
  }
  const angle = inp.angle ?? base.angle;
  return step(app, `Add text "${words.slice(0, 24)}"`, () => {
    ed.add(t, { center: true, select: false, name: inp.name || words.replace(/\s+/g, " ").slice(0, 24) });
    if (inp.name) t.set("data", { ...t.data, keepName: true });
    const fix = place(t, { ...inp, w: undefined, h: undefined, angle }, ed);
    return added(ed, t, {}, fix);
  }, { signal });
}

// ---- add_shape / add_line -------------------------------------------------------------------

export async function addShape(app, inp, { signal }) {
  const ed = editorOf(app);
  const spec = pick(SHAPES, inp.shape, (s) => s.key, { what: "shape", catalog: "shapes" });
  const o = createShape(spec.key);
  if (inp.gradient) o.set("fill", gradientFill(inp.gradient).fill);
  else if (inp.fill) o.set("fill", inp.fill);
  if (inp.stroke || inp.stroke_width) o.set({ stroke: inp.stroke || "#16121b", strokeWidth: inp.stroke_width ?? 8 });
  if (inp.radius !== undefined) {
    if (o.type !== "rect") throw new ToolInputError("add_shape: radius only works with rect and roundRect.");
    o.set({ rx: inp.radius, ry: inp.radius, data: { ...o.data, radius: inp.radius } });
  }
  const short = Math.min(ed.width, ed.height);
  return step(app, `Add ${spec.label}`, () => {
    ed.add(o, { center: true, select: false, name: inp.name || spec.label });
    const size = inp.w === undefined && inp.h === undefined ? { w: short * 0.36 } : inp;
    const fix = place(o, { ...inp, w: size.w, h: size.h }, ed);
    return added(ed, o, {}, fix);
  }, { signal });
}

export async function addLine(app, inp, { signal }) {
  const ed = editorOf(app);
  const dx = inp.x2 - inp.x1, dy = inp.y2 - inp.y1;
  if (Math.hypot(dx, dy) < 1) throw new ToolInputError("add_line: the start and end points are the same. Give two different points.");
  const o = new OcLine([{ x: 0, y: 0 }, { x: dx, y: dy }], {
    stroke: inp.color || (pageIsDark(app) ? "#f3ead8" : "#16121b"), strokeWidth: inp.width ?? 8,
    startCap: inp.start_cap || "none", endCap: inp.end_cap || "none", lineStyle: inp.style || "solid",
    data: { kind: "line" },
  });
  const label = inp.end_cap && inp.end_cap !== "none" ? "Arrow" : "Line";
  return step(app, `Add ${label.toLowerCase()}`, () => {
    ed.add(o, { center: false, select: false, name: inp.name || label });
    o.setPositionByOrigin({ x: (inp.x1 + inp.x2) / 2, y: (inp.y1 + inp.y2) / 2 }, "center", "center");
    if (inp.opacity !== undefined) o.set("opacity", inp.opacity);
    o.setCoords();
    return added(ed, o);
  }, { signal });
}

// ---- add_element ---------------------------------------------------------------------------

export async function addElement(app, inp, { signal }) {
  const ed = editorOf(app);
  const { obj, label, fixedPlace } = await buildElement(app, inp);
  return step(app, `Add ${label}`, () => {
    ed.add(obj, { center: !fixedPlace, select: false, name: inp.name || obj.name || label });
    if (fixedPlace) {
      obj.setPositionByOrigin(fixedPlace, "center", "center");
      obj.setCoords();
    }
    const fix = place(obj, inp, ed);
    if (obj.data?.overlay) obj.set({ evented: false });
    return added(ed, obj, obj.data?.overlay ? { overlay: "Covers the whole page; it can't be clicked on the canvas, use its id." } : {}, fix);
  }, { signal });
}

// ---- add_character ---------------------------------------------------------------------------

export async function addCharacter(app, inp, { signal }) {
  const ed = editorOf(app);
  const cast = pick(CAST, inp.who, (c) => c.who, { what: "character", catalog: "characters" });
  const params = {
    who: cast.who, expr: inp.expression || cast.expr, dir: inp.facing === "left" ? -1 : 1,
    head: Boolean(inp.head_only), sticker: Boolean(inp.sticker),
    look: (LOOKS.find((l) => l.id === (inp.look || "ahead")) || LOOKS[0]).look,
  };
  const g = await createCharacter(params);
  const k = inp.height ? inp.height / g.height : fitScale(g, ed.width, ed.height, params.head);
  g.set({ scaleX: k, scaleY: k });
  return step(app, `Add ${cast.name}`, () => {
    ed.add(g, { center: true, select: false, name: inp.name || cast.name });
    const fix = place(g, { ...inp, w: undefined, h: undefined }, ed);
    return added(ed, g, { character: { who: cast.who, expression: params.expr, facing: params.dir === -1 ? "left" : "right" } }, fix);
  }, { signal });
}
