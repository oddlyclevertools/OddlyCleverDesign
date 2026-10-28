// The Download button and its popover: file type, size (1×, 2×, 4×), which pages, transparency,
// JPG/WebP quality, "Limit file size" (KB) for PNG, JPG and WebP, PDF and SVG options, an
// estimate of the file size before anything is made, "Copy as image", progress and the last
// result.
import { el, icon, popover, slider, toast, toggle } from "../../ui/kit.js";
import { popFrom } from "../../ui/popfrom.js";
import { canCopyImage, copyDesignImage, estimateExport, exportDesign } from "./export.js";
import { MAX_EXPORT_SIDE, clampScale, formatBytes, loadPrefs, maxScaleFor, outputSize, savePrefs } from "./util.js";

const PREFS_KEY = "fl-download";
const DEFAULTS = {
  type: "png", scale: 1, transparent: false, quality: 90, limit: false, limitKB: 2000,
  lossless: false, embedFonts: true, pages: "current",
};
const SCALES = [1, 2, 4];
const IMAGE = ["png", "jpg", "webp"];
const ESTIMATE_WAIT = 220; // ms after the last change before the size estimate re-runs

const CHOICES = [
  { id: "png", label: "PNG", icon: "FileImage", tag: "Recommended", help: "Sharp image for thumbnails and posts. Can have a transparent background." },
  { id: "jpg", label: "JPG", icon: "Image", help: "Small image file. Good for photos and YouTube's 2 MB limit." },
  { id: "webp", label: "WebP", icon: "ImagePlay", help: "Smaller than PNG or JPG at the same look. Can be transparent. Fine for YouTube and the web." },
  { id: "pdf", label: "PDF", icon: "FileText", help: "Every page at your design's size, for printing and sharing." },
  { id: "svg", label: "SVG", icon: "FileCode", help: "Vector file for the web and other design apps. Text effects and curved text come along." },
  { id: "ocd", label: "Design file", icon: "FileJson", help: "An .ocd file you can open again here later, on any computer." },
];

/**
 * Other features add file types here (motion adds MP4 and GIF):
 * { id, label, icon, help, tag?, options?(prefs, persist, app) -> Node[], run(app, prefs, onProgress) -> result }
 * where result = { filename, bytes, notes? }. Their prefs live in the same saved prefs object.
 */
const EXTRA = [];
export function registerExportType(type) {
  if (!type?.id || typeof type.run !== "function") throw new Error("An export type needs an id and run().");
  if (!EXTRA.some((t) => t.id === type.id)) EXTRA.push(type);
}
const allChoices = () => [...CHOICES, ...EXTRA];
const extraOf = (id) => EXTRA.find((t) => t.id === id);

let lastResult = null; // { text } of the last download in this session
const picks = new Map(); // project id -> picked page indices (this session only)

/** The nearest of 1×, 2×, 4× that this design allows. */
function snapScale(scale, w, h) {
  const ok = SCALES.filter((s) => s <= maxScaleFor(w, h) + 1e-6);
  if (!ok.length) return clampScale(1, w, h);
  return ok.reduce((best, s) => (Math.abs(s - scale) < Math.abs(best - scale) ? s : best), ok[0]);
}

/** The "pages" option for exportDesign from the popover's choice. */
function pagesOption(ed, prefs, picked) {
  if (ed.pageCount < 2) return "current";
  if (prefs.pages === "pick") return [...picked].filter((i) => i < ed.pageCount).sort((a, b) => a - b);
  return prefs.pages === "all" ? "all" : "current";
}

