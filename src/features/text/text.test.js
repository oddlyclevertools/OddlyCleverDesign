import { describe, expect, it } from "vitest";
import { CASES, caseOf, originalOf } from "./casing.js";
import { faceKeys } from "./octext.js";
import { WEIGHT_NAMES, weightName } from "./weight.js";

const upper = CASES.find((c) => c[0] === "upper")[2];

describe("letter case keeps the words as typed", () => {
  it("finds the original while the cased words are unchanged", () => {
    const t = { text: upper("Make Money Fast"), data: { textCase: { id: "upper", original: "Make Money Fast" } } };
    expect(originalOf(t)).toBe("Make Money Fast");
    expect(caseOf(t)).toBe("upper");
  });

  it("forgets it once the words were edited", () => {
    const t = { text: "MAKE MONEY FASTER", data: { textCase: { id: "upper", original: "Make Money Fast" } } };
    expect(originalOf(t)).toBeNull();
    expect(caseOf(t)).toBe("original");
  });
});

describe("fonts a saved text needs", () => {
  it("includes styled letters in both saved forms", () => {
    const base = { fontFamily: "Montserrat", fontWeight: 800, fontStyle: "normal" };
    const arr = faceKeys({ ...base, styles: [{ start: 0, end: 3, style: { fontWeight: 900, fill: "#ff0" } }] });
    expect(arr).toEqual([["Montserrat", 800, "normal"], ["Montserrat", 900, "normal"]]);
    const obj = faceKeys({ ...base, styles: { 0: { 2: { fontStyle: "italic" }, 3: { fill: "#fff" } } } });
    expect(obj).toEqual([["Montserrat", 800, "normal"], ["Montserrat", 800, "italic"]]);
  });
});

describe("weight names", () => {
  it("names every CSS weight", () => {
    expect(Object.keys(WEIGHT_NAMES)).toHaveLength(9);
    expect(weightName(900)).toBe("Black");
    expect(weightName(650)).toBe("Bold"); // rounds to the nearest hundred
  });
});
