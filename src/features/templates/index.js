// Templates feature: the home screen (sizes, templates, your designs) and the editor's
// Templates panel. Templates are drawn in code (see thumbnails.js, vertical.js, social.js, print.js).
import "./templates.css";
import { registerHome, registerPanel } from "../../ui/shell.js";
import { renderHome } from "./home.js";
import { renderTemplatesPanel } from "./panel.js";

export function install() {
  registerHome(renderHome);
  registerPanel({ id: "templates", icon: "LayoutTemplate", label: "Templates", order: 10, render: renderTemplatesPanel });
}
