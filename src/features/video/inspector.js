// Clip and scene settings (a popover from the timeline): volume, fades, mute, speed (0.1-10x,
// backwards, pitch), freeze frame, fit (fill, fit, blurred fill, colour, free reframe),
// design-on-top, picture-in-picture and the transition in.
import { el, icon, popover, slider, toast, toggle } from "../../ui/kit.js";
import { colorInput } from "./captions-ui.js";
import * as api from "./api.js";
import { findClip, MAX_SPEED, MIN_SPEED, TRANSITIONS } from "./model.js";
import { pipObjects } from "./pip.js";
import { reframePad } from "./reframe-ui.js";
import { readTimeline, scenesOf } from "./store.js";

const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];
const FIT_CHOICES = [
  { value: "cover", label: "Fill (crop the edges)" },
  { value: "blur", label: "Blurred copy behind" },
  { value: "color", label: "Colour behind" },
  { value: "contain", label: "Black bars" },
  { value: "free", label: "Free: move and zoom" },
];

const guard = (fn) => (...a) => {
  try {
    const r = fn(...a);
    if (r?.catch) r.catch((e) => toast(e.message, { error: true }));
  } catch (e) { toast(e.message, { error: true }); }
};

function field(label, control) {
  return el("label.vd-field", {}, el("span", {}, label), control);
}

function choice(label, value, options, onChange) {
  const s = el("select.sel", { "aria-label": label, on: { change: () => onChange(s.value) } },
    options.map((o) => el("option", { value: o.value, selected: String(o.value) === String(value) }, o.label)));
  return field(label, s);
}

function transitionControls(app, id, tr) {
  return el("div.vd-insp-sec", {},
    el("h5", {}, "Transition in"),
    el("div.vd-chips.wrap", { role: "radiogroup", "aria-label": "Transition" }, TRANSITIONS.map((t) => el("button.vd-chip", {
      type: "button", role: "radio", "aria-checked": String(tr.type === t.id), class: tr.type === t.id ? "on" : null,
      on: { click: guard(() => { api.addTransition(app, { id, type: t.id, dur: tr.dur }); reopen(); }) },
    }, t.label))),
    tr.type !== "cut" ? slider({
      label: "Length", unit: "s", min: 0.1, max: 3, step: 0.1, value: tr.dur,
      onChange: guard((v) => api.addTransition(app, { id, type: tr.type, dur: v })),
    }) : null);
}

let reopen = () => {};

/** Open the settings of a clip (or a scene) under `anchor`. */
export function openInspector(app, anchor, sel) {
  reopen = () => openInspector(app, anchor, sel);
  const tl = readTimeline(app);
  if (sel?.kind === "scene") {
    const s = scenesOf(app, tl).find((x) => x.id === sel.id);
    if (!s) return;
    popover(anchor, el("div.vd-insp", {},
      el("h4.vd-insp-title", {}, icon("LayoutTemplate", 15), s.label),
      slider({ label: "Length", unit: "s", min: 0.5, max: 120, step: 0.1, value: s.duration,
        onChange: guard((v) => api.setSceneDuration(app, { id: s.id, duration: v })) }),
      s.index > 0 ? transitionControls(app, s.id, s.transition) : el("p.vd-note", {}, "The first scene starts the video, so it has no transition in.")),
    { cls: "vd-pop" });
    return;
  }
  const c = findClip(tl, sel?.id);
  if (!c) return;
  const isPip = pipObjects(app.editor.canvas.getObjects()).some((o) => o.data?.vdClip === c.id);
  const set = (patch, label, merge = false) => guard(() => api.updateClip(app, c.id, patch, { label, merge }))();
  const parts = [
    el("h4.vd-insp-title", {}, icon(c.kind === "video" ? "Film" : "Music", 15), el("span", {}, c.name)),
    slider({ label: "Volume", unit: "%", min: 0, max: 200, step: 1, value: Math.round(c.volume * 100),
      onInput: (v) => set({ volume: v / 100 }, "Volume", true), onChange: (v) => set({ volume: v / 100 }, "Volume", true) }),
    toggle({ label: "Mute", value: c.muted, onChange: (v) => set({ muted: v }, v ? "Mute" : "Unmute") }),
    el("div.vd-row2", {},
      slider({ label: "Fade in", unit: "s", min: 0, max: 5, step: 0.1, value: c.fadeIn, onChange: (v) => set({ fadeIn: v }, "Fade in") }),
      slider({ label: "Fade out", unit: "s", min: 0, max: 5, step: 0.1, value: c.fadeOut, onChange: (v) => set({ fadeOut: v }, "Fade out") })),
    speedControls(app, c),
  ];
  if (c.kind === "video") {
    parts.push(
      el("div.vd-insp-sec", {}, el("h5", {}, "Picture"),
        toggle({ label: "Picture in picture (move and resize it on the design)", value: isPip,
          onChange: guard(async (v) => { await api.setPictureInPicture(app, { id: c.id, on: v }); reopen(); }) }),
        isPip ? null : fitControls(app, c),
        isPip ? null : toggle({ label: "Show the design on top (titles over the video)", value: c.overlay, onChange: (v) => set({ overlay: v }, "Design on top") })),
      isPip ? null : transitionControls(app, c.id, c.transition));
  }
  popover(anchor, el("div.vd-insp", {}, parts), { cls: "vd-pop" });
}

