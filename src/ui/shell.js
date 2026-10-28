// The app shell: home view and editor view. The editor is a "studio": a lit set with a header strip
// (brand, undo/redo, the design name on a paper tag, the command search, actions), the stage with
// a floating selection toolbar, panel drawers, and a tool dock at the bottom with the zoom controls.
// Features plug in through the registries below; none edit this file.
import "../styles/studio.css";
import "../styles/overlays.css";
import "../styles/shell-motion.css";
import { FabricObject } from "fabric";
import { el, icon, iconButton } from "./kit.js";
import { openPalette, registerCommands } from "./palette.js";
import { initOnboarding, showHelp } from "./onboard.js";
import { initTips } from "./tips.js";
import { BRAND, keysOf, logo, modKey, wordmark } from "./brand.js";

export { registerCommands, openPalette, BRAND, keysOf, logo, modKey, wordmark };

const panels = [];      // {id, icon, label, order, render(container, app) -> optional cleanup}
const tools = [];       // {id, order, match(sel, app) -> bool, render(app, sel) -> Node}
const topActions = [];  // {id, order, render(app) -> Node}
const shortcuts = [];   // {keys: "mod+d" | "delete" | ..., run(app, e), when?(app) -> bool, label}
let home = null;        // render(container, app)

export function registerPanel(p) { panels.push({ order: 50, ...p }); panels.sort((a, b) => a.order - b.order); }
export function registerTool(t) { tools.push({ order: 50, ...t }); tools.sort((a, b) => a.order - b.order); }
export function registerTopAction(a) { topActions.push({ order: 50, ...a }); topActions.sort((a, b) => a.order - b.order); }
export function registerShortcut(s) { shortcuts.push(s); }
export function registerHome(render) { home = render; }
export const listShortcuts = () => shortcuts.filter((s) => s.label);
export const listPanels = () => panels.slice();

const PAGE_MARGIN = 72;

/** Build the shell inside `root`. Returns the elements the app needs. */
export function createShell(root) {
  const homeView = el("main.view.home-view", { id: "home" });
  const nameInput = el("input.doc-name", { id: "doc-name", value: "Untitled design", spellcheck: false, "aria-label": "Design name", "data-tip": "Rename your design" });
  const undoBtn = iconButton("Undo2", `Undo (${modKey}+Z)`, () => {});
  const redoBtn = iconButton("Redo2", `Redo (${modKey}+Shift+Z)`, () => {});
  const topRight = el("div.top-actions");
  const cmdPill = el("button.cmd-pill", { type: "button", "aria-label": "Search every tool and action", "data-tip": "Search every tool, size and template" },
    icon("Search", 16), el("span", {}, "What do you want to do?"), el("kbd", {}, `${modKey} K`));
  const helpBtn = el("button.help-btn", { type: "button", "aria-label": "Help and tips", "data-tip": "Help, tips and the tour" }, "?");
  const topbar = el("header.topbar", {},
    el("div.top-left", {},
      el("a.brand", { href: "#/", title: "All designs" }, logo(), wordmark()),
      el("div.top-mid", {}, undoBtn, redoBtn, el("label.name-tag", {}, nameInput), el("span.save-state", { id: "save-state" }, ""))),
    el("span.top-gap"), cmdPill, el("span.top-gap"),
    el("div.top-right", {}, topRight, helpBtn));
  const rail = el("nav.rail", { "aria-label": "Tools" });
  const panelBox = el("aside.panel", { "aria-label": "Panel" });
  const toolbar = el("div.ctx-toolbar", { role: "toolbar", "aria-label": "Selection tools" });
  const canvasHost = el("div.canvas-host");
  const pageGlow = el("div.page-glow", { "aria-hidden": "true" });
  canvasHost.append(pageGlow);
  const zoomLabel = el("button.zoom-label", { type: "button", title: "Zoom to fit (Shift+1)" }, "100%");
  const zoomRange = el("input.zoom-range", { type: "range", min: 5, max: 400, value: 100, "aria-label": "Zoom" });
  const sizeLabel = el("span.size-label", {}, "");
  const zoomOut = iconButton("ZoomOut", `Zoom out (${modKey}+-)`, () => {});
  const zoomIn = iconButton("ZoomIn", `Zoom in (${modKey}+=)`, () => {});
  const zoombar = el("div.zoombar", {}, zoomOut, zoomRange, zoomIn, zoomLabel);
  const hint = el("div.stage-hint.off", { role: "note" });
  const stage = el("div.stage", {}, toolbar, canvasHost, hint);
  const dockbar = el("footer.dockbar", {}, el("div.dock-left", {}, sizeLabel), rail, zoombar);
  const editorView = el("main.view.editor-view", { id: "editor" }, topbar, el("div.workspace", {}, panelBox, stage), dockbar);
  root.append(homeView, editorView);
  return { homeView, editorView, topbar, topRight, nameInput, undoBtn, redoBtn, rail, panelBox, toolbar, canvasHost,
    zoomLabel, zoomRange, sizeLabel, zoomOut, zoomIn, cmdPill, helpBtn, pageGlow, stageHint: hint, dockbar };
}

