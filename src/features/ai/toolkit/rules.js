// Run-time checks the JSON schemas can't express: text effect settings and catalogue keys.
// Pure (no DOM, no Fabric), so the unit tests cover it.
import { EFFECTS } from "../../text/effects.js";
import { COLOR_PATTERN, ToolInputError, closest, validate } from "./validate.js";
import { isEffectColorKey } from "./schemas.js";

const colorSchema = { type: "string", pattern: COLOR_PATTERN };

/** Check one effect's settings; returns a clean copy. */
export function checkEffect(name, params, where = `effect.${name}`) {
  const def = EFFECTS[name];
  if (!def) throw new ToolInputError(`"${name}" isn't a text effect. Effects: ${Object.keys(EFFECTS).join(", ")}.`);
  const out = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v === null || v === undefined) continue;
    if (!(k in def.defaults)) {
      const hint = closest(k, Object.keys(def.defaults));
      throw new ToolInputError(`"${where}.${k}" isn't a setting of ${name}.${hint ? ` Did you mean "${hint}"?` : ""} Settings: ${Object.keys(def.defaults).join(", ")}.`);
    }
    out[k] = isEffectColorKey(k)
      ? validate(colorSchema, v, `${where}.${k}`)
      : validate({ type: "number", ...(k === "direction" ? { minimum: -180, maximum: 180 } : { minimum: 0, maximum: 100 }) }, v, `${where}.${k}`);
  }
  return out;
}

/** Only one "look" effect can be on at a time. */
export function checkEffects(effect = {}) {
  const looks = Object.keys(effect).filter((k) => EFFECTS[k]?.kind === "look");
  if (looks.length > 1) throw new ToolInputError(`Only one look effect at a time (got ${looks.join(" and ")}). Layers (shadow, neon, chrome, sticker, outline, background) can stack.`);
  return Object.fromEntries(Object.entries(effect).map(([k, v]) => [k, checkEffect(k, v)]));
}

/**
 * Find a catalogue entry by key, or throw a friendly error that names the catalogue to list.
 * @template T
 * @param {T[]} list
 * @param {(item: T) => string} keyOf
 */
export function pick(list, key, keyOf, { what, catalog }) {
  const hit = list.find((x) => keyOf(x) === key) || list.find((x) => keyOf(x).toLowerCase() === String(key).toLowerCase());
  if (hit) return hit;
  const hint = closest(key, list.map(keyOf));
  throw new ToolInputError(`No ${what} called "${key}".${hint ? ` Did you mean "${hint}"?` : ""} Call list_assets with catalog "${catalog}" for the keys.`);
}
