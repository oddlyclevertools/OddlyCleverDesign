// OddlyClever Design: app entry. Builds the shell, the editor and the `app` object every
// feature receives, then installs the features and routes between home and editor.
//
// Bus events:  selection(sel, active) · change(label) · objects:changed(objs) · doc(editor)
//              zoom(z) · pan · history({canUndo, canRedo}) · saved(rec) · view(name)
import "./styles/app.css";
import "./styles/motion.css";
import { createBus } from "./core/bus.js";
import { Editor, isTyping } from "./core/editor.js";
import { resolveSize } from "./core/sizes.js";
import { installEmojiFont, watchEmoji } from "./core/emoji.js";
import * as store from "./core/store.js";
import { createShell, mountShell, registerShortcut } from "./ui/shell.js";
import { closePopover, setDocumentColorSource, toast } from "./ui/kit.js";

import { install as installText } from "./features/text/index.js";
import { install as installElements } from "./features/elements/index.js";
import { install as installTemplates } from "./features/templates/index.js";
import { install as installFiles } from "./features/files/index.js";
import { install as installArrange } from "./features/arrange/index.js";
import { install as installStyles } from "./features/styles/index.js";
import { install as installCharacters } from "./features/characters/index.js";
import { install as installMotion } from "./features/motion/index.js";
import { install as installStudio } from "./features/studio/index.js";
import { install as installAI } from "./features/ai/index.js";
import { install as installLibrary } from "./features/library/index.js";
import { install as installCutout } from "./features/cutout/index.js";
import { install as installPages } from "./features/pages/index.js";
import { install as installMagic } from "./features/magic/index.js";
import { install as installVideo } from "./features/video/index.js";
import { install as installStock } from "./features/stock/index.js";
import { install as installPlanner } from "./features/planner/index.js";
import { install as installBulk } from "./features/bulk/index.js";
import { install as installTranslate } from "./features/translate/index.js";
import { install as installShare } from "./features/share/index.js";

const AUTOSAVE_MS = 900;

const bus = createBus();
const shell = createShell(document.getElementById("app"));
const editor = new Editor(shell.canvasHost, bus);
installEmojiFont();
watchEmoji(editor.canvas);

const app = {
  bus, editor, shell, store,
  view: "home",
  project: null, // { id, name } of the open design
  isTyping,
  /** Create a design (optionally from a template builder) and open it. */
  async newDesign({ size = "yt-thumb", name = "Untitled design", template = null } = {}) {
    const { w, h } = resolveSize(size);
    await leaveDesign();
    await editor.newDocument(w, h);
    if (template) await template(app);
    editor.history.reset();
    const id = store.newProjectId();
    app.project = { id, name };
    await save(true);
    location.hash = `#/d/${id}`;
  },
  /** `wanted()` says whether the user still wants this design once it has loaded. */
  async openDesign(id, wanted = () => true) {
    const rec = await store.getProject(id);
    if (!rec) throw new Error("That design isn't in this browser any more.");
    await leaveDesign();
    const dropped = await editor.loadJSON(rec.doc);
    if (!wanted()) return;
    app.project = { id: rec.id, name: rec.name };
    if (dropped) toast(`${dropped} item${dropped > 1 ? "s" : ""} couldn't be opened and ${dropped > 1 ? "were" : "was"} left out.`, { ms: 6000 });
    shell.nameInput.value = rec.name;
    show("editor");
    await new Promise(requestAnimationFrame);
    editor._fitHost();
    editor.zoomToFit();
  },
  rename(name) {
    if (!app.project) return;
    app.project.name = name;
    shell.nameInput.value = name;
    scheduleSave();
  },
  show: (name) => show(name),
  save: () => save(true),
};
window.__app = app; // handy for debugging and the end-to-end tests

// Document colours for the colour picker: every solid fill/stroke in the design.
setDocumentColorSource(() => {
  const out = [];
  const walk = (o) => {
    for (const c of [o.fill, o.stroke]) if (typeof c === "string" && c.startsWith("#")) out.push(c.toLowerCase());
    o._objects?.forEach(walk);
  };
  editor.canvas.getObjects().forEach(walk);
  return out;
});

