// The Translate panel: pick languages, whole design or selected text, new designs or pages.
// The translating is done by the user's AI (app.ai.translate, wired by the AI feature).
import { el, icon, toast } from "../../ui/kit.js";
import { hasPages } from "../bulk/pages.js";
import { LANGUAGES } from "./languages.js";
import { textsToTranslate, translateDesign } from "./translate.js";

/** A loader icon that turns (motion.css .oc-spin). */
const spinner = () => { const s = icon("LoaderCircle", 17); s.classList.add("oc-spin"); return s; };

const POPULAR = ["es", "fr", "de", "pt", "hi", "ar", "ja", "zh-Hans"];
let picked = new Set(); // language codes, kept while the app is open
let lastResult = null;

export function renderTranslatePanel(box, app) {
  const root = el("div.tr-panel");
  box.append(root);
  let query = "", scope = "all", asNew = true, busy = false;

  const paint = () => {
    const translator = typeof app.ai?.translate === "function" ? app.ai.translate : null;
    const pages = hasPages(app);
    if (!pages) asNew = true;
    const selCount = textsToTranslate(app, { scope: "selection" }).length;
    if (scope === "selection" && !selCount) scope = "all";
    const count = textsToTranslate(app, { scope }).length;

    const q = query.trim().toLowerCase();
    const shown = q ? LANGUAGES.filter((l) => `${l.name} ${l.native} ${l.code}`.toLowerCase().includes(q))
      : [...LANGUAGES].sort((a, b) => (POPULAR.indexOf(b.code) >= 0) - (POPULAR.indexOf(a.code) >= 0));
    const chip = (l) => el("button.tr-chip", {
      type: "button", "aria-pressed": String(picked.has(l.code)), class: picked.has(l.code) ? "on" : null, title: l.rtl ? `${l.name} (right to left)` : l.name,
      on: { click: () => { picked = new Set(picked); if (picked.has(l.code)) picked.delete(l.code); else picked.add(l.code); paint(); } },
    }, picked.has(l.code) ? icon("Check", 13) : null, el("span", {}, l.name), el("small", { dir: l.rtl ? "rtl" : null }, l.native));
    const search = el("input.tr-search", { type: "search", placeholder: "Find a language", value: query, "aria-label": "Find a language",
      on: { input: (e) => { query = e.target.value; const pos = e.target.selectionStart; paint(); const s = root.querySelector(".tr-search"); s.focus(); s.setSelectionRange(pos, pos); } } });
    const seg = (options, value, onPick, label) => el("div.tr-seg", { role: "radiogroup", "aria-label": label }, options.map((o) => el("button", {
      type: "button", role: "radio", "aria-checked": String(o.value === value), class: o.value === value ? "on" : null, disabled: o.disabled, title: o.title,
      on: { click: () => { onPick(o.value); paint(); } },
    }, o.label)));

    const go = el("button.btn.primary.tr-go", { type: "button", disabled: busy || !translator || !picked.size || !count },
      busy ? spinner() : icon("Languages", 17),
      busy ? "Translating…" : picked.size ? `Translate into ${picked.size} language${picked.size === 1 ? "" : "s"}` : "Pick languages");
    const status = el("p.tr-status", { role: "status" });
    go.addEventListener("click", async () => {
      busy = true;
      paint();
      const st = root.querySelector(".tr-status");
      try {
        lastResult = await translateDesign(app, {
          languages: [...picked], translator, asNew, scope,
          onProgress: (_, t) => { if (st) st.textContent = t; },
        });
        const n = lastResult.made.length;
        if (n) toast(asNew ? `Made ${n} translated design${n === 1 ? "" : "s"}.` : `Added ${n} translated page${n === 1 ? "" : "s"}.`);
        if (lastResult.failed.length) toast(`${lastResult.failed.length} language${lastResult.failed.length === 1 ? "" : "s"} didn't work: ${lastResult.failed[0].error}`, { error: true, ms: 7000 });
      } catch (e) {
        toast(e.message, { error: true });
      } finally {
        busy = false;
        paint();
      }
    });

    root.replaceChildren(...[
      el("p.tr-lead", {}, "Make a copy of this design in other languages. Styles stay; text that grows is shrunk to fit."),
      translator ? null : el("div.tr-connect", {}, icon("PlugZap", 18), el("div", {}, el("b", {}, "Connect an AI in Ask AI to translate."),
        el("button.btn.small", { type: "button", on: { click: () => app.openPanel?.("ai") } }, icon("Sparkles", 14), "Open Ask AI"))),
      el("section.sec", {}, el("h4.sec-title", {}, "Languages"), search, el("div.tr-chips", {}, shown.map(chip)),
        shown.length ? null : el("p.tr-note.tr-empty", {}, icon("SearchX", 22), el("span", {}, "No language matches. Try its English name."))),
      el("section.sec", {}, el("h4.sec-title", {}, "What to translate"),
        seg([{ value: "all", label: "Whole design" }, { value: "selection", label: `Selected text${selCount ? ` (${selCount})` : ""}`, disabled: !selCount, title: selCount ? null : "Select text on the page first" }],
          scope, (v) => { scope = v; }, "What to translate"),
        el("p.tr-note", {}, `${count} text${count === 1 ? "" : "s"} will be translated.`),
        el("h4.sec-title.tr-gap", {}, "Make"),
        seg([{ value: true, label: "New designs" }, { value: false, label: "New pages", disabled: !pages, title: pages ? null : "Pages aren't available yet in this version" }],
          asNew, (v) => { asNew = v; }, "Make")),
      go, status,
      lastResult ? resultList(lastResult) : null].filter(Boolean));
  };

  const resultList = (res) => el("section.sec.tr-results", {}, el("h4.sec-title", {}, "Last translation"),
    res.made.map((m) => el("div.tr-res", {},
      m.thumb ? el("img", { src: m.thumb, alt: "" }) : el("span.tr-res-ico", {}, icon("BookCopy", 16)),
      el("div.grow", {}, el("b", {}, m.language), m.warnings.map((w) => el("p.tr-warn", {}, icon("TriangleAlert", 12), w))),
      m.id ? el("button.btn.small", { type: "button", on: { click: () => { location.hash = `#/d/${m.id}`; } } }, "Open") : null)),
    res.failed.map((f) => el("div.tr-res.bad", {}, el("span.tr-res-ico", {}, icon("CircleX", 16)), el("div.grow", {}, el("b", {}, f.language), el("p.tr-warn", {}, f.error)))));

  paint();
  const offs = [app.bus.on("selection", paint), app.bus.on("doc", paint)];
  return () => offs.forEach((f) => f());
}
