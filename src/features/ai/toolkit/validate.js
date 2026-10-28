// Input checking for AI tool calls. A small JSON-Schema subset (type, enum, range, length,
// pattern, properties, required, additionalProperties, items) with friendly, specific errors,
// plus the safety rules: nothing an AI sends may make the app load a web address.
// Pure: no DOM, no Fabric, so the unit tests can run it in Node.

/** Anything that could make the browser fetch something. Text content is exempt (it's only drawn). */
const REMOTE = /(^|[\s("'=])(https?|ftp|file|blob|wss?|javascript|vbscript):|^\s*\/\/|url\s*\(|@import/i;
/** Fields whose strings are only ever drawn as words, never loaded. */
// svg is checked by draw_vector's own cleaner (it drops every outside link); prompt only goes to the image AI.
const TEXT_KEYS = new Set(["text", "name", "label", "number", "query", "badge_text", "title", "svg", "prompt", "description", "notes"]);
/** The only way in for a picture: a small inline raster image. */
export const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;
export const MAX_IMAGE_CHARS = 8 * 1024 * 1024;
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const COLOR_PATTERN = "^(#[0-9a-fA-F]{3,8}|(rgb|hsl)a?\\([0-9.,%\\sdeg]+\\)|transparent|white|black)$";
/** The schema pattern is kept short; this is the strict test (no 5- or 7-digit hex). */
const STRICT_HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const PATTERN_HELP = {
  [COLOR_PATTERN]: 'a colour like "#ff2e7e", "rgb(255, 46, 126)" or "transparent"',
};

export class ToolInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolInputError";
  }
}

const show = (v) => {
  if (typeof v === "string") return `"${v.length > 40 ? `${v.slice(0, 37)}...` : v}"`;
  if (v === null) return "null";
  if (Array.isArray(v)) return "a list";
  if (typeof v === "object") return "an object";
  return String(v);
};
const kindOf = (v) => (v === null ? "null" : Array.isArray(v) ? "a list" : typeof v === "object" ? "an object"
  : typeof v === "string" ? "text" : typeof v === "number" ? "a number" : typeof v === "boolean" ? "true/false" : typeof v);
const TYPE_WORDS = { string: "text", number: "a number", integer: "a whole number", boolean: "true or false", object: "an object", array: "a list" };

/** Edit distance, for "Did you mean ...?" hints. */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/** The closest option to `word`, when it's close enough to be a likely typo. */
export function closest(word, options) {
  const w = String(word).toLowerCase();
  let best = null, bestD = Infinity;
  for (const o of options) {
    const dd = distance(w, String(o).toLowerCase());
    if (dd < bestD) { best = o; bestD = dd; }
  }
  return best !== null && bestD <= Math.max(2, Math.floor(w.length / 3)) ? best : null;
}

const listOf = (items, max = 14) => {
  const shown = items.slice(0, max).join(", ");
  return items.length > max ? `${shown}, ... (${items.length} in all)` : shown;
};

/** Numbers and booleans that arrive as text ("64", "true") are accepted; small models do that. */
function coerce(schema, v) {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if ((schema.type === "number" || schema.type === "integer") && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (schema.type === "boolean" && /^(true|false)$/i.test(t)) return t.toLowerCase() === "true";
  return v;
}

function check(schema, value, path) {
  const where = path || "input";
  const v = coerce(schema, value);
  const t = schema.type;
  if (t === "string" && typeof v !== "string") throw new ToolInputError(`"${where}" must be text (got ${kindOf(v)}).`);
  if ((t === "number" || t === "integer") && (typeof v !== "number" || !Number.isFinite(v))) {
    throw new ToolInputError(`"${where}" must be ${TYPE_WORDS[t]} (got ${kindOf(v)}${typeof v === "string" ? ` ${show(v)}` : ""}).`);
  }
  if (t === "integer" && !Number.isInteger(v)) throw new ToolInputError(`"${where}" must be a whole number (got ${v}).`);
  if (t === "boolean" && typeof v !== "boolean") throw new ToolInputError(`"${where}" must be true or false (got ${kindOf(v)}).`);
  if (t === "array" && !Array.isArray(v)) throw new ToolInputError(`"${where}" must be a list (got ${kindOf(v)}).`);
  if (t === "object" && (!v || typeof v !== "object" || Array.isArray(v))) throw new ToolInputError(`"${where}" must be an object (got ${kindOf(v)}).`);

  if (schema.enum && !schema.enum.includes(v)) {
    const hint = typeof v === "string" ? closest(v, schema.enum) : null;
    throw new ToolInputError(`"${where}" must be one of: ${listOf(schema.enum)} (got ${show(v)}).${hint ? ` Did you mean "${hint}"?` : ""}`);
  }
  if (typeof v === "number") {
    const lo = schema.minimum, hi = schema.maximum;
    if ((lo !== undefined && v < lo) || (hi !== undefined && v > hi)) {
      const range = lo !== undefined && hi !== undefined ? `between ${lo} and ${hi}` : lo !== undefined ? `at least ${lo}` : `at most ${hi}`;
      throw new ToolInputError(`"${where}" must be ${range} (got ${v}).`);
    }
  }
  if (typeof v === "string") {
    if (schema.minLength !== undefined && v.length < schema.minLength) {
      throw new ToolInputError(schema.minLength === 1 ? `"${where}" can't be empty.` : `"${where}" must be at least ${schema.minLength} characters.`);
    }
    if (schema.maxLength !== undefined && v.length > schema.maxLength) {
      throw new ToolInputError(`"${where}" is too long (${v.length} characters, at most ${schema.maxLength}).`);
    }
    const bad = schema.pattern && (!new RegExp(schema.pattern).test(v.trim())
      || (schema.pattern === COLOR_PATTERN && v.trim().startsWith("#") && !STRICT_HEX.test(v.trim())));
    if (bad) {
      throw new ToolInputError(`"${where}" must be ${PATTERN_HELP[schema.pattern] || `in the form ${schema.pattern}`} (got ${show(v)}).`);
    }
    return schema.pattern ? v.trim() : v;
  }
  if (Array.isArray(v)) {
    if (schema.minItems !== undefined && v.length < schema.minItems) throw new ToolInputError(`"${where}" needs at least ${schema.minItems} item${schema.minItems > 1 ? "s" : ""}.`);
    if (schema.maxItems !== undefined && v.length > schema.maxItems) throw new ToolInputError(`"${where}" can have at most ${schema.maxItems} items (got ${v.length}).`);
    return schema.items ? v.map((x, i) => check(schema.items, x, `${where}[${i}]`)) : v.slice();
  }
  if (t === "object") return checkObject(schema, v, path);
  return v;
}

function checkObject(schema, v, path) {
  const props = schema.properties || {};
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (BAD_KEYS.has(k)) continue;
    const sub = path ? `${path}.${k}` : k;
    if (props[k]) {
      if (x === undefined || x === null) continue; // "not given"
      out[k] = check(props[k], x, sub);
    } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      if (x === undefined || x === null) continue;
      out[k] = check(schema.additionalProperties, x, sub);
    } else if (schema.additionalProperties === false) {
      const names = Object.keys(props);
      const hint = closest(k, names);
      throw new ToolInputError(`"${sub}" isn't a field here.${hint ? ` Did you mean "${hint}"?` : ""} Fields: ${listOf(names, 30)}.`);
    } else {
      out[k] = x;
    }
  }
  for (const r of schema.required || []) {
    if (out[r] === undefined) throw new ToolInputError(`"${path ? `${path}.${r}` : r}" is required.`);
  }
  return out;
}