// ---- autosave ---------------------------------------------------------------------------
let saveTimer = null, saving = null;
const saveState = document.getElementById("save-state");
function scheduleSave() {
  if (!app.project) return;
  saveState.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(false), AUTOSAVE_MS);
}
async function save(now) {
  if (!app.project) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  await saving;
  const failed = (e) => {
    saveState.textContent = "Not saved";
    toast(`Couldn't save: ${e.message}`, { error: true, ms: 6000 });
  };
  try {
    const rec = {
      id: app.project.id, name: app.project.name,
      width: editor.width, height: editor.height,
      thumb: editor.thumbnail(), doc: editor.toJSON(),
    };
    saving = store.saveProject(rec).then((r) => {
      saveState.textContent = "Saved";
      bus.emit("saved", r);
    }).catch(failed);
  } catch (e) {
    failed(e);
    return;
  }
  if (now) await saving;
}
/** Before another design replaces the open one: write its pending edits, then let it go. */
async function leaveDesign() {
  if (saveTimer) await save(true);
  else await saving;
  app.project = null; // changes made while the next design builds must not land in this one
}
bus.on("change", scheduleSave);
// Undo and redo rebuild every object, so an open popover would be editing a detached copy.
bus.on("change", (label) => { if (label === "History") closePopover(); });
// Flush when the tab is hidden or closed (beforeunload alone misses mobile and tab discards).
const flush = () => { if (saveTimer) save(true); };
window.addEventListener("pagehide", flush);
window.addEventListener("beforeunload", flush);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
// Ask the browser not to evict the designs under storage pressure (it may say no).
navigator.storage?.persist?.().catch(() => {});

// ---- views and routing ------------------------------------------------------------------
let homeApi = null;
function show(name) {
  app.view = name;
  shell.homeView.classList.toggle("active", name === "home");
  shell.editorView.classList.toggle("active", name === "editor");
  if (name === "home") homeApi?.renderHome(shell.homeView);
  if (name === "editor") requestAnimationFrame(() => editor._fitHost());
  bus.emit("view", name);
}

let navSeq = 0; // a later navigation wins over one still in flight
async function route() {
  const seq = ++navSeq;
  const m = location.hash.match(/^#\/d\/([\w-]+)/);
  if (m) {
    if (app.project?.id === m[1] && app.view === "editor") return;
    try {
      await app.openDesign(m[1], () => seq === navSeq);
    } catch (e) {
      if (seq !== navSeq) return;
      toast(e.message, { error: true });
      location.hash = "#/";
    }
  } else {
    await leaveDesign();
    if (seq !== navSeq) return;
    editor.canvas.discardActiveObject();
    show("home");
  }
}

// ---- base shortcuts (features add their own) --------------------------------------------
registerShortcut({ keys: "mod+z", label: "Undo", run: () => editor.history.undo() });
registerShortcut({ keys: "mod+shift+z|mod+y", label: "Redo", run: () => editor.history.redo() });
registerShortcut({ keys: "delete|backspace", label: "Delete", run: () => editor.remove() });
registerShortcut({ keys: "mod+a", label: "Select all", run: () => editor.selectAll() });
registerShortcut({ keys: "escape", label: "Deselect", run: () => { editor.canvas.discardActiveObject(); editor.canvas.requestRenderAll(); } });
registerShortcut({ keys: "mod+=|mod++", label: "Zoom in", run: () => editor.setZoom(editor.zoom * 1.25) });
registerShortcut({ keys: "mod+-", label: "Zoom out", run: () => editor.setZoom(editor.zoom / 1.25) });
registerShortcut({ keys: "!|mod+0", label: "Zoom to fit (Shift+1)", run: () => editor.zoomToFit() });
registerShortcut({ keys: "mod+s", label: "Save", run: async () => { await save(true); toast("Saved in this browser."); } });

// ---- boot -------------------------------------------------------------------------------
for (const install of [installText, installElements, installTemplates, installFiles, installPages, installArrange,
  installStyles, installCharacters, installMotion, installStudio, installAI, installLibrary, installCutout, installMagic,
  installVideo, installStock, installPlanner, installBulk, installTranslate, installShare]) {
  try { install(app); } catch (e) { console.error("feature install failed", e); }
}
// Stock videos go straight onto the video timeline.
app.stock?.setVideoHandler?.(({ blob, name }) => app.video.addClip({ file: new File([blob], name, { type: blob.type }), track: "video" }));
homeApi = mountShell(app);
window.addEventListener("hashchange", route);
route();
