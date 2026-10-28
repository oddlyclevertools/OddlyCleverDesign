import { describe, expect, it } from "vitest";
import { createBus } from "../../src/core/bus.js";
import { MAX_SIDE, resolveSize, SIZES } from "../../src/core/sizes.js";
import { FONTS, nearestWeight } from "../../src/core/fonts.js";

describe("bus", () => {
  it("delivers events and unsubscribes", () => {
    const bus = createBus();
    const got = [];
    const off = bus.on("x", (a, b) => got.push([a, b]));
    bus.emit("x", 1, 2);
    off();
    bus.emit("x", 3, 4);
    expect(got).toEqual([[1, 2]]);
  });

  it("keeps going when a handler throws", () => {
    const bus = createBus();
    const got = [];
    bus.on("x", () => { throw new Error("boom"); });
    bus.on("x", () => got.push("second"));
    const err = console.error;
    console.error = () => {};
    bus.emit("x");
    console.error = err;
    expect(got).toEqual(["second"]);
  });
});

describe("sizes", () => {
  it("has unique preset ids and sane sizes", () => {
    const ids = SIZES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SIZES) expect(s.w <= MAX_SIDE && s.h <= MAX_SIDE && s.w >= 16 && s.h >= 16).toBe(true);
  });

  it("resolves presets and validates custom sizes", () => {
    expect(resolveSize("yt-thumb")).toEqual({ w: 1280, h: 720, preset: "yt-thumb" });
    expect(resolveSize({ w: "640.4", h: 360 })).toEqual({ w: 640, h: 360, preset: null });
    expect(() => resolveSize("nope")).toThrow();
    expect(() => resolveSize({ w: 10, h: 100 })).toThrow();
    expect(() => resolveSize({ w: MAX_SIDE + 1, h: 100 })).toThrow();
    expect(() => resolveSize({ w: "abc", h: 100 })).toThrow();
  });
});

describe("fonts", () => {
  it("snaps to a weight the family has", () => {
    expect(nearestWeight("Anton", 700)).toBe(400);
    expect(nearestWeight("Montserrat", 650)).toBe(600);
    expect(nearestWeight("Unknown", 900)).toBe(400);
    for (const f of Object.values(FONTS)) expect(f.weights.length).toBeGreaterThan(0);
  });
});