/**
 * Check `value` against a JSON schema. Returns a clean copy (prototype keys dropped, numbers
 * given as text turned into numbers, nulls treated as "not given"). Throws ToolInputError.
 */
export function validate(schema, value, path = "") {
  return check(schema, value ?? (schema.type === "object" ? {} : value), path);
}

/** Throw when any string (outside plain text fields) points at the web or a file. */
export function assertNoRemote(value, path = "") {
  if (typeof value === "string") {
    const key = path.split(/[.[\]]/).filter(Boolean).filter((p) => !/^\d+$/.test(p)).pop() || "";
    if (key === "image_data") {
      if (!DATA_IMAGE.test(value)) {
        throw new ToolInputError(`"${path}" must be an inline picture: data:image/png, jpeg, webp or gif with base64 data. Web addresses and SVG aren't allowed.`);
      }
      if (value.length > MAX_IMAGE_CHARS) throw new ToolInputError(`"${path}" is too big (at most about 6 MB).`);
      return;
    }
    if (!TEXT_KEYS.has(key) && REMOTE.test(value)) {
      throw new ToolInputError(`"${path}" looks like a web address or file link. This app works offline and never loads outside files: use list_assets for built-in art.`);
    }
    return;
  }
  if (Array.isArray(value)) value.forEach((x, i) => assertNoRemote(x, `${path}[${i}]`));
  else if (value && typeof value === "object") {
    for (const [k, x] of Object.entries(value)) assertNoRemote(x, path ? `${path}.${k}` : k);
  }
}

/**
 * Validate a tool call's input against the tool's schema and the safety rules.
 * @param {{name: string, input_schema: object}[]} tools
 */
export function validateToolInput(tools, name, input) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    const hint = closest(name, tools.map((t) => t.name));
    throw new ToolInputError(`No tool called "${name}".${hint ? ` Did you mean "${hint}"?` : ""} Tools: ${tools.map((t) => t.name).join(", ")}.`);
  }
  if (input !== undefined && input !== null && (typeof input !== "object" || Array.isArray(input))) {
    throw new ToolInputError(`${name}: the input must be an object of named fields.`);
  }
  try {
    const clean = validate(tool.input_schema, input || {});
    assertNoRemote(clean);
    return clean;
  } catch (e) {
    if (e instanceof ToolInputError) throw new ToolInputError(`${name}: ${e.message}`);
    throw e;
  }
}
