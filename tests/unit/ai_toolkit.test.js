// AI toolkit input checks: the schemas every provider sees, and the validator that turns a bad
// tool call into a friendly, specific error (and keeps web addresses out).
import { describe, expect, it } from "vitest";
import { TOOLS, CATALOGS, EFFECT_NAMES } from "../../src/features/ai/toolkit/schemas.js";
import { assertNoRemote, closest, validate, validateToolInput, ToolInputError } from "../../src/features/ai/toolkit/validate.js";
import { checkEffect, checkEffects, pick } from "../../src/features/ai/toolkit/rules.js";

const run = (name, input) => validateToolInput(TOOLS, name, input);
const err = (fn) => {
  try { fn(); } catch (e) { return e; }
  throw new Error("expected an error");
};

describe("tool schemas", () => {
  it("has the contract shape, unique names and every required tool", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of TOOLS) {
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.input_schema.type).toBe("object");
    }
    for (const n of ["get_design", "look_at_design", "list_assets", "new_design", "apply_template", "set_background", "add_text",
      "add_shape", "add_line", "add_element", "add_character", "update_objects", "delete_objects", "arrange", "apply_palette",
      "apply_font_pairing", "animate", "check_design", "undo"]) expect(names).toContain(n);
    expect(CATALOGS).toContain("templates");
    expect(EFFECT_NAMES).toContain("outline");
  });

  it("uses only provider-neutral JSON Schema", () => {
    const walk = (s, path) => {
      if (!s || typeof s !== "object") return;
      for (const bad of ["anyOf", "oneOf", "allOf", "$ref", "format"]) expect(s[bad], `${path}.${bad}`).toBeUndefined();
      if (s.type !== undefined) expect(typeof s.type, `${path}.type`).toBe("string");
      Object.entries(s.properties || {}).forEach(([k, v]) => walk(v, `${path}.${k}`));
      if (s.items) walk(s.items, `${path}[]`);
      if (typeof s.additionalProperties === "object") walk(s.additionalProperties, `${path}{}`);
    };
    for (const t of TOOLS) walk(t.input_schema, t.name);
  });

  it("stays small enough for local models", () => {
    // About 12k tokens for 31 tools: fits any local model with a 16k+ context. v0.4's features
    // (video, stock, planner, bulk, translate, share, magic edits, pages) share ONE tool,
    // use_feature, whose actions come from its "help" action, so they cost almost nothing here.
    // Raise it only with a reason; trim repeated wording first.
    expect(JSON.stringify(TOOLS).length).toBeLessThan(49000);
  });
});

