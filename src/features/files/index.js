// Files feature: Download (PNG/JPG/PDF/SVG/.ocd), Resize (with basic magic resize), the
// File menu, opening .ocd files (menu, home screen, drag and drop) and app.files.
import "./files.css";
import { registerShortcut, registerTopAction } from "../../ui/shell.js";
import { downloadButton, registerExportType } from "./download.js";
import { canCopyImage, copyDesignImage, estimateExport, exportDesign } from "./export.js";
import { importDesignFile, installDrop } from "./importer.js";
import { fileMenuButton, shortcutsModal } from "./menu.js";
import { resizeButton, resizeDesign } from "./resize.js";

export function install(app) {
  app.files = {
    /** Import a .ocd File: resolves { id, name }, or null when it failed (a toast explains). */
    importDesignFile: (file) => importDesignFile(app, file).catch(() => null),
    /** Export the open design; see export.js for the options. Downloads unless download: false. */
    exportDesign: (type, opts) => exportDesign(app, type, opts),
    /** Copy the open page as a picture to the clipboard. */
    copyImage: (opts) => copyDesignImage(app, opts),
    canCopyImage,
    /** About how big an export would be, in bytes. */
    estimate: (type, opts) => estimateExport(app, type, opts),
    /** Resize in place (one undo step). */
    resize: (w, h, opts) => resizeDesign(app.editor, w, h, opts),
    /** Add a file type to the Download popover (see download.js). */
    registerExportType,
  };

  registerTopAction({ id: "file-menu", order: 10, render: fileMenuButton });
  registerTopAction({ id: "resize", order: 20, render: resizeButton });
  registerTopAction({ id: "download", order: 90, render: downloadButton });

  registerShortcut({ keys: "?", label: "Keyboard shortcuts", group: "Help", run: () => shortcutsModal() });

  installDrop(app);
}
