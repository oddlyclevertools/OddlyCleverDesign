// Reading tools: get_design (a compact JSON summary), look_at_design (a picture for vision)
// and check_design (the studio's findings, with fixes).
import { brief, boxOf, editorOf, isCharacter, isText, json, kindOf, step } from "./context.js";
import { fromFabricFill } from "../../elements/fill.js";
import { groupColors } from "../../elements/vector.js";
import { LOOKS } from "../../characters/cast.js";
import { animOf, pageDuration } from "../../motion/timeline.js";
import { runCheck } from "../../studio/check.js";
import { autoKind, zonesFor } from "../../studio/zones.js";
import { attachedRefs, attachedStyleName, listStyles } from "../refs/store.js";
import { describeNotes } from "../refs/analyse.js";
import { ToolInputError } from "./validate.js";

const r = (v) => Math.round(v);
const colorOf = (fill) => {
  if (!fill) return undefined;
  if (typeof fill === "string") return fill;
  const v = fromFabricFill(fill);
  return typeof v === "string" ? v : { gradient: v };
};

function lookId(look) {
  if (!Array.isArray(look)) return "ahead";
  let best = LOOKS[0], d = Infinity;
  for (const l of LOOKS) {
    const dd = Math.hypot(l.look[0] - look[0], l.look[1] - look[1]);
    if (dd < d) { d = dd; best = l; }
  }
  return best.id;
}

function textInfo(t) {
  const fx = t.data?.effect ? Object.keys(t.data.effect) : [];
  return {
    text: t.text,
    font: { family: t.fontFamily, size: r(t.fontSize * Math.abs(t.scaleY || 1)), weight: Number(t.fontWeight) || 400, ...(t.fontStyle === "italic" ? { italic: true } : {}) },
    fill: colorOf(t.fill),
    ...(t.textAlign !== "center" ? { align: t.textAlign } : {}),
    ...(fx.length ? { effects: fx } : {}),
    ...(t.data?.curve ? { curve: t.data.curve } : {}),
  };
}

const ELEMENT_KEY = { illustration: "illustration", badge: "badge", decoration: "decor", sticker: "sticker", icon: "icon" };

/** One object as compact JSON (defaults left out). */
export function describe(o) {
  const kind = kindOf(o);
  const d = o.data || {};
  const out = { id: o.id, kind, name: o.name, ...boxOf(o) };
  if (Math.abs(o.angle || 0) > 0.05) out.angle = Math.round(o.angle * 10) / 10;
  if (o.opacity !== undefined && o.opacity < 1) out.opacity = Math.round(o.opacity * 100) / 100;
  if (o.flipX) out.flip_x = true;
  if (o.flipY) out.flip_y = true;
  if (isText(o)) Object.assign(out, textInfo(o));
  else if (isCharacter(o)) {
    const c = d.character || {};
    out.character = { who: c.who, expression: c.expr, facing: c.dir === -1 ? "left" : "right", look: lookId(c.look), ...(c.head ? { head_only: true } : {}), ...(c.sticker ? { sticker: true } : {}) };
  } else if (kind === "chart") {
    const ch = d.chart;
    out.chart = { type: ch.type, ...(ch.rows ? { rows: ch.rows.map((x) => ({ label: x.label, value: x.value })) } : {}),
      ...(ch.value !== undefined ? { value: ch.value } : {}), ...(ch.number ? { number: ch.number } : {}), ...(ch.label ? { label: ch.label } : {}) };
  } else if (kind === "photo_grid") {
    out.layout = d.grid?.layout;
    out.cells = o.getObjects().length;
    out.empty_cells = o.getObjects().filter((c) => c.data?.empty).length;
  } else if (kind === "text_group" || kind === "badge" || kind === "group") {
    const texts = o.getObjects().filter(isText);
    if (texts.length) out.texts = texts.map((t) => t.text);
    if (kind === "group") out.children = o.getObjects().length;
    out.colors = groupColors(o).slice(0, 5);
  } else if (o._objects) {
    out.colors = groupColors(o).slice(0, 5);
  } else if (kind === "background") {
    if (d.scene) out.scene = d.scene;
  } else if (kind === "line") {
    out.color = typeof o.stroke === "string" ? o.stroke : undefined;
    out.width = o.strokeWidth;
    if (o.startCap !== "none") out.start_cap = o.startCap;
    if (o.endCap !== "none") out.end_cap = o.endCap;
  } else {
    const f = colorOf(o.fill);
    if (f !== undefined) out.fill = f;
    if (o.stroke && o.strokeWidth) { out.stroke = colorOf(o.stroke); out.stroke_width = o.strokeWidth; }
  }
  if (ELEMENT_KEY[kind] && d[ELEMENT_KEY[kind]]) out.key = d[ELEMENT_KEY[kind]];
  if (d.kind === "shape" && d.shape) out.shape = d.shape === "rect" ? (d.radius ? "roundRect" : "rect") : d.shape;
  if (o.locked) out.locked = true;
  if (o.visible === false) out.hidden = true;
  const a = animOf(o);
  if (a) out.anim = { ...(a.in ? { intro: a.in.type } : {}), ...(a.loop ? { loop: a.loop.type } : {}), ...(a.out ? { outro: a.out.type } : {}) };
  return out;
}