/** Speed chips plus a custom value, backwards, keep the pitch, and freeze frame. */
function speedControls(app, c) {
  const setSpeed = (patch) => guard(() => { api.setSpeed(app, { id: c.id, ...patch }); reopen(); })();
  const custom = el("input.num", { type: "number", min: MIN_SPEED, max: MAX_SPEED, step: 0.05, value: c.speed, "aria-label": "Custom speed (0.1 to 10 times)" });
  custom.addEventListener("change", () => setSpeed({ speed: Math.max(MIN_SPEED, Math.min(MAX_SPEED, Number(custom.value) || 1)) }));
  const sec = el("div.vd-insp-sec", {}, el("h5", {}, "Speed"),
    el("div.vd-chips", { role: "radiogroup", "aria-label": "Speed" }, SPEEDS.map((s) => el("button.vd-chip", {
      type: "button", role: "radio", "aria-checked": String(c.speed === s), class: c.speed === s ? "on" : null,
      on: { click: () => setSpeed({ speed: s }) },
    }, s === 1 ? "1× normal" : `${s}×`))),
    el("label.vd-field", {}, el("span", {}, "Custom (0.1× to 10×)"), custom));
  if (c.freeze) {
    sec.append(el("p.vd-note", {}, "This is a freeze frame: a still picture. Drag its ends on the timeline to make it longer or shorter."));
    return sec;
  }
  sec.append(
    toggle({ label: "Play it backwards", value: c.reverse, onChange: (v) => setSpeed({ reverse: v }) }),
    toggle({ label: "Keep the voice's pitch when sped up or slowed down", value: c.keepPitch, onChange: (v) => setSpeed({ keepPitch: v }) }));
  if (c.kind === "video") {
    sec.append(el("div.vd-row-btns", {}, el("button.btn.small", {
      type: "button", title: "Hold the picture at the playhead for 2 seconds; the rest of the clip moves along",
      on: { click: guard(() => { api.freezeFrame(app, { id: c.id }); reopen(); }) },
    }, icon("Snowflake", 13), "Freeze frame at the playhead")));
  }
  return sec;
}

/** How a clip of another shape fills the page, with the colour or the reframe pad. */
function fitControls(app, c) {
  const preview = app.video?.preview;
  const box = el("div.vd-fit", {},
    choice("Fill the frame", c.fit, FIT_CHOICES, (v) => { guard(() => api.setFit(app, { id: c.id, fit: v }))(); reopen(); }));
  if (c.fit === "color") {
    box.append(el("label.vd-field", {}, el("span", {}, "Colour behind"),
      colorInput(c.fill, "Colour behind the video", (v, done) => guard(() => api.setFit(app, { id: c.id, fill: v }, { merge: !done }))())));
  }
  if (c.fit === "free" && preview) box.append(reframePad(app, c.id, preview));
  return box;
}
