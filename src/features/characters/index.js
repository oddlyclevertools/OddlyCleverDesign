// Characters feature (v0.2): the Oddly Clever cast as editable vector characters, a panel to add
// them, a toolbar to change face, eyes, facing, head/body and sticker edge, and the Oddly Clever
// template pack. The cast is the user's own property (all rights reserved, see ASSETS.md).
import "./characters.css";
import { registerPanel } from "../../ui/shell.js";
import { addTemplates } from "../templates/registry.js";
import { renderPanel, wireDrop } from "./panel.js";
import { registerCharacterTool } from "./toolbar.js";
import oddlyTemplates from "./templates.js";

export function install(app) {
  registerPanel({ id: "characters", icon: "Smile", label: "Characters", order: 25, render: renderPanel });
  registerCharacterTool();
  addTemplates(oddlyTemplates);
  wireDrop(app);
}
