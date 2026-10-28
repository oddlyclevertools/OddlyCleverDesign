// Text styles for the Text panel: the plain heading / subheading / body buttons and the one-click
// presets (thumbnail looks and two-line combos). Every preset is built at a size unit `u`
// (1 = a 720 px short side), so it suits any page and also renders small for its preview.
import { Group } from "fabric";
import { ensureFont } from "../../core/fonts.js";
import { makeText, fitWidth, isDark, pageUnit } from "./helpers.js";
import { MORE_PRESETS, BASE_MOODS, MOODS } from "./presets-more.js";

export { MOODS };

/** The three plain text styles. */
export const BASICS = [
  { id: "heading", label: "Add a heading", font: "Montserrat", weight: 800, size: 84, width: 0.8, text: "Add a heading", cls: "tx-add-h" },
  { id: "subheading", label: "Add a subheading", font: "Montserrat", weight: 600, size: 46, width: 0.62, text: "Add a subheading", cls: "tx-add-s" },
  { id: "body", label: "Add a little bit of body text", font: "Inter", weight: 400, size: 26, width: 0.5, text: "Add a little bit of body text", cls: "tx-add-b" },
];

const fx = (effect, curve = 0) => ({ data: { effect, ...(curve ? { curve } : {}) } });

/**
 * Presets. parts: one entry per text; a preset with several parts becomes a group.
 * Each part: [text, props, widthFactor]. bg: preview tile tone.
 */
