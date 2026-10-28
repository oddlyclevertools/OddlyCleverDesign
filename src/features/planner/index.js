// Content Planner (prefix pl-): a calendar of planned posts with repeating slots, and an upload kit
// per post. It never posts anywhere. Opens full screen from the top bar or app.planner.open().
//   app.planner = { open, close, listPlan, addPost, updatePost, downloadUploadKit }
import "./planner.css";
import { registerCommands, registerTopAction } from "../../ui/shell.js";
import { el, icon } from "../../ui/kit.js";
import { closePlanner, openPlanner, renderPlanner } from "./planner.js";
import { addPost, downloadUploadKit, listPlan, updatePost } from "./actions.js";

export { renderPlanner, openPlanner, closePlanner, listPlan, addPost, updatePost, downloadUploadKit };

export function install(app) {
  registerTopAction({
    id: "planner", order: 15,
    render: (a) => el("button.btn.pl-top-btn", { type: "button", title: "Plan your posts and make upload kits", "aria-label": "Content planner",
      on: { click: () => openPlanner(a) } }, icon("CalendarDays", 17), el("span", {}, "Planner")),
  });
  registerCommands(() => [
    { id: "planner:open", label: "Open content planner", hint: "Calendar of posts and upload kits", group: "Tool", icon: "CalendarDays",
      keywords: "planner calendar schedule posts upload kit youtube shorts", run: (a) => openPlanner(a) },
  ]);
  app.planner = {
    open: () => openPlanner(app),
    close: () => closePlanner(),
    listPlan: (opts) => listPlan(app, opts),
    addPost: (fields) => addPost(app, fields),
    updatePost: (id, fields) => updatePost(app, id, fields),
    downloadUploadKit: (id, opts) => downloadUploadKit(app, id, opts),
  };
}
