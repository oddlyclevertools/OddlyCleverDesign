// Styles feature (v0.2): the Styles panel (palettes, Shuffle, font pairings), the free brand
// kit (its colours also show in every colour picker), and your own uploaded fonts.
//
// Uploaded fonts must be registered before any design opens, or their text is measured with a
// fallback font. main.js installs features synchronously and opens the first design straight
// after, so install() starts loading the fonts and makes editor.loadJSON (used by open, undo,
// redo and file import) wait for them first (capped at 4 s so a slow disk never blocks).
import "./styles.css";
import { registerPanel } from "../../ui/shell.js";
import { renderStylesPanel } from "./panel.js";
import { loadUserFonts, userFontsReady } from "./user-fonts.js";
import { getKit, onKitChanged } from "./brand-db.js";
import { setBrandColorSource } from "../../ui/kit.js";

export { userFonts, isUserFont, onUserFontsChanged } from "./user-fonts.js";

export function install(app) {
  loadUserFonts();
  const ed = app.editor;
  const loadJSON = ed.loadJSON.bind(ed);
  ed.loadJSON = async (...args) => {
    await userFontsReady();
    return loadJSON(...args);
  };

  // The brand kit's colours show in every colour picker (and give "Make it pop" its accent).
  let brand = [];
  setBrandColorSource(() => brand);
  getKit().then((k) => { brand = k.colors || []; }).catch(() => { /* no storage: no brand colours */ });
  onKitChanged((k) => { brand = k.colors || []; });

  registerPanel({ id: "styles", icon: "Palette", label: "Styles", order: 45, render: renderStylesPanel });
}
