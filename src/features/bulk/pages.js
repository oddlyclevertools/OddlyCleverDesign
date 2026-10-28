// Multi-page designs are another feature (app.pages). This adapter is the only place Bulk Create,
// Translate and Share talk to it, so the contract lives here:
//   app.pages.docs()        -> every page as a design document (the open page's live state included)
//   app.pages.addFromJSON(doc) -> append a page built from a design document
//   app.pages.index         -> the open page's index (0-based)
// A few other likely method names are accepted too. Without app.pages, a design has one page.

const ADD_NAMES = ["addFromJSON", "addPageFromJSON", "addDoc", "addPage", "add"];
const DOCS_NAMES = ["docs", "toDocs", "allDocs"];

const api = (app) => (app?.pages && typeof app.pages === "object" ? app.pages : null);
const fnOf = (p, names) => names.map((n) => p[n]).find((f) => typeof f === "function");

/** True when the app can hold several pages in one design. */
export const hasPages = (app) => Boolean(api(app) && fnOf(api(app), ADD_NAMES));

/** Append one page per document. Throws when pages aren't available. */
export async function addPages(app, docs) {
  const p = api(app);
  const add = p && fnOf(p, ADD_NAMES);
  if (!add) throw new Error("This version can't add pages yet.");
  const have = app.editor?.pageCount ?? 1;
  if (have + docs.length > 100) throw new Error(`A design can have up to 100 pages and this one has ${have}. Make ${docs.length} separate designs instead, or fewer rows.`);
  for (const doc of docs) await add.call(p, doc);
  return docs.length;
}

/** Every page of the open design as a document (one page without app.pages). */
export async function pageDocs(app) {
  const p = api(app);
  const get = p && fnOf(p, DOCS_NAMES);
  if (get) {
    const docs = await get.call(p);
    if (Array.isArray(docs) && docs.length) return docs.map((d) => d?.doc || d);
  }
  if (p && Array.isArray(p.list)) {
    const docs = p.list.map((x) => x?.doc).filter(Boolean);
    if (docs.length === p.list.length && docs.length) return docs;
  }
  return [app.editor.toJSON()];
}

/** The open page's index (0 without pages). */
export function pageIndex(app) {
  const p = api(app);
  const i = p ? (typeof p.index === "function" ? p.index() : p.index ?? p.current ?? p.currentIndex) : 0;
  return Number.isInteger(i) && i >= 0 ? i : 0;
}