/** Wire the registries into a built shell. */
export function mountShell(app) {
  const s = app.shell;
  let current = null, cleanup = null;

  // Selection handles in the brand pink (objects made from now on).
  Object.assign(FabricObject.ownDefaults, { cornerStrokeColor: "#ff2e7e", borderColor: "#ff2e7e" });
  Object.assign(app.editor.canvas, { selectionBorderColor: "#ff2e7e", selectionColor: "rgba(255, 46, 126, 0.1)" });

  // Tool dock + drawers.
  const railButtons = new Map();
  for (const p of panels) {
    const b = el("button.rail-btn", { type: "button", title: p.label, "aria-pressed": "false", dataset: { panel: p.id },
      on: { click: () => open(p.id === current ? null : p.id) } },
    el("span.ico", {}, icon(p.icon, 20)), el("span", {}, p.label));
    railButtons.set(p.id, b);
    s.rail.append(b);
  }
  const railMark = railIndicator(s.rail, railButtons, () => current);
  const fitDock = () => {
    s.rail.classList.remove("compact");
    if (s.rail.scrollWidth > s.rail.clientWidth + 1) s.rail.classList.add("compact");
    railMark();
  };
  new ResizeObserver(fitDock).observe(s.dockbar);
  scrollableRail(s.rail);
  let closeTimer = 0;

  function open(id) {
    cleanup?.();
    cleanup = null;
    const prev = current;
    current = id;
    for (const [pid, b] of railButtons) {
      b.classList.toggle("on", pid === id);
      b.setAttribute("aria-pressed", String(pid === id));
    }
    railMark();
    clearTimeout(closeTimer);
    s.panelBox.classList.remove("closing");
    const p = panels.find((x) => x.id === id);
    if (!p) {
      // Closing: the drawer folds away with its content still in it, then empties.
      s.panelBox.classList.remove("open");
      const old = s.panelBox.firstElementChild;
      if (old) {
        old.inert = true;
        s.panelBox.classList.add("closing");
        closeTimer = setTimeout(() => {
          if (current) return;
          s.panelBox.replaceChildren();
          s.panelBox.classList.remove("closing");
        }, cssMs("--dur-3"));
      }
    } else {
      s.panelBox.replaceChildren();
      s.panelBox.classList.add("open");
      const box = el("div.panel-inner", {}, el("h3.panel-title", {}, p.label));
      const card = el("div.panel-card", { dataset: { panel: p.id } }, iconButton("X", "Close panel", () => open(null), { cls: "panel-close" }), box);
      s.panelBox.append(card);
      try {
        cleanup = p.render(box, app) || null;
      } catch (e) {
        console.error(`[panel ${p.id}]`, e);
        box.append(el("p", { style: { color: "var(--muted)" } }, "This panel couldn't open. Try again, or reload the page."));
      }
      // A fresh drawer slides out; switching tools slides the new content in from the side of the new tool.
      const from = panels.findIndex((x) => x.id === prev), to = panels.indexOf(p);
      card.classList.add(from < 0 ? "enter-open" : to > from ? "enter-next" : "enter-prev");
      revealPanel(box);
    }
    requestAnimationFrame(() => app.editor._fitHost());
  }
  app.openPanel = open;
  app.currentPanel = () => current;

  // Contextual toolbar.
  const renderToolbar = () => {
    const sel = app.editor.selection();
    const nodes = [];
    for (const t of tools) {
      let ok = false;
      try { ok = t.match(sel, app); } catch (e) { console.error(`[tool ${t.id}]`, e); }
      if (!ok) continue;
      try {
        const n = t.render(app, sel);
        if (n) nodes.push(n);
      } catch (e) { console.error(`[tool ${t.id}]`, e); }
    }
    s.toolbar.replaceChildren(...nodes);
    s.toolbar.classList.toggle("empty", nodes.length === 0);
    // Too wide for the stage? Collapse labelled buttons to icons (their tooltips stay).
    s.toolbar.classList.remove("compact");
    if (s.toolbar.scrollWidth > s.toolbar.clientWidth + 1) s.toolbar.classList.add("compact");
  };
  let pending = false;
  const scheduleToolbar = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; renderToolbar(); });
  };
  app.bus.on("selection", scheduleToolbar);
  app.bus.on("doc", scheduleToolbar);
  app.bus.on("history", () => scheduleToolbar());
  app.refreshToolbar = scheduleToolbar;

  // Top actions.
  for (const a of topActions) {
    try {
      const n = a.render(app);
      if (n) s.topRight.append(n);
    } catch (e) { console.error(`[top action ${a.id}]`, e); }
  }
  // Narrow window or many actions? First drop the action labels (tooltips stay), then shrink the search pill.
  const fitTop = () => {
    const t = s.topbar;
    t.classList.remove("tight", "tighter");
    if (s.cmdPill.clientWidth < 220) t.classList.add("tight");
    if (s.cmdPill.clientWidth < 170) t.classList.add("tighter");
  };
  let lastW = 0;
  new ResizeObserver(() => {
    if (s.topbar.clientWidth === lastW) return; // only the window width matters (labels toggling must not loop)
    lastW = s.topbar.clientWidth;
    fitTop();
  }).observe(s.topbar);
  new MutationObserver(() => requestAnimationFrame(fitTop)).observe(s.topRight, { childList: true, subtree: true });

  // A little more room around the page, so the lit set shows behind it.
  const fit = app.editor.zoomToFit.bind(app.editor);
  app.editor.zoomToFit = (margin = PAGE_MARGIN) => fit(margin);

  // Undo / redo / name.
  s.undoBtn.onclick = () => app.editor.history.undo();
  s.redoBtn.onclick = () => app.editor.history.redo();
  app.bus.on("history", ({ canUndo, canRedo }) => { s.undoBtn.disabled = !canUndo; s.redoBtn.disabled = !canRedo; });
  s.nameInput.addEventListener("change", () => app.rename(s.nameInput.value.trim() || "Untitled design"));
  s.nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") s.nameInput.blur(); });

  // Zoom.
  const showZoom = (z) => {
    s.zoomLabel.textContent = `${Math.round(z * 100)}%`;
    s.zoomRange.value = Math.round(z * 100);
  };
  app.bus.on("zoom", showZoom);
  s.zoomRange.addEventListener("input", () => app.editor.setZoom(s.zoomRange.value / 100));
  s.zoomLabel.onclick = () => app.editor.zoomToFit();
  s.zoomIn.onclick = () => app.editor.setZoom(app.editor.zoom * 1.25);
  s.zoomOut.onclick = () => app.editor.setZoom(app.editor.zoom / 1.25);
  app.bus.on("doc", (ed) => {
    s.sizeLabel.replaceChildren(icon("Ruler", 13), `${ed.width} × ${ed.height} px`);
  });

  wirePageGlow(app);
  wireStageHint(app);

  // Keyboard shortcuts (editor view only, never while typing).
  window.addEventListener("keydown", (e) => {
    if (app.view !== "editor" || app.isTyping(e)) return;
    const combo = comboOf(e);
    for (const sc of shortcuts) {
      if (!sc.keys.split("|").includes(combo)) continue;
      if (sc.when && !sc.when(app)) continue;
      e.preventDefault();
      sc.run(app, e);
      return;
    }
  });

  // Command palette, help, onboarding and tooltips.
  s.cmdPill.addEventListener("click", () => openPalette(app));
  s.helpBtn.addEventListener("click", () => showHelp(app, s.helpBtn));
  window.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "k") return;
    if (e.target?.tagName === "TEXTAREA" || e.target?.isContentEditable) return; // editing text on the page
    e.preventDefault();
    openPalette(app);
  });
  initTips();
  initOnboarding(app);

  return { renderHome: (container) => home?.(container, app) };
}

