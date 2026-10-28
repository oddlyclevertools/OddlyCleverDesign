// A/B pack for YouTube Test & Compare: copies of the open design saved as new projects
// ("Name (B)", "Name (C)"), each with one kind of change. The open design is never touched:
// every variant is built on an off-screen canvas from the saved JSON.
import { StaticCanvas } from "fabric";
import { CUSTOM_PROPS } from "../../core/editor.js";
import { shiftHue } from "./color.js";
import { boxOf, isText, pageFontSize } from "./geom.js";

export const LETTERS = ["B", "C"];
const HUES = { B: 180, C: 95 };           // colour wheel turns per variant
const HERO_GROW = { B: 1, C: 1.18 };      // C also makes the hero a bit bigger
const KEEP_COLOURS = /character|cast|sticker|illustration|image|photo/i;
const THUMB_SIDE = 360;

/** The headline: the text with the biggest letters on the page. */
export function headlineOf(objects) {
  const texts = objects.filter((o) => isText(o) && (o.text || "").trim());
  return texts.sort((a, b) => pageFontSize(b) - pageFontSize(a))[0] || null;
}

/** The hero: the biggest picture-like object that isn't the background or text. */
function heroOf(objects, W, H) {
  const list = objects.filter((o) => !isText(o) && !o.isBg && !o.isPage)
    .map((o) => ({ o, b: boxOf(o) }))
    .filter(({ b }) => b.w * b.h < W * H * 0.8);
  list.sort((p, q) => q.b.w * q.b.h - p.b.w * p.b.h);
  return list[0]?.o || null;
}

function recolour(o, deg) {
  if (KEEP_COLOURS.test(o.data?.kind || "") || /^image$/i.test(o.type)) return;
  const turn = (v) => {
    if (typeof v === "string") return shiftHue(v, deg);
    if (v?.colorStops) {
      v.colorStops = v.colorStops.map((s) => ({ ...s, color: shiftHue(s.color, deg) }));
      return v;
    }
    return v;
  };
  const props = { fill: turn(o.fill), stroke: turn(o.stroke) };
  if (o.shadow?.color) o.shadow.color = shiftHue(o.shadow.color, deg);
  if (o.styles) {
    const styles = {};
    for (const [ln, line] of Object.entries(o.styles)) {
      styles[ln] = {};
      for (const [ch, st] of Object.entries(line || {})) {
        styles[ln][ch] = { ...st, ...(st.fill ? { fill: shiftHue(st.fill, deg) } : {}), ...(st.stroke ? { stroke: shiftHue(st.stroke, deg) } : {}) };
      }
    }
    props.styles = styles;
  }
  o.set(props);
  if (Array.isArray(o._objects) && !isText(o)) for (const c of o._objects) recolour(c, deg);
  o.dirty = true;
}

/** Break `text` into `lines` lines of similar length (keeps the look of a stacked headline). */
export function splitLike(text, lines) {
  if (lines <= 1 || text.includes("\n")) return text;
  const words = text.split(/\s+/);
  if (words.length <= 1) return text;
  const n = Math.min(lines, words.length), target = text.length / n, out = [];
  let line = "";
  words.forEach((w, i) => {
    const left = words.length - i; // words still to place, this one included
    const mustBreak = left <= n - out.length - 1;
    if (line && out.length < n - 1 && (mustBreak || line.length + w.length / 2 > target)) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  });
  out.push(line);
  return out.join("\n");
}

/** True when an object is, or holds, text (those must not be flipped or they'd read backwards). */
const hasText = (o) => isText(o) || (Array.isArray(o._objects) && o._objects.some(hasText));

/** Mirror the layout left to right: shapes and pictures flip, words stay readable. */
function mirror(objects, W) {
  for (const o of objects) {
    if (o.isPage || o.isBg) continue;
    const c = o.getCenterPoint();
    const props = { angle: (360 - (o.angle || 0)) % 360 };
    if (hasText(o)) props.skewX = -(o.skewX || 0);
    else props.flipX = !o.flipX;
    o.set(props);
    o.setPositionByOrigin({ x: W - c.x, y: c.y }, "center", "center");
    o.setCoords();
  }
}