function downloadPanel(app) {
  const ed = app.editor;
  const prefs = loadPrefs(PREFS_KEY, DEFAULTS);
  if (!allChoices().some((c) => c.id === prefs.type)) prefs.type = DEFAULTS.type;
  prefs.scale = snapScale(Number(prefs.scale) || 1, ed.width, ed.height);
  const pid = app.project?.id || "none";
  const picked = new Set((picks.get(pid) || [ed.pageIndex]).filter((i) => i < ed.pageCount));
  let busy = false;
  const persist = () => { savePrefs(PREFS_KEY, prefs); queueEstimate(); };

  const typeGrid = el("div.fl-types", { role: "radiogroup", "aria-label": "File type" });
  const help = el("p.fl-help");
  const options = el("div.fl-options");
  const bar = el("div.fl-bar", {}, el("i"));
  const btnLabel = el("span", {}, "Download");
  const goBtn = el("button.btn.primary.fl-go", { type: "button" }, icon("Download", 17), btnLabel);
  const copyBtn = el("button.btn.fl-copy", {
    type: "button", title: "Copy as a picture (the pages you chose, stacked), to paste into chats, docs or other apps", "aria-label": "Copy as image",
  }, icon("ClipboardCopy", 17), el("span", {}, "Copy"));
  const estimate = el("div.fl-estimate", { "aria-live": "polite" });
  const status = el("div.fl-status", { role: "status", "aria-live": "polite" }, lastResult?.text || "");

  // ---- size estimate ----------------------------------------------------------------------
  let estTimer = 0, estToken = 0;
  function queueEstimate() {
    clearTimeout(estTimer);
    const token = ++estToken;
    estimate.classList.add("busy");
    estTimer = setTimeout(async () => {
      let res = null;
      try {
        res = await estimateExport(app, prefs.type, {
          scale: prefs.scale, transparent: prefs.transparent, quality: prefs.quality / 100,
          limitKB: prefs.limit ? prefs.limitKB : null, lossless: prefs.lossless, pages: pagesOption(ed, prefs, picked),
        });
      } catch { res = null; }
      if (token !== estToken) return;
      estimate.classList.remove("busy");
      if (!res) { estimate.replaceChildren(); return; }
      const what = res.exact ? "File size" : "About";
      const pages = pagesOption(ed, prefs, picked);
      const several = Array.isArray(pages) ? pages.length > 1 : pages === "all" || (prefs.type === "pdf" && ed.pageCount > 1);
      estimate.replaceChildren(...[icon("HardDrive", 13), el("span", {}, `${what} `, el("b", {}, formatBytes(res.bytes))),
        res.capped ? el("span.fl-muted", {}, " with your limit") : null,
        several && !res.exact ? el("span.fl-muted", {}, " for all the pages") : null].filter(Boolean));
    }, ESTIMATE_WAIT);
  }

  const drawTypes = () => {
    typeGrid.replaceChildren(...allChoices().map((c) => el("button.fl-type", {
      type: "button", role: "radio", "aria-checked": c.id === prefs.type, class: c.id === prefs.type ? "on" : null,
      title: c.help, on: { click: () => { if (busy) return; prefs.type = c.id; persist(); drawTypes(); drawOptions(); } },
    }, icon(c.icon, 18), el("span", {}, c.label), c.tag ? el("small.fl-tag", {}, c.tag) : null)));
    help.textContent = allChoices().find((c) => c.id === prefs.type).help;
  };

  // ---- size: 1×, 2×, 4× -------------------------------------------------------------------
  const sizeControl = () => {
    const readout = el("div.fl-px");
    const seg = el("div.fl-seg.fl-scales", { role: "radiogroup", "aria-label": "Size" });
    const max = maxScaleFor(ed.width, ed.height);
    const draw = () => {
      seg.replaceChildren(...SCALES.map((s) => {
        const tooBig = s > max + 1e-6;
        return el("button.fl-seg-btn", {
          type: "button", role: "radio", "aria-checked": prefs.scale === s, class: prefs.scale === s ? "on" : null, disabled: tooBig,
          title: tooBig ? `Too big: exports stop at ${MAX_EXPORT_SIDE} px on the long side` : `${s}× the design's size`,
          on: { click: () => { if (busy) return; prefs.scale = s; persist(); draw(); } },
        }, `${s}×`);
      }));
      const { width, height } = outputSize(ed.width, ed.height, clampScale(prefs.scale, ed.width, ed.height));
      readout.replaceChildren(...[el("b", {}, `${width} × ${height} px`),
        prefs.scale > 1 ? el("span.fl-muted", {}, " · sharper on big screens") : null].filter(Boolean));
    };
    draw();
    return el("div.fl-sec", {}, el("div.fl-label", {}, "Size"), seg, readout);
  };

  // ---- pages (multi-page designs) ---------------------------------------------------------
  const pageChoice = (zipNote) => {
    const n = ed.pageCount;
    const seg = el("div.fl-seg", { role: "radiogroup", "aria-label": "Pages to download" });
    const chips = el("div.fl-pages", { role: "group", "aria-label": "Pick pages" });
    const note = el("p.fl-note");
    const draw = () => {
      seg.replaceChildren(...[
        ["current", `This page (${ed.pageIndex + 1})`],
        ["all", `All ${n}`],
        ["pick", "Pick pages"],
      ].map(([id, label]) => el("button.fl-seg-btn", {
        type: "button", role: "radio", "aria-checked": prefs.pages === id, class: prefs.pages === id ? "on" : null,
        on: { click: () => { if (busy) return; prefs.pages = id; persist(); draw(); } },
      }, label)));
      const pick = prefs.pages === "pick";
      chips.hidden = !pick;
      chips.replaceChildren(...[...Array(n).keys()].map((i) => el("button.fl-page", {
        type: "button", "aria-pressed": String(picked.has(i)), class: picked.has(i) ? "on" : null,
        title: ed.pages[i]?.name || `Page ${i + 1}`, "aria-label": `Page ${i + 1}`,
        on: { click: () => {
          if (busy) return;
          if (picked.has(i) && picked.size > 1) picked.delete(i); else picked.add(i);
          picks.set(pid, [...picked]);
          queueEstimate();
          draw();
        } },
      }, String(i + 1))));
      const count = pick ? picked.size : prefs.pages === "all" ? n : 1;
      note.textContent = pick ? `Pages ${[...picked].sort((a, b) => a - b).map((i) => i + 1).join(", ")}.${count > 1 && zipNote ? " Several pages come as one .zip." : ""}`
        : count > 1 && zipNote ? "Several pages come as one .zip." : "";
      note.hidden = !note.textContent;
    };
    draw();
    return el("div.fl-sec", {}, el("div.fl-label", {}, "Pages"), seg, chips, note);
  };
  const pageNote = (text) => el("p.fl-note.fl-page-note", {}, icon("Files", 13), text);

  // ---- file size limit (PNG, JPG, WebP) ---------------------------------------------------
  const limitControl = (t) => {
    const row = el("div.fl-limit");
    const kb = el("input.fl-num", {
      type: "number", min: 20, max: 1000000, step: 10, value: prefs.limitKB, disabled: !prefs.limit,
      "aria-label": "Maximum file size in KB",
      on: { change: () => { prefs.limitKB = Math.max(20, Math.round(Number(kb.value) || DEFAULTS.limitKB)); kb.value = prefs.limitKB; persist(); } },
    });
    row.replaceChildren(kb, el("span.fl-unit", {}, "KB"),
      el("button.btn.small.ghost", {
        type: "button", title: "YouTube thumbnails must be under 2 MB",
        on: { click: () => { prefs.limitKB = 2000; kb.value = 2000; persist(); } },
      }, "YouTube 2 MB"));
    row.classList.toggle("off", !prefs.limit);
    return [
      toggle({
        label: "Limit file size", value: prefs.limit,
        onChange: (v) => { prefs.limit = v; kb.disabled = !v; row.classList.toggle("off", !v); persist(); },
      }),
      row,
      el("p.fl-note", {}, t === "png"
        ? "PNG has no quality setting, so with a limit the picture gets fewer pixels until it fits."
        : "With a limit, the quality drops only as far as needed, then the size."),
    ];
  };

  const drawOptions = () => {
    const t = prefs.type;
    const parts = [];
    const multi = ed.pageCount > 1;
    if (multi && (IMAGE.includes(t) || t === "pdf")) parts.push(pageChoice(t !== "pdf"));
    if (multi && t === "ocd") parts.push(pageNote(`The design file keeps all ${ed.pageCount} pages.`));
    if (multi && !IMAGE.includes(t) && !["pdf", "ocd"].includes(t)) {
      parts.push(pageNote(`${t === "svg" ? "SVG" : "Videos and GIFs"} use the page you're on: page ${ed.pageIndex + 1} of ${ed.pageCount}.`));
    }
    if (IMAGE.includes(t)) parts.push(sizeControl());
    if (t === "png" || t === "webp" || t === "svg") {
      parts.push(el("div.fl-sec", {}, toggle({
        label: "Transparent background", value: prefs.transparent,
        onChange: (v) => { prefs.transparent = v; persist(); },
      })));
    }
    if (t === "jpg" || t === "webp") {
      parts.push(el("div.fl-sec", {},
        slider({
          label: "Quality", unit: "%", min: 10, max: 100, step: 1, value: prefs.quality,
          onInput: (v) => { prefs.quality = v; }, onChange: (v) => { prefs.quality = v; persist(); },
        }),
        ...limitControl(t)));
    }
    if (t === "png") parts.push(el("div.fl-sec", {}, ...limitControl(t)));
    if (t === "pdf") {
      parts.push(el("div.fl-sec", {},
        toggle({ label: "Lossless image (bigger file)", value: prefs.lossless, onChange: (v) => { prefs.lossless = v; persist(); } }),
        el("p.fl-note", {}, `Page: ${Math.round(ed.width * 0.75)} × ${Math.round(ed.height * 0.75)} pt. The design is placed as a high-resolution image, so text can't be selected.`)));
    }
    if (t === "svg") {
      parts.push(el("div.fl-sec", {},
        toggle({ label: "Embed fonts", value: prefs.embedFonts, onChange: (v) => { prefs.embedFonts = v; persist(); } }),
        el("p.fl-note", {}, "Embedded fonts make text look right everywhere. Without them, text needs the fonts installed.")));
    }
    const extra = extraOf(t);
    if (extra?.options) parts.push(...(extra.options(prefs, persist, app) || []).filter(Boolean));
    if (t === "ocd") {
      parts.push(el("p.fl-note", {}, "Open it with File › Open design file, or drop it onto this window."));
    }
    options.replaceChildren(...parts);
    queueEstimate();
  };

  const setBusy = (on) => {
    busy = on;
    goBtn.disabled = on;
    copyBtn.disabled = on || !canCopyImage();
    goBtn.classList.toggle("busy", on);
    bar.classList.toggle("show", on);
    goBtn.firstChild.replaceWith(icon(on ? "LoaderCircle" : "Download", 17));
    if (!on) btnLabel.textContent = "Download";
  };

  goBtn.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    const t0 = performance.now();
    try {
      const onProgress = (f, text) => {
        bar.firstChild.style.width = `${Math.round(f * 100)}%`;
        if (performance.now() - t0 > 250) btnLabel.textContent = text;
      };
      const extra = extraOf(prefs.type);
      const lossy = prefs.type === "jpg" || prefs.type === "webp";
      const res = extra ? await extra.run(app, prefs, onProgress) : await exportDesign(app, prefs.type, {
        scale: prefs.scale, transparent: prefs.transparent, quality: prefs.quality / 100,
        limitKB: prefs.limit && IMAGE.includes(prefs.type) ? prefs.limitKB : null, lossless: prefs.lossless, embedFonts: prefs.embedFonts,
        pages: pagesOption(ed, prefs, picked), onProgress,
      });
      const bits = [formatBytes(res.bytes)];
      if (IMAGE.includes(res.type)) bits.push(`${res.width} × ${res.height} px`);
      if (res.pages > 1) bits.push(`${res.pages} pages`);
      if (lossy && res.quality) bits.push(`quality ${Math.round(res.quality * 100)}%`);
      lastResult = { text: `Last download: ${res.filename} · ${bits.join(" · ")}` };
      status.textContent = lastResult.text;
      if (IMAGE.includes(res.type) && res.fitted === false) {
        toast(`Couldn't get under ${prefs.limitKB} KB, so this is as small as it gets (${formatBytes(res.bytes)}).`, { error: true, ms: 6000 });
      } else {
        toast(`Downloaded ${res.filename} (${formatBytes(res.bytes)}).`);
      }
      for (const n of res.notes || []) toast(n, { ms: 5000 });
    } catch (e) {
      toast(`Download failed: ${e.message}`, { error: true, ms: 6000 });
    } finally {
      setBusy(false);
      bar.firstChild.style.width = "0";
    }
  });

  copyBtn.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    try {
      const scale = IMAGE.includes(prefs.type) ? prefs.scale : 1;
      const res = await copyDesignImage(app, { scale, transparent: prefs.transparent && (prefs.type === "png" || prefs.type === "webp"),
        pages: pagesOption(ed, prefs, picked) });
      const what = res.pages > 1 ? `${res.pages} pages, stacked` : `page ${ed.pageIndex + 1}`;
      status.textContent = `Copied ${what} · ${res.width} × ${res.height} px PNG`;
      toast("Copied. Paste it anywhere with Ctrl+V.");
    } catch (e) {
      toast(e?.name === "NotAllowedError" ? "The browser blocked copying. Click Copy again, or use Download." : `Couldn't copy: ${e.message}`, { error: true, ms: 6000 });
    } finally {
      setBusy(false);
    }
  });
  copyBtn.disabled = !canCopyImage();

  drawTypes();
  drawOptions();
  return el("div.fl-download", {},
    el("div.fl-head", {}, el("h4", {}, "Download"), el("span.fl-muted", {}, `${ed.width} × ${ed.height} px`)),
    el("div.fl-label", {}, "File type"), typeGrid, help, options, estimate,
    el("div.fl-actions", {}, goBtn, copyBtn), bar, status);
}

export function downloadButton(app) {
  const btn = el("button.btn.primary.fl-top-btn", { type: "button", title: "Download your design", "aria-label": "Download" },
    icon("Download", 17), el("span", {}, "Download"));
  btn.addEventListener("click", () => popFrom(popover(btn, downloadPanel(app), { align: "end", cls: "fl-pop" }), btn));
  return btn;
}