/** A motion token ("--dur-3") in milliseconds. */
function cssMs(token) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const n = parseFloat(v);
  if (Number.isNaN(n)) return 0;
  return v.endsWith("ms") ? n : n * 1000;
}

/** The panel's first sections rise in one after another (once, when the drawer opens). */
function revealPanel(box) {
  const kids = [...box.children];
  kids.forEach((c, i) => c.style.setProperty("--i", String(Math.min(i, 8))));
  box.classList.add("reveal");
  const total = cssMs("--dur-3") + cssMs("--stagger") * Math.min(kids.length, 9) + 60;
  setTimeout(() => box.classList.remove("reveal"), total);
}

/**
 * One glowing marker under the active tool that glides from tool to tool.
 * Returns a function that moves it to the current tool (call after the tool or the layout changes).
 */
function railIndicator(rail, buttons, active) {
  const mark = el("span.rail-ind", { "aria-hidden": "true" });
  rail.append(mark); // last, so the tools' nth-child colours stay the same
  rail.classList.add("has-ind");
  return () => {
    const b = buttons.get(active());
    if (!b) { mark.classList.remove("on"); return; }
    const wasOn = mark.classList.contains("on");
    mark.classList.toggle("jump", !wasOn); // first appearance: no slide from the far left
    mark.style.setProperty("--x", `${b.offsetLeft + b.offsetWidth / 2}px`);
    mark.style.setProperty("--c", getComputedStyle(b).getPropertyValue("--c"));
    if (!wasOn) void mark.offsetWidth;
    mark.classList.add("on");
  };
}

