// Keeps the selection toolbar on one clean line at any stage width, and gives it its motion.
//  - Fit: when the tools don't fit (after the shell has collapsed labels to icons), the least used
//    controls move, in order, into a "More tools" tray at the end of the bar. The tray lives inside
//    the toolbar, so every control keeps its class, title and aria label and stays reachable.
//    Controls can say how early they fold with data-fold (higher folds first, 0 = keep to the end).
//  - Motion: the groups stagger in when the selection changes, and a toggle that flips (Bold, Lock…)
//    gives a small pop when the bar redraws.
import { el, icon } from "../../ui/kit.js";

const INTERACTIVE = "button, input, select, textarea, [tabindex]";
const POPUPS = ".popover, .ar-ctx, .modal-back";
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** "Lock (Ctrl+Shift+L)" -> "Lock", "Position: layer order, align, size" -> "Position". */
export function shortLabel(text = "") {
  return String(text).replace(/\s*\(.*$/, "").replace(/:.*$/, "").trim();
}

function foldPrio(node) {
  const v = node.dataset?.fold ?? node.querySelector?.("[data-fold]")?.dataset.fold;
  return v == null || v === "" ? 1 : Number(v);
}

const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Wire the fit and motion to the shell's toolbar. */
export function wireToolbarFit(app) {
  const bar = app.shell?.toolbar;
  if (!bar) return;
  bar.classList.add("tb-fit");
  let lastSel = [];
  let lastToggles = new Map();
  let keepOpen = false; // the tray stays open across redraws of the same selection
  let closeTray = () => {};

  const mo = new MutationObserver(() => {
    closeTray(true);
    const sel = app.editor.selection();
    const same = sameList(sel, lastSel);
    lastSel = sel.slice();
    if (!same) keepOpen = false;
    try {
      fit(same && keepOpen);
      if (same) popToggles(); else enter();
      lastToggles = readToggles();
    } finally {
      mo.takeRecords(); // our own moves mustn't trigger another pass
    }
  });
  mo.observe(bar, { childList: true });

  // Redraw (and so refit) when the stage changes width: window resize, panels opening.
  let lastW = 0;
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (!lastW) { lastW = w; return; }
    if (w === lastW) return;
    lastW = w;
    if (!bar.classList.contains("empty")) app.refreshToolbar?.();
  }).observe(bar.parentElement || bar);

  const overflowing = () => bar.scrollWidth > bar.clientWidth + 1;

  function fit(reopen) {
    bar.classList.remove("tb-folded");
    if (bar.classList.contains("empty") || !overflowing()) return;
    const groups = [...bar.children].filter((g) => g.classList.contains("tgroup"));
    const units = [];
    groups.forEach((g, gi) => [...g.children].forEach((u, ui) => {
      if (u.matches(INTERACTIVE) || u.querySelector(INTERACTIVE)) units.push({ u, g, gi, ui, prio: foldPrio(u) });
    }));
    if (units.length < 2) return;
    // Higher data-fold first; among equals, the ones at the end of the bar first.
    units.sort((a, b) => b.prio - a.prio || b.gi - a.gi || b.ui - a.ui);

    const tray = el("div.tb-more-tray", { role: "group", "aria-label": "More tools" });
    const btn = el("button.ibtn.tb-more-btn", {
      type: "button", title: "More tools", "aria-label": "More tools", "aria-haspopup": "true", "aria-expanded": "false",
    }, icon("Ellipsis"));
    const more = el("div.tgroup.tb-more", {}, btn, tray);
    // Like the groups they came from: clicking a tool mustn't end typing in a text box.
    more.addEventListener("mousedown", (e) => {
      if (e.target.closest?.("button") && app.editor.active?.()?.isEditing) e.preventDefault();
    });
    bar.append(more);
    bar.classList.add("tb-folded");

    const secs = new Map();
    const order = new WeakMap();
    for (const x of units) {
      if (!overflowing()) break;
      let sec = secs.get(x.gi);
      if (!sec) secs.set(x.gi, (sec = el("div.tb-more-sec")));
      order.set(x.u, x.ui);
      const next = [...sec.children].find((c) => order.get(c) > x.ui);
      sec.insertBefore(x.u, next || null);
      label(x.u);
      if (!x.g.querySelector(INTERACTIVE)) x.g.remove();
    }
    [...secs.keys()].sort((a, b) => a - b).forEach((k) => tray.append(secs.get(k)));
    btn.classList.toggle("has-on", Boolean(tray.querySelector(".on, [aria-pressed='true']")));
    wireTray(more, btn, tray, reopen);
  }

  // Icon-only buttons get their name written next to the icon inside the tray.
  function label(u) {
    if (!u.matches("button") || u.textContent.trim()) return;
    const name = shortLabel(u.getAttribute("aria-label") || u.title);
    if (name) u.append(el("span.tb-more-label", {}, name));
  }

  function wireTray(more, btn, tray, reopen) {
    let open = false;
    const away = (e) => {
      if (more.contains(e.target) || e.target.closest?.(POPUPS)) return;
      set(false);
    };
    const esc = (e) => {
      if (e.key !== "Escape" || document.querySelector(".popover")) return;
      e.stopPropagation();
      set(false);
      btn.focus();
    };
    const set = (on, { animate = true, focus = false } = {}) => {
      if (on === open) return;
      open = on;
      keepOpen = on;
      more.classList.toggle("open", on);
      btn.setAttribute("aria-expanded", String(on));
      if (on) {
        document.addEventListener("pointerdown", away, true);
        document.addEventListener("keydown", esc, true);
        if (animate && !reduced()) {
          tray.animate([{ opacity: 0, transform: "translateY(-6px) scale(.97)" }, { opacity: 1, transform: "none" }],
            { duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
          [...tray.querySelectorAll(".tb-more-sec > *")].forEach((c, i) => c.animate(
            [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }],
            { duration: 180, delay: Math.min(i, 12) * 22, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" }));
        }
        if (focus) tray.querySelector(INTERACTIVE)?.focus();
      } else {
        document.removeEventListener("pointerdown", away, true);
        document.removeEventListener("keydown", esc, true);
      }
    };
    btn.addEventListener("click", (e) => set(!open, { focus: e.detail === 0 }));
    closeTray = (silent) => {
      if (silent) {
        // The bar is being redrawn: drop the listeners but remember the state.
        const was = keepOpen;
        set(false);
        keepOpen = was;
      } else set(false);
    };
    if (reopen) set(true, { animate: false });
  }

  // ---- motion ----------------------------------------------------------------------------

  function enter() {
    if (reduced() || bar.classList.contains("empty")) return;
    [...bar.children].forEach((g, i) => g.animate(
      [{ opacity: 0, transform: "translateY(5px) scale(.98)" }, { opacity: 1, transform: "none" }],
      { duration: 240, delay: Math.min(i, 8) * 28, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" }));
  }

  const keyOf = (b) => b.getAttribute("aria-label") || b.title || "";
  function readToggles() {
    const m = new Map();
    for (const b of bar.querySelectorAll("button")) {
      const k = keyOf(b);
      if (k) m.set(k, b.classList.contains("on") || b.getAttribute("aria-pressed") === "true");
    }
    return m;
  }

  function popToggles() {
    if (reduced()) return;
    for (const b of bar.querySelectorAll("button")) {
      const k = keyOf(b);
      const was = lastToggles.get(k);
      const now = b.classList.contains("on") || b.getAttribute("aria-pressed") === "true";
      if (was === false && now) {
        b.animate([{ transform: "scale(.86)" }, { transform: "scale(1.08)" }, { transform: "none" }],
          { duration: 260, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
      }
    }
  }
}
