// Shared toolbar pieces: buttons, per-object edits, border and shadow popovers.
import { Shadow } from "fabric";
import { colorButton, el, icon, popover, slider, toHex } from "../../ui/kit.js";

/** A toolbar button with an icon and an optional text label. */
export function tbtn(iconName, label, onClick, { text = false, on = false, cls = "" } = {}) {
  return el(`button.el-tbtn${text ? ".text" : ""}${cls ? "." + cls : ""}`, {
    type: "button", title: label, "aria-label": label, class: on ? "on" : null, on: { click: onClick },
  }, icon(iconName, 17), text ? el("span", {}, label) : null);
}

/** Commit at most every `ms` while dragging; always on release. Returns (done) => void. */
export function throttledCommit(app, label, ms = 300) {
  let last = 0, timer = null;
  return (done) => {
    clearTimeout(timer);
    if (done) { app.editor.commit(label); return; }
    const now = performance.now();
    if (now - last > ms) { last = now; app.editor.commit(label, { merge: true }); }
    else timer = setTimeout(() => { last = performance.now(); app.editor.commit(label, { merge: true }); }, ms);
  };
}

/** Move a kit slider to a value without firing its callbacks. */
export function setSlider(node, v) {
  const range = node?.querySelector("input.range"), num = node?.querySelector("input.num");
  if (!range) return;
  range.value = v;
  num.value = v;
  const min = Number(range.min), max = Number(range.max);
  range.style.setProperty("--p", `${((v - min) / (max - min || 1)) * 100}%`);
}

/** A small segmented control. options: [{value, label, icon?}] */
export function segmented(options, value, onChange, title = "") {
  const box = el("div.el-seg", { role: "radiogroup", "aria-label": title });
  const paint = () => box.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === String(value)));
  for (const o of options) {
    box.append(el("button", {
      type: "button", title: o.label, "aria-label": o.label, dataset: { v: String(o.value) },
      on: { click: () => { value = o.value; paint(); onChange(o.value); } },
    }, o.icon ? icon(o.icon, 16) : null, o.text ?? (o.icon ? null : o.label)));
  }
  paint();
  return box;
}

// ---- dash styles ------------------------------------------------------------------------

const DASHES = [["solid", "Solid"], ["dashed", "Dashed"], ["dotted", "Dotted"]];
export const dashOptions = () => DASHES.map(([value, label]) => ({ value, label, text: el(`span.el-dash.${value}`) }));

export function dashArray(style, w) {
  if (style === "dashed") return [w * 3, w * 2];
  if (style === "dotted") return [0.001, w * 2];
  return null;
}

// ---- shadows ----------------------------------------------------------------------------

export const SHADOW_PRESETS = {
  none: null,
  drop: { blur: 18, dist: 14, angle: 45, opacity: 45, color: "#000000" },
  soft: { blur: 40, dist: 22, angle: 90, opacity: 30, color: "#000000" },
  hard: { blur: 0, dist: 12, angle: 45, opacity: 85, color: "#000000" },
  glow: { blur: 34, dist: 0, angle: 0, opacity: 90, color: "#ffffff" },
};

function rgba(hex, opacity) {
  const h = toHex(hex) || "#000000";
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, opacity / 100))})`;
}

export function makeShadow(s) {
  if (!s) return null;
  const a = (s.angle * Math.PI) / 180;
  return new Shadow({
    color: rgba(s.color, s.opacity), blur: s.blur,
    offsetX: Math.round(Math.cos(a) * s.dist * 10) / 10, offsetY: Math.round(Math.sin(a) * s.dist * 10) / 10,
    affectStroke: true, nonScaling: true,
  });
}

/** Shadow settings of an object (from data, or read back from a plain Fabric shadow). */
export function shadowOf(o) {
  if (o.data?.shadow) return o.data.shadow;
  if (!o.shadow) return null;
  const sh = o.shadow;
  return { blur: sh.blur || 0, dist: Math.round(Math.hypot(sh.offsetX, sh.offsetY)), angle: Math.round((Math.atan2(sh.offsetY, sh.offsetX) * 180) / Math.PI), opacity: 50, color: toHex(sh.color) || "#000000" };
}

export function shadowPanel(app, objs) {
  let cur = shadowOf(objs[0]);
  const commit = throttledCommit(app, "Shadow", 250);
  const apply = (s, done) => {
    cur = s;
    for (const o of objs) {
      o.set({ shadow: makeShadow(s), data: { ...(o.data || {}), shadow: s } });
      o.set("dirty", true);
    }
    app.editor.canvas.requestRenderAll();
    commit(done);
    sliders.classList.toggle("off", !s);
  };
  const presetRow = el("div.el-presets", {}, Object.entries(SHADOW_PRESETS).map(([k, p]) => el("button.el-preset", {
    type: "button", title: k === "none" ? "No shadow" : `${k[0].toUpperCase()}${k.slice(1)} shadow`,
    on: { click: () => { apply(p ? { ...p } : null, true); rebuild(); } },
  }, el("span.el-preset-demo", { class: `sh-${k}` }), el("span", {}, k === "none" ? "None" : k[0].toUpperCase() + k.slice(1)))));
  const sliders = el("div.el-sliders");
  const rebuild = () => {
    const s = cur;
    sliders.classList.toggle("off", !s);
    if (!s) { sliders.replaceChildren(el("p.el-hint", {}, "Pick a style to add a shadow.")); return; }
    const num = (key, label, min, max, unit = "") => slider({
      label, min, max, value: s[key], unit,
      onInput: (v) => apply({ ...cur, [key]: v }, false), onChange: (v) => apply({ ...cur, [key]: v }, true),
    });
    sliders.replaceChildren(
      num("blur", "Blur", 0, 100), num("dist", "Distance", 0, 80), num("angle", "Direction", -180, 180, "°"),
      num("opacity", "Strength", 0, 100, "%"),
      el("div.el-field", {}, el("span", {}, "Colour"), colorButton({ value: s.color, title: "Shadow colour",
        onChange: (v, done) => typeof v === "string" && apply({ ...cur, color: toHex(v) || "#000000" }, done) })),
    );
  };
  rebuild();
  return el("div.el-pop", {}, el("h4.el-pop-title", {}, "Shadow"), presetRow, sliders);
}

export function shadowButton(app, objs) {
  const b = tbtn("SunDim", "Shadow", () => popover(b, shadowPanel(app, objs), { cls: "el-popover" }), { on: Boolean(objs[0]?.shadow) });
  return b;
}
