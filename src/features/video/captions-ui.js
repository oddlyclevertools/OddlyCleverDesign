// The caption tools on the timeline: "Auto captions" (asks once for the speech model, then
// listens on the graphics card), the caption look (Shorts presets with live previews, font,
// colours, size, height) and the caption lane, where a caption is clicked to edit its words and
// times, dragged to move, dragged at its ends to retime, split or joined.
import { FONT_NAMES } from "../../core/fonts.js";
import { closePopover, confirmDialog, el, icon, modal, popover, slider, toast, toHex } from "../../ui/kit.js";
import * as api from "./api.js";
import { LANGUAGES, makeCaptions } from "./autocaption.js";
import { CAPTION_PRESETS, captionY, drawCaptions, prepareCaptionFont, resolveStyle } from "./captions.js";
import { CUE_LENGTHS } from "./cues.js";
import { readTimeline } from "./store.js";
import { WHISPER, loadWhisper, whisperLoaded, whisperReady } from "./whisper.js";

const PREFS = "vd-autocap";
const loadPrefs = () => { try { return { language: "en", length: "short", source: "auto", ...JSON.parse(localStorage.getItem(PREFS) || "{}") }; } catch { return { language: "en", length: "short", source: "auto" }; } };
const savePrefs = (p) => { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* private mode */ } };

const guard = (fn) => {
  try {
    const r = fn();
    if (r?.catch) r.catch((e) => toast(e.message, { error: true }));
    return r;
  } catch (e) { toast(e.message, { error: true }); return null; }
};

/**
 * A colour swatch that works inside a popover (the app's colour picker is a popover itself).
 * onChange(hex, done): done is false while the colour is being dragged.
 */
export function colorInput(value, title, onChange) {
  const inp = el("input.vd-color", { type: "color", value: toHex(value) || "#ffffff", title, "aria-label": title });
  inp.addEventListener("input", () => onChange(inp.value, false));
  inp.addEventListener("change", () => onChange(inp.value, true));
  return inp;
}

function field(label, control) {
  return el("label.vd-field", {}, el("span", {}, label), control);
}
function choice(label, value, options, onChange) {
  const s = el("select.sel", { "aria-label": label, on: { change: () => onChange(s.value) } },
    options.map((o) => el("option", { value: o.value, selected: String(o.value) === String(value) }, o.label)));
  return field(label, s);
}

// ---- the speech model ---------------------------------------------------------------------

/** Ask once, then download (or load) the speech model with a progress box. Resolves true when ready. */
export async function ensureWhisper({ ask = true } = {}) {
  if (whisperLoaded()) return true;
  const ready = await whisperReady();
  if (!ready) {
    if (!ask) return false;
    const mb = Math.round(WHISPER.bytes / 1e6);
    const ok = await confirmDialog("Get auto captions?",
      `They need a ${mb} MB speech model (${WHISPER.label}), downloaded once from huggingface.co and kept in this browser. After that captions are made offline on your graphics card, and your voice never leaves this PC.`,
      `Download ${mb} MB`);
    if (!ok) return false;
  }
  const bar = el("div.vd-dl-bar", {}, el("i"));
  const label = el("p.vd-note", {}, ready ? "Getting the speech model ready…" : "Starting the download…");
  const box = modal(ready ? "Loading auto captions" : "Downloading auto captions", () => el("div.vd-dl", {}, bar, label,
    el("p.vd-note", {}, "You can close this box: it keeps going, and your captions appear when it's done.")));
  try {
    await loadWhisper({ download: !ready, onProgress: (f, what) => {
      bar.firstChild.style.width = `${Math.round(f * 100)}%`;
      label.textContent = what === "Downloading"
        ? `${Math.round(f * WHISPER.bytes / 1e6)} of ${Math.round(WHISPER.bytes / 1e6)} MB`
        : `Loading the model on your graphics card… ${Math.round(f * 100)}%`;
    } });
    return true;
  } finally {
    box.close();
  }
}

/**
 * Auto captions from the speech on the timeline, with the consent and progress UI.
 * Returns the result of makeCaptions, or null when the user said no.
 */
