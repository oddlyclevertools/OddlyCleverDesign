// Translate pure parts: language lookup, script detection, right-to-left and font choice.
import { describe, expect, it } from "vitest";
import { findLanguage, fontFor, isRtlText, needsLetterWrap, scriptsIn } from "./languages.js";

describe("languages", () => {
  it("finds by code, English name or own name", () => {
    expect(findLanguage("ar")).toMatchObject({ name: "Arabic", rtl: true });
    expect(findLanguage("hebrew").code).toBe("he");
    expect(findLanguage("Español").code).toBe("es");
    expect(findLanguage("Klingon")).toMatchObject({ code: "Klingon", rtl: false });
    expect(() => findLanguage(" ")).toThrow();
  });
  it("detects scripts, RTL and languages without spaces", () => {
    expect(scriptsIn("नमस्ते").map((s) => s.id)).toEqual(["devanagari"]);
    expect(isRtlText("مرحبا بالعالم")).toBe(true);
    expect(isRtlText("שלום 2026")).toBe(true);
    expect(isRtlText("Hello مرحبا world")).toBe(false);
    expect(needsLetterWrap("今日は")).toBe(true);
    expect(needsLetterWrap("Привет")).toBe(false);
  });
});

describe("fonts for scripts", () => {
  it("keeps a font that has the letters", () => {
    expect(fontFor("Inter", "Привет мир")).toEqual({ ok: true, family: "Inter", missing: [] });
    expect(fontFor("Anton", "Hello")).toMatchObject({ ok: true });
  });
  it("switches to a bundled font that has them", () => {
    expect(fontFor("Anton", "مرحبا").family).toBe("Rubik");
    expect(fontFor("Montserrat", "नमस्ते").family).toBe("Poppins");
    expect(fontFor("Oswald", "สวัสดี").family).toBe("Kanit");
    expect(fontFor("Permanent Marker", "Zażółć").ok).toBe(false);
  });
  it("names a free font to upload when none is bundled", () => {
    const r = fontFor("Inter", "你好世界");
    expect(r.ok).toBe(false);
    expect(r.missing[0].suggest).toMatch(/Noto Sans SC/);
  });
  it("trusts fonts the user uploaded", () => {
    expect(fontFor("My Upload", "你好").ok).toBe(true);
  });
});
