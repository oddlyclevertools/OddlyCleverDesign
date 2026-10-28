// Card builders shared by the home screen and the Templates panel.
import { el, icon, toast } from "../../ui/kit.js";
import { applyTemplate, previewOf, sizeOf } from "./engine.js";
import { sizeLabel } from "./registry.js";

/** "Edited just now", "Edited 3 min ago", "Edited yesterday", ... */
export function editedAgo(ts, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "Edited just now";
  const m = Math.round(s / 60);
  if (m < 60) return `Edited ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Edited ${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "Edited yesterday";
  if (d < 7) return `Edited ${d} days ago`;
  return `Edited ${new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

/** An image box that shows a shimmer until the template's preview is ready. */
export function previewBox(tpl, cls = "tp-prev") {
  const { w, h } = sizeOf(tpl);
  const box = el(`div.${cls}.tp-loading`, { style: { aspectRatio: `${w} / ${h}` } });
  previewOf(tpl).then((url) => {
    const img = el("img", { src: url, alt: `${tpl.name} template preview`, draggable: false, decoding: "async" });
    img.addEventListener("load", () => box.classList.remove("tp-loading"), { once: true });
    box.append(img);
  }).catch((e) => {
    box.classList.remove("tp-loading");
    box.classList.add("tp-broken");
    box.append(el("span", {}, icon("ImageOff", 20)));
    box.title = `Preview failed: ${e.message}`;
  });
  return box;
}

/** Start a new design from a template, at the template's own size. */
export async function startFromTemplate(app, tpl) {
  try {
    await app.newDesign({ size: tpl.size, name: tpl.name, template: (a) => applyTemplate(a.editor, tpl, { record: false }) });
  } catch (e) {
    toast(`Couldn't open that template: ${e.message}`, { error: true });
  }
}

/** A template card for the home gallery (justified rows: width follows the aspect ratio). */
export function homeTemplateCard(tpl, app, i) {
  const { w, h } = sizeOf(tpl);
  const aspect = w / h;
  const { dims, name } = sizeLabel(tpl);
  const card = el("button.tp-tcard", {
    type: "button", title: `Use the ${tpl.name} template (${dims} px)`,
    style: { flexGrow: aspect, flexBasis: `${Math.round(aspect * 190)}px`, "--i": i },
    on: { click: () => startFromTemplate(app, tpl) },
  },
  previewBox(tpl),
  el("span.tp-tcard-info", {}, el("b", {}, tpl.name), el("small", {}, `${name} · ${dims}`)),
  el("span.tp-tcard-use", {}, icon("Plus", 14), "Use"));
  return card;
}
