// Copy style with the paint roller: pick up the selected object's style, then the next object
// clicked gets it. Esc or a click on empty canvas cancels.
import { toast } from "../../ui/kit.js";
import { copyStyle, pasteStyle } from "./clipboard.js";

export const paintMode = {
  active: false,
  app: null,
  toggle(app) {
    if (this.active) this.stop();
    else this.start(app);
  },
  start(app) {
    if (!copyStyle(app)) return;
    this.app = app;
    this.active = true;
    const c = app.editor.canvas;
    this.saved = { hover: c.hoverCursor, def: c.defaultCursor };
    c.hoverCursor = "copy";
    c.defaultCursor = "copy";
    app.shell.canvasHost.classList.add("ar-painting");
    toast("Style copied. Click an object to paste it.");
    app.refreshToolbar();
  },
  stop() {
    if (!this.active) return;
    const c = this.app.editor.canvas;
    c.hoverCursor = this.saved.hover;
    c.defaultCursor = this.saved.def;
    this.active = false;
    this.app.shell.canvasHost.classList.remove("ar-painting");
    this.app.refreshToolbar();
  },
};

export function wirePaint(app) {
  const c = app.editor.canvas;
  c.on("mouse:down", (opt) => {
    if (!paintMode.active || opt.e?.button === 2) return;
    const t = opt.target;
    if (t && !t.isPage && !t.isBg) {
      // Fabric may hand us the multi-selection: use the object under the pointer.
      const target = t.type === "activeselection" ? (opt.subTargets?.[0] || t) : t;
      pasteStyle(app, target.type === "activeselection" ? target.getObjects() : [target]);
    }
    paintMode.stop();
  });
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") paintMode.stop(); });
  app.bus.on("doc", () => paintMode.stop());
}
