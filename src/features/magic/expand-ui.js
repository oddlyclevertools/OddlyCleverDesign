// Magic Expand chooser: pick a new shape (or a percentage) and see the grown frame drawn on the
// page before anything is spent. Resolves with the options for magicExpand, or null.
import { el, icon } from "../../ui/kit.js";
import { pixelToScreen } from "./mask.js";
import { createOverlay, inPixels } from "./overlay.js";
import { expandPlan } from "./ops.js";

const CHOICES = [
  { id: "16:9", label: "16:9", opts: { aspect: "16:9" } },
  { id: "9:16", label: "9:16", opts: { aspect: "9:16" } },
  { id: "1:1", label: "1:1", opts: { aspect: "1:1" } },
  { id: "4:5", label: "4:5", opts: { aspect: "4:5" } },
  { id: "page", label: "Fill the page", opts: { aspect: "page" } },
  { id: "25", label: "+25%", opts: { percent: 25 } },
  { id: "50", label: "+50%", opts: { percent: 50 } },
];

/**
 * @param {object} app
 * @param {object} img
 * @param {{ cost: Node }} opts
 * @returns {Promise<object|null>} options for magicExpand (with prompt), or null when cancelled
 */
export function expandChooser(app, img, { cost }) {
  return new Promise((resolve) => {
    const fc = app.editor.canvas;
    let choice = null, finished = false;
    const planOf = (c) => { try { return expandPlan(app, img, c.opts); } catch { return null; } };
    const useful = (p) => p && (p.W - p.w0 >= 2 || p.H - p.h0 >= 2);

    const overlay = createOverlay(app, {
      interactive: false,
      draw(ctx) {
        const plan = choice && planOf(choice);
        if (!plan || !img.canvas) return;
        const m = pixelToScreen(img, fc);
        const s = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
        const x0 = (img.cropX || 0) - plan.ox, y0 = (img.cropY || 0) - plan.oy;
        inPixels(ctx, m, (c) => {
          c.beginPath();
          c.rect(x0, y0, plan.W, plan.H);
          c.rect(img.cropX || 0, img.cropY || 0, img.width, img.height);
          c.fillStyle = "rgba(255,46,126,.18)";
          c.fill("evenodd");
          c.setLineDash([8 / s, 6 / s]);
          c.lineWidth = 2 / s;
          c.strokeStyle = "#ff7aa9";
          c.strokeRect(x0, y0, plan.W, plan.H);
        });
      },
    });

    const chips = CHOICES.map((c) => {
      const ok = useful(planOf(c));
      const b = el("button.mg-chip", { type: "button", disabled: !ok, title: ok ? `Expand to ${c.label}` : "The photo already has this shape",
        "aria-pressed": "false", on: { click: () => pick(c, b) } }, c.label);
      return b;
    });
    const input = el("input.mg-prompt", { type: "text", maxLength: 400, placeholder: "Optional: what the new area shows, e.g. more beach and sky",
      "aria-label": "What the new area shows (optional)" });
    const go = el("button.btn.primary.small", { type: "button", disabled: true, on: { click: () => done() } }, icon("Expand", 15), "Expand");
    const bar = el("div.mg-bar", { role: "toolbar", "aria-label": "Magic expand", tabindex: "-1" },
      el("div.mg-row", {}, el("span.mg-title", {}, icon("Expand", 16), "Magic expand"), cost, ...chips),
      el("div.mg-row", {}, input),
      el("div.mg-row.end", {}, el("span.mg-hint", {}, "The photo stays as it is; the AI paints the new area around it."),
        el("button.btn.small", { type: "button", on: { click: () => finish(null) } }, "Cancel"), go));
    app.shell.canvasHost.append(bar);
    requestAnimationFrame(() => bar.classList.add("show"));
    bar.focus({ preventScroll: true });
    const first = CHOICES.find((c) => useful(planOf(c)));
    if (first) pick(first, chips[CHOICES.indexOf(first)]);

    function pick(c, b) {
      choice = c;
      for (const x of chips) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); }
      go.disabled = false;
      overlay.redraw();
    }
    function done() {
      if (!choice) return;
      finish({ ...choice.opts, prompt: input.value.trim() });
    }
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); finish(null); }
      else if (e.key === "Enter" && (e.target === input || !app.isTyping?.(e))) { e.preventDefault(); e.stopImmediatePropagation(); done(); }
    };
    window.addEventListener("keydown", onKey, true);
    const offDoc = app.bus.on("doc", () => finish(null));
    const offSel = app.bus.on("selection", (sel) => { if (!sel.includes(img)) finish(null); });
    const offRender = () => fc.off("object:modified", overlay.redraw);
    fc.on("object:modified", overlay.redraw);

    function finish(result) {
      if (finished) return;
      finished = true;
      window.removeEventListener("keydown", onKey, true);
      offDoc();
      offSel();
      offRender();
      overlay.destroy();
      bar.classList.remove("show");
      setTimeout(() => bar.remove(), 180);
      resolve(result && img.canvas ? result : null);
    }
  });
}
