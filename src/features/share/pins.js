// Review comment pins over the page in the editor. Each pin opens its note with Resolve / Reopen.
// Pins follow zoom and pan; resolved ones hide unless "Show resolved" is on.
import { el, icon, popover, closePopover, toast } from "../../ui/kit.js";
import { pageIndex } from "../bulk/pages.js";
import { listComments, onComments, setResolved } from "./comments.js";

export function createPins(app) {
  const layer = el("div.sh-pins", { "aria-label": "Review comments" });
  app.shell.canvasHost.append(layer);
  let list = [], visible = true, showResolved = false, loadedFor = null;

  const place = () => {
    const ed = app.editor, v = ed.canvas.viewportTransform;
    for (const pin of layer.children) {
      const x = Number(pin.dataset.x) * ed.width, y = Number(pin.dataset.y) * ed.height;
      pin.style.left = `${v[0] * x + v[4]}px`;
      pin.style.top = `${v[3] * y + v[5]}px`;
    }
  };
  const openNote = (pin, c, n) => {
    const when = c.at ? new Date(c.at) : null;
    const body = el("div.sh-note", {},
      el("div.sh-note-head", {}, el("b", {}, `${n}`), el("span", {}, c.reviewer || "A viewer"), when && !Number.isNaN(when.getTime()) ? el("small", {}, when.toLocaleDateString()) : null),
      el("p", {}, c.text),
      el("div.row.end", {}, el("button.btn.small", { type: "button", on: { click: async () => {
        try {
          await setResolved(app.project.id, c.id, !c.resolved);
          closePopover();
          toast(c.resolved ? "Comment opened again." : "Comment resolved.");
        } catch (e) { toast(e.message, { error: true }); }
      } } }, icon(c.resolved ? "RotateCcw" : "Check", 14), c.resolved ? "Reopen" : "Resolve")));
    popover(pin, body, { cls: "sh-pop" });
  };
  const paint = () => {
    const on = visible && app.view === "editor" && Boolean(app.project);
    const page = pageIndex(app);
    const shown = on ? list.map((c, i) => ({ c, n: i + 1 })).filter(({ c }) => c.page === page && (showResolved || !c.resolved)) : [];
    layer.replaceChildren(...shown.map(({ c, n }) => {
      const pin = el("button.sh-pin", { type: "button", class: c.resolved ? "done" : null, title: c.text, "aria-label": `Comment ${n}: ${c.text}`,
        dataset: { x: c.x, y: c.y } }, el("span", {}, c.resolved ? "✓" : `${n}`));
      pin.addEventListener("click", () => openNote(pin, c, n));
      return pin;
    }));
    place();
  };
  const reload = async () => {
    const id = app.project?.id || null;
    loadedFor = id;
    try {
      const l = await listComments(id);
      if (loadedFor !== id) return;
      list = l;
    } catch {
      list = [];
    }
    paint();
  };
  app.editor.canvas.on("after:render", place);
  app.bus.on("doc", reload);
  app.bus.on("view", reload);
  onComments((id) => { if (id === app.project?.id) reload(); });

  return {
    reload,
    /** Counts for the menu. */
    counts: () => ({ open: list.filter((c) => !c.resolved).length, resolved: list.filter((c) => c.resolved).length }),
    get visible() { return visible; },
    get showResolved() { return showResolved; },
    setVisible(v) { visible = v; paint(); },
    setShowResolved(v) { showResolved = v; paint(); },
  };
}
