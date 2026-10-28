// Font pairings: swap every text's font for the pairing's heading or body face, by size.
// The biggest texts (at least 55% of the largest, or big for the page) get the heading face.
import { ensureFont, nearestWeight } from "../../core/fonts.js";
import { isText, pageUnit } from "../text/helpers.js";
import { keepsColors } from "./recolor.js";
import { refitGroups } from "./recorder.js";

/** Every text in the design (inside groups too), with its size on the page. */
export function designTexts(editor) {
  const out = [];
  const walk = (o, k) => {
    if (keepsColors(o)) return;
    const s = k * Math.abs(o.scaleY || 1);
    if (isText(o)) out.push({ t: o, size: o.fontSize * s });
    else o._objects?.forEach((c) => walk(c, s));
  };
  editor.objects().forEach((o) => walk(o, 1));
  return out;
}

/** Split texts into heading and body. */
export function rolesOf(editor) {
  const list = designTexts(editor);
  const max = Math.max(0, ...list.map((x) => x.size));
  const big = 54 * pageUnit(editor);
  return list.map((x) => ({ ...x, role: list.length === 1 || x.size >= max * 0.55 || x.size >= big ? "head" : "body" }));
}

/** Load the faces a pairing needs. */
export async function loadPairing(pair) {
  const h = pair.head, b = pair.body;
  await Promise.all([
    ensureFont(h.family, nearestWeight(h.family, h.weight), h.style || "normal"),
    ensureFont(b.family, nearestWeight(b.family, b.weight), "normal"),
  ]);
}

/** Set the pairing's fonts through the recorder, keeping each text's centre still. */
export function applyPairing(app, pair, rec) {
  const ed = app.editor;
  const roles = rolesOf(ed);
  for (const { t, role } of roles) {
    const face = role === "head" ? pair.head : pair.body;
    const c = t.getCenterPoint();
    const boxW = t.width;
    rec.set(t, "left", t.left);
    rec.set(t, "top", t.top);
    rec.set(t, "fontFamily", face.family);
    rec.set(t, "fontWeight", nearestWeight(face.family, face.weight));
    rec.set(t, "fontStyle", face.style || "normal");
    // per-character font overrides would fight the pairing
    if (t.styles && Object.keys(t.styles).length) rec.set(t, "styles", stripFonts(t.styles));
    t.initDimensions();
    // a wider face can push a long word past the box: shrink it back to the old width
    for (let i = 0; i < 4 && t.width > boxW * 1.01; i++) {
      rec.set(t, "fontSize", Math.max(6, t.fontSize * (boxW / t.width) * 0.98));
      rec.set(t, "width", boxW);
      t.initDimensions();
    }
    t.setPositionByOrigin(c, "center", "center");
    t.setCoords();
  }
  refitGroups(roles.map((r) => r.t));
  ed.canvas.requestRenderAll();
  return roles.length;
}

function stripFonts(styles) {
  const out = {};
  for (const [line, chars] of Object.entries(styles)) {
    out[line] = {};
    for (const [ch, st] of Object.entries(chars || {})) {
      const { fontFamily, fontWeight, fontStyle, ...rest } = st;
      out[line][ch] = rest;
    }
  }
  return out;
}
