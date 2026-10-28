// Studio feature (v0.2): the tools Canva lacks or paywalls, for YouTube creators first.
//   Feed preview (with the title fit) · Safe zones · Check my design (words, hero size, title)
//   · Test & Compare pack · Version history
// Everything lives in this folder; app.studio exposes it for other features and the tests.
import "./studio.css";
import { el, icon, iconButton, toast } from "../../ui/kit.js";
import { registerPanel, registerTopAction } from "../../ui/shell.js";
import { runCheck } from "./check.js";
import { openFeedPreview } from "./feed.js";
import { createOverlay } from "./overlay.js";
import { openPackDialog } from "./pack-ui.js";
import { renderStudioPanel } from "./panel.js";
import { createTimeline } from "./timeline.js";
import { makeVariants, exportPack } from "./variants.js";

export function install(app) {
  const ed = app.editor;
  const overlay = createOverlay(app);
  const timeline = createTimeline(app);

  // ---- design check state (shared by the panel and the top button) ------------------------
  const checkListeners = new Set();
  const check = {
    findings: null,
    running: false,
    stale: false,
    onChange(fn) { checkListeners.add(fn); return () => checkListeners.delete(fn); },
    emit() { for (const fn of checkListeners) fn(); },
    async run() {
      if (check.running) return check.findings;
      check.running = true;
      check.emit();
      try {
        check.findings = await runCheck(app, { kind: overlay.kind(), zones: overlay.zones(), openFeed: (opts) => studio.openFeed(opts) });
        check.stale = false;
      } catch (e) {
        check.findings = null;
        toast(`The check stopped: ${e.message}`, { error: true });
      } finally {
        check.running = false;
        check.emit();
      }
      return check.findings;
    },
    show(f) {
      const sel = f.targets.filter((o) => o.canvas && o.selectable !== false && !o.locked);
      if (sel.length) ed.select(sel);
      const rect = f.rect || (f.targets[0] && f.targets[0].getBoundingRect());
      if (rect) overlay.flash(rect);
    },
    async fix(f) {
      try {
        await f.fix.run();
        if (!f.fix.keep) toast(`${f.fix.label}: done. Ctrl+Z undoes it.`);
      } catch (e) {
        toast(`Couldn't fix it: ${e.message}`, { error: true });
        return;
      }
      if (!f.fix.keep) await check.run();
    },
  };
  // Findings point at objects; any edit (or undo) makes them stale.
  app.bus.on("doc", () => { if (check.findings && !check.running) { check.findings = null; check.emit(); } });
  app.bus.on("change", () => { if (check.findings && !check.running && !check.stale) { check.stale = true; check.emit(); } });

  const studio = {
    overlay, timeline, check, focus: null,
    openFeed: (opts) => {
      if (!app.project) return toast("Open a design first.", { error: true });
      return openFeedPreview(app, opts);
    },
  };

  registerPanel({
    id: "studio", icon: "Clapperboard", label: "Studio", order: 65,
    render: (box) => renderStudioPanel(box, app, studio),
  });

  registerTopAction({
    id: "studio", order: 80,
    render: () => {
      const zonesBtn = iconButton("Frame", "Show safe zones (never exported)", () => overlay.toggle(), { cls: "sd-top-zones" });
      overlay.onChange(() => zonesBtn.classList.toggle("on", overlay.on));
      zonesBtn.classList.toggle("on", overlay.on);
      const checkBtn = iconButton("ShieldCheck", "Check my design", async () => {
        studio.focus = "check";
        if (app.currentPanel?.() !== "studio") app.openPanel("studio");
        await check.run();
      }, { cls: "sd-top-check" });
      const previewBtn = el("button.btn.small.sd-top-preview", { type: "button", title: "See your thumbnail in the YouTube feed", on: { click: () => studio.openFeed() } },
        icon("MonitorPlay", 16), el("span", {}, "Preview"));
      return el("div.sd-top", {}, zonesBtn, checkBtn, previewBtn);
    },
  });

  app.studio = {
    openFeed: studio.openFeed,
    safeZones: overlay,
    check: () => check.run(),
    findings: () => check.findings,
    fix: (f) => check.fix(f),
    show: (f) => check.show(f),
    makeVariants: (opts) => makeVariants(app, opts),
    exportPack: (pack) => exportPack(app, pack),
    openPackDialog: () => openPackDialog(app),
    versions: timeline,
  };
}
