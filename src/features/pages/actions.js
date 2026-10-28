// Page actions for the UI and the AI. Indexes are 0-based (page 1 is index 0). Every change
// is one undo step; switching pages is not. Page operations run one at a time.

let chain = Promise.resolve();
/** Run page operations in order, so two quick clicks can't load pages over each other. */
function queued(fn) {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

const need = (app) => {
  if (!app.project || app.view !== "editor") throw new Error("Open a design first.");
  return app.editor;
};
const stopPreview = (app) => app.motion?.stop?.();
const indexOf = (ed, i) => (i == null ? ed.pageIndex : Math.round(Number(i)));

/** Every page: [{ index, number, name, notes, current }]. */
export function listPages(app) {
  return app.editor.listPages().map(({ index, number, id, name, customName, notes, current }) => ({ index, number, id, name, customName, notes, current }));
}

/** Show page `index`. Not an undo step. Resolves the index shown. */
export function goToPage(app, index) {
  return queued(async () => {
    const ed = need(app);
    stopPreview(app);
    return ed.goToPage(indexOf(ed, index));
  });
}

/**
 * Add a blank page (default: after the one open) and show it. One undo step.
 * @param {{at?: number, name?: string, notes?: string, go?: boolean}} opts
 * @returns {Promise<number>} the new page's index
 */
export function addPage(app, { at, name = "", notes = "", go = true } = {}) {
  return queued(async () => {
    const ed = need(app);
    stopPreview(app);
    const i = ed.addPage({ at: at ?? ed.pageIndex + 1, name, notes });
    if (go) await ed.goToPage(i);
    return i;
  });
}

/** Copy page `index` (default: the open one) right after it and show the copy. One undo step. */
export function duplicatePage(app, index, { go = true } = {}) {
  return queued(async () => {
    const ed = need(app);
    stopPreview(app);
    const i = ed.duplicatePage(indexOf(ed, index));
    if (go) await ed.goToPage(i);
    return i;
  });
}

/** Delete page `index` (default: the open one). The last page can't be deleted. One undo step. */
export function deletePage(app, index) {
  return queued(async () => {
    const ed = need(app);
    stopPreview(app);
    await ed.deletePage(indexOf(ed, index));
    return ed.pageCount;
  });
}

/** Move page `from` to position `to`. One undo step. */
export function movePage(app, from, to) {
  return queued(async () => need(app).movePage(Math.round(Number(from)), Math.round(Number(to))));
}

/** Rename page `index` ("" means "Page N" again). One undo step. */
export function renamePage(app, index, name) {
  const ed = need(app);
  ed.renamePage(indexOf(ed, index), name);
}

/** Set page `index`'s speaker notes. One undo step. */
export function setPageNotes(app, index, notes) {
  const ed = need(app);
  ed.setPageNotes(indexOf(ed, index), notes);
}
