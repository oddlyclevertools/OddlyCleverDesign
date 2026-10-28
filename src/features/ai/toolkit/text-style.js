// Text styling shared by add_text and update_objects: fonts, size, colour, spacing, effects, curve.
import { ensureFont, FONTS, nearestWeight } from "../../../core/fonts.js";
import { userFonts } from "../../styles/user-fonts.js";
import { withEffect } from "../../text/effects.js";
import { ToolInputError, closest } from "./validate.js";
import { checkEffects } from "./rules.js";
import { gradientFill } from "./context.js";

/** A font family the app has (built in or the user's own), matched case-insensitively. */
export function resolveFamily(name) {
  const all = [...Object.keys(FONTS), ...userFonts().map((f) => f.family)];
  const hit = all.find((f) => f === name) || all.find((f) => f.toLowerCase() === String(name).toLowerCase());
  if (hit) return hit;
  const hint = closest(name, all);
  throw new ToolInputError(`The font "${name}" isn't in this app.${hint ? ` Did you mean "${hint}"?` : ""} Call list_assets with catalog "fonts". Fonts can't be loaded from the web.`);
}

/** The weight/style to use for a family (snapped to what it ships), loaded and ready. */
export async function faceFor(family, weight, italic) {
  const w = FONTS[family] ? nearestWeight(family, weight) : 400;
  const style = italic && (FONTS[family]?.italic ?? false) ? "italic" : "normal";
  await ensureFont(family, w, style);
  return { fontFamily: family, fontWeight: w, fontStyle: style };
}

/** A new effect object from the current one plus switches on/off (never mutates). */
export function nextEffect(current, effect, remove) {
  const on = checkEffects(effect || {});
  let fx = current || null;
  for (const name of remove || []) fx = name === "all" ? null : withEffect(fx, name, null);
  for (const [name, params] of Object.entries(on)) fx = withEffect(fx, name, params);
  return fx;
}

/**
 * Apply the text fields of an input to an OcText (font, size, colour, spacing, effects, curve).
 * Words (text/uppercase) are set by the caller. Keeps the centre when `keepCenter`.
 */
export async function styleText(t, inp, { keepCenter = true } = {}) {
  // Inside a group (a text combo or badge) positions are local: leave them alone.
  const keep = keepCenter && !t.parent && !t.group;
  const c = t.getCenterPoint();
  const props = {};
  if (inp.font !== undefined || inp.weight !== undefined || inp.italic !== undefined) {
    const family = inp.font !== undefined ? resolveFamily(inp.font) : t.fontFamily;
    Object.assign(props, await faceFor(family, inp.weight ?? (Number(t.fontWeight) || 400), inp.italic ?? t.fontStyle === "italic"));
  }
  if (inp.font_size !== undefined) props.fontSize = inp.font_size / Math.abs(t.scaleY || 1);
  if (inp.gradient) props.fill = gradientFill(inp.gradient).fill;
  else if (inp.color !== undefined) props.fill = inp.color;
  if (inp.align !== undefined) props.textAlign = inp.align;
  if (inp.line_height !== undefined) props.lineHeight = inp.line_height;
  if (inp.letter_spacing !== undefined) props.charSpacing = inp.letter_spacing;
  let data = t.data || {};
  if (inp.effect !== undefined || inp.remove_effects !== undefined) {
    const fx = nextEffect(data.effect, inp.effect, inp.remove_effects);
    const { effect: _old, ...rest } = data;
    data = fx ? { ...rest, effect: fx } : rest;
  }
  if (inp.curve !== undefined) {
    const { curve: _c, ...rest } = data;
    data = inp.curve ? { ...rest, curve: inp.curve } : rest;
  }
  if (data !== t.data) props.data = data;
  if (Object.keys(props).length) {
    // A per-character style would override the new font or colour for some letters.
    const drop = [...(props.fontFamily ? ["fontFamily", "fontWeight", "fontStyle"] : []), ...(props.fill ? ["fill"] : [])];
    if (drop.length && t.styles && Object.keys(t.styles).length) props.styles = stripStyles(t.styles, drop);
    t.set(props);
    t.initDimensions();
    t.dirty = true;
  }
  if (keep) t.setPositionByOrigin(c, "center", "center");
  t.setCoords();
}

/** A copy of per-character styles without `keys`. */
function stripStyles(styles, keys) {
  const out = {};
  for (const [line, chars] of Object.entries(styles)) {
    out[line] = {};
    for (const [ch, st] of Object.entries(chars || {})) {
      const rest = Object.fromEntries(Object.entries(st).filter(([k]) => !keys.includes(k)));
      if (Object.keys(rest).length) out[line][ch] = rest;
    }
  }
  return out;
}

/** Text width that hugs the words (longest line), capped at `max`. */
export function hugWidth(t, max) {
  t.set("width", 6000);
  t.initDimensions();
  const natural = Math.ceil(t.calcTextWidth()) + 4;
  t.set("width", Math.max(20, Math.min(natural, max)));
  t.initDimensions();
}
