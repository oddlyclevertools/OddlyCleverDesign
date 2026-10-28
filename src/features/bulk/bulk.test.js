// Bulk Create pure parts: table parsing (paste, CSV quotes, xlsx stored + deflated), the zip
// writer/reader round trip and placeholder filling that keeps per-letter styles.
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { colIndex, detectDelimiter, parseTable, splitDelimited, xlsxCells, toTable } from "./data.js";
import { buildStyles, fillPlaceholders, flattenStyles, placeholdersIn, replaceAllText } from "./textstyles.js";
import { crc32, createZip, readZip } from "./zip.js";

const enc = new TextEncoder();

describe("tables", () => {
  it("parses a pasted spreadsheet (tabs) with headings", () => {
    const t = parseTable("Name\tCity\nAmy\tLeeds\nBo\tYork\n");
    expect(t.columns).toEqual(["Name", "City"]);
    expect(t.rows).toEqual([{ Name: "Amy", City: "Leeds" }, { Name: "Bo", City: "York" }]);
  });
  it("handles CSV quotes, commas, newlines and CRLF", () => {
    expect(detectDelimiter('a,b;c\n')).toBe(",");
    const cells = splitDelimited('Name,Quote\r\n"Smith, Jo","He said ""hi""\nthen left"\r\n');
    expect(cells[1]).toEqual(["Smith, Jo", 'He said "hi"\nthen left']);
  });
  it("names blank and repeated headings and drops empty rows", () => {
    const t = toTable([["Name", "", "Name"], ["", "", ""], ["a", "b", "c"]]);
    expect(t.columns).toEqual(["Name", "Column 2", "Name (2)"]);
    expect(t.rows).toHaveLength(1);
  });
  it("explains empty input", () => {
    expect(() => parseTable("  ")).toThrow(/Paste a table/);
    expect(() => parseTable("Name\n")).toThrow(/no rows/);
  });
  it("reads column letters", () => {
    expect(colIndex("A")).toBe(0);
    expect(colIndex("Z")).toBe(25);
    expect(colIndex("AB")).toBe(27);
  });
});

function xlsx(deflate) {
  const files = {
    "xl/workbook.xml": '<workbook xmlns:r="r"><sheets><sheet name="People" sheetId="1" r:id="rId7"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId7" Target="worksheets/sheet3.xml"/></Relationships>',
    "xl/sharedStrings.xml": "<sst><si><t>Name</t></si><si><r><t>Pri</t></r><r><t>ce</t></r></si><si><t>Tom &amp; Jo</t></si></sst>",
    "xl/worksheets/sheet3.xml": '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>'
      + '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>9.5</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Zed</t></is></c><c r="B3" t="b"><v>1</v></c></row></sheetData></worksheet>',
  };
  if (!deflate) return createZip(Object.entries(files).map(([name, s]) => ({ name, data: enc.encode(s) })));
  // A deflated zip, like Excel writes.
  const parts = [], central = [];
  let off = 0;
  for (const [name, s] of Object.entries(files)) {
    const raw = enc.encode(s), comp = deflateRawSync(raw), nb = enc.encode(name);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(8, 8, true); h.setUint32(14, crc32(raw), true);
    h.setUint32(18, comp.length, true); h.setUint32(22, raw.length, true); h.setUint16(26, nb.length, true);
    parts.push(new Uint8Array(h.buffer), nb, comp);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(10, 8, true); c.setUint32(20, comp.length, true); c.setUint32(24, raw.length, true);
    c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nb);
    off += 30 + nb.length + comp.length;
  }
  const size = central.reduce((t, p) => t + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(10, Object.keys(files).length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)]);
}

describe("xlsx and zip", () => {
  for (const deflate of [false, true]) {
    it(`reads the first sheet (${deflate ? "deflated" : "stored"})`, async () => {
      const cells = await xlsxCells(await xlsx(deflate).arrayBuffer());
      const t = toTable(cells);
      expect(t.columns).toEqual(["Name", "Column 2", "Price"]);
      expect(t.rows[0]).toEqual({ Name: "Tom & Jo", "Column 2": "", Price: "9.5" });
      expect(t.rows[1]).toEqual({ Name: "Zed", "Column 2": "TRUE", Price: "" });
    });
  }
  it("writes a zip it can read back, with unique names", async () => {
    const blob = createZip([{ name: "a.png", data: enc.encode("one") }, { name: "a.png", data: enc.encode("two") }]);
    const z = readZip(new Uint8Array(await blob.arrayBuffer()));
    expect([...z.keys()]).toEqual(["a.png", "a (2).png"]);
    expect(new TextDecoder().decode(await z.get("a (2).png")())).toBe("two");
  });
  it("rejects a file that isn't a zip", () => {
    expect(() => readZip(enc.encode("not a zip at all, sorry about that"))).toThrow(/valid spreadsheet/);
  });
});

describe("text with styles", () => {
  const styles = { 0: { 0: { fill: "red" }, 3: { fontWeight: 900 } }, 1: { 0: { fill: "blue" } } };
  it("flattens and rebuilds styles", () => {
    const flat = flattenStyles("Hi {{x}}\nyo", styles);
    expect(buildStyles("Hi {{x}}\nyo", flat)).toEqual(styles);
  });
  it("fills placeholders case-insensitively, keeping styles around them", () => {
    const r = fillPlaceholders("Hi {{ NAME }}!\nyo {{nope}}", styles, { name: "Amélie" });
    expect(r.text).toBe("Hi Amélie!\nyo {{nope}}");
    expect(r.unknown).toEqual(["nope"]);
    expect(r.styles[0][0]).toEqual({ fill: "red" });
    expect(r.styles[0][3]).toEqual({ fontWeight: 900 }); // A takes the placeholder's style
    expect(r.styles[0][8]).toEqual({ fontWeight: 900 });
    expect(r.styles[1][0]).toEqual({ fill: "blue" });
    expect(placeholdersIn("{{a}} and {{ b c }}")).toEqual(["a", "b c"]);
  });
  it("replaces all text with the first letter's style", () => {
    const r = replaceAllText("Big", { 0: { 0: { fill: "red" } } }, "New\nwords");
    expect(r.styles[1][4]).toEqual({ fill: "red" });
    expect(replaceAllText("Big", {}, "x").styles).toEqual({});
  });
});
