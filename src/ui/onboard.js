// Beginner help: the first-run welcome ("What are you making today?"), a short skippable tour of
// the editor, the "?" help popover with tips, and the keyboard-shortcut sheet.
// The welcome and the tour show once (flags in localStorage). Automated browsers skip them so test
// scripts aren't blocked; add ?onboard to the URL to force them.
import { el, icon, modal, popover, closePopover } from "./kit.js";
import { listShortcuts } from "./shell.js";
import { BRAND, TEA_URL, keysOf, modKey } from "./brand.js";
import { openPalette } from "./palette.js";

const SEEN_WELCOME = "oc-welcome-seen";
const SEEN_TOUR = "oc-tour-seen";

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: show again next time */ } },
};
const forced = () => /[?&]onboard\b/.test(location.search);
const automated = () => navigator.webdriver === true && !forced();

const CHOICES = [
  { size: "yt-thumb", label: "YouTube thumbnail", note: "1280 × 720", w: 16, h: 9, tone: "pink" },
  { size: "shorts", label: "Short or Reel", note: "1080 × 1920", w: 9, h: 16, tone: "gold" },
  { size: "ig-post", label: "Social post", note: "1080 × 1080", w: 1, h: 1, tone: "cyan" },
  { size: "poster", label: "Poster", note: "18 × 24 in", w: 3, h: 4, tone: "paper" },
];

export function initOnboarding(app) {
  let pendingTour = false;
  app.onboard = {
    openWelcome: () => openWelcome(app, (picked) => { pendingTour = picked; }),
    startTour: (force = false) => startTour(app, force),
    showShortcuts,
    showHelp: (anchor) => showHelp(app, anchor),
  };
  app.bus.on("view", (name) => {
    if (automated()) return;
    if (name === "home" && (!store.get(SEEN_WELCOME) || forced()) && !document.querySelector(".ob-welcome")) {
      app.onboard.openWelcome();
    }
    if (name === "editor" && (pendingTour || !store.get(SEEN_TOUR) || forced())) {
      pendingTour = false;
      setTimeout(() => startTour(app, forced()), 650);
    }
  });
}

// ---- welcome ------------------------------------------------------------------------------

// Custom properties need setProperty (el()'s style object can't set them): --i orders the reveal.
const staggered = (node, i) => { node.style.setProperty("--i", String(i)); return node; };

function openWelcome(app, onPicked) {
  if (document.querySelector(".ob-welcome")) return;
  const done = () => store.set(SEEN_WELCOME, "1");
  const back = el("div.ob-welcome", { role: "dialog", "aria-modal": "true", "aria-label": "What are you making today?" });
  const close = () => {
    document.removeEventListener("keydown", esc, true);
    back.classList.remove("show");
    setTimeout(() => back.remove(), 260);
  };
  const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); done(); close(); } };
  const pick = (c) => {
    done();
    close();
    onPicked(true);
    app.newDesign({ size: c.size }).catch(() => {});
  };
  const other = () => {
    done();
    close();
    const search = document.querySelector(".tp-search-input");
    if (search) {
      search.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => search.focus(), 300);
    } else openPalette(app);
  };
  const card = (c, i) => staggered(el("button.ob-choice", { type: "button", dataset: { tone: c.tone }, on: { click: () => pick(c) } },
    el("span.ob-shape-box", {}, el("span.ob-shape", { style: { aspectRatio: `${c.w} / ${c.h}`, [c.w >= c.h ? "width" : "height"]: "62px" } })),
    el("b", {}, c.label), el("small", {}, c.note)), i);
  back.append(el("div.ob-panel", {},
    el("img.ob-sparks", { src: BRAND.sparks, alt: "Sparks, the Oddly Clever mascot", draggable: false }),
    el("div.ob-body", {},
      el("div.ob-sign", { "aria-hidden": "true" }, el("b", {}, "ODDLY"), el("i", {}, "clever")),
      el("h2.ob-q", {}, "What are you making today?"),
      el("p.ob-sub", {}, "Pick one and I'll set up the page. You can change the size later."),
      el("div.ob-choices", {}, CHOICES.map(card),
        staggered(el("button.ob-choice.ob-other", { type: "button", on: { click: other } },
          el("span.ob-shape-box", {}, icon("Search", 30)), el("b", {}, "Something else"), el("small", {}, "36 sizes and templates")), 4)),
      el("button.ob-skip", { type: "button", on: { click: () => { done(); close(); } } }, "Skip. I'll look around first."))));
  document.body.append(back);
  document.addEventListener("keydown", esc, true);
  requestAnimationFrame(() => back.classList.add("show"));
  setTimeout(() => back.querySelector(".ob-choice")?.focus({ preventScroll: true }), 300);
}

// ---- tour ---------------------------------------------------------------------------------

const STEPS = [
  { target: ".rail", title: "Your toolbelt", text: "Every tool lives down here: templates, text, photos, shapes, characters and more. Click one and its drawer slides out.", place: "above" },
  { target: ".page-glow", title: "Your page", text: "Click anything on the page to change it. Its tools pop up just above the page. Drag to move, pull the corners to resize.", place: "inside" },
  { target: ".cmd-pill", title: "Lost? Just ask.", text: `Press ${modKey} K and type what you want: “add text”, “undo”, “poster”, “download”…`, place: "below" },
  { target: ".top-actions", title: "Done? Download it.", text: "Download gives you a PNG, JPG, PDF and more. Your work also saves in this browser as you go.", place: "below" },
];

let tourOn = null;