export async function autoCaptions(app, opts = {}) {
  const tl = readTimeline(app);
  if (tl.captions?.cues.length && opts.confirmReplace !== false) {
    const ok = await confirmDialog("Replace your captions?", "New captions take the place of the ones on the timeline. Undo brings the old ones back.", "Replace");
    if (!ok) return null;
  }
  if (!(await ensureWhisper({ ask: opts.ask !== false }))) {
    if (opts.ask === false) throw new Error(`Auto captions need the ${Math.round(WHISPER.bytes / 1e6)} MB speech model first. Click Captions on the timeline to get it.`);
    return null;
  }
  const chip = el("div.vd-job", { role: "status", "aria-live": "polite" }, icon("Captions", 16), el("span.vd-job-text", {}, "Listening…"), el("div.vd-job-bar", {}, el("i")));
  document.body.append(chip);
  try {
    const res = await makeCaptions(app, { ...opts, onProgress: (f, label) => {
      chip.querySelector(".vd-job-text").textContent = label;
      chip.querySelector(".vd-job-bar i").style.width = `${Math.round(f * 100)}%`;
      opts.onProgress?.(f, label);
    } });
    if (!res.onGPU) toast("This browser has no WebGPU, so the processor made the captions (slower). Chrome or Edge use the graphics card.", { ms: 7000 });
    return res;
  } finally {
    chip.remove();
  }
}

/** The Auto captions popover (language, words per caption, what to listen to, look). */
export function openAutoCaptions(app, anchor, { onDone } = {}) {
  const prefs = loadPrefs();
  const tl = readTimeline(app);
  let preset = tl.captions?.style.preset || prefs.preset || "highlight";
  const go = el("button.btn.primary", { type: "button" }, icon("Sparkles", 15), "Make captions");
  const status = el("p.vd-note", {}, "Listens to your voice-over (or the video's sound) and writes every word, timed to the moment it's said.");
  go.addEventListener("click", async () => {
    go.disabled = true;
    closePopover();
    try {
      const res = await autoCaptions(app, { language: prefs.language, length: prefs.length, source: prefs.source, style: { preset } });
      if (res) {
        toast(`Captions made: ${res.cues.length} caption${res.cues.length === 1 ? "" : "s"} from ${res.words} words${res.onGPU ? " on your graphics card" : ""}.`, { ms: 4500 });
        onDone?.();
      }
    } catch (e) { toast(e.message, { error: true, ms: 6000 }); }
  });
  popover(anchor, el("div.vd-insp.vd-cap-pop", {},
    el("h4.vd-insp-title", {}, icon("Captions", 15), "Auto captions"), status,
    choice("Language", prefs.language, LANGUAGES, (v) => { prefs.language = v; savePrefs(prefs); }),
    choice("Words per caption", prefs.length, CUE_LENGTHS, (v) => { prefs.length = v; savePrefs(prefs); }),
    choice("Listen to", prefs.source, [
      { value: "auto", label: "The voice track (or the video's sound)" },
      { value: "voice", label: "The voice track" }, { value: "video", label: "The video's own sound" }, { value: "all", label: "Both" },
    ], (v) => { prefs.source = v; savePrefs(prefs); }),
    el("h5.vd-sub", {}, "Look"),
    presetGrid(preset, (id) => { preset = id; prefs.preset = id; savePrefs(prefs); }),
    el("div.vd-row-btns", {}, go)), { cls: "vd-pop" });
}

// ---- the look -------------------------------------------------------------------------------

const SAMPLE = { start: 0, end: 2, text: "Make it pop", words: [{ text: "Make", start: 0, end: 0.5 }, { text: "it", start: 0.5, end: 0.9 }, { text: "pop", start: 0.9, end: 2 }] };

/** A small live picture of a caption look (the third word being said). */
function presetCard(style, on, pick) {
  const c = el("canvas.vd-cap-thumb", { width: 168, height: 78 });
  const btn = el("button.vd-cap-card", { type: "button", role: "radio", "aria-checked": String(on), class: on ? "on" : null,
    title: resolveStyle(style).label, on: { click: pick } }, c, el("span", {}, resolveStyle(style).label));
  prepareCaptionFont({ style }).then(() => {
    const g = c.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 168, 78);
    grd.addColorStop(0, "#2a2140");
    grd.addColorStop(1, "#14324a");
    g.fillStyle = grd;
    g.fillRect(0, 0, 168, 78);
    drawCaptions(g, { cues: [SAMPLE], style: { ...style, y: 0.5, size: 2.6 } }, 1.2, 168, 78);
  });
  return btn;
}