function pageInfo(app, ed) {
  const page = ed.page;
  const bgObj = ed.objects().find((o) => o.isBg && o.data?.scene);
  const background = bgObj ? { scene: bgObj.data.scene.key, scene_colors: bgObj.data.scene.colors }
    : (() => { const v = page?.data?.fill ?? fromFabricFill(page?.fill); return typeof v === "string" ? { color: v } : { gradient: v }; })();
  const kind = autoKind(ed.width, ed.height);
  const zones = kind ? zonesFor(kind, ed.width, ed.height) : null;
  return {
    name: app.project?.name, width: ed.width, height: ed.height, background,
    animation_seconds: pageDuration(ed),
    ...(zones ? { safe_zones: { platform: zones.label, note: zones.note, keep_clear: zones.rects.filter((z) => z.check)
      .map((z) => ({ label: z.label, x: r(z.x), y: r(z.y), w: r(z.w), h: r(z.h) })) } } : {}),
  };
}

export async function getDesign(app) {
  const ed = editorOf(app);
  const objects = ed.objects().filter((o) => !o.data?.guide && !o.data?.cropUI).map(describe);
  const selected = ed.selection().map((o) => o.id).filter(Boolean);
  return { text: json({ page: pageInfo(app, ed), selected, objects }) };
}

// ---- look_at_design --------------------------------------------------------------------

const MARK_COLORS = ["#ff2e7e", "#00c2ff", "#ffc83d", "#39d98a", "#b26bff", "#ff7a1a"];
const MAX_IMAGE_B64 = 4_000_000;

function drawMarks(canvas, objs, scale) {
  const ctx = canvas.getContext("2d");
  const labels = [];
  const fontPx = Math.max(13, Math.round(Math.min(canvas.width, canvas.height) / 34));
  ctx.font = `700 ${fontPx}px Inter, Arial, sans-serif`;
  ctx.textBaseline = "top";
  objs.forEach((o, i) => {
    const b = boxOf(o);
    const n = String(i + 1), col = MARK_COLORS[i % MARK_COLORS.length];
    const x = b.x * scale, y = b.y * scale, w = b.w * scale, h = b.h * scale;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = col;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    const tw = ctx.measureText(n).width + 10;
    const lx = Math.max(0, Math.min(canvas.width - tw, x)), ly = Math.max(0, Math.min(canvas.height - fontPx - 6, y));
    ctx.fillStyle = col;
    ctx.fillRect(lx, ly, tw, fontPx + 6);
    ctx.fillStyle = "#0d0a10";
    ctx.fillText(n, lx + 5, ly + 3);
    ctx.restore();
    labels.push(`${n} = ${o.id} (${kindOf(o)}${isText(o) ? ` "${o.text.replace(/\s+/g, " ").slice(0, 30)}"` : ` ${o.name || ""}`})`);
  });
  return labels;
}