/**
 * Build one variant document from the saved design JSON.
 * @param {object} doc editor.toJSON() of the original
 * @param {{ letter: string, colours: boolean, headline: string|null, hero: boolean }} opts
 * @returns {Promise<{ doc: object, thumb: string }>}
 */
export async function buildVariant(doc, { letter, colours, headline, hero }) {
  const W = doc.width, H = doc.height;
  const sc = new StaticCanvas(document.createElement("canvas"), { width: W, height: H, renderOnAddRemove: false });
  try {
    await sc.loadFromJSON(doc.canvas);
    const objs = sc.getObjects();
    const design = objs.filter((o) => !o.isPage);
    if (colours) {
      const deg = HUES[letter] ?? 120;
      for (const o of objs) recolour(o, deg);
    }
    if (headline != null && headline.trim()) {
      const h = headlineOf(design);
      if (h) {
        h.set({ text: splitLike(headline.trim(), h.text.split("\n").length), styles: {} });
        h.initDimensions?.();
      }
    }
    if (hero) {
      const heroObj = heroOf(design, W, H);
      mirror(design, W);
      const grow = HERO_GROW[letter] ?? 1;
      if (heroObj && grow !== 1) {
        const c = heroObj.getCenterPoint();
        heroObj.set({ scaleX: heroObj.scaleX * grow, scaleY: heroObj.scaleY * grow });
        heroObj.setPositionByOrigin(c, "center", "center");
        heroObj.setCoords();
      }
    }
    sc.renderAll();
    const scale = Math.min(1, THUMB_SIDE / Math.max(W, H));
    const thumb = sc.toDataURL({ format: "jpeg", quality: 0.78, multiplier: scale });
    return { doc: { ...doc, canvas: sc.toObject(CUSTOM_PROPS) }, thumb };
  } finally {
    sc.dispose();
  }
}

/**
 * Save variants of the open design as new projects. Flushes the open design first.
 * @returns {Promise<Array<{ id: string, name: string, letter: string }>>}
 */
export async function makeVariants(app, { count = 2, colours = false, headlines = {}, hero = false }) {
  if (!app.project) throw new Error("Open a design first.");
  if (!colours && !hero && !Object.values(headlines).some((t) => t?.trim())) {
    throw new Error("Pick at least one thing to change.");
  }
  await app.save();
  const base = app.editor.toJSON();
  const baseName = app.project.name.replace(/\s*\([A-C]\)$/, "");
  const out = [{ id: app.project.id, name: app.project.name, letter: "A" }];
  for (const letter of LETTERS.slice(0, Math.max(1, Math.min(2, count - 1)))) {
    const { doc, thumb } = await buildVariant(base, { letter, colours, headline: headlines[letter] ?? null, hero });
    const id = app.store.newProjectId();
    const name = `${baseName} (${letter})`;
    await app.store.saveProject({ id, name, width: doc.width, height: doc.height, thumb, doc });
    out.push({ id, name, letter, thumb });
  }
  return out;
}

const waitFor = async (test, ms = 8000) => {
  const end = performance.now() + ms;
  while (!test()) {
    if (performance.now() > end) throw new Error("The design took too long to open.");
    await new Promise((r) => setTimeout(r, 60));
  }
};

/** Open `id` through the router (so the address bar stays right) and wait until it shows. */
export async function openAndWait(app, id) {
  if (app.project?.id === id && app.view === "editor") return;
  location.hash = `#/d/${id}`;
  await waitFor(() => app.project?.id === id && app.view === "editor");
  await new Promise(requestAnimationFrame);
}

/**
 * Download every variant as a JPG under 2 MB, opening each in turn, then return to the
 * design that was open. `onStep(i, total, name)` reports progress.
 */
export async function exportPack(app, pack, onStep) {
  const startId = app.project?.id;
  await app.save();
  const results = [];
  try {
    for (let i = 0; i < pack.length; i++) {
      const v = pack[i];
      onStep?.(i, pack.length, v.name);
      await openAndWait(app, v.id);
      const name = /\([A-C]\)$/.test(v.name) ? v.name : `${v.name} (${v.letter})`;
      results.push(await app.files.exportDesign("jpg", { quality: 0.92, limitKB: 1990, name }));
    }
  } finally {
    if (startId) await openAndWait(app, startId).catch(() => {});
  }
  return results;
}