function presetGrid(current, onPick) {
  const grid = el("div.vd-cap-grid", { role: "radiogroup", "aria-label": "Caption look" });
  const draw = (cur) => grid.replaceChildren(...CAPTION_PRESETS.map((p) => presetCard({ preset: p.id }, p.id === cur, () => { onPick(p.id); draw(p.id); })));
  draw(current);
  return grid;
}

/** The caption look popover: presets, font, colours, size and height, plus the caption tools. */
export function openCaptionStyle(app, anchor, preview) {
  const tl = readTimeline(app);
  if (!tl.captions) { openAutoCaptions(app, anchor); return; }
  const st = tl.captions.style;
  const full = resolveStyle(st);
  const reopen = () => openCaptionStyle(app, anchor, preview);
  const set = (patch, merge = false) => guard(() => api.setCaptionStyle(app, patch, { merge }));
  const yNow = Math.round(captionY(full, app.editor.width, app.editor.height) * 100);
  popover(anchor, el("div.vd-insp.vd-cap-pop", {},
    el("h4.vd-insp-title", {}, icon("Captions", 15), "Captions"),
    presetGrid(st.preset, (id) => { set({ preset: id }); reopen(); }),
    el("div.vd-row2", {},
      choice("Font", full.font, FONT_NAMES.map((f) => ({ value: f, label: f })), (v) => set({ font: v })),
      el("div.vd-colors", {},
        field("Text", colorInput(full.color, "Caption colour", (v, done) => set({ color: v }, !done))),
        field("Spoken word", colorInput(full.highlight, "Colour of the word being said", (v, done) => set({ highlight: v }, !done))))),
    slider({ label: "Size", unit: "%", min: 50, max: 200, step: 5, value: Math.round((st.size || 1) * 100),
      onInput: (v) => set({ size: v / 100 }, true), onChange: (v) => set({ size: v / 100 }, true) }),
    slider({ label: "Height on screen", unit: "% from the top", min: 6, max: 94, step: 1, value: yNow,
      onInput: (v) => set({ y: v / 100 }, true), onChange: (v) => set({ y: v / 100 }, true) }),
    el("p.vd-note", {}, "Tip: turn on Safe zones on the preview to keep captions clear of the Shorts buttons."),
    el("div.vd-row-btns", {},
      el("button.btn.small", { type: "button", on: { click: () => openAutoCaptions(app, anchor) } }, icon("Sparkles", 14), "Auto captions again"),
      el("button.btn.small", { type: "button", on: { click: () => { guard(() => api.addCaption(app, { at: preview.time })); closePopover(); } } }, icon("Plus", 14), "Add one at the playhead"),
      el("button.btn.small", { type: "button", on: { click: async () => {
        closePopover();
        if (await confirmDialog("Remove all captions?", "The caption track goes away. Undo brings it back.", "Remove")) guard(() => api.addCaptionTrack(app, null));
      } } }, icon("Trash2", 14), "Remove all"))), { cls: "vd-pop" });
}

// ---- the caption lane ---------------------------------------------------------------------

/**
 * One caption on the lane. Click: edit it. Drag: move it. Drag an end: change when it starts or
 * ends. `ctx` = { app, preview, pps, selected, select(index), snap(t) }.
 */