function startTour(app, force = false) {
  if (tourOn || app.view !== "editor") return;
  if (!force && store.get(SEEN_TOUR)) return;
  if (document.querySelector(".ob-welcome, .pal-back, .modal-back")) return;
  closePopover();
  let i = 0;
  const spot = el("div.ob-spot", { "aria-hidden": "true" });
  const dots = el("span.ob-dots");
  const title = el("h3.ob-tt");
  const text = el("p.ob-tx");
  const next = el("button.btn.primary.small", { type: "button" });
  const card = el("div.ob-tour", { role: "dialog", "aria-live": "polite", "aria-label": "Quick tour" },
    el("img.ob-tour-face", { src: BRAND.sparksHead, alt: "", draggable: false }),
    el("div.ob-tour-body", {}, title, text,
      el("div.ob-tour-foot", {}, dots, el("span.grow"),
        el("button.btn.small.ghost", { type: "button", on: { click: () => end() } }, "Skip tour"), next)));
  const layer = el("div.ob-tour-layer", {}, spot, card);
  document.body.append(layer);
  const end = () => {
    store.set(SEEN_TOUR, "1");
    window.removeEventListener("resize", place);
    document.removeEventListener("keydown", key, true);
    layer.classList.remove("show");
    setTimeout(() => layer.remove(), 220);
    tourOn = null;
  };
  const key = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(); }
    else if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); go(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); go(i - 1); }
  };
  function place() {
    const step = STEPS[i];
    const t = document.querySelector(step.target);
    const r = t?.getBoundingClientRect();
    if (!r || !r.width) { spot.style.opacity = "0"; card.style.left = "50%"; card.style.top = "40%"; return; }
    const pad = step.place === "inside" ? 4 : 8;
    Object.assign(spot.style, { opacity: "1", left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let left = r.left + r.width / 2 - cw / 2, top;
    if (step.place === "above") top = r.top - ch - 22;
    else if (step.place === "inside") top = r.top + r.height / 2 - ch / 2;
    else top = r.bottom + 18;
    left = Math.max(12, Math.min(left, innerWidth - cw - 12));
    top = Math.max(12, Math.min(top, innerHeight - ch - 12));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }
  function go(n) {
    if (n >= STEPS.length) { end(); return; }
    i = Math.max(0, n);
    title.textContent = STEPS[i].title;
    text.textContent = STEPS[i].text;
    next.textContent = i === STEPS.length - 1 ? "Let's make something" : "Next";
    next.onclick = () => go(i + 1);
    dots.replaceChildren(...STEPS.map((_, j) => el("i", { class: j === i ? "on" : null })));
    card.classList.remove("pop");
    void card.offsetWidth;
    card.classList.add("pop");
    place();
  }
  window.addEventListener("resize", place);
  document.addEventListener("keydown", key, true);
  tourOn = { end };
  go(0);
  requestAnimationFrame(() => { layer.classList.add("show"); place(); next.focus({ preventScroll: true }); });
}

// ---- help ---------------------------------------------------------------------------------

const TIPS = [
  ["MousePointerClick", "Click anything on the page to edit it. Its tools appear above the page."],
  ["Search", `Press ${modKey} K and type what you want to do.`],
  ["Undo2", `Made a mess? ${modKey} Z undoes it. Nothing is lost.`],
  ["Move", "Hold Space and drag to move around. Ctrl + scroll zooms."],
  ["CopyPlus", `${modKey} D duplicates. Arrow keys nudge by 1 px (Shift: 10 px).`],
  ["HardDrive", "Your designs save in this browser by themselves. No account, no upload."],
];

export function showHelp(app, anchor) {
  const inEditor = app.view === "editor";
  const box = el("div.ob-help", {},
    el("div.ob-help-head", {}, el("img", { src: BRAND.sparksGrin, alt: "", draggable: false }),
      el("div", {}, el("h4.sec-title", {}, "Quick tips"), el("p", {}, "The short version. You've got this."))),
    el("ul.ob-tips", {}, TIPS.map(([ic, t]) => el("li", {}, icon(ic, 16), el("span", {}, t)))),
    el("div.ob-help-actions", {},
      inEditor ? el("button.btn.small.primary", { type: "button", on: { click: () => { closePopover(); startTour(app, true); } } }, icon("Compass", 15), "Take the tour") : null,
      el("button.btn.small", { type: "button", on: { click: () => { closePopover(); openPalette(app); } } }, icon("Search", 15), "Search everything"),
      el("button.btn.small", { type: "button", on: { click: () => { closePopover(); showShortcuts(); } } }, icon("Keyboard", 15), "Shortcuts"),
      !inEditor ? el("button.btn.small", { type: "button", on: { click: () => { closePopover(); app.onboard.openWelcome(); } } }, icon("Sparkles", 15), "Start something") : null),
    el("p.ob-tea", {}, "Free forever. If it saves you time, ",
      el("a", { href: TEA_URL, target: "_blank", rel: "noopener" }, icon("Coffee", 14), "buy me a tea"), "."));
  popover(anchor, box, { align: "end", cls: "ob-help-pop" });
}

export function showShortcuts() {
  const rows = listShortcuts().map((s) => el("div.ob-key", {}, el("span", {}, s.label.replace(/\s*\(.*\)$/, "")),
    el("span.ob-keys", {}, keysOf(s.keys).map((k) => el("kbd", {}, k)))));
  rows.unshift(el("div.ob-key", {}, el("span", {}, "Search everything"), el("span.ob-keys", {}, el("kbd", {}, modKey), el("kbd", {}, "K"))));
  modal("Keyboard shortcuts", el("div.ob-keylist", {}, rows), { wide: true });
}
