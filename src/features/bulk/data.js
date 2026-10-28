// Bulk Create data: a pasted table, a CSV/TSV file or an .xlsx workbook, turned into
// { columns: string[], rows: object[] } (each row maps column name -> text).
import { readZip } from "./zip.js";

export const MAX_ROWS = 500;
export const MAX_COLS = 60;
const MAX_FILE = 25 * 1024 * 1024;

/** Pick the delimiter that splits the first line into the most columns. */
export function detectDelimiter(text) {
  const first = String(text).split(/\r?\n/).find((l) => l.trim()) || "";
  let best = ",", bestN = 0;
  for (const d of ["\t", ",", ";", "|"]) {
    let n = 0, q = false;
    for (const ch of first) {
      if (ch === '"') q = !q;
      else if (ch === d && !q) n++;
    }
    if (n > bestN) { best = d; bestN = n; }
  }
  return best;
}

/** Split delimited text into rows of cells (RFC 4180 quotes, CRLF or LF). */
export function splitDelimited(text, delim = detectDelimiter(text)) {
  const s = String(text).replace(/^﻿/, "");
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/**
 * Cells (first row = headings) to a table. Blank headings become "Column N", repeats get " (2)".
 * @param {string[][]} cells
 * @returns {{columns: string[], rows: Record<string,string>[], truncated: boolean}}
 */
export function toTable(cells) {
  const nonEmpty = cells.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  if (!nonEmpty.length) throw new Error("The table is empty. Paste rows with headings in the first row.");
  const width = Math.min(MAX_COLS, Math.max(...nonEmpty.map((r) => r.length)));
  const seen = new Map();
  const columns = [];
  for (let i = 0; i < width; i++) {
    let name = String(nonEmpty[0][i] ?? "").trim().replace(/\s+/g, " ") || `Column ${i + 1}`;
    const key = name.toLowerCase();
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n > 1) name = `${name} (${n})`;
    columns.push(name);
  }
  const body = nonEmpty.slice(1);
  if (!body.length) throw new Error("There are headings but no rows. Add one row per design under the headings.");
  const rows = body.slice(0, MAX_ROWS).map((r) => Object.fromEntries(columns.map((c, i) => [c, String(r[i] ?? "").trim()])));
  return { columns, rows, truncated: body.length > MAX_ROWS };
}

/** Parse pasted or CSV/TSV text into a table. */
export function parseTable(text) {
  if (!String(text || "").trim()) throw new Error("Paste a table first (copy it from a spreadsheet).");
  return toTable(splitDelimited(text));
}

// ---- xlsx --------------------------------------------------------------------------------------

const decodeXml = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** The text of every <t> in a fragment (rich text runs joined). */
const textsOf = (xml) => [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) => decodeXml(m[1])).join("");

/** "BC" -> 54 (0-based column index). */
export function colIndex(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Parse the first worksheet of an .xlsx file into cells. */
export async function xlsxCells(buf) {
  const zip = readZip(buf);
  const read = async (name) => (zip.has(name) ? new TextDecoder().decode(await zip.get(name)()) : null);
  const shared = [];
  const ss = await read("xl/sharedStrings.xml");
  if (ss) for (const m of ss.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)) shared.push(textsOf(m[1]));
  // The first sheet in the workbook's order, via its relationship id.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = await read("xl/workbook.xml"), rels = await read("xl/_rels/workbook.xml.rels");
  const rid = wb?.match(/<(?:\w+:)?sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (rid && rels) {
    const target = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((t) => t.includes(`Id="${rid}"`))?.match(/Target="([^"]+)"/)?.[1];
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }
  const sheet = await read(sheetPath);
  if (!sheet) throw new Error("Couldn't find a sheet in this workbook.");
  // The row/cell patterns below scan ahead for closing tags; keep the text small enough that a
  // broken sheet can't make that slow.
  if (sheet.length > 16e6) throw new Error("This sheet is too big for Bulk create. Keep it under about 5,000 rows, or save it as CSV.");
  const cells = [];
  for (const rm of sheet.matchAll(/<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const r = Number(rm[1].match(/\br="(\d+)"/)?.[1]) - 1;
    const rowIndex = Number.isFinite(r) && r >= 0 ? r : cells.length;
    if (rowIndex > MAX_ROWS + 1) break;
    const row = [];
    for (const cm of rm[2].matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const attrs = cm[1], inner = cm[2] || "";
      const ref = attrs.match(/\br="([A-Z]+)\d+"/i)?.[1];
      const ci = ref ? colIndex(ref) : row.length;
      if (ci >= MAX_COLS) continue;
      const t = attrs.match(/\bt="(\w+)"/)?.[1] || "n";
      const v = inner.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
      let val = "";
      if (t === "s") val = shared[Number(v)] ?? "";
      else if (t === "inlineStr") val = textsOf(inner);
      else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
      else if (v != null) val = decodeXml(v);
      row[ci] = val;
    }
    cells[rowIndex] = Array.from(row, (x) => x ?? "");
  }
  return Array.from(cells, (r) => r || []);
}

/**
 * Read a File (CSV, TSV, TXT or XLSX) into a table.
 * @param {File} file
 */
export async function readTableFile(file) {
  if (!file) throw new Error("No file chosen.");
  if (file.size > MAX_FILE) throw new Error("That file is too big (over 25 MB).");
  const name = (file.name || "").toLowerCase();
  if (/\.xlsx$|\.xlsm$/.test(name)) return toTable(await xlsxCells(await file.arrayBuffer()));
  if (/\.xls$|\.ods$|\.numbers$/.test(name)) throw new Error("Save the sheet as .xlsx or CSV first (this kind of file can't be read).");
  const text = await file.text();
  return toTable(splitDelimited(text, name.endsWith(".tsv") ? "\t" : detectDelimiter(text)));
}
