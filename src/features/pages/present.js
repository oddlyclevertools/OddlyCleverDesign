// Present: a full-screen slideshow of every page. Arrow keys, click or swipe to move, Esc to
// leave. Pages fade or slide in, and each page's animations play as it arrives (the same
// stateAt() the editor preview and MP4 export use). Hold the pointer down for a laser dot.
// "Presenter view" opens a second window with the speaker notes, a timer and the next page.
import { el, icon, iconButton, toast } from "../../ui/kit.js";
import { applyState, captureBase } from "../motion/render.js";
import { animOf, introEnd, stateAt } from "../motion/timeline.js";
import { loadPageStage, renderPageJSON } from "./render.js";

export const TRANSITIONS = [
  { id: "fade", label: "Fade" },
  { id: "slide", label: "Slide" },
  { id: "none", label: "None" },
];
const PREF = "pg-present";
const TRANSITION_MS = 420;
const HOLD_MS = 220;      // hold this long for the laser pointer
const SWIPE_PX = 60;
const IDLE_MS = 2400;     // controls and cursor hide after this

export function loadPresentPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(PREF) || "null");
    return { transition: "fade", notes: false, fromStart: true, ...(v && typeof v === "object" ? v : {}) };
  } catch {
    return { transition: "fade", notes: false, fromStart: true };
  }
}
export function savePresentPrefs(p) {
  try { localStorage.setItem(PREF, JSON.stringify(p)); } catch { /* storage blocked */ }
}

let active = null; // the running show (one at a time)
export const presenting = () => Boolean(active);

/**
 * Start presenting. Call it from a click or key press (full screen and the notes window need one).
 * @param {object} app
 * @param {{from?: number, transition?: "fade"|"slide"|"none", notes?: boolean}} opts
 *   from: the page index to start on (default: the open page); notes: open the presenter view
 * @returns {{ next(): Promise<void>, prev(): Promise<void>, go(i: number): Promise<void>, exit(): void, get index(): number }}
 */
