// The colour picker: solid colours (hex, the page eyedropper, brand, document, recent and default
// swatches) and, where a fill allows it, a gradient editor (linear or radial, any angle, 2 to 5
// colour stops). Recent colours are kept between visits. Re-exported by kit.js.
import { el, icon, popover, slider } from "./kit.js";
import { pickFromPage } from "./eyedropper.js";
import { popFrom } from "./popfrom.js";

export const PALETTE = [
  "#000000", "#545454", "#a6a6a6", "#ffffff", "#ff3131", "#ff5757", "#ff66c4", "#cb6ce6",
  "#8c52ff", "#5e17eb", "#0097b2", "#0cc0df", "#5ce1e6", "#38b6ff", "#5170ff", "#004aad",
  "#00bf63", "#7ed957", "#c1ff72", "#ffde59", "#ffbd59", "#ff914d", "#ff6b00", "#7a4b2a",
];
const lin = (angle, ...colors) => ({ type: "linear", angle, stops: colors.map((c, i) => ({ offset: i / (colors.length - 1), color: c })) });
const rad = (...colors) => ({ type: "radial", stops: colors.map((c, i) => ({ offset: i / (colors.length - 1), color: c })) });
const GRADIENTS = [
  lin(135, "#ff5f6d", "#ffc371"), lin(135, "#8e2de2", "#4a00e0"), lin(135, "#00c6ff", "#0072ff"), lin(90, "#f7971e", "#ffd200"),
  lin(135, "#11998e", "#38ef7d"), lin(135, "#fc466b", "#3f5efb"), lin(180, "#0f2027", "#2c5364"), lin(135, "#ee9ca7", "#ffdde1"),
  lin(90, "#ffd60a", "#ff7a00", "#ff2e7e"), lin(90, "#8fe3ff", "#c084fc", "#ff66c4"), lin(180, "#ffffff", "#ffe066", "#ff9f1c"),
  lin(180, "#f3ead8", "#c9b79c"), rad("#fff6b7", "#f6416c"), rad("#8fe3ff", "#1e3c72"), rad("#ffffff", "#ffc83d", "#ff2e7e"), rad("#2a2132", "#0d0a10"),
];
const MAX_STOPS = 5;
const RECENT_KEY = "oc.colors.recent";
const MAX_RECENT = 16;

// ---- sources the app plugs in -------------------------------------------------------------

/** Colours used in the design, so the picker can offer them ("document colours"). */
let documentColors = () => [];
export function setDocumentColorSource(fn) { documentColors = fn; }

/** The brand kit's colours (the styles feature keeps this up to date). */
let brandSource = () => [];
export function setBrandColorSource(fn) { brandSource = fn; }
/** The brand colours right now (never throws). */
export function brandColors() {
  try { return (brandSource() || []).filter((c) => typeof c === "string"); } catch { return []; }
}

// ---- recent colours (kept in this browser) --------------------------------------------------

function loadRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(list) ? list.filter((c) => typeof c === "string" && c.length < 40).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}
function pushRecent(c) {
  if (typeof c !== "string" || !c || c === "transparent") return;
  const list = [c, ...loadRecent().filter((x) => x !== c)].slice(0, MAX_RECENT);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* storage blocked: the list just isn't kept */ }
}

// ---- values ---------------------------------------------------------------------------------

export const isGradient = (v) => Boolean(v) && typeof v === "object" && (v.type === "linear" || v.type === "radial");

export function cssOf(v) {
  if (!v) return "transparent";
  if (typeof v === "string") return v;
  if (!isGradient(v)) return "transparent";
  const stops = [...v.stops].sort((a, b) => a.offset - b.offset).map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(", ");
  if (v.type === "radial") return `radial-gradient(circle at 50% 50%, ${stops})`;
  return `linear-gradient(${v.angle ?? 90}deg, ${stops})`;
}

/** "#rrggbb" for a CSS colour string where possible. */
export function toHex(c) {
  if (typeof c !== "string") return null;
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{8}$/i.test(c)) return c.slice(0, 7).toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${[...c.slice(1)].map((x) => x + x).join("")}`.toLowerCase();
  const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return `#${[m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, "0")).join("")}`;
  return null;
}