describe("validateToolInput", () => {
  it("names unknown tools and suggests the closest", () => {
    const e = err(() => run("add_txt", {}));
    expect(e).toBeInstanceOf(ToolInputError);
    expect(e.message).toMatch(/No tool called "add_txt". Did you mean "add_text"\?/);
  });

  it("requires fields and rejects unknown ones with a hint", () => {
    expect(err(() => run("add_text", {})).message).toMatch(/"text" is required/);
    expect(err(() => run("add_text", { text: "hi", colour: "#fff" })).message).toMatch(/"colour" isn't a field here. Did you mean "color"\?/);
    expect(err(() => run("update_objects", { changes: [{ id: "a", sise: 3 }] })).message).toMatch(/changes\[0\]\.sise/);
  });

  it("checks types, ranges, enums and lists", () => {
    expect(err(() => run("add_text", { text: "hi", font_size: "huge" })).message).toMatch(/"font_size" must be a number/);
    expect(err(() => run("add_shape", { shape: "rect", opacity: 3 })).message).toMatch(/between 0 and 1 \(got 3\)/);
    expect(err(() => run("add_character", { who: "spark" })).message).toMatch(/Did you mean "sparks"\?/);
    expect(err(() => run("delete_objects", { ids: [] })).message).toMatch(/at least 1 item/);
    expect(err(() => run("undo", { steps: 1.5 })).message).toMatch(/whole number/);
    expect(err(() => run("add_text", { text: "" })).message).toMatch(/can't be empty/);
  });

  it("accepts numbers and booleans sent as text, and treats null as not given", () => {
    expect(run("add_text", { text: "hi", font_size: "64", italic: "true", x: null })).toEqual({ text: "hi", font_size: 64, italic: true });
  });

  it("checks colours strictly", () => {
    for (const c of ["#fff", "#ff2e7e", "#ff2e7e80", "rgb(1, 2, 3)", "rgba(1,2,3,0.5)", "hsl(330 100% 59%)", "transparent"]) {
      expect(run("add_shape", { shape: "rect", fill: c }).fill).toBe(c);
    }
    for (const c of ["pink-ish", "#12345", "#ggg", "url(#x)", "rgb(1,2,3); x"]) {
      expect(err(() => run("add_shape", { shape: "rect", fill: c })).message).toMatch(/must be a colour/);
    }
  });

  it("drops prototype keys", () => {
    const out = run("add_text", JSON.parse('{"text":"hi","__proto__":{"polluted":1}}'));
    expect(out).toEqual({ text: "hi" });
    expect({}.polluted).toBeUndefined();
  });

  it("rejects input that isn't an object", () => {
    expect(err(() => run("get_design", "please")).message).toMatch(/must be an object/);
    expect(run("get_design", undefined)).toEqual({});
  });
});

describe("no remote loading", () => {
  it("rejects web and file addresses outside plain text", () => {
    expect(err(() => run("set_background", { scene: "https://x.example/a.png" })).message).toMatch(/web address/);
    expect(err(() => run("add_element", { type: "icon", key: "//cdn.example/i.svg" })).message).toMatch(/web address/);
    expect(err(() => run("new_design", { template: "file:///C:/x" })).message).toMatch(/web address/);
    expect(err(() => assertNoRemote({ a: { b: "javascript:alert(1)" } })).message).toMatch(/a\.b/);
  });

  it("allows addresses as words on the design", () => {
    expect(run("add_text", { text: "Visit https://oddlyclever.example" }).text).toContain("https://");
  });

  it("only takes inline raster pictures", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(run("add_element", { type: "image", image_data: png }).image_data).toBe(png);
    expect(err(() => run("add_element", { type: "image", image_data: "data:image/svg+xml;base64,PHN2Zz4=" })).message).toMatch(/SVG aren't allowed/);
    expect(err(() => run("add_element", { type: "image", image_data: "http://x/y.png" })).message).toMatch(/inline picture/);
  });
});

describe("text effects and catalogue keys", () => {
  it("checks effect settings", () => {
    expect(checkEffect("outline", { thickness: "40", color: "#000" })).toEqual({ thickness: 40, color: "#000" });
    expect(err(() => checkEffect("outline", { thickness: 101 })).message).toMatch(/between 0 and 100/);
    expect(err(() => checkEffect("shadow", { direction: 400 })).message).toMatch(/between -180 and 180/);
    expect(err(() => checkEffect("outline", { colour: "#000" })).message).toMatch(/Did you mean "color"\?/);
    expect(err(() => checkEffect("outline", { color: "nope" })).message).toMatch(/must be a colour/);
    expect(err(() => checkEffect("sparkle", {})).message).toMatch(/isn't a text effect/);
  });

  it("allows stacked layers but only one look", () => {
    expect(Object.keys(checkEffects({ outline: {}, shadow: {}, neon: {} }))).toHaveLength(3);
    expect(err(() => checkEffects({ hollow: {}, glitch: {} })).message).toMatch(/one look effect/);
  });

  it("finds catalogue keys forgivingly and points at list_assets", () => {
    const list = [{ key: "coin" }, { key: "crown" }];
    expect(pick(list, "COIN", (x) => x.key, { what: "illustration", catalog: "illustrations" }).key).toBe("coin");
    expect(err(() => pick(list, "coins", (x) => x.key, { what: "illustration", catalog: "illustrations" })).message)
      .toMatch(/No illustration called "coins". Did you mean "coin"\? Call list_assets with catalog "illustrations"/);
    expect(closest("zzzzzz", ["coin"])).toBeNull();
  });

  it("validates nested schemas directly", () => {
    expect(validate({ type: "array", items: { type: "integer", minimum: 0 } }, [1, "2"])).toEqual([1, 2]);
  });
});