export async function lookAtDesign(app, inp) {
  const ed = editorOf(app);
  const maxSide = inp.max_side || 1568;
  const scale = Math.min(1, maxSide / Math.max(ed.width, ed.height));
  const page = ed.renderPage({ scale });
  let labels = [];
  if (inp.mark_ids) {
    const objs = ed.objects().filter((o) => !o.isBg && o.visible !== false && !o.data?.guide && !o.data?.cropUI);
    labels = drawMarks(page, objs, scale);
  }
  let mediaType = "image/png";
  let url = page.toDataURL(mediaType);
  if (url.length > MAX_IMAGE_B64) {
    mediaType = "image/jpeg";
    url = page.toDataURL(mediaType, 0.9);
  }
  const data = url.slice(url.indexOf(",") + 1);
  const head = `The page (${ed.width}x${ed.height}) shown at ${page.width}x${page.height}${scale < 1 ? ` (1 picture px = ${Math.round(10 / scale) / 10} page px)` : ""}.`;
  return { text: labels.length ? `${head} Numbered boxes: ${labels.join("; ")}.` : head, image: { mediaType, data } };
}

// ---- check_design ----------------------------------------------------------------------

async function findings(app, zonesKind) {
  const ed = app.editor;
  const kind = !zonesKind || zonesKind === "auto" ? autoKind(ed.width, ed.height) : zonesKind;
  const zones = kind ? zonesFor(kind, ed.width, ed.height) : null;
  return runCheck(app, { kind, zones });
}

const usableFix = (f) => f.fix && !f.fix.keep && typeof f.fix.run === "function";

export async function checkDesign(app, inp, { signal }) {
  editorOf(app);
  if (inp.fix) {
    const list = await findings(app, inp.zones);
    const f = list.find((x) => x.id === inp.fix);
    if (!f) throw new Error(`No finding with id "${inp.fix}" now (it may be fixed already). Run check_design again for current ids.`);
    if (!usableFix(f)) throw new Error(`"${f.title}" has no automatic fix. Change the design yourself (see the finding text).`);
    await step(app, f.fix.label, () => f.fix.run(), { signal });
    const left = await findings(app, inp.zones);
    return { text: json({ fixed: f.title, remaining: left.length, targets: f.targets.filter((o) => o.canvas).map(brief) }) };
  }
  const list = await findings(app, inp.zones);
  const out = list.map((f) => ({
    id: f.id, severity: f.severity, title: f.title, text: f.text,
    objects: (f.targets || []).map((o) => o.id).filter(Boolean),
    ...(usableFix(f) ? { fix: f.fix.label } : {}),
  }));
  return { text: json({ findings: out, summary: out.length ? `${out.filter((f) => f.severity === "fix").length} to fix, ${out.filter((f) => f.severity === "look").length} to look at.` : "No problems found." }) };
}


// ---- style_references ------------------------------------------------------------------

/** List the user's style pictures, or show one (so an AI outside the app can see them too). */
export async function styleReferences(app, inp) {
  const saved = await listStyles().catch(() => []);
  const attached = attachedRefs();
  if (!inp.style) {
    const lines = [];
    if (attached.length) lines.push(`Attached now (style "attached"${attachedStyleName() ? `, from "${attachedStyleName()}"` : ""}): ${attached.length} picture(s).`, ...attached.map((r, i) => describeNotes(r.notes, i)));
    for (const s of saved) lines.push(`Saved style "${s.name}": ${s.refs.length} picture(s).`, ...s.refs.map((r, i) => describeNotes(r.notes, i)));
    return { text: lines.length ? lines.join("\n") : "The user has no style pictures yet. They can attach some in the Ask AI panel (the picture button) and save them as a style." };
  }
  const want = inp.style.trim().toLowerCase();
  const refs = want === "attached" ? attached : saved.find((s) => s.name.toLowerCase() === want)?.refs;
  if (!refs?.length) {
    const names = ["attached", ...saved.map((s) => s.name)].map((n) => `"${n}"`).join(", ");
    throw new ToolInputError(`style_references: no style "${inp.style}". Try: ${names}.`);
  }
  const i = Math.min(refs.length, inp.picture || 1) - 1;
  const r = refs[i];
  return { text: `Picture ${i + 1} of ${refs.length} in "${inp.style}". Match its style, not its content.\n${describeNotes(r.notes, i)}`, image: { mediaType: r.mediaType, data: r.data } };
}
