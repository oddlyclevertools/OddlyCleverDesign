// Where the timeline lives in the design, and which pages are its scenes.
//
// The timeline is kept on the page object as page.data.video, so it is saved, undone and redone
// with the design like everything else. If the design has several pages (app.pages, added by the
// multi-page feature), each page is a scene; otherwise the one page is the only scene.
import { pageDuration } from "../motion/timeline.js";
import { normalize, sceneList } from "./model.js";

// With several pages the timeline belongs to the whole design: it lives on the first page that
// has one (page 1 for a new one), whichever page is open, so switching pages never swaps it.
const pageData = (ed, i) => (i === (ed.pageIndex ?? 0) ? ed.page?.data : ed.pages?.[i]?.canvas?.objects?.find((o) => o?.isPage)?.data);
function holderIndex(ed) {
  const n = ed.pages?.length || 1;
  for (let i = 0; i < n; i++) if (pageData(ed, i)?.video) return i;
  return 0;
}

/** The timeline of the open design (a clean copy). */
export function readTimeline(app) {
  const ed = app.editor;
  return normalize(pageData(ed, holderIndex(ed))?.video);
}

/**
 * Store a new timeline in the design. One undo step per call unless `commit` is false
 * (then the caller commits); `merge` folds a drag into one step.
 */
export function writeTimeline(app, tl, label = "Edit video", { commit = true, merge = false } = {}) {
  const ed = app.editor;
  const page = ed.page;
  if (!page) throw new Error("Open a design first.");
  const at = holderIndex(ed);
  if (at === (ed.pageIndex ?? 0)) page.set("data", { ...(page.data || {}), video: tl });
  else {
    ed.pages = ed.pages.map((p, i) => (i !== at ? p : { ...p, canvas: { ...p.canvas,
      objects: p.canvas.objects.map((o) => (o?.isPage ? { ...o, data: { ...(o.data || {}), video: tl } } : o)) } }));
  }
  if (commit) app.editor.commit(label, { merge });
  app.bus.emit("video:changed", tl);
  return tl;
}

/**
 * The design's pages as scene sources: [{ id, label, defaultDuration, current, doc? }].
 * Works with whatever page list app.pages offers (list(), an array, or .pages), and with a
 * single-page design when there is none.
 */
export function pagesOf(app) {
  const P = app.pages;
  let list = null;
  if (P) {
    try {
      list = typeof P.list === "function" ? P.list() : Array.isArray(P) ? P : Array.isArray(P.pages) ? P.pages : null;
    } catch { list = null; }
  }
  if (Array.isArray(list) && list.length) {
    const cur = typeof P.current === "function" ? P.current() : P.currentId ?? P.current;
    const curId = cur && typeof cur === "object" ? cur.id : cur;
    return list.map((p, i) => {
      const id = String(p?.id ?? `p${i}`);
      const isCur = curId != null ? String(curId) === id : i === 0;
      return {
        id, label: p?.name || p?.label || `Scene ${i + 1}`,
        defaultDuration: Number(p?.duration) || (isCur ? pageDuration(app.editor) : 5),
        current: isCur, doc: p?.doc || p?.json || null,
      };
    });
  }
  return [{ id: "page", label: "Your design", defaultDuration: pageDuration(app.editor), current: true, doc: null }];
}

/** The scenes with their start times and lengths. */
export function scenesOf(app, tl = readTimeline(app)) {
  return sceneList(tl, pagesOf(app));
}

/** The design JSON (editor.toJSON format) of a scene's page. */
export function sceneDoc(app, scene) {
  const pages = pagesOf(app);
  const p = pages.find((x) => x.id === scene.id);
  const atRest = (fn) => (app.motion?.player ? app.motion.player.atRest(fn) : fn());
  if (!p || p.current) return atRest(() => app.editor.toJSON());
  if (p.doc) return p.doc;
  const get = app.pages?.getJSON || app.pages?.docOf;
  if (typeof get === "function") {
    try {
      const d = get.call(app.pages, p.id);
      if (d) return d;
    } catch { /* fall back to the open page */ }
  }
  return atRest(() => app.editor.toJSON());
}
