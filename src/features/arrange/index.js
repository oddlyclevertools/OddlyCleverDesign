// Arrange feature: layers, position, smart guides and snapping, rulers and guides, the
// clipboard, the context menu, unlocking from the canvas and the arrange shortcuts.
import "./arrange.css";
import "./toolbar.css";
import { registerPanel, registerTopAction } from "../../ui/shell.js";
import { wireClipboard } from "./clipboard.js";
import { wireContextMenu, closeMenu } from "./contextmenu.js";
import { registerLayers } from "./layers.js";
import { wireLocked } from "./locked.js";
import { createOverlay } from "./overlay.js";
import { wirePaint } from "./paint.js";
import { createRulers } from "./rulers.js";
import { registerArrangeShortcuts } from "./shortcuts.js";
import { wireSnapping } from "./snapping.js";
import { onPrefs } from "./state.js";
import { registerToolbar } from "./toolbar.js";
import { wireToolbarFit } from "./tbfit.js";
import { viewButton } from "./view.js";

export function install(app) {
  const overlay = createOverlay(app);
  const rulers = createRulers(app, overlay);
  onPrefs(() => {
    rulers.show();
    app.editor.canvas.requestRenderAll();
  });
  wireSnapping(app, overlay.request);
  wireClipboard(app);
  wirePaint(app);
  wireContextMenu(app);
  wireLocked(app);
  registerToolbar(app);
  wireToolbarFit(app);
  registerLayers(app, registerPanel, overlay);
  registerArrangeShortcuts(app);
  registerTopAction({ id: "ar-view", order: 20, render: viewButton });
  for (const ev of ["doc", "history", "zoom", "pan", "view"]) app.bus.on(ev, overlay.request);
  app.bus.on("view", closeMenu);
  app.bus.on("zoom", closeMenu);
}
