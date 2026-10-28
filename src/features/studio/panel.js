// The Studio panel: friendly cards for the feed preview, safe zones, the design check, the
// Test & Compare pack and version history.
import { el, icon, modal, select, toast, toggle } from "../../ui/kit.js";
import { stagger } from "../../ui/motion.js";
import { ZONE_KINDS } from "./zones.js";
import { loadPack, openPackDialog, runExport } from "./pack-ui.js";

const ago = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
const clock = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const card = (ic, title, text, ...body) => el("section.sd-card", {},
  el("div.sd-card-head", {}, el("span.sd-card-ic", {}, icon(ic, 18)), el("div", {}, el("h4", {}, title), el("p", {}, text))),
  ...body);

/**
 * @param {HTMLElement} box
 * @param {object} app
 * @param {object} studio { overlay, timeline, check: { findings, running, run(), show(f), fix(f) }, openFeed() }
 */
export function renderStudioPanel(box, app, studio) {
  const { overlay, timeline, check } = studio;
  const offs = [];

  // ---- feed preview ---------------------------------------------------------------------
  const feedCard = card("MonitorPlay", "See it on YouTube", "Your thumbnail at real size in the home feed, search, up next and Shorts.",
    el("button.btn.primary.sd-wide", { type: "button", on: { click: () => studio.openFeed() } }, icon("Eye", 16), "Open the preview"));

  // ---- safe zones -----------------------------------------------------------------------
  const zoneNote = el("p.sd-note");
  const zoneToggle = toggle({ label: "Show safe zones", value: overlay.on, onChange: (v) => overlay.setOn(v) });
  const zoneSelect = select({
    value: overlay.kindPref, title: "Which platform",
    options: ZONE_KINDS.map((k) => ({ value: k.id, label: k.label })),
    onChange: (v) => overlay.setKind(v),
  });
  zoneSelect.classList.add("sd-wide");
  const showZoneNote = () => {
    const z = overlay.zones();
    zoneNote.textContent = z ? z.note : "No platform covers this size. Pick one above to see its zones.";
    const input = zoneToggle.querySelector("input");
    if (input) input.checked = overlay.on;
  };
  const zonesCard = card("Frame", "Safe zones", "See where buttons, badges and trimming cover your design. Never exported.",
    zoneToggle, zoneSelect, zoneNote,
    el("div.sd-legend", {}, el("span.danger", {}, "Covered"), el("span.caution", {}, "Sometimes covered"), el("span.safe", {}, "Safe area")));
  offs.push(overlay.onChange(showZoneNote));
  showZoneNote();

  // ---- design check ---------------------------------------------------------------------
  const results = el("div.sd-results", { "aria-live": "polite" });
  const checkBtn = el("button.btn.primary.sd-wide", { type: "button", on: { click: () => check.run() } }, icon("ShieldCheck", 16), "Check my design");
  function renderFindings() {
    checkBtn.disabled = check.running;
    if (check.running) {
      results.replaceChildren(el("p.sd-note.sd-looking", {}, el("span.sd-spin", { "aria-hidden": "true" }), "Looking closely…"),
        ...[0, 1, 2].map(() => el("div.sd-find-skel.oc-skeleton", { "aria-hidden": "true" })));
      return;
    }
    if (!check.findings) { results.replaceChildren(); return; }
    if (!check.findings.length) {
      results.replaceChildren(el("div.sd-find.ok", {}, el("div.sd-find-head", {}, icon("CircleCheck", 16), el("b", {}, "Looks great")),
        el("p", {}, "Text is readable, nothing is cut off and nothing hides under the platform's buttons.")));
      return;
    }
    const nFix = check.findings.filter((f) => f.severity === "fix").length;
    results.replaceChildren(
      ...(check.stale ? [el("p.sd-note.sd-stale", {}, "You've changed the design since this check. Check again to update it.")] : []),
      el("p.sd-note", {}, `${check.findings.length} thing${check.findings.length > 1 ? "s" : ""} to look at${nFix ? `, ${nFix} worth fixing` : ""}.`),
      ...check.findings.map((f) => el("div.sd-find", { class: f.severity },
        el("div.sd-find-head", {}, icon(f.severity === "fix" ? "TriangleAlert" : "Info", 16), el("b", {}, f.title)),
        el("p", {}, f.text),
        el("div.row", {},
          f.targets.length || f.rect ? el("button.btn.small", { type: "button", on: { click: () => check.show(f) } }, icon("Crosshair", 14), "Show me") : null,
          f.fix ? el("button.btn.small.sd-fix", { type: "button", on: { click: () => check.fix(f) } }, icon("WandSparkles", 14), f.fix.label) : null))));
    stagger(results, { max: 10 });
  }
  offs.push(check.onChange(renderFindings));
  renderFindings();
  const checkCard = card("ShieldCheck", "Check my design", "Finds small text, low contrast, cut-off words, covered spots, too many fonts or words, a face that's too small, titles the feed cuts and files too big for YouTube.",
    checkBtn, results);

  // ---- test & compare -------------------------------------------------------------------
  const packRow = el("div.row");
  const renderPack = () => {
    const pack = loadPack();
    const mineIn = pack?.some((v) => v.id === app.project?.id);
    packRow.replaceChildren(...[
      el("button.btn.sd-grow", { type: "button", on: { click: () => openPackDialog(app, renderPack) } }, icon("Copy", 16), "Make versions"),
      mineIn ? el("button.btn", { type: "button", title: "Download every version as a JPG under 2 MB", on: { click: () => runExport(app, pack) } }, icon("Download", 16), "Export pack") : null,
    ].filter(Boolean));
  };
  renderPack();
  const packCard = card("Columns2", "Test & Compare pack", "Make 2–3 versions of this thumbnail so YouTube can test which one gets more clicks.", packRow);

  // ---- versions -------------------------------------------------------------------------
  const vlist = el("div.sd-versions", {}, [0, 1].map(() => el("div.sd-version-skel.oc-skeleton", { "aria-hidden": "true" })));
  let versionsShown = false;
  async function renderVersions() {
    let list = [];
    try { list = await timeline.list(); } catch (e) { vlist.replaceChildren(el("p.sd-note", {}, `Versions aren't available: ${e.message}`)); return; }
    if (!list.length) {
      vlist.replaceChildren(el("p.sd-note.sd-empty", {}, icon("History", 18),
        el("span", {}, "No versions yet. They save by themselves every few minutes while you edit, or press Save a version.")));
      return;
    }
    vlist.replaceChildren(...list.map((v) => el("div.sd-version", {},
      el("button.sd-version-thumb", { type: "button", title: "Preview this version", on: { click: () => previewVersion(v) } }, el("img", { src: v.thumb, alt: "" })),
      el("div.grow", {}, el("b", {}, v.label), el("small", {}, `${ago(v.at)} · ${clock(v.at)}`)),
      el("button.btn.small", { type: "button", title: "Put this version back (you can undo it)", on: { click: () => restore(v) } }, icon("RotateCcw", 14), "Restore"))));
    if (!versionsShown) stagger(vlist, { max: 8 });
    versionsShown = true;
  }
  async function restore(v) {
    try {
      await timeline.restore(v.id);
      toast("Version restored. Press Ctrl+Z to go back.");
    } catch (e) {
      toast(`Couldn't restore: ${e.message}`, { error: true });
    }
  }
  function previewVersion(v) {
    modal(`${v.label} · ${ago(v.at)}`, (close) => el("div.sd-vpreview", {},
      el("img", { src: v.thumb, alt: "This version" }),
      el("p.sd-muted", {}, `${v.width} × ${v.height} px, saved ${new Date(v.at).toLocaleString()}.`),
      el("div.row.end", {}, el("button.btn", { type: "button", on: { click: close } }, "Close"),
        el("button.btn.primary", { type: "button", on: { click: () => { close(); restore(v); } } }, icon("RotateCcw", 16), "Restore this version"))), { wide: true });
  }
  offs.push(timeline.onChange(renderVersions));
  renderVersions();
  const versionsCard = card("History", "Version history", "Go back to any earlier version. Restoring is one step you can undo.",
    el("button.btn.sd-wide", { type: "button", on: { click: async () => { if (await timeline.saveNow()) toast("Version saved."); } } }, icon("Save", 16), "Save a version"),
    vlist);

  [feedCard, zonesCard, checkCard, packCard, versionsCard].forEach((c, i) => c.style.setProperty("--i", String(i)));
  box.append(el("p.sd-intro", {}, "Extra tools to make your video stand out. All free, all on this computer."),
    feedCard, zonesCard, checkCard, packCard, versionsCard);
  if (studio.focus === "check") requestAnimationFrame(() => checkCard.scrollIntoView({ block: "start", behavior: "smooth" }));
  studio.focus = null;
  return () => offs.forEach((off) => off());
}
