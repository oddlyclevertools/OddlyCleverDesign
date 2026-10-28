// Automatic and on-demand versions of the open design, and restoring one as an undo step.
import { toast } from "../../ui/kit.js";
import { AUTO_EVERY_MS, addVersion, getVersion, listVersions } from "./versions.js";

const TICK_MS = 20 * 1000;
const THUMB_SIDE = 320;

export function createTimeline(app) {
  const ed = app.editor;
  let session = null; // { designId, baseline: {doc, thumb, at, width, height} | null, dirty, lastAt }
  let restoring = false;
  const listeners = new Set();
  const notify = () => { for (const fn of listeners) fn(); };

  const snapshotNow = () => ({
    doc: JSON.stringify(ed.toJSON()), thumb: ed.thumbnail(THUMB_SIDE), at: Date.now(), width: ed.width, height: ed.height,
  });

  async function store(designId, snap, label, auto) {
    try {
      const rec = await addVersion({ designId, label, auto, ...snap });
      if (session?.designId === designId) session.lastAt = snap.at;
      if (rec) notify();
      return rec;
    } catch (e) {
      toast(`Couldn't save a version: ${e.message}`, { error: true });
      return null;
    }
  }

  async function begin() {
    const designId = app.project?.id;
    if (!designId || session?.designId === designId) return;
    session = { designId, baseline: snapshotNow(), dirty: false, lastAt: 0 };
    const s = session;
    try {
      const list = await listVersions(designId);
      if (list[0]) s.lastAt = list[0].at;
    } catch { /* storage blocked: versions just won't save */ }
    notify();
  }

  async function onChange(label) {
    if (restoring || !session || app.project?.id !== session.designId || label === "Typing") return;
    session.dirty = true;
    // Keep the design as it was when opened, so this session's edits can always be rolled back.
    const base = session.baseline;
    if (base) {
      session.baseline = null;
      if (Date.now() - session.lastAt >= AUTO_EVERY_MS) await store(session.designId, base, "When you opened it", true);
    }
  }

  async function tick(force = false) {
    const s = session;
    if (!s?.dirty || app.project?.id !== s.designId) return;
    if (!force && Date.now() - s.lastAt < AUTO_EVERY_MS) return;
    s.dirty = false;
    await store(s.designId, snapshotNow(), "Automatic save", true);
  }

  app.bus.on("view", (name) => {
    if (name === "editor") begin();
    else if (session) {
      // Leaving the design: keep its latest state as a version (the canvas still holds it).
      const s = session;
      session = null;
      if (s.dirty) store(s.designId, snapshotNow(), "When you closed it", true);
    }
  });
  app.bus.on("change", onChange);
  setInterval(() => tick(false), TICK_MS);

  return {
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    designId: () => app.project?.id || null,
    list: () => (app.project?.id ? listVersions(app.project.id) : Promise.resolve([])),
    /** Save a version now (the "Save a version" button). */
    async saveNow(label = "Saved by you") {
      if (!app.project) return null;
      await begin();
      if (session) session.dirty = false;
      const rec = await store(app.project.id, snapshotNow(), label, false);
      if (!rec) toast("No changes since the last version.");
      return rec;
    },
    /** Put a version back on the page as one undo step. */
    async restore(versionId) {
      const v = await getVersion(versionId);
      if (!v || v.designId !== app.project?.id) throw new Error("That version belongs to another design.");
      await store(v.designId, snapshotNow(), "Before you restored", true);
      restoring = true;
      try {
        const sizeChanged = v.width !== ed.width || v.height !== ed.height;
        ed.canvas.discardActiveObject();
        await ed.loadJSON(JSON.parse(v.doc), { keepHistory: true });
        if (sizeChanged) ed.zoomToFit();
        ed.commit("Restore version");
      } finally {
        restoring = false;
      }
      if (session) session.dirty = true;
      return v;
    },
    tick,
  };
}