export function cueItem(q, index, ctx) {
  const { pps } = ctx;
  const node = el("div.vd-cue", {
    class: ctx.selected ? "sel" : null, tabindex: "0", role: "button",
    style: { left: `${q.start * pps}px`, width: `${Math.max(6, (q.end - q.start) * pps)}px` },
    title: `${q.text} · Click to edit, drag to move`, "aria-label": `Caption: ${q.text}`, dataset: { cue: String(index) },
  }, el("span", {}, q.text));
  const lh = el("i.vd-h.l", { title: "Drag to change when it starts" }), rh = el("i.vd-h.r", { title: "Drag to change when it ends" });
  node.append(lh, rh);
  const open = () => {
    // Show the caption on the preview while it's edited (Split then cuts in the middle, as the
    // playhead wasn't put there by the user).
    const inside = ctx.preview.time > q.start && ctx.preview.time < q.end;
    if (!inside) ctx.preview.seek(Math.min(q.end - 0.01, q.start + Math.min(0.3, (q.end - q.start) / 2)));
    openCueEditor(ctx.app, node, index, ctx.preview, { splitAtPlayhead: inside });
  };
  node.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); open(); } });
  node.addEventListener("pointerdown", (e) => {
    if (e.target.classList.contains("vd-h")) return;
    ctx.select(index);
    dragX(e, (dx) => { node.style.left = `${Math.max(0, q.start + dx / pps) * pps}px`; return dx; }, (dx) => {
      if (dx == null) { open(); return; }
      const start = ctx.snap(Math.max(0, q.start + dx / pps));
      guard(() => api.moveCaption(ctx.app, { index, by: start - q.start }));
    });
  });
  const edge = (side) => (e) => {
    e.stopPropagation();
    ctx.select(index);
    dragX(e, (dx) => {
      const t = side === "l" ? Math.min(q.end - 0.1, Math.max(0, q.start + dx / pps)) : Math.max(q.start + 0.1, q.end + dx / pps);
      if (side === "l") { node.style.left = `${t * pps}px`; node.style.width = `${(q.end - t) * pps}px`; }
      else node.style.width = `${(t - q.start) * pps}px`;
      return t;
    }, (t) => {
      if (t == null) return;
      const v = ctx.snap(t);
      guard(() => api.editCaption(ctx.app, side === "l" ? { index, start: v } : { index, end: v }));
    });
  };
  lh.addEventListener("pointerdown", edge("l"));
  rh.addEventListener("pointerdown", edge("r"));
  return node;
}

function dragX(e, move, end) {
  e.preventDefault();
  const x0 = e.clientX;
  let last = null, moved = false;
  const mv = (ev) => {
    const dx = ev.clientX - x0;
    if (!moved && Math.abs(dx) < 3) return;
    moved = true;
    last = move(dx);
  };
  const up = () => {
    window.removeEventListener("pointermove", mv);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    end(moved ? last : null);
  };
  window.addEventListener("pointermove", mv);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

/** The caption editor: its words, start and end, and split / join / remove. */
export function openCueEditor(app, anchor, index, preview, { splitAtPlayhead } = {}) {
  const q = readTimeline(app).captions?.cues[index];
  if (!q) return;
  const text = el("textarea.vd-cap-text", { rows: 2, "aria-label": "Caption words", maxlength: 400 }, q.text);
  const num = (label, v) => el("input.num", { type: "number", min: 0, step: 0.05, value: v.toFixed(2), "aria-label": label });
  const start = num("Starts at (seconds)", q.start), end = num("Ends at (seconds)", q.end);
  const save = () => {
    const patch = {};
    const t = text.value.replace(/\s+/g, " ").trim();
    if (t !== q.text) patch.text = t;
    if (Math.abs(Number(start.value) - q.start) > 0.001) patch.start = Number(start.value);
    if (Math.abs(Number(end.value) - q.end) > 0.001) patch.end = Number(end.value);
    if (Object.keys(patch).length) guard(() => api.editCaption(app, { index, ...patch }));
  };
  text.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); closePopover(); }
    if (e.key === "Escape") closePopover();
    e.stopPropagation(); // typing here never reaches the timeline's or the design's keys
  });
  text.addEventListener("change", save);
  start.addEventListener("change", save);
  end.addEventListener("change", save);
  const playhead = preview.time;
  const inside = (splitAtPlayhead ?? true) && playhead > q.start && playhead < q.end;
  const act = (ic, label, title, fn) => el("button.btn.small", { type: "button", title, on: { click: () => { closePopover(); guard(fn); } } }, icon(ic, 14), label);
  popover(anchor, el("div.vd-insp.vd-cue-pop", {},
    el("h4.vd-insp-title", {}, icon("Captions", 15), `Caption ${index + 1}`),
    text,
    el("div.vd-row2", {}, field("Starts at (s)", start), field("Ends at (s)", end)),
    el("div.vd-row-btns", {},
      act("Scissors", "Split", inside ? "Split this caption at the playhead" : "Split this caption in the middle", () => api.splitCaption(app, { index, at: inside ? playhead : undefined })),
      act("Combine", "Join next", "Join this caption with the next one", () => api.mergeCaptions(app, { index })),
      act("Play", "Play it", "Play from the start of this caption", () => { preview.seek(q.start).then(() => preview.play()); }),
      act("Trash2", "Remove", "Remove this caption (undo brings it back)", () => api.removeCaption(app, { index }))),
    el("p.vd-note", {}, "Enter saves. Keep the same number of words to keep each word's timing.")), { cls: "vd-pop" });
  requestAnimationFrame(() => text.focus());
}
