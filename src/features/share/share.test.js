// Share pure parts: the .html builder (offline, escaped, pages) and the comments file checks.
import { describe, expect, it } from "vitest";
import { parseComments } from "./comments.js";
import { COMMENTS_KIND, buildShareHtml, inlineSvg, scriptHashes } from "./html.js";

const page = (markup = "<svg></svg>") => ({ width: 1280, height: 720, markup });

describe("share html", () => {
  it("is self-contained and forbids network requests", () => {
    const html = buildShareHtml({ title: "My <design>", exportId: "x1", pages: [page()] });
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("<title>My &lt;design&gt;</title>");
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toContain('id="add"');
    expect(html).not.toContain('id="prev"');
  });
  it("adds page arrows for several pages and comments in review mode", () => {
    const html = buildShareHtml({ title: "T", mode: "review", exportId: "x", pages: [page(), page()] });
    expect(html).toContain('id="prev"');
    expect(html).toContain('id="save"');
    expect(html).toContain(COMMENTS_KIND);
    expect((html.match(/class="pg"/g) || []).length).toBe(2);
  });
  it("keeps </script> in the title out of the script", () => {
    const html = buildShareHtml({ title: "</script><script>alert(1)</script>", exportId: "x", pages: [page()] });
    expect(html).not.toContain("<script>alert(1)");
  });
  it("locks scripts to their hashes", async () => {
    const hashes = await scriptHashes("review");
    expect(hashes).toHaveLength(2);
    const html = buildShareHtml({ title: "T", mode: "review", exportId: "x", pages: [page()], hashes });
    expect(html).toMatch(/script-src 'sha256-[A-Za-z0-9+/=]+' 'sha256-/);
    expect(html).not.toMatch(/script-src 'unsafe-inline'/);
  });
  it("needs a page", () => {
    expect(() => buildShareHtml({ title: "T", exportId: "x", pages: [] })).toThrow();
  });
  it("inlines svg without the prolog or fixed size", () => {
    const s = inlineSvg('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect/></svg>');
    expect(s.startsWith("<svg")).toBe(true);
    expect(s).not.toMatch(/\swidth="1280"/);
    expect(s).toContain('viewBox="0 0 1280 720"');
  });
});

describe("comments files", () => {
  const good = { app: "oddlyclever-design", kind: COMMENTS_KIND, reviewer: " Sam ", design: { id: "d1", name: "Ad" },
    comments: [{ page: 0, x: 0.5, y: 1.4, text: " Bigger logo " }, { page: -1, x: 0, y: 0, text: "bad page" }, { page: 0, x: 0.1, y: 0.1, text: "   " }] };
  it("keeps valid comments, clamps and trims", () => {
    const p = parseComments(JSON.stringify(good));
    expect(p.reviewer).toBe("Sam");
    expect(p.comments).toEqual([{ page: 0, x: 0.5, y: 1, text: "Bigger logo", at: "" }]);
    expect(p.design.id).toBe("d1");
  });
  it("refuses other files", () => {
    expect(() => parseComments("nope")).toThrow(/isn't JSON/);
    expect(() => parseComments('{"kind":"other"}')).toThrow(/review copy/);
    expect(() => parseComments("")).toThrow(/empty/);
  });
});
