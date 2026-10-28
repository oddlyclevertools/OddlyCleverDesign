// Opening .ocd design files: validate, save as a new project, open it. Also the
// drag-and-drop target for .ocd files (image files are left to the elements feature).
import { FORMAT, MAX_PAGES } from "../../core/editor.js";
import { MAX_SIDE } from "../../core/sizes.js";
import { el, icon, toast } from "../../ui/kit.js";

const APP_ID = "oddlyclever-design";
const MAX_FILE_BYTES = 64 * 1024 * 1024; // designs with many embedded photos get big, but not this big
const MAX_OBJECTS = 5000;
const DESIGN_EXT = /\.(ocd|json)$/i;

/** True for a file that looks like a design file (by name or JSON type). */
export const isDesignFile = (f) => Boolean(f) && (DESIGN_EXT.test(f.name || "") || f.type === "application/json");

/**
 * Check a parsed design file. Returns a clean doc or throws a friendly error.
 * @param {unknown} data
 */
export function validateDesign(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("This file isn't a design file.");
  if (data.app !== APP_ID) throw new Error("This isn't an OddlyClever Design file.");
  if (typeof data.format !== "number" || data.format < 1) throw new Error("This design file is damaged (no format version).");
  if (data.format > FORMAT) throw new Error("This design was made with a newer version of OddlyClever Design.");
  const w = Number(data.width), h = Number(data.height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 16 || h < 16 || w > MAX_SIDE || h > MAX_SIDE) {
    throw new Error(`The design size must be between 16 and ${MAX_SIDE} px.`);
  }
  const checkCanvas = (canvas) => {
    if (!canvas || typeof canvas !== "object" || !Array.isArray(canvas.objects)) {
      throw new Error("This design file is damaged (no objects).");
    }
    if (canvas.objects.some((o) => !o || typeof o !== "object" || typeof o.type !== "string")) {
      throw new Error("This design file is damaged (a bad object).");
    }
    return canvas.objects.length;
  };
  const canvas = data.canvas;
  let objects = checkCanvas(canvas);
  // Format 2: several pages. `canvas` is the page that was open; the others carry their own.
  let pages = null;
  if (Array.isArray(data.pages) && data.pages.length) {
    if (data.pages.length > MAX_PAGES) throw new Error(`This design has more than ${MAX_PAGES} pages.`);
    const at = Number.isInteger(data.page) ? data.page : 0;
    pages = data.pages.map((p, i) => {
      if (!p || typeof p !== "object") throw new Error("This design file is damaged (a bad page).");
      if (p.canvas != null) objects += checkCanvas(p.canvas);
      else if (i !== at) throw new Error("This design file is damaged (a page is missing).");
      return {
        id: typeof p.id === "string" ? p.id.slice(0, 40) : undefined,
        name: typeof p.name === "string" ? p.name.slice(0, 80) : "",
        notes: typeof p.notes === "string" ? p.notes.slice(0, 20000) : "",
        ...(p.canvas != null ? { canvas: p.canvas } : {}),
      };
    });
  }
  if (objects > MAX_OBJECTS * Math.max(1, pages?.length || 1)) throw new Error(`This design has more than ${MAX_OBJECTS} objects a page.`);
  const name = typeof data.name === "string" ? data.name.trim().slice(0, 120) : "";
  const doc = { app: APP_ID, format: data.format, width: Math.round(w), height: Math.round(h), canvas };
  if (pages) Object.assign(doc, { pages, ...(Number.isInteger(data.page) ? { page: Math.max(0, Math.min(pages.length - 1, data.page)) } : {}) });
  return { doc, name };
}

/**
 * Read a .ocd file, save it as a new project and open it.
 * @param {object} app
 * @param {File|Blob} file
 * @returns {Promise<{id: string, name: string}>}
 */
export async function importDesignFile(app, file) {
  try {
    if (!file) throw new Error("No file was chosen.");
    if (file.size > MAX_FILE_BYTES) throw new Error("This file is too big to be a design file (over 64 MB).");
    if (file.name && !isDesignFile(file)) throw new Error("Choose a .ocd design file.");
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new Error("This file isn't a design file (it can't be read).");
    }
    const { doc, name: savedName } = validateDesign(data);
    const name = savedName || (file.name || "Imported design").replace(DESIGN_EXT, "") || "Imported design";
    if (app.project) await app.save();
    const id = app.store.newProjectId();
    await app.store.saveProject({ id, name, width: doc.width, height: doc.height, thumb: "", doc });
    try {
      await app.openDesign(id);
    } catch (e) {
      // It passed the checks but Fabric couldn't build it: don't leave a broken design behind.
      await app.store.deleteProject(id).catch(() => {});
      throw new Error(`This design couldn't be opened: ${e.message}`);
    }
    location.hash = `#/d/${id}`;
    await app.save(); // makes the thumbnail for the home screen
    toast(`Opened “${name}”.`);
    return { id, name };
  } catch (e) {
    toast(e.message, { error: true, ms: 5000 });
    throw e;
  }
}

/** Ask for a .ocd file and import it. */
export function chooseDesignFile(app) {
  const input = el("input", { type: "file", accept: ".ocd,application/json", style: { display: "none" } });
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    input.remove();
    if (f) importDesignFile(app, f).catch(() => {});
  });
  document.body.append(input);
  input.click();
}

/** Window-wide drop target for design files. Image drops pass through untouched. */
export function installDrop(app) {
  let depth = 0;
  const overlay = el("div.fl-drop", { "aria-hidden": "true" },
    el("div.fl-drop-card", {}, icon("FolderOpen", 30), el("b", {}, "Drop to open the design file"),
      el("span", {}, "It opens as a new design. Your current one is kept.")));
  // A drag may carry a design file when it has a file that isn't an image (.ocd has no MIME type).
  const maybeDesign = (dt) => [...(dt?.items || [])].some((i) => i.kind === "file" && !i.type.startsWith("image/")
    && (i.type === "" || i.type === "application/json"));
  const show = (on) => {
    if (on && !overlay.isConnected) document.body.append(overlay);
    overlay.classList.toggle("show", on);
  };

  window.addEventListener("dragenter", (e) => {
    if (!maybeDesign(e.dataTransfer)) return;
    depth++;
    show(true);
  });
  window.addEventListener("dragleave", () => {
    if (depth === 0) return;
    depth = Math.max(0, depth - 1);
    if (!depth) show(false);
  });
  window.addEventListener("dragover", (e) => {
    if (!maybeDesign(e.dataTransfer)) return;
    e.preventDefault(); // allow the drop (and stop the browser opening the file)
    e.dataTransfer.dropEffect = "copy";
  });
  // Capture phase, so a canvas drop handler never sees a design file.
  window.addEventListener("drop", (e) => {
    depth = 0;
    show(false);
    const files = [...(e.dataTransfer?.files || [])];
    const design = files.find(isDesignFile);
    if (!design) {
      if (files.length && files.every((f) => !f.type.startsWith("image/")) && maybeDesign(e.dataTransfer)) {
        e.preventDefault();
        toast("Only .ocd design files (or images) can be dropped here.", { error: true });
      }
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    importDesignFile(app, design).catch(() => {});
  }, true);
}