/** Mix two hex colours (t = 0..1); non-hex colours give the first one. */
function mix(a, b, t) {
  const pa = toHex(a), pb = toHex(b);
  if (!pa || !pb) return a;
  const n = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(n(pa, i) + (n(pb, i) - n(pa, i)) * t).toString(16).padStart(2, "0")).join("")}`;
}

const sorted = (stops) => [...stops].sort((a, b) => a.offset - b.offset);
/** The gradient value the picker hands out (stops sorted, no editor ids). */
function gradValue(g) {
  const stops = sorted(g.stops).map((s) => ({ offset: Math.round(s.offset * 1000) / 1000, color: s.color }));
  return g.type === "radial" ? { type: "radial", stops } : { type: "linear", angle: g.angle ?? 135, stops };
}
let stopIds = 0;
const withIds = (g) => ({ type: g.type, angle: g.angle ?? 135, stops: g.stops.map((s) => ({ ...s, id: ++stopIds })) });

// ---- the button and the panel ---------------------------------------------------------------

/**
 * A colour button that opens the picker.
 * value: "#rrggbb" | "rgba(...)" | {type:"linear", angle, stops:[{offset,color}]} | {type:"radial", stops}
 * onChange(value, done) – done=false while dragging.
 */
export function colorButton({ value, onChange, gradient = false, title = "Colour", cls = "" }) {
  const sw = el("span.swatch-fill");
  const btn = el(`button.color-btn${cls ? "." + cls : ""}`, { type: "button", title, "aria-label": title }, sw);
  const paint = (v) => { sw.style.background = cssOf(v); };
  paint(value);
  btn.addEventListener("click", () => {
    openColorPicker(btn, { value, gradient, onChange: (v, done) => { value = v; paint(v); onChange(v, done); } });
  });
  btn.setValue = (v) => { value = v; paint(v); };
  return btn;
}

/** Open the picker in a popover under `anchor`. Same options as colorButton. */
export function openColorPicker(anchor, { value, onChange, gradient = false, title = "" }) {
  let handle = null;
  // The panel changes height (Solid/Gradient). Re-place it under the button; if the toolbar was
  // redrawn meanwhile (the button is gone), just keep it on screen where it is.
  const relayout = () => {
    if (!handle) return;
    if (anchor.isConnected) { handle.place(); return; }
    const p = handle.pop.getBoundingClientRect();
    handle.pop.style.top = `${Math.max(8, Math.min(p.top, innerHeight - p.height - 8))}px`;
  };
  const panel = colorPanel({ value, onChange, gradient, title, relayout });
  // Give the focus back on close (e.g. to a text being typed in, so typing carries on).
  const before = document.activeElement;
  handle = popover(anchor, panel, {
    cls: "pop-color",
    onClose: () => {
      const a = document.activeElement;
      if (before?.isConnected && before !== document.body && (!a || a === document.body)) before.focus({ preventScroll: true });
    },
  });
  popFrom(handle, anchor);
  return handle;
}

function colorPanel({ value, onChange, gradient, title, relayout }) {
  let mode = gradient && isGradient(value) ? "gradient" : "solid";
  let solid = isGradient(value) ? value.stops[0]?.color || "#000000"
    : (typeof value === "string" && value && value !== "transparent" ? value : "#000000");
  let grad = withIds(isGradient(value) ? value : lin(135, toHex(solid) || "#8c52ff", "#ff66c4"));
  let activeId = grad.stops[0].id;
  const activeIndex = () => Math.max(0, grad.stops.findIndex((s) => s.id === activeId));
  const current = () => (mode === "gradient" ? grad.stops[activeIndex()].color : solid);

  const hex = el("input.hex", { spellcheck: false, maxlength: 9, "aria-label": "Colour code" });
  const native = el("input.native", { type: "color", "aria-label": "Choose any colour" });
  let root = null; // the panel, once built
  let unset = !isGradient(value) && !(typeof value === "string" && value && value !== "transparent"); // no colour yet: ring nothing
  /** Ring the swatch that matches the current colour (presets are gradients, so they're left out). */
  const markSwatches = () => {
    const h = unset && mode === "solid" ? null : toHex(current());
    root?.querySelectorAll(".swatches:not(.cp-presets) .sw").forEach((b) => {
      const on = !!h && toHex(b.title) === h;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
  };
  const syncInputs = () => {
    const c = current();
    hex.value = c;
    const h = toHex(c);
    if (h) native.value = h;
    markSwatches();
  };
  const emitGrad = (done) => onChange(gradValue(grad), done);

  /** A solid colour picked anywhere: the fill, or the selected gradient stop. */
  const pick = (c, done = true) => {
    unset = false;
    if (mode === "gradient") {
      grad = { ...grad, stops: grad.stops.map((s) => (s.id === activeId ? { ...s, color: c } : s)) };
      paintGrad();
      emitGrad(done);
    } else {
      solid = c;
      onChange(c, done);
    }
    syncInputs();
    if (done) pushRecent(c);
  };
  native.addEventListener("input", () => pick(native.value, false));
  native.addEventListener("change", () => pick(native.value, true));
  hex.addEventListener("change", () => {
    const v = hex.value.trim().startsWith("#") ? hex.value.trim() : `#${hex.value.trim()}`;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) pick(v.toLowerCase());
    else syncInputs();
  });

  const eye = el("button.btn.small.cp-eye", {
    type: "button", title: "Pick a colour from the design", "aria-label": "Pick a colour from the design",
    on: { click: async () => {
      const pop = eye.closest(".popover");
      pop?.classList.add("cp-picking");
      const c = await pickFromPage();
      pop?.classList.remove("cp-picking");
      if (c) pick(c);
      eye.focus({ preventScroll: true });
    } },
  }, icon("Pipette", 15), "Pick");

  const swatches = (list, label) => el("div.swatches", { role: "group", "aria-label": label }, list.map((c) => el("button.sw", {
    type: "button", title: c, "aria-label": c, style: { background: c }, on: { click: () => pick(c) },
  })));
  const swatchBlock = (label, list) => (list.length ? [el("h5", {}, label), swatches(list, label)] : []);

  // ---- gradient editor ----
  const gradBox = el("div.cp-grad");
  const paintGrad = () => {
    const bar = el("div.cp-gbar", { title: "Click the bar to add a colour", style: { background: cssOf({ ...gradValue(grad), type: "linear", angle: 90 }) } });
    const markers = grad.stops.map((s, j) => {
      const m = el("button.cp-stop", {
        type: "button", class: s.id === activeId ? "on" : null, style: { left: `${s.offset * 100}%`, background: s.color },
        title: `Colour ${j + 1} at ${Math.round(s.offset * 100)}% (drag, or use the arrow keys)`,
        "aria-label": `Colour ${j + 1} at ${Math.round(s.offset * 100)}%`, "aria-pressed": String(s.id === activeId),
      });
      m.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeId = s.id;
        syncInputs();
        m.setPointerCapture?.(e.pointerId);
        const r = bar.getBoundingClientRect();
        let moved = false;
        const move = (ev) => {
          moved = true;
          const off = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
          grad = { ...grad, stops: grad.stops.map((x) => (x.id === s.id ? { ...x, offset: off } : x)) };
          m.style.left = `${off * 100}%`;
          bar.style.background = cssOf({ ...gradValue(grad), type: "linear", angle: 90 });
          emitGrad(false);
        };
        const up = () => {
          m.removeEventListener("pointermove", move);
          m.removeEventListener("pointerup", up);
          m.removeEventListener("pointercancel", up);
          if (moved) emitGrad(true);
          paintGrad();
          gradBox.querySelector(".cp-stop.on")?.focus({ preventScroll: true });
        };
        m.addEventListener("pointermove", move);
        m.addEventListener("pointerup", up);
        m.addEventListener("pointercancel", up);
      });
      m.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          const d = (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 0.1 : 0.01);
          grad = { ...grad, stops: grad.stops.map((x) => (x.id === s.id ? { ...x, offset: Math.max(0, Math.min(1, x.offset + d)) } : x)) };
          activeId = s.id;
          paintGrad();
          emitGrad(true);
          gradBox.querySelector(".cp-stop.on")?.focus({ preventScroll: true });
        } else if ((e.key === "Delete" || e.key === "Backspace") && grad.stops.length > 2) {
          e.preventDefault();
          removeStop(s.id);
        }
      });
      m.addEventListener("click", () => { activeId = s.id; syncInputs(); paintGrad(); gradBox.querySelector(".cp-stop.on")?.focus({ preventScroll: true }); });
      return m;
    });
    bar.addEventListener("pointerdown", (e) => {
      if (e.target !== bar) return;
      const r = bar.getBoundingClientRect();
      addStop(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
    });
    const typeTabs = el("div.cp-seg", { role: "radiogroup", "aria-label": "Gradient type" }, [["linear", "Linear"], ["radial", "Radial"]].map(([t, label]) =>
      el("button.cp-seg-btn", {
        type: "button", role: "radio", "aria-checked": String(grad.type === t), class: grad.type === t ? "on" : null,
        on: { click: () => { if (grad.type !== t) { grad = { ...grad, type: t }; paintGrad(); emitGrad(true); relayout(); } } },
      }, label)));
    const angle = grad.type === "linear" ? slider({
      label: "Angle", min: 0, max: 360, step: 1, value: Math.round(grad.angle ?? 135), unit: "°",
      onInput: (v) => { grad = { ...grad, angle: v }; emitGrad(false); },
      onChange: (v) => { grad = { ...grad, angle: v }; emitGrad(true); },
    }) : null;
    gradBox.replaceChildren(
      el("div.cp-gwrap", {}, bar, el("div.cp-stops", {}, markers)),
      el("div.cp-grow", {}, typeTabs,
        el("button.ibtn.cp-mini", { type: "button", title: "Add a colour", "aria-label": "Add a colour", disabled: grad.stops.length >= MAX_STOPS,
          on: { click: () => addStop(null) } }, icon("Plus", 15)),
        el("button.ibtn.cp-mini", { type: "button", title: "Remove the selected colour", "aria-label": "Remove the selected colour",
          disabled: grad.stops.length <= 2, on: { click: () => removeStop(activeId) } }, icon("Minus", 15)),
        el("button.ibtn.cp-mini", { type: "button", title: "Flip the colours", "aria-label": "Flip the colours",
          on: { click: () => { grad = { ...grad, stops: grad.stops.map((s) => ({ ...s, offset: 1 - s.offset })) }; paintGrad(); emitGrad(true); } } }, icon("ArrowLeftRight", 15))),
      angle,
    );
  };
  const addStop = (at) => {
    if (grad.stops.length >= MAX_STOPS) return;
    const st = sorted(grad.stops);
    let off = at;
    if (off == null) { // halfway across the widest gap
      let best = 0, gap = -1;
      for (let k = 1; k < st.length; k++) {
        const g = st[k].offset - st[k - 1].offset;
        if (g > gap) { gap = g; best = k - 1; }
      }
      off = (st[best].offset + st[best + 1].offset) / 2;
    }
    const after = st.find((s) => s.offset >= off) || st.at(-1), before = [...st].reverse().find((s) => s.offset <= off) || st[0];
    const t = after.offset === before.offset ? 0 : (off - before.offset) / (after.offset - before.offset);
    const s = { offset: off, color: mix(before.color, after.color, t), id: ++stopIds };
    grad = { ...grad, stops: [...grad.stops, s] };
    activeId = s.id;
    syncInputs();
    paintGrad();
    emitGrad(true);
    relayout();
  };
  const removeStop = (id) => {
    if (grad.stops.length <= 2) return;
    grad = { ...grad, stops: grad.stops.filter((s) => s.id !== id) };
    if (!grad.stops.some((s) => s.id === activeId)) activeId = grad.stops[0].id;
    syncInputs();
    paintGrad();
    emitGrad(true);
  };

  const presets = el("div.swatches.cp-presets", { role: "group", "aria-label": "Ready-made gradients" }, GRADIENTS.map((g) => el("button.sw", {
    type: "button", title: `${g.type === "radial" ? "Radial" : "Linear"}: ${g.stops.map((s) => s.color).join(" → ")}`,
    "aria-label": `${g.type === "radial" ? "Radial" : "Linear"} gradient`, style: { background: cssOf(g) },
    on: { click: () => { grad = withIds(g); activeId = grad.stops[0].id; syncInputs(); paintGrad(); emitGrad(true); relayout(); } },
  })));
  const noColor = el("div.row.cp-none", {}, el("button.btn.small", { type: "button", on: { click: () => onChange("transparent", true) } },
    icon("Ban", 14), " No colour"));

  // ---- mode tabs (only where a gradient is allowed) ----
  const tabs = gradient ? el("div.cp-seg.cp-tabs", { role: "tablist", "aria-label": "Colour kind" }) : null;
  const gradPart = el("div.cp-gradpart", {}, gradBox, el("h5", {}, "Ready-made gradients"), presets);
  const paintMode = () => {
    gradPart.hidden = mode !== "gradient";
    noColor.hidden = mode === "gradient";
    tabs?.replaceChildren(...[["solid", "Solid"], ["gradient", "Gradient"]].map(([m, label]) => el("button.cp-seg-btn", {
      type: "button", role: "tab", "aria-selected": String(mode === m), class: mode === m ? "on" : null,
      on: { click: () => {
        if (mode === m) return;
        mode = m;
        if (m === "gradient") emitGrad(true); else onChange(solid = grad.stops[activeIndex()].color, true);
        syncInputs();
        paintMode();
        relayout();
      } },
    }, label)));
  };

  const docCols = [...new Set(documentColors())].slice(0, 16);
  const recent = loadRecent();
  const parts = [
    title ? el("h4.cp-title", {}, title) : null,
    tabs,
    el("div.color-top", {}, native, hex, eye),
    gradPart,
    ...swatchBlock("Brand colours", [...new Set(brandColors())].slice(0, 16)),
    ...swatchBlock("Document colours", docCols),
    ...swatchBlock("Recent", recent),
    ...swatchBlock("Default colours", PALETTE),
    noColor,
  ];
  syncInputs();
  paintGrad();
  paintMode();
  root = el("div.color-panel", {}, parts);
  markSwatches();
  return root;
}