const BASE_PRESETS = [
  { id: "yellow-outline", label: "Big outlined yellow", bg: "dark", parts: [["I QUIT MY JOB", {
    fontFamily: "Anton", fontSize: 128, fill: "#ffde59", lineHeight: 1.0,
    ...fx({ outline: { thickness: 62, color: "#000000" }, shadow: { offset: 38, direction: 50, blur: 0, transparency: 0, color: "#000000" } }),
  }]] },
  { id: "white-stroke", label: "White with black stroke", bg: "light", parts: [["WAIT FOR IT", {
    fontFamily: "Montserrat", fontWeight: 900, fontSize: 104, fill: "#ffffff", lineHeight: 1.0,
    ...fx({ outline: { thickness: 55, color: "#000000" } }),
  }]] },
  { id: "highlight", label: "Highlight box", bg: "dark", parts: [["NOBODY TALKS\nABOUT THIS", {
    fontFamily: "Poppins", fontWeight: 800, fontSize: 70, fill: "#111111", lineHeight: 1.18,
    ...fx({ background: { roundness: 18, spread: 30, transparency: 0, color: "#ffde59" } }),
  }]] },
  { id: "neon", label: "Neon glow", bg: "dark", parts: [["NEON NIGHTS", {
    fontFamily: "Montserrat", fontWeight: 700, fontSize: 92, fill: "#ff3fd2", charSpacing: 40,
    ...fx({ neon: { intensity: 62, tube: 65, color: null } }),
  }]] },
  { id: "retro", label: "Retro offset shadow", bg: "dark", parts: [["RETRO WAVE", {
    fontFamily: "Archivo Black", fontSize: 100, fill: "#ffde59", lineHeight: 1.0,
    ...fx({ outline: { thickness: 22, color: "#2b1a4a" }, shadow: { offset: 55, direction: 45, blur: 0, transparency: 0, color: "#ff3c7e" } }),
  }]] },
  { id: "red-label", label: "Red label", bg: "dark", parts: [["BREAKING", {
    fontFamily: "Oswald", fontWeight: 700, fontSize: 72, fill: "#ffffff", charSpacing: 80,
    ...fx({ background: { roundness: 0, spread: 28, transparency: 0, color: "#e11d2e" } }),
  }, 0.5]] },
  { id: "documentary", label: "Documentary title", bg: "light", parts: [["THE LAST KINGDOM", {
    fontFamily: "Playfair Display", fontWeight: 900, fontSize: 80, fill: "#1d1b18", charSpacing: 120,
    ...fx({ lift: { intensity: 35 } }),
  }]] },
  { id: "glitch", label: "Glitch", bg: "dark", parts: [["GLITCH", {
    fontFamily: "Archivo Black", fontSize: 120, fill: "#ffffff",
    ...fx({ glitch: { offset: 45, direction: 0, colorA: "#00e5ff", colorB: "#ff2bd6" } }),
  }]] },
  { id: "hollow", label: "Hollow", bg: "dark", parts: [["OUTLINE ONLY", {
    fontFamily: "Anton", fontSize: 116, fill: "#38b6ff", lineHeight: 1.0,
    ...fx({ hollow: { thickness: 45 } }),
  }]] },
  { id: "splice", label: "Splice", bg: "dark", parts: [["SPLICE", {
    fontFamily: "Bebas Neue", fontSize: 150, fill: "#ffffff", charSpacing: 40,
    ...fx({ splice: { thickness: 40, offset: 45, direction: 45, color: "#ff5757" } }),
  }]] },
  { id: "echo", label: "Echo", bg: "light", parts: [["ECHO", {
    fontFamily: "Archivo Black", fontSize: 120, fill: "#ff5757",
    ...fx({ echo: { offset: 60, direction: -35, color: null } }),
  }]] },
  { id: "curved", label: "Curved badge", bg: "dark", parts: [["SUBSCRIBE FOR MORE", {
    fontFamily: "Montserrat", fontWeight: 800, fontSize: 64, fill: "#ffde59",
    ...fx({ outline: { thickness: 40, color: "#000000" } }, 32),
  }, 0.62]] },
  { id: "marker", label: "Marker note", bg: "dark", parts: [["watch till the end!", {
    fontFamily: "Permanent Marker", fontSize: 72, fill: "#ff3131",
    ...fx({ outline: { thickness: 30, color: "#ffffff" }, lift: { intensity: 55 } }),
  }, 0.62]] },
  { id: "script-pop", label: "Script pop", bg: "dark", parts: [["Sweet deal", {
    fontFamily: "Lobster", fontSize: 110, fill: "#ff66c4",
    ...fx({ outline: { thickness: 36, color: "#ffffff" }, shadow: { offset: 25, direction: 60, blur: 35, transparency: 45, color: "#000000" } }),
  }, 0.62]] },
  { id: "combo-money", label: "Heading + note", bg: "dark", parts: [
    ["HOW I MADE $10K", {
      fontFamily: "Anton", fontSize: 120, fill: "#ffde59", lineHeight: 1.0,
      ...fx({ outline: { thickness: 60, color: "#000000" }, shadow: { offset: 35, direction: 50, blur: 0, transparency: 0, color: "#000000" } }),
    }],
    ["in 30 days (no luck)", {
      fontFamily: "Permanent Marker", fontSize: 58, fill: "#ffffff", angle: -3,
      ...fx({ outline: { thickness: 34, color: "#000000" } }),
    }, 0.6],
  ] },
  { id: "combo-truth", label: "Big word + label", bg: "dark", parts: [
    ["THE TRUTH", {
      fontFamily: "Bebas Neue", fontSize: 170, fill: "#ffffff", lineHeight: 0.95, charSpacing: 20,
      ...fx({ shadow: { offset: 30, direction: 70, blur: 40, transparency: 35, color: "#000000" }, outline: { thickness: 28, color: "#000000" } }),
    }],
    ["ABOUT PASSIVE INCOME", {
      fontFamily: "Oswald", fontWeight: 600, fontSize: 46, fill: "#111111", charSpacing: 60,
      ...fx({ background: { roundness: 10, spread: 30, transparency: 0, color: "#ffde59" } }),
    }, 0.55],
  ] },
  { id: "combo-serif", label: "Serif title + subtitle", bg: "light", parts: [
    ["A Quiet Empire", { fontFamily: "DM Serif Display", fontSize: 96, fill: "#1d1b18", lineHeight: 1.05 }],
    ["THE STORY OF SALT · EPISODE 3", {
      fontFamily: "Inter", fontWeight: 600, fontSize: 24, fill: "#6b5d4f", charSpacing: 300,
    }, 0.6],
  ] },
];

