// The design sanitiser: unknown types and outside URLs never reach Fabric.
import { describe, expect, it } from "vitest";
import { sanitizeCanvas, sanitizeObjects } from "../../src/core/sanitize.js";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("sanitizeObjects", () => {
  it("keeps known types and data: images", () => {
    const { objects, dropped } = sanitizeObjects([{ type: "Rect", width: 10 }, { type: "Image", src: PNG }]);
    expect(objects).toHaveLength(2);
    expect(dropped).toBe(0);
  });

  it("drops unknown types and remote images, also inside groups and clip paths", () => {
    const { objects, dropped } = sanitizeObjects([
      { type: "NotAThing" },
      { type: "Image", src: "http://127.0.0.1:9999/track.png" },
      { type: "Rect", fill: { type: "pattern", source: "https://example.com/p.png" } },
      { type: "Group", objects: [{ type: "Rect" }, { type: "Image", src: "//evil/x.png" }],
        clipPath: { type: "Image", src: "https://example.com/c.png" } },
    ]);
    expect(dropped).toBe(5);
    expect(objects).toHaveLength(1);
    expect(objects[0].objects).toHaveLength(1);
    expect(objects[0].clipPath).toBeUndefined();
  });

  it("strips prototype keys and does not change the input", () => {
    const input = JSON.parse('[{"type":"Rect","__proto__":{"polluted":true},"data":{"constructor":1,"ok":2}}]');
    const { objects } = sanitizeObjects(input);
    expect(Object.keys(objects[0])).not.toContain("__proto__");
    expect(objects[0].data).toEqual({ ok: 2 });
    expect({}.polluted).toBeUndefined();
    expect(input[0].data.constructor).toBe(1);
  });

  it("rejects absurd nesting", () => {
    let deep = { type: "Group", objects: [] };
    for (let i = 0; i < 60; i++) deep = { type: "Group", objects: [deep] };
    expect(() => sanitizeObjects([deep])).toThrow(/nested/);
  });
});

describe("sanitizeCanvas", () => {
  it("drops canvas-level images and settings", () => {
    const { canvas } = sanitizeCanvas({
      version: "7.4.0", objects: [], background: "#fff",
      backgroundImage: { type: "Image", src: "https://example.com/bg.png" }, overlayImage: {}, selectionColor: "red",
    });
    expect(canvas).toEqual({ version: "7.4.0", objects: [], background: "#fff" });
  });
});