/** Keep the glow layer exactly behind the page as the view zooms and pans. */
function wirePageGlow(app) {
  const c = app.editor.canvas, glow = app.shell.pageGlow;
  let last = "";
  c.on("after:render", () => {
    const v = c.viewportTransform, ed = app.editor;
    if (!ed.page) return;
    const key = `${v[0]},${v[4]},${v[5]},${ed.width},${ed.height}`;
    if (key === last) return;
    last = key;
    Object.assign(glow.style, { left: `${v[4]}px`, top: `${v[5]}px`, width: `${ed.width * v[0]}px`, height: `${ed.height * v[0]}px` });
    glow.classList.add("on");
  });
}

/** A friendly hint on an empty page: what to do next. */
function wireStageHint(app) {
  const hint = app.shell.stageHint;
  const go = (id) => () => (app.openPanel ? app.openPanel(id) : null);
  const has = (id) => listPanels().some((p) => p.id === id);
  const btn = (id, ic, label) => (has(id) ? el("button.btn.small", { type: "button", on: { click: go(id) } }, icon(ic, 14), label) : null);
  hint.append(
    el("img", { src: BRAND.sparksHead, alt: "", draggable: false }),
    el("span", {}, el("b", {}, "Empty page."), " Start with"),
    btn("templates", "LayoutTemplate", "A template"),
    btn("text", "Type", "Text"),
    btn("elements", "Shapes", "Elements"),
    el("span", {}, "or press"), el("kbd", {}, `${modKey} K`));
  let pending = false;
  const update = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      hint.classList.toggle("off", app.view !== "editor" || app.editor.objects().length > 0);
    });
  };
  for (const ev of ["doc", "change", "objects:changed", "history", "view"]) app.bus.on(ev, update);
}

/** "mod+shift+z", "delete", "arrowleft", "mod+=" ... (mod = Ctrl or Cmd). */
export function comboOf(e) {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("mod");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey && k.length > 1) parts.push("shift");
  else if (e.shiftKey && /[a-z0-9]/.test(k)) parts.push("shift");
  parts.push(k === " " ? "space" : k);
  return parts.join("+");
}


/**
 * The tool dock holds more tools than fit on a narrow screen: let it scroll sideways with the
 * mouse wheel, by dragging it, or with the arrows that show at an edge with more tools past it.
 */
function scrollableRail(rail) {
  const prev = el("button.rail-more.prev", { type: "button", "aria-label": "More tools on the left", tabindex: "-1" }, icon("ChevronLeft", 16));
  const next = el("button.rail-more.next", { type: "button", "aria-label": "More tools on the right", tabindex: "-1" }, icon("ChevronRight", 16));
  const wrap = el("div.rail-wrap");
  rail.replaceWith(wrap);
  wrap.append(prev, rail, next);
  const sync = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    prev.hidden = rail.scrollLeft <= 1;
    next.hidden = rail.scrollLeft >= max - 1;
    wrap.classList.toggle("more-l", !prev.hidden);
    wrap.classList.toggle("more-r", !next.hidden);
  };
  const page = (d) => rail.scrollBy({ left: d * rail.clientWidth * 0.7, behavior: "smooth" });
  prev.addEventListener("click", () => page(-1));
  next.addEventListener("click", () => page(1));
  rail.addEventListener("scroll", sync, { passive: true });
  new ResizeObserver(sync).observe(rail);
  new MutationObserver(sync).observe(rail, { childList: true });
  rail.addEventListener("wheel", (e) => {
    if (rail.scrollWidth <= rail.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    rail.scrollLeft += e.deltaY;
  }, { passive: false });
  // Drag to scroll. A press that moves less than a few pixels is still a click on the tool.
  let drag = null;
  rail.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || rail.scrollWidth <= rail.clientWidth) return;
    drag = { x: e.clientX, left: rail.scrollLeft, moved: false, id: e.pointerId };
  });
  rail.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) { drag.moved = true; rail.setPointerCapture(e.pointerId); rail.classList.add("dragging"); }
    rail.scrollLeft = drag.left - dx;
  });
  const end = () => {
    if (!drag) return;
    if (drag.moved) {
      // swallow the click that ends a drag, so it doesn't open a panel
      rail.addEventListener("click", (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
      setTimeout(() => rail.classList.remove("dragging"), 0);
    }
    drag = null;
  };
  rail.addEventListener("pointerup", end);
  rail.addEventListener("pointercancel", end);
  requestAnimationFrame(sync);
}