/** Every preset: the v0.1 looks (with their mood) and the v0.2 ones. */
export const PRESETS = [
  ...BASE_PRESETS.map((p) => ({ ...p, mood: BASE_MOODS[p.id] || "Thumbnail punch" })),
  ...MORE_PRESETS,
];

async function loadFonts(parts) {
  await Promise.all(parts.map(([, p]) => ensureFont(p.fontFamily, p.fontWeight || 400, p.fontStyle || "normal")));
}

/**
 * Build a preset as a Fabric object (an OcText, or a group for combos).
 * @param {object} preset
 * @param {number} u size unit
 * @param {number} pageW page width (for widths)
 */
export async function buildPreset(preset, u, pageW, { tight = false } = {}) {
  await loadFonts(preset.parts);
  const texts = preset.parts.map(([text, props, wf = 0.8]) => {
    const t = makeText(text, {
      ...props,
      fontSize: Math.round(props.fontSize * u),
      width: pageW * wf,
      data: props.data ? structuredClone(props.data) : undefined,
    });
    if (tight) {
      // Previews: hug the longest line so the tile shows the text big.
      t.set("width", 4000);
      t.initDimensions();
      t.set("width", Math.ceil(t.calcTextWidth()) + 2);
      t.initDimensions();
    } else {
      fitWidth(t, pageW * 0.92);
    }
    return t;
  });
  if (texts.length === 1) return texts[0];
  // Stack the parts, centred, with a small gap.
  let y = 0;
  for (const t of texts) {
    const h = t.getBoundingRect().height;
    t.setPositionByOrigin({ x: 0, y: y + h / 2 }, "center", "center");
    t.setCoords();
    y += h + t.fontSize * 0.12;
  }
  return new Group(texts, { data: { textCombo: preset.id } });
}

/** Add a preset to the page, centred and selected. */
export async function addPreset(app, preset) {
  const ed = app.editor;
  const obj = await buildPreset(preset, pageUnit(ed), ed.width);
  ed.add(obj, { name: preset.label });
  return obj;
}

/** Add one of the plain styles (heading / subheading / body). */
export async function addBasic(app, id, { edit = false } = {}) {
  const b = BASICS.find((x) => x.id === id) || BASICS[2];
  const ed = app.editor;
  await ensureFont(b.font, b.weight);
  const t = makeText(b.text, {
    fontFamily: b.font, fontWeight: b.weight, fontSize: Math.round(b.size * pageUnit(ed)),
    width: ed.width * b.width, fill: isDark(ed.page?.fill) ? "#ffffff" : "#1f1f29",
  });
  fitWidth(t, ed.width * 0.92);
  ed.add(t, { name: b.label.replace(/^Add an? /, "").replace(/^(.)/, (c) => c.toUpperCase()) });
  if (edit) {
    t.enterEditing();
    t.selectAll();
    ed.canvas.requestRenderAll();
  }
  return t;
}

// ---- previews ------------------------------------------------------------------------------

const previewCache = new Map();
const TILE_W = 300, TILE_H = 132;

/** A data URL of the preset drawn small with its real fonts and effects. */
export async function presetPreview(preset) {
  if (previewCache.has(preset.id)) return previewCache.get(preset.id);
  const job = (async () => {
    const obj = await buildPreset(preset, 0.5, 640, { tight: true });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement("canvas");
    c.width = TILE_W * dpr;
    c.height = TILE_H * dpr;
    const ctx = c.getContext("2d");
    obj.setPositionByOrigin({ x: 0, y: 0 }, "center", "center");
    obj.setCoords();
    const r = obj.getBoundingRect();
    const padX = 26, padY = 24;
    const s = Math.min((TILE_W - padX * 2) / r.width, (TILE_H - padY * 2) / r.height, 1.4);
    ctx.scale(dpr, dpr);
    ctx.translate(TILE_W / 2, TILE_H / 2);
    ctx.scale(s, s);
    obj.render(ctx);
    return c.toDataURL("image/png");
  })();
  previewCache.set(preset.id, job);
  try {
    return await job;
  } catch (e) {
    previewCache.delete(preset.id);
    throw e;
  }
}
