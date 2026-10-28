// Share without a server: a self-contained view-only .html file, the editable .ocd file (the
// files feature), and a review copy whose viewers drop comment pins and send back a .json that
// "Import comments" shows on the design.
import "./share.css";
import { el, icon, popover, closePopover, toast } from "../../ui/kit.js";
import { registerTopAction } from "../../ui/shell.js";
import { stagger } from "../../ui/motion.js";
import { popFrom } from "../../ui/popfrom.js";
import { formatBytes } from "../files/util.js";
import { importComments, listComments, setResolved } from "./comments.js";
import { exportShareFile } from "./export.js";
import { createPins } from "./pins.js";

function chooseJson(onFile) {
  const input = el("input", { type: "file", accept: ".json,application/json", style: { display: "none" } });
  input.addEventListener("change", () => { const f = input.files?.[0]; input.remove(); if (f) onFile(f); });
  document.body.append(input);
  input.click();
}

function item(iconName, label, hint, run, { cls = "" } = {}) {
  return el(`button.sh-item${cls ? "." + cls : ""}`, { type: "button", role: "menuitem", on: { click: () => { closePopover(); run(); } } },
    el("span.sh-ico", {}, icon(iconName, 18)), el("span.sh-txt", {}, el("b", {}, label), hint ? el("small", {}, hint) : null));
}

async function runImport(app, pins, file) {
  try {
    const res = await importComments(app, file);
    pins.setVisible(true);
    await pins.reload();
    const extra = res.otherDesign ? ` They were made on “${res.otherDesign}”, so check they fit.` : "";
    toast(res.added ? `Added ${res.added} comment${res.added === 1 ? "" : "s"}.${extra}` : "Those comments are already here.", { ms: 5000 });
  } catch (e) {
    toast(e.message, { error: true });
  }
}

function shareMenu(app, pins) {
  const guard = (fn) => async () => { try { await fn(); } catch (e) { toast(e.message, { error: true }); } };
  const html = (mode) => guard(async () => {
    toast(mode === "review" ? "Making the review copy…" : "Making the file…", { ms: 1500 });
    const res = await exportShareFile(app, { mode });
    toast(`Downloaded ${res.filename} (${formatBytes(res.bytes)}). Send it to anyone: it opens in any browser, offline.`, { ms: 6000 });
  });
  const { open, resolved } = pins.counts();
  return el("div.sh-menu", { role: "menu", "aria-label": "Share" },
    el("p.sh-head", {}, "Share without a server: you send the file."),
    item("FileCode2", "Share as a file", "A view-only page (.html) that opens in any browser", html("view")),
    item("FileJson", ".ocd file to edit", "The design file, for someone with OddlyClever Design", guard(async () => {
      if (!app.files?.exportDesign) throw new Error("Design files aren't available.");
      const res = await app.files.exportDesign("ocd");
      toast(`Downloaded ${res.filename} (${formatBytes(res.bytes)}).`);
    })),
    item("MessageSquarePlus", "Review copy", "The page, plus comment pins your viewers can save", html("review")),
    el("div.sh-sep"),
    item("Upload", "Import comments…", "The .json a viewer saved from a review copy", () => chooseJson((f) => runImport(app, pins, f))),
    open + resolved ? item(pins.visible ? "EyeOff" : "Eye", pins.visible ? "Hide comment pins" : "Show comment pins",
      `${open} open${resolved ? `, ${resolved} resolved` : ""}`, () => pins.setVisible(!pins.visible)) : null,
    resolved ? item(pins.showResolved ? "EyeOff" : "CheckCheck", pins.showResolved ? "Hide resolved comments" : "Show resolved comments", "",
      () => { pins.setVisible(true); pins.setShowResolved(!pins.showResolved); }) : null);
}

export function install(app) {
  const pins = createPins(app);
  app.share = {
    /** Make the .html: mode "view" (view-only) or "review" (with comments). Downloads unless download: false. */
    exportShareFile: (opts) => exportShareFile(app, opts),
    /** Import a review comments .json File (or its text) into the open design. */
    importComments: (file) => importComments(app, file).then(async (r) => { await pins.reload(); return r; }),
    /** The open design's review comments. */
    comments: () => listComments(app.project?.id),
    /** Mark a comment resolved (true) or open (false). */
    resolveComment: (id, resolved = true) => setResolved(app.project?.id, id, resolved),
    pins,
  };
  registerTopAction({ id: "share", order: 85, render: () => shareButton(app, pins) });
}

/** The Share button for the top bar. */
export function shareButton(app, pins = app.share?.pins) {
  const btn = el("button.btn.sh-btn", { type: "button", title: "Share", "aria-label": "Share", "aria-haspopup": "menu" }, icon("Share2", 17), el("span", {}, "Share"));
  btn.addEventListener("click", () => {
    if (!app.project) return toast("Open a design first.", { error: true });
    pins.reload().finally(() => popFrom(popover(btn, stagger(shareMenu(app, pins)), { align: "end", cls: "sh-pop" }), btn));
  });
  return btn;
}
