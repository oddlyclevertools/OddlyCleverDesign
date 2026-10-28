// The Bulk Create preview: every row's design in a grid, problems flagged, rows can be unticked,
// then made into designs, pages or a ZIP of pictures.
import { el, icon, modal, toast } from "../../ui/kit.js";
import { stagger } from "../../ui/motion.js";
import { outputVariants, previewBulk } from "./engine.js";
import { hasPages } from "./pages.js";

const FLAG_TEXT = {
  overflow: "Text doesn't fit", contrast: "Hard to read", small: "Tiny text", picture: "Picture missing",
  unknown: "Unknown column", shrunk: "Shrunk to fit",
};
const isProblem = (f) => f.kind !== "shrunk";

function outputChoices(app) {
  const pages = hasPages(app);
  return [
    { id: "designs", icon: "Files", label: "Separate designs", help: "One new design per row, on your home screen." },
    { id: "pages", icon: "BookCopy", label: "Pages in this design", help: pages ? "Every row becomes a page of this design." : "Pages aren't available yet in this version.", disabled: !pages },
    { id: "png", icon: "FileArchive", label: "ZIP of PNG", help: "Download every row as a PNG, in one ZIP file." },
    { id: "jpg", icon: "FileArchive", label: "ZIP of JPG", help: "Smaller pictures, in one ZIP file." },
  ];
}

/** Build the variants, then show the preview dialog. */
export async function openPreview(app, { rows, mapping, fit }) {
  let close = () => {};
  const bar = el("div.bk-bar", {}, el("i"));
  const status = el("p.bk-status", { role: "status" }, "Making the previews…");
  const skeleton = el("div.bk-skel", { "aria-hidden": "true" }, [0, 1, 2, 3].map(() => el("div.bk-skel-card", {}, el("div.oc-skeleton.bk-skel-thumb"), el("div.oc-skeleton.bk-skel-line"))));
  const body = el("div.bk-preview", {}, el("div.bk-progress", {}, status, bar), skeleton);
  const m = modal("Bulk create: preview", body, { wide: true });
  close = m.close;
  const ctrl = new AbortController();
  const stop = new MutationObserver(() => { if (!body.isConnected) { ctrl.abort(); stop.disconnect(); } });
  stop.observe(document.body, { childList: true });
  let variants;
  try {
    variants = await previewBulk(app, {
      rows, mapping, fit, signal: ctrl.signal,
      onProgress: (f, t) => { bar.firstChild.style.width = `${Math.round(f * 100)}%`; status.textContent = t; },
    });
  } catch (e) {
    if (!ctrl.signal.aborted) {
      toast(e.message, { error: true });
      close();
    }
    return;
  }
  renderGrid(app, body, variants, () => close());
}

function renderGrid(app, body, variants, close) {
  const picked = new Set(variants.map((v) => v.index));
  const problems = variants.filter((v) => v.flags.some(isProblem)).length;
  let onlyProblems = false;
  let output = "designs";
  const grid = el("div.bk-grid", { role: "list" });
  const count = el("b");
  const go = el("button.btn.primary", { type: "button" }, icon("Sparkles", 16), el("span"));
  const bar = el("div.bk-bar", {}, el("i"));
  const status = el("span.bk-status", { role: "status" });

  const paintCount = () => {
    count.textContent = `${picked.size} of ${variants.length} ticked`;
    go.lastChild.textContent = output === "png" || output === "jpg" ? `Download ${picked.size}` : `Create ${picked.size}`;
    go.disabled = !picked.size;
  };
  const card = (v) => {
    const box = el("input", { type: "checkbox", checked: picked.has(v.index), "aria-label": `Include ${v.label}`,
      on: { change: () => { if (box.checked) picked.add(v.index); else picked.delete(v.index); c.classList.toggle("off", !box.checked); paintCount(); } } });
    const flags = v.flags.filter((f, i, a) => a.findIndex((g) => g.kind === f.kind) === i);
    const c = el("label.bk-card", { role: "listitem", class: [picked.has(v.index) ? "" : "off", v.flags.some(isProblem) ? "warn" : ""].join(" ").trim() || null },
      el("div.bk-thumb", {}, el("img", { src: v.thumb, alt: `Row ${v.index + 1}: ${v.label}`, loading: "lazy" }), box),
      el("div.bk-card-name", { title: v.label }, el("small", {}, `${v.index + 1}`), v.label),
      flags.length ? el("div.bk-flags", {}, flags.map((f) => el(`span.bk-flag.${isProblem(f) ? "bad" : "info"}`, {
        title: v.flags.filter((g) => g.kind === f.kind).map((g) => g.text).join("\n"),
      }, icon(isProblem(f) ? "TriangleAlert" : "Minimize2", 12), FLAG_TEXT[f.kind] || f.kind))) : null);
    return c;
  };
  const paintGrid = () => { grid.replaceChildren(...variants.filter((v) => !onlyProblems || v.flags.some(isProblem)).map(card)); return grid; };

  const choices = outputChoices(app);
  const outBox = el("div.bk-outputs", { role: "radiogroup", "aria-label": "What to make" });
  const help = el("p.bk-help");
  const paintOut = () => {
    outBox.replaceChildren(...choices.map((c) => el("button.bk-out", {
      type: "button", role: "radio", "aria-checked": String(c.id === output), class: c.id === output ? "on" : null,
      disabled: c.disabled, title: c.help,
      on: { click: () => { output = c.id; paintOut(); paintCount(); } },
    }, icon(c.icon, 16), c.label)));
    help.textContent = choices.find((c) => c.id === output).help;
  };

  go.addEventListener("click", async () => {
    const chosen = variants.filter((v) => picked.has(v.index));
    go.disabled = true;
    bar.classList.add("show");
    try {
      const res = await outputVariants(app, chosen, {
        output, onProgress: (f, t) => { bar.firstChild.style.width = `${Math.round(f * 100)}%`; status.textContent = t; },
      });
      close();
      const what = res.output === "designs" ? `Made ${res.made} designs. Find them on your home screen.`
        : res.output === "pages" ? `Added ${res.made} pages.` : `Downloaded ${res.filename} (${res.made} pictures).`;
      toast(res.note ? `${what} ${res.note}` : what, { ms: 5000 });
    } catch (e) {
      toast(e.message, { error: true });
      go.disabled = false;
    }
  });

  const filter = el("label.toggle", {}, el("input", { type: "checkbox", on: { change: (e) => { onlyProblems = e.target.checked; stagger(paintGrid(), { max: 12 }); } } }),
    el("span.track"), el("span", {}, "Only rows to check"));
  const allBtn = (label, on) => el("button.btn.small.ghost", { type: "button", on: { click: () => {
    variants.forEach((v) => (on ? picked.add(v.index) : picked.delete(v.index)));
    paintGrid(); paintCount();
  } } }, label);

  body.replaceChildren(
    el("div.bk-sum", {},
      el("span", {}, count),
      problems ? el("span.bk-flag.bad", {}, icon("TriangleAlert", 12), `${problems} to check`) : el("span.bk-flag.ok", {}, icon("Check", 12), "All rows look fine"),
      el("span.grow"), problems ? filter : null, allBtn("Tick all", true), allBtn("Untick all", false)),
    grid,
    el("div.bk-foot", {}, el("div.bk-foot-left", {}, outBox, help, el("div.bk-run", {}, bar, status)), go));
  paintOut();
  stagger(paintGrid(), { max: 12 });
  paintCount();
}