export function present(app, { from, transition, notes } = {}) {
  if (active) return active.api;
  const ed = app.editor;
  if (app.view !== "editor") throw new Error("Open a design first.");
  const prefs = loadPresentPrefs();
  const state = {
    transition: TRANSITIONS.some((t) => t.id === transition) ? transition : prefs.transition,
    index: Math.max(0, Math.min(ed.pageCount - 1, Number.isInteger(from) ? from : ed.pageIndex)),
  };
  app.motion?.stop?.();
  const a = ed.canvas.getActiveObject();
  if (a?.isEditing) a.exitEditing();

  // A snapshot of every page (the open page at rest), so editing can't change the show.
  const W = ed.width, H = ed.height;
  const pages = ed.listPages().map((p) => ({ name: p.name, notes: p.notes, json: ed.pageJSON(p.index) }));

  // Open the notes window first: browsers only allow it straight from the click.
  const notesWin = notes ?? prefs.notes ? openNotesWindow() : null;
  if ((notes ?? prefs.notes) && !notesWin) toast("Your browser blocked the presenter view. Allow pop-ups for this site to see your notes.", { error: true, ms: 6000 });

  const stageBox = el("div.pg-show-stage");
  const laser = el("div.pg-laser", { "aria-hidden": "true" });
  const counter = el("span.pg-show-count");
  const transSel = el("select.pg-show-select", { "aria-label": "Page transition", title: "Page transition" },
    ...TRANSITIONS.map((t) => el("option", { value: t.id, selected: t.id === state.transition }, t.label)));
  const controls = el("div.pg-show-bar", {},
    iconButton("ChevronLeft", "Previous page (←)", () => api.prev()),
    counter,
    iconButton("ChevronRight", "Next page (→)", () => api.next()),
    el("span.pg-show-sep"),
    transSel,
    iconButton("NotebookPen", "Open the presenter view (notes, timer, next page)", () => attachNotes(openNotesWindow())),
    iconButton("X", "Stop presenting (Esc)", () => api.exit()));
  const hint = el("div.pg-show-hint", {}, "← → to move · hold for a laser pointer · Esc to stop");
  const root = el("div.pg-show", { role: "dialog", "aria-label": "Presenting", tabindex: -1 }, stageBox, laser, controls, hint);
  document.body.append(root);

  // ---- slides ---------------------------------------------------------------------------
  const built = new Map(); // index -> Promise<slide>
  let shown = null;        // { index, node, sc, raf, ... }

  function fitSize() {
    const k = Math.min(innerWidth / W, innerHeight / H);
    return { cw: Math.max(1, Math.round(W * k)), ch: Math.max(1, Math.round(H * k)), k };
  }

  async function buildSlide(i) {
    const { cw, ch, k } = fitSize();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const sc = await loadPageStage(pages[i].json, W, H, { width: Math.round(cw * dpr), height: Math.round(ch * dpr) });
    sc.setViewportTransform([k * dpr, 0, 0, k * dpr, 0, 0]);
    const node = sc.lowerCanvasEl || sc.getElement();
    Object.assign(node.style, { width: `${cw}px`, height: `${ch}px` });
    const entries = sc.getObjects().filter((o) => !o.isPage && animOf(o)).map((o) => ({ o, base: captureBase(o, W, H) }));
    const holdAt = Math.max(0, ...entries.map((e) => introEnd(animOf(e.o))));
    const loops = entries.some((e) => animOf(e.o)?.loop);
    const draw = (t) => {
      for (const e of entries) applyState(e.o, e.base, stateAt(e.o, t, { duration: Infinity, pw: W, ph: H, geo: e.base.geo }));
      sc.renderAll();
    };
    draw(0);
    return { index: i, sc, node: el("div.pg-slide", {}, node), draw, holdAt, loops, raf: 0, size: `${cw}x${ch}` };
  }
  const slideFor = (i) => {
    if (!built.has(i)) built.set(i, buildSlide(i).catch((e) => { built.delete(i); throw e; }));
    return built.get(i);
  };
  const dropSlide = (s) => {
    cancelAnimationFrame(s.raf);
    s.node.remove();
    s.sc.dispose();
  };
  function play(s) {
    const t0 = performance.now();
    const tick = (now) => {
      if (!active || shown !== s) return;
      const t = (now - t0) / 1000;
      s.draw(t);
      if (s.loops || t <= s.holdAt + 0.05) s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
  }

  let busy = Promise.resolve();
  async function show(i, dir = 1) {
    i = Math.max(0, Math.min(pages.length - 1, i));
    if (shown && shown.index === i) return;
    let s;
    try {
      s = await slideFor(i);
    } catch (e) {
      toast(`Couldn't show page ${i + 1}: ${e.message}`, { error: true });
      return;
    }
    if (!active) return;
    built.delete(i);
    const old = shown;
    shown = s;
    state.index = i;
    stageBox.append(s.node);
    const anim = old ? state.transition : "none";
    if (anim === "fade") {
      s.node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: TRANSITION_MS, easing: "ease-out" });
    } else if (anim === "slide") {
      s.node.animate([{ transform: `translateX(${dir * 100}%)` }, { transform: "none" }], { duration: TRANSITION_MS, easing: "cubic-bezier(.2,.8,.2,1)" });
      old.node.animate([{ transform: "none" }, { transform: `translateX(${-dir * 100}%)` }], { duration: TRANSITION_MS, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    }
    play(s);
    if (old) {
      cancelAnimationFrame(old.raf);
      setTimeout(() => dropSlide(old), anim === "none" ? 0 : TRANSITION_MS + 30);
    }
    counter.textContent = `${i + 1} / ${pages.length}`;
    updateNotes();
    // Get the neighbours ready; let go of anything further away.
    for (const [k, p] of built) if (Math.abs(k - i) > 1) { built.delete(k); p.then(dropSlide, () => {}); }
    if (i + 1 < pages.length) slideFor(i + 1).catch(() => {});
    if (i > 0) slideFor(i - 1).catch(() => {});
  }
  const go = (i, dir) => (busy = busy.then(() => show(i, dir)));

  // ---- input ------------------------------------------------------------------------------
  let idle = 0;
  const wake = () => {
    root.classList.add("awake");
    clearTimeout(idle);
    idle = setTimeout(() => root.classList.remove("awake"), IDLE_MS);
  };
  const onKey = (e) => {
    const k = e.key;
    const nextKeys = ["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n", "N"];
    const prevKeys = ["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p", "P"];
    if (e.target === transSel) {
      if (k === "Escape") { e.preventDefault(); api.exit(); }
      return;
    }
    let handled = true;
    if (nextKeys.includes(k)) api.next();
    else if (prevKeys.includes(k)) api.prev();
    else if (k === "Home") api.go(0);
    else if (k === "End") api.go(pages.length - 1);
    else if (k === "Escape") api.exit();
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    } else if (!e.ctrlKey && !e.metaKey) {
      e.stopPropagation(); // the editor's own shortcuts stay quiet while presenting
    }
  };
  window.addEventListener("keydown", onKey, true);

  let press = null;
  const onDown = (e) => {
    if (e.target.closest(".pg-show-bar")) return;
    root.setPointerCapture?.(e.pointerId);
    press = { x: e.clientX, y: e.clientY, t: performance.now(), laser: false };
    press.timer = setTimeout(() => {
      if (!press) return;
      press.laser = true;
      moveLaser(e.clientX, e.clientY);
      laser.classList.add("on");
      root.classList.add("lasering");
    }, HOLD_MS);
  };
  const moveLaser = (x, y) => { laser.style.transform = `translate(${x}px, ${y}px)`; };
  const onMove = (e) => {
    wake();
    if (!press) return;
    if (press.laser) moveLaser(e.clientX, e.clientY);
    else if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) clearTimeout(press.timer);
  };
  const onUp = (e) => {
    if (!press) return;
    const p = press;
    press = null;
    clearTimeout(p.timer);
    if (p.laser) {
      laser.classList.remove("on");
      root.classList.remove("lasering");
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) api.next(); else api.prev();
    } else if (Math.hypot(dx, dy) < 12) {
      if (e.clientX < innerWidth * 0.15) api.prev(); else api.next();
    }
  };
  const onCancel = () => {
    if (press) clearTimeout(press.timer);
    press = null;
    laser.classList.remove("on");
    root.classList.remove("lasering");
  };
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onCancel);
  root.addEventListener("contextmenu", (e) => e.preventDefault());
  transSel.addEventListener("change", () => {
    state.transition = transSel.value;
    savePresentPrefs({ ...loadPresentPrefs(), transition: state.transition });
  });

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!active || !shown || shown.size === `${fitSize().cw}x${fitSize().ch}`) return;
      for (const p of built.values()) p.then(dropSlide, () => {});
      built.clear();
      const i = shown.index;
      const old = shown;
      shown = null;
      dropSlide(old);
      go(i, 1);
    }, 150);
  };
  window.addEventListener("resize", onResize);

  let wentFull = false;
  const onFull = () => {
    if (document.fullscreenElement === root) wentFull = true;
    else if (wentFull && active) api.exit();
  };
  document.addEventListener("fullscreenchange", onFull);
  // Full screen needs a click or key press; without one the overlay still fills the window.
  if (navigator.userActivation?.isActive !== false) root.requestFullscreen?.().catch(() => {});
  root.focus();

  // ---- presenter view (second window) -------------------------------------------------
  const notesState = { win: null, els: null, t0: performance.now(), paused: 0, pausedAt: 0, timer: 0, thumbs: new Map() };
  function attachNotes(win) {
    if (!win) {
      toast("Your browser blocked the presenter view. Allow pop-ups for this site to see your notes.", { error: true, ms: 6000 });
      return;
    }
    notesState.win = win;
    notesState.els = buildNotesView(win, {
      next: () => api.next(), prev: () => api.prev(), exit: () => api.exit(),
      togglePause: () => {
        if (notesState.pausedAt) { notesState.paused += performance.now() - notesState.pausedAt; notesState.pausedAt = 0; } else notesState.pausedAt = performance.now();
        tickTimer();
      },
      resetTimer: () => { notesState.t0 = performance.now(); notesState.paused = 0; notesState.pausedAt = notesState.pausedAt ? performance.now() : 0; tickTimer(); },
    });
    clearInterval(notesState.timer);
    notesState.timer = setInterval(tickTimer, 500);
    tickTimer();
    updateNotes();
  }
  function tickTimer() {
    const els = notesState.els;
    if (!els || notesState.win?.closed) return;
    const now = notesState.pausedAt || performance.now();
    const s = Math.max(0, Math.floor((now - notesState.t0 - notesState.paused) / 1000));
    els.timer.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    els.pause.textContent = notesState.pausedAt ? "Resume" : "Pause";
  }
  const thumbOf = (i) => {
    if (!notesState.thumbs.has(i)) {
      const scale = Math.min(1, 900 / Math.max(W, H));
      notesState.thumbs.set(i, renderPageJSON(pages[i].json, W, H, { scale, matte: "#ffffff" }).then((c) => c.toDataURL("image/jpeg", 0.85)));
    }
    return notesState.thumbs.get(i);
  };
  function updateNotes() {
    const els = notesState.els;
    if (!els || notesState.win?.closed) return;
    const i = state.index, p = pages[i];
    els.count.textContent = `Page ${i + 1} of ${pages.length}${p.name && p.name !== `Page ${i + 1}` ? ` · ${p.name}` : ""}`;
    els.notes.textContent = p.notes || "No notes for this page.";
    els.notes.classList.toggle("empty", !p.notes);
    thumbOf(i).then((u) => { if (state.index === i) els.now.src = u; }).catch(() => {});
    if (i + 1 < pages.length) {
      els.nextBox.hidden = false;
      els.endBox.hidden = true;
      thumbOf(i + 1).then((u) => { if (state.index === i) els.next.src = u; }).catch(() => {});
    } else {
      els.nextBox.hidden = true;
      els.endBox.hidden = false;
    }
  }
  if (notesWin) attachNotes(notesWin);

  // ---- api ----------------------------------------------------------------------------------
  const api = {
    get index() { return state.index; },
    get pages() { return pages.length; },
    get transition() { return state.transition; },
    next: () => (state.index < pages.length - 1 ? go(state.index + 1, 1) : Promise.resolve()),
    prev: () => (state.index > 0 ? go(state.index - 1, -1) : Promise.resolve()),
    go: (i) => go(Math.round(Number(i)), Number(i) >= state.index ? 1 : -1),
    exit() {
      if (!active) return;
      active = null;
      offView();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("fullscreenchange", onFull);
      clearTimeout(idle);
      clearInterval(notesState.timer);
      if (document.fullscreenElement === root) document.exitFullscreen?.().catch(() => {});
      if (notesState.win && !notesState.win.closed) notesState.win.close();
      if (shown) dropSlide(shown);
      for (const p of built.values()) p.then(dropSlide, () => {});
      built.clear();
      root.classList.add("leaving");
      setTimeout(() => root.remove(), 200);
      app.bus.emit("present", false);
    },
  };
  active = { api };
  const offView = app.bus.on("view", () => api.exit());
  wake();
  app.bus.emit("present", true);
  go(state.index, 1);
  return api;
}

// ---- the presenter view window ------------------------------------------------------------

function openNotesWindow() {
  try {
    const w = Math.min(1100, screen.availWidth || 1100), h = Math.min(700, screen.availHeight || 700);
    return window.open("", "oc-presenter-view", `popup=yes,width=${w},height=${h}`) || null;
  } catch {
    return null;
  }
}

const NOTES_CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; height: 100vh; display: grid; grid-template-rows: auto 1fr auto; background: #0d0a10; color: #f7eff4;
  font: 15px/1.45 Inter, system-ui, sans-serif; }
header, footer { display: flex; align-items: center; gap: 12px; padding: 12px 18px; background: #151019; border-bottom: 1px solid rgba(255,230,240,.12); }
footer { border-top: 1px solid rgba(255,230,240,.12); border-bottom: 0; justify-content: center; }
.timer { font: 700 30px/1 ui-monospace, Consolas, monospace; color: #8fe3ff; letter-spacing: .04em; min-width: 110px; }
.count { flex: 1; color: #b2a5b6; }
button { font: inherit; color: inherit; height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid rgba(255,230,240,.18); background: #2a2132; cursor: pointer; }
button:hover { border-color: #ff2e7e; }
button.primary { background: #ff2e7e; border-color: #ff2e7e; color: #fff; font-weight: 600; }
main { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 18px; padding: 18px; min-height: 0; }
.col { display: grid; gap: 10px; align-content: start; min-height: 0; }
.label { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #b2a5b6; }
img { width: 100%; max-height: 52vh; object-fit: contain; background: #1e1724; border-radius: 10px; border: 1px solid rgba(255,230,240,.12); }
.now { box-shadow: 0 0 0 2px #ff2e7e, 0 0 26px -4px rgba(255,46,126,.6); }
.next img { max-height: 24vh; opacity: .9; }
.end { padding: 18px; border-radius: 10px; background: #1e1724; color: #b2a5b6; text-align: center; }
.notes { overflow: auto; white-space: pre-wrap; font-size: 22px; line-height: 1.5; padding: 14px 16px; border-radius: 10px; background: #151019;
  border: 1px solid rgba(255,230,240,.1); max-height: 40vh; }
.notes.empty { color: #7d6f83; font-size: 16px; font-style: italic; }
`;

function buildNotesView(win, h) {
  const d = win.document;
  d.title = "Presenter view · OddlyClever Design";
  d.head.replaceChildren(Object.assign(d.createElement("style"), { textContent: NOTES_CSS }));
  const mk = (tag, cls, text) => {
    const n = d.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const btn = (label, fn, cls) => {
    const b = mk("button", cls, label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  };
  const timer = mk("span", "timer", "00:00");
  const pause = btn("Pause", h.togglePause);
  const count = mk("span", "count");
  const now = mk("img", "now");
  now.alt = "This page";
  const next = mk("img");
  next.alt = "Next page";
  const notes = mk("div", "notes");
  const nextBox = mk("div", "col next");
  nextBox.append(mk("div", "label", "Next"), next);
  const endBox = mk("div", "end", "This is the last page.");
  const header = mk("header");
  header.append(timer, pause, btn("Reset", h.resetTimer), count, btn("Stop presenting", h.exit));
  const left = mk("div", "col");
  left.append(mk("div", "label", "Now"), now);
  const right = mk("div", "col");
  right.append(nextBox, endBox, mk("div", "label", "Notes"), notes);
  const main = mk("main");
  main.append(left, right);
  const footer = mk("footer");
  footer.append(btn("← Previous", h.prev), btn("Next →", h.next, "primary"));
  d.body.replaceChildren(header, main, footer);
  d.addEventListener("keydown", (e) => {
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); h.next(); }
    if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); h.prev(); }
    if (e.key === "Escape") h.exit();
  });
  return { timer, pause, count, now, next, notes, nextBox, endBox };
}

/** The Present popover: transition, start page, presenter view, Start. */
export function presentPanel(app, close) {
  const ed = app.editor;
  const prefs = loadPresentPrefs();
  const seg = (items, value, onPick, label) => {
    const box = el("div.fl-seg", { role: "radiogroup", "aria-label": label });
    const draw = (v) => box.replaceChildren(...items.map((m) => el("button.fl-seg-btn", {
      type: "button", role: "radio", "aria-checked": m.id === v, class: m.id === v ? "on" : null,
      on: { click: () => { draw(m.id); onPick(m.id); } },
    }, m.label)));
    draw(value);
    return box;
  };
  const save = () => savePresentPrefs(prefs);
  const notesToggle = el("label.pg-check", {},
    el("input", { type: "checkbox", checked: prefs.notes, on: { change: (e) => { prefs.notes = e.target.checked; save(); } } }),
    el("span", {}, el("b", {}, "Presenter view"), el("small", {}, "A second window with your notes, a timer and the next page.")));
  const start = el("button.btn.primary.pg-start", { type: "button" }, icon("Play", 16), "Start presenting");
  start.addEventListener("click", () => {
    close?.();
    try {
      present(app, { from: prefs.fromStart ? 0 : ed.pageIndex, transition: prefs.transition, notes: prefs.notes });
    } catch (e) {
      toast(e.message, { error: true });
    }
  });
  return el("div.pg-present-pop", {},
    el("div.pg-pop-head", {}, icon("Presentation", 16), el("b", {}, "Present"), el("span.pg-muted", {}, `${ed.pageCount} page${ed.pageCount > 1 ? "s" : ""}`)),
    el("div.pg-label", {}, "Start from"),
    seg([{ id: "start", label: "Page 1" }, { id: "here", label: `This page (${ed.pageIndex + 1})` }], prefs.fromStart ? "start" : "here",
      (id) => { prefs.fromStart = id === "start"; save(); }, "Start from"),
    el("div.pg-label", {}, "Between pages"),
    seg(TRANSITIONS, prefs.transition, (id) => { prefs.transition = id; save(); }, "Transition"),
    notesToggle,
    el("p.pg-hint", {}, "Arrow keys, click or swipe to move. Hold the mouse down for a laser pointer. Esc stops."),
    start);
}
