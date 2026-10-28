// The timeline dock under the canvas: a bar (play, time, split, delete, settings, add files,
// record, beats, captions, keys, export, zoom) and the tracks (design scenes, video, voice,
// music, sound effects, captions) with clips you can drag to move, drag at the ends to trim,
// and click to select. Captions are edited on their lane (captions-ui.js); the keys are keys.js.
import { el, icon, iconButton, popover, toast } from "../../ui/kit.js";
import { morphHeight } from "../../ui/motion.js";
import * as api from "./api.js";
import { cueItem, openAutoCaptions, openCaptionStyle, openCueEditor } from "./captions-ui.js";
import { openInspector } from "./inspector.js";
import { createKeys, openKeys } from "./keys.js";
import { ACCEPT, beatsOf, importMedia, infoOf, kindOf } from "./media.js";
import * as M from "./model.js";
import { pipObjects } from "./pip.js";
import { openRecorder } from "./record.js";
import { readTimeline, scenesOf } from "./store.js";

const OPEN_KEY = "vd-dock-open-v2"; // v2: folded away by default (it covered the page in small windows)
const HEAD_W = 112;
const LANE_H = 38;
const SNAP_PX = 8;
const TR_ICONS = { dip: "Moon", crossfade: "Blend", slide: "ArrowRightLeft", wipe: "PanelLeftOpen", zoom: "ZoomIn", whip: "Wind", spin: "RotateCw" };

export function fmtTime(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

const guard = async (fn) => {
  try { return await fn(); } catch (e) { toast(e.message, { error: true }); return null; }
};

/** Build the dock and put it under the canvas. Returns its API. */
export function createDock(app, preview, { onExport }) {
  let open = (() => { try { return localStorage.getItem(OPEN_KEY) === "1"; } catch { return false; } })();
  let zoom = 1;          // multiplier on the fitted scale
  let pps = 40;          // pixels per second (computed)
  let sel = null;        // { kind: "clip"|"scene", id }
  let showBeats = true;
  const beatCache = new Map(); // mediaId -> beats

  // ---- bar ----
  const playBtn = el("button.vd-play", { type: "button", title: "Play or pause (Space)", "aria-label": "Play" }, icon("Play", 18));
  const timeLabel = el("span.vd-time", {}, "0:00.0 / 0:00.0");
  const splitBtn = barBtn("Scissors", "Split", "Split the clip at the playhead (S)", () => splitSelected());
  const delBtn = barBtn("Trash2", "Delete", "Remove the clip from the timeline (Delete). Undo brings it back.", () => deleteSelected());
  const setBtn = barBtn("SlidersHorizontal", "Settings", "Volume, fades, speed, transition, picture in picture", () => sel && openInspector(app, setBtn, sel));
  const fileInput = el("input", { type: "file", accept: ACCEPT, multiple: true, hidden: true });
  const addBtn = barBtn("Plus", "Add media", "Add video or sound files (MP4, WebM, MOV, MP3, WAV, M4A)", () => fileInput.click());
  const recBtn = barBtn("Mic", "Record", "Record a voice-over with your microphone", () => openRecorder(app, { at: preview.time }));
  const beatBtn = barBtn("AudioWaveform", "Beats", "Find the beats in your music and snap scene changes to them", () => beatsMenu());
  const capBtn = barBtn("Captions", "Captions", "Auto captions from your voice, and their look", () => {
    if (readTimeline(app).captions?.cues.length) openCaptionStyle(app, capBtn, preview);
    else openAutoCaptions(app, capBtn, { onDone: () => render() });
  });
  const keysBtn = iconButton("Keyboard", "Timeline keys: J K L, Q W trim, frame steps…", () => openKeys(keysBtn), { cls: "vd-keys-btn" });
  const expBtn = el("button.btn.small.primary.vd-export", { type: "button", title: "Export the video as MP4 (H.264 + AAC)", on: { click: () => onExport(expBtn) } }, icon("Download", 15), el("span", {}, "Export video"));
  const zoomIn = iconButton("ZoomIn", "Zoom the timeline in", () => setZoom(zoom * 1.5));
  const zoomOut = iconButton("ZoomOut", "Zoom the timeline out", () => setZoom(zoom / 1.5));
  const foldBtn = iconButton("ChevronDown", "Hide the timeline", () => setOpen(!open), { cls: "vd-fold" });
  const bar = el("div.vd-bar", {},
    el("div.vd-bar-l", {}, playBtn, timeLabel),
    el("div.vd-bar-m", {}, splitBtn, delBtn, setBtn, el("span.vd-sep"), addBtn, recBtn, beatBtn, capBtn),
    el("div.vd-bar-r", {}, keysBtn, zoomOut, zoomIn, expBtn, foldBtn), fileInput);

  // ---- body ----
  const heads = el("div.vd-heads");
  const ruler = el("div.vd-ruler", { title: "Click or drag to move the playhead" });
  const lanes = el("div.vd-lanes");
  const playhead = el("div.vd-playhead", {}, el("i"));
  const inner = el("div.vd-inner", {}, ruler, lanes, playhead);
  const scroller = el("div.vd-scroll", {}, inner);
  const empty = el("div.vd-empty", {}, icon("Clapperboard", 16),
    el("span", {}, "Drop videos, music or sounds here, or "),
    el("button.btn.small", { type: "button", on: { click: () => fileInput.click() } }, "pick files"));
  const body = el("div.vd-body", {}, heads, scroller, empty);
  const dock = el("section.vd-dock", { tabindex: "-1", "aria-label": "Video timeline" }, bar, body);

  function barBtn(ic, label, title, fn) {
    return el("button.btn.small.vd-bbtn", { type: "button", title, "aria-label": label, on: { click: fn } }, icon(ic, 15), el("span", {}, label));
  }

  // ---- state helpers ----
  const tlNow = () => readTimeline(app);
  // No clips and folded: no dock at all, so the page keeps the room (the Video panel brings it back).
  // The first clip in a design opens the timeline (even when the AI added it); folding it stays folded.
  let hadClips = null;
  const syncBare = (tl = tlNow()) => {
    const has = tl.clips.length > 0;
    dock.classList.toggle("bare", !has);
    if (has && hadClips === false && !open) { hadClips = has; setOpen(true); return; }
    hadClips = has;
  };
  function setOpen(v, animate = true) {
    open = v;
    try { localStorage.setItem(OPEN_KEY, v ? "1" : "0"); } catch { /* private mode */ }
    const flip = () => { dock.classList.toggle("closed", !open); syncBare(); if (open) render(); };
    // Fold and unfold with a height glide (only when the dock is on screen).
    if (animate && dock.isConnected && !dock.classList.contains("bare")) morphHeight(dock, flip); else flip();
    foldBtn.replaceChildren(icon(open ? "ChevronDown" : "ChevronUp"));
    foldBtn.title = open ? "Hide the timeline" : "Show the timeline";
    foldBtn.setAttribute("aria-label", foldBtn.title);
  }
  function setZoom(z) {
    zoom = Math.max(0.25, Math.min(40, z));
    render();
  }
  function select(next) {
    sel = next;
    render();
  }

  // ---- render ----
  function render() {
    const tl = tlNow();
    const scenes = scenesOf(app, tl);
    const dur = M.totalDuration(tl, scenes);
    const viewW = Math.max(200, scroller.clientWidth || 800);
    pps = (viewW / Math.max(5, dur * 1.1)) * zoom;
    const width = Math.max(viewW, (dur + 4) * pps);
    inner.style.width = `${width}px`;
    if (sel?.kind === "clip" && !M.findClip(tl, sel.id)) sel = null;
    const hasClip = sel?.kind === "clip";
    splitBtn.disabled = !hasClip;
    delBtn.disabled = !hasClip;
    setBtn.disabled = !sel || sel.kind === "cue";
    empty.hidden = tl.clips.length > 0;
    syncBare(tl);

    drawRuler(width);
    const rows = M.TRACKS.map((t) => ({ ...t }));
    if (tl.captions?.cues.length) rows.push({ id: "captions", label: "Captions", kind: "captions", icon: "Captions" });
    heads.replaceChildren(el("div.vd-head.ruler-gap"), ...rows.map((r) => r.id === "captions"
      ? el("button.vd-head.vd-head-btn", { type: "button", title: "Caption look: presets, font, colours, size", on: { click: (e) => openCaptionStyle(app, e.currentTarget, preview) } }, icon(r.icon, 14), el("span", {}, r.label), icon("Palette", 12))
      : el("div.vd-head", { title: r.label }, icon(r.icon, 14), el("span", {}, r.label))));
    lanes.replaceChildren(...rows.map((r) => {
      const lane = el("div.vd-lane", { dataset: { track: r.id } });
      if (r.id === "scenes") scenes.forEach((s) => lane.append(sceneItem(s)));
      else if (r.id === "captions") tl.captions.cues.forEach((q, i) => lane.append(cueItem(q, i, cueCtx(i))));
      else M.clipsOn(tl, r.id).forEach((c) => lane.append(clipItem(c)));
      return lane;
    }));
    timeLabel.textContent = `${fmtTime(preview.time)} / ${fmtTime(dur)}`;
    placePlayhead();
  }

  function drawRuler(width) {
    const step = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find((s) => s * pps >= 60) || 600;
    const ticks = [];
    for (let s = 0; s * pps < width; s += step) {
      ticks.push(el("span.vd-tick", { style: { left: `${s * pps}px` } }, fmtTime(s).replace(/\.0$/, "")));
    }
    ruler.replaceChildren(...ticks);
  }

  function placePlayhead() {
    playhead.style.transform = `translateX(${preview.time * pps}px)`;
  }

  function sceneItem(s) {
    const node = el("div.vd-item.vd-scene", {
      class: sel?.kind === "scene" && sel.id === s.id ? "sel" : null,
      style: { left: `${s.start * pps}px`, width: `${Math.max(6, s.duration * pps)}px` },
      title: `${s.label}: ${s.duration.toFixed(1)} s. Drag the right edge to change its length.`,
      tabindex: "0", dataset: { scene: s.id },
    }, el("span.vd-name", {}, icon("LayoutTemplate", 12), s.label, el("small", {}, ` ${s.duration.toFixed(1)} s`)));
    if (s.index > 0) node.append(transitionDot(s.id, s.transition));
    const right = el("i.vd-h.r", { title: "Drag to change the scene length" });
    node.append(right);
    node.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".vd-tr")) return;
      select({ kind: "scene", id: s.id });
    });
    node.addEventListener("dblclick", () => openInspector(app, setBtn, { kind: "scene", id: s.id }));
    right.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      drag(e, {
        move: (dx) => {
          const d = Math.max(M.MIN_SCENE, s.duration + dx / pps);
          const nd = dom(`[data-scene="${s.id}"]`);
          if (nd) nd.style.width = `${d * pps}px`;
          return d;
        },
        end: (d) => { if (d != null && Math.abs(d - s.duration) > 0.01) guard(() => api.setSceneDuration(app, { id: s.id, duration: snapT(s.start + d, null) - s.start })); },
      });
    });
    return node;
  }

  function clipItem(c) {
    const len = M.clipLength(c);
    const pip = c.kind === "video" && pipObjects(app.editor.canvas.getObjects()).some((o) => o.data?.vdClip === c.id);
    const node = el("div.vd-item.vd-clip", {
      class: `${c.kind}${sel?.kind === "clip" && sel.id === c.id ? " sel" : ""}${c.muted ? " muted" : ""}${pip ? " pip" : ""}`,
      style: { left: `${c.start * pps}px`, width: `${Math.max(4, len * pps)}px` },
      title: `${c.name} · ${len.toFixed(1)} s${c.speed !== 1 && !c.freeze ? ` · ${c.speed}×` : ""}${c.reverse ? " · backwards" : ""}`,
      tabindex: "0", dataset: { clip: c.id },
    });
    const wave = el("canvas.vd-wave");
    node.append(wave, el("span.vd-name", {}, icon(c.freeze ? "Snowflake" : c.kind === "video" ? "Film" : c.muted ? "VolumeX" : "Music", 12), c.name,
      c.speed !== 1 && !c.freeze ? el("small", {}, ` ${c.speed}×`) : null,
      c.reverse ? el("em.vd-tag", { title: "Plays backwards" }, "Reverse") : null,
      c.freeze ? el("em.vd-tag", { title: "A still picture" }, "Freeze") : null,
      pip ? el("em.vd-tag", { title: "Shown as a picture on the design" }, "Picture") : null));
    if (c.fadeIn > 0) node.append(el("i.vd-fade.in", { style: { width: `${Math.min(len / 2, c.fadeIn) * pps}px` } }));
    if (c.fadeOut > 0) node.append(el("i.vd-fade.out", { style: { width: `${Math.min(len / 2, c.fadeOut) * pps}px` } }));
    if (c.kind === "video" && !pip) node.append(transitionDot(c.id, c.transition));
    const lh = el("i.vd-h.l", { title: "Drag to trim the start" }), rh = el("i.vd-h.r", { title: "Drag to trim the end" });
    node.append(lh, rh);
    paintClip(c, node, wave);
    node.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".vd-tr") || e.target.classList.contains("vd-h")) return;
      if (!(sel?.kind === "clip" && sel.id === c.id)) { sel = { kind: "clip", id: c.id }; markSel(); }
      node.focus({ preventScroll: true });
      moveDrag(e, c, node);
    });
    node.addEventListener("dblclick", () => openInspector(app, setBtn, { kind: "clip", id: c.id }));
    lh.addEventListener("pointerdown", (e) => { e.stopPropagation(); trimDrag(e, c, node, "l"); });
    rh.addEventListener("pointerdown", (e) => { e.stopPropagation(); trimDrag(e, c, node, "r"); });
    return node;
  }

  const cueCtx = (i) => ({
    app, preview, pps, selected: sel?.kind === "cue" && sel.index === i,
    select: (index) => { sel = { kind: "cue", index }; markSel(); },
    snap: (t) => snapT(t, null),
  });

  function markSel() {
    dock.querySelectorAll(".vd-item.sel, .vd-cue.sel").forEach((n) => n.classList.remove("sel"));
    if (sel) dom(sel.kind === "clip" ? `[data-clip="${sel.id}"]` : sel.kind === "cue" ? `[data-cue="${sel.index}"]` : `[data-scene="${sel.id}"]`)?.classList.add("sel");
    const hasClip = sel?.kind === "clip";
    splitBtn.disabled = !hasClip;
    delBtn.disabled = !hasClip;
    setBtn.disabled = !sel || sel.kind === "cue";
  }

  const dom = (q) => lanes.querySelector(q);

  async function paintClip(c, node, wave) {
    const info = await infoOf(c.mediaId).catch(() => null);
    if (!info) { node.classList.add("missing"); node.title = "This file isn't in this browser any more."; return; }
    if (c.kind === "video" && info.thumb) node.style.setProperty("--thumb", `url("${info.thumb}")`);
    const w = Math.min(4000, Math.max(4, Math.round(M.clipLength(c) * pps))), h = LANE_H - 6;
    if (info.peaks?.length && !c.freeze) {
      wave.width = w;
      wave.height = h;
      const g = wave.getContext("2d");
      g.fillStyle = c.kind === "video" ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.75)";
      const rate = info.peakRate || 100, n = info.peaks.length / 2;
      for (let x = 0; x < w; x++) {
        const xx = c.reverse ? w - 1 - x : x; // a backwards clip shows its sound mirrored
        const s0 = c.in + (xx / w) * (c.out - c.in), s1 = c.in + ((xx + 1) / w) * (c.out - c.in);
        let lo = 0, hi = 0;
        for (let b = Math.floor(s0 * rate); b <= Math.min(n - 1, Math.floor(s1 * rate)); b++) {
          lo = Math.min(lo, info.peaks[b * 2]);
          hi = Math.max(hi, info.peaks[b * 2 + 1]);
        }
        const k = c.muted ? 0.15 : Math.min(1, c.volume);
        const y0 = h / 2 - hi * (h / 2) * k, y1 = h / 2 - lo * (h / 2) * k;
        g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
      }
    }
    const beats = info.beats?.beats || beatCache.get(c.mediaId);
    if (showBeats && beats && c.track === "music") {
      for (const b of M.clipBeats(c, beats)) node.append(el("i.vd-beat", { style: { left: `${(b - c.start) * pps}px` } }));
    }
  }

  function transitionDot(id, tr) {
    const label = M.TRANSITIONS.find((t) => t.id === tr.type)?.label || "Cut";
    const dot = el("button.vd-tr", { type: "button", class: tr.type !== "cut" ? "on" : null, title: `Transition: ${label}. Click to change.`, "aria-label": `Transition: ${label}` },
      icon(TR_ICONS[tr.type] || "Slash", 11));
    dot.addEventListener("click", (e) => {
      e.stopPropagation();
      const tl = tlNow();
      const kind = M.findClip(tl, id) ? "clip" : "scene";
      select({ kind, id });
      openInspector(app, dot.isConnected ? dot : setBtn, { kind, id });
    });
    return dot;
  }

  // ---- dragging ----
  function drag(e, { move, end }) {
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY;
    let last = null, moved = false;
    const mv = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      moved = true;
      last = move(dx, dy, ev);
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

  /** Snap a time to the playhead, clip edges, scene edges and 0 when within a few pixels. */
  function snapT(t, exceptId) {
    const tl = tlNow();
    const pts = [0, preview.time, ...scenesOf(app, tl).map((s) => s.start + s.duration)];
    for (const c of tl.clips) if (c.id !== exceptId) pts.push(c.start, M.clipEnd(c));
    let best = t, bd = SNAP_PX / pps;
    for (const p of pts) if (Math.abs(p - t) < bd) { best = p; bd = Math.abs(p - t); }
    return best;
  }

  function laneAt(y, kind) {
    for (const lane of lanes.children) {
      const r = lane.getBoundingClientRect();
      if (y >= r.top && y < r.bottom) {
        const tr = lane.dataset.track;
        if (kind === "audio" ? M.AUDIO_TRACKS.includes(tr) : tr === "video") return tr;
      }
    }
    return null;
  }

  function moveDrag(e, c, node) {
    const len = M.clipLength(c);
    drag(e, {
      move: (dx, dy, ev) => {
        let s = Math.max(0, c.start + dx / pps);
        const sStart = snapT(s, c.id), sEnd = snapT(s + len, c.id);
        if (sStart !== s) s = sStart;
        else if (sEnd !== s + len) s = sEnd - len;
        node.style.left = `${s * pps}px`;
        const track = laneAt(ev.clientY, c.kind) || c.track;
        node.style.transform = track !== c.track ? `translateY(${(M.TRACKS.findIndex((t) => t.id === track) - M.TRACKS.findIndex((t) => t.id === c.track)) * LANE_H}px)` : "";
        return { s, track };
      },
      end: (r) => {
        if (!r) return;
        guard(() => api.moveClip(app, { id: c.id, start: r.s, track: r.track }));
      },
    });
  }

  function trimDrag(e, c, node, side) {
    sel = { kind: "clip", id: c.id };
    markSel();
    drag(e, {
      move: (dx) => {
        const len = M.clipLength(c);
        if (side === "l") {
          const minStart = c.start - c.in / c.speed;
          const s = Math.min(Math.max(minStart, 0, snapT(c.start + dx / pps, c.id)), c.start + len - M.MIN_CLIP);
          node.style.left = `${s * pps}px`;
          node.style.width = `${(c.start + len - s) * pps}px`;
          return { startAt: s };
        }
        const end = Math.max(c.start + M.MIN_CLIP, snapT(c.start + len + dx / pps, c.id));
        node.style.width = `${(end - c.start) * pps}px`;
        return { endAt: end };
      },
      end: (r) => { if (r) guard(() => api.trimClip(app, { id: c.id, ...r })); },
    });
  }

  // Scrubbing on the ruler (and on empty lane space).
  const timeAtX = (x) => Math.max(0, (x - inner.getBoundingClientRect().left) / pps);
  function scrub(e) {
    e.preventDefault();
    preview.seek(timeAtX(e.clientX));
    const mv = (ev) => preview.seek(timeAtX(ev.clientX));
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
  }
  ruler.addEventListener("pointerdown", scrub);
  playhead.addEventListener("pointerdown", scrub);
  lanes.addEventListener("pointerdown", (e) => {
    dock.focus({ preventScroll: true });
    if (e.target.closest(".vd-item, .vd-cue")) return;
    if (sel) { sel = null; markSel(); }
    scrub(e);
  });

  // ---- actions ----
  function splitSelected() {
    if (sel?.kind !== "clip") return;
    guard(() => {
      const res = api.splitClip(app, { id: sel.id, at: preview.time });
      sel = { kind: "clip", id: res.right.id };
      render();
    });
  }
  function deleteSelected() {
    if (sel?.kind !== "clip") return;
    const id = sel.id;
    sel = null;
    guard(() => api.deleteClip(app, { id }));
  }

  async function addFiles(files, { at, track } = {}) {
    let start = at;
    for (const file of files) {
      const kind = kindOf(file);
      if (!kind) { toast(`"${file.name}" isn't a video or sound file.`, { error: true }); continue; }
      const t = toastStep(`Adding ${file.name}…`);
      const res = await guard(async () => {
        const media = await importMedia(file);
        const tr = track && (media.kind === "video" ? track === "video" : M.AUDIO_TRACKS.includes(track)) ? track : undefined;
        return api.addClip(app, { mediaId: media.id, track: tr, start });
      });
      t();
      if (res && start != null) start = res.end;
      if (res) sel = { kind: "clip", id: res.id };
    }
    render();
  }
  fileInput.addEventListener("change", () => {
    const files = [...fileInput.files];
    fileInput.value = "";
    if (files.length) addFiles(files);
  });

  function toastStep(msg) {
    const n = el("div.vd-busy", { role: "status" }, icon("LoaderCircle", 14), msg);
    bar.append(n);
    return () => n.remove();
  }

  // Drop files on the timeline: on the lane under the pointer, at the time under the pointer.
  dock.addEventListener("dragover", (e) => {
    if (![...(e.dataTransfer?.types || [])].includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    dock.classList.add("drop");
  });
  dock.addEventListener("dragleave", (e) => { if (!dock.contains(e.relatedTarget)) dock.classList.remove("drop"); });
  dock.addEventListener("drop", (e) => {
    const files = [...(e.dataTransfer?.files || [])];
    dock.classList.remove("drop");
    if (!files.length) return;
    e.preventDefault();
    e.stopPropagation();
    const lane = e.target.closest?.(".vd-lane");
    addFiles(files, lane ? { at: timeAtX(e.clientX), track: lane.dataset.track } : {});
  });

  function beatsMenu() {
    const tl = tlNow();
    const music = M.clipsOn(tl, "music");
    const status = el("p.vd-note", {}, music.length ? "Finds the beat of your first music clip." : "Add a music clip first (Add media).");
    const findBtn = el("button.btn.small", { type: "button", disabled: !music.length }, icon("AudioWaveform", 14), "Find beats");
    const snapBtn = el("button.btn.small.primary", { type: "button", disabled: !music.length }, icon("Magnet", 14), "Snap scene changes to the beat");
    const show = el("label.toggle", {}, el("input", { type: "checkbox", checked: showBeats, on: { change: (e) => { showBeats = e.target.checked; render(); } } }), el("span.track"), el("span", {}, "Show beat markers"));
    findBtn.addEventListener("click", async () => {
      status.textContent = "Listening for the beat…";
      const r = await guard(() => api.findBeats(app, { id: music[0].id }));
      if (r) {
        beatCache.set(music[0].mediaId, (await beatsOf(music[0].mediaId)).beats);
        status.textContent = r.bpm ? `${Math.round(r.bpm)} beats per minute: ${r.beats.length} beats on the timeline.` : "No clear beat in this music.";
        render();
      } else status.textContent = "";
    });
    snapBtn.addEventListener("click", async () => {
      status.textContent = "Snapping…";
      const r = await guard(() => api.snapToBeats(app, { id: music[0].id }));
      status.textContent = r ? `Done: ${r.scenes} scene change${r.scenes === 1 ? "" : "s"} and ${r.clips} video clip${r.clips === 1 ? "" : "s"} now land on the beat.` : "";
      render();
    });
    popover(beatBtn, el("div.vd-insp", {}, el("h4.vd-insp-title", {}, icon("AudioWaveform", 15), "Beats"), status,
      el("div.vd-row-btns", {}, findBtn, snapBtn), show), { cls: "vd-pop" });
  }

  // Keys while the timeline has focus (they don't reach the design's own shortcuts): keys.js.
  const onKey = createKeys({
    app, preview,
    sel: () => sel,
    select: (next) => { sel = next; markSel(); },
    deleteSelected, splitSelected,
    ripple: (id) => { sel = null; guard(() => api.rippleDelete(app, { id })); },
    run: (fn) => guard(fn),
    openSettings: () => {
      if (sel?.kind === "cue") openCueEditor(app, dom(`[data-cue="${sel.index}"]`) || capBtn, sel.index, preview);
      else openInspector(app, setBtn, sel);
    },
  });
  dock.addEventListener("keydown", (e) => {
    if (e.target.closest("input, select, textarea")) return;
    if (onKey(e)) { e.preventDefault(); e.stopPropagation(); }
  });

  // ---- wiring ----
  playBtn.addEventListener("click", () => preview.toggle());
  preview.onState((playing) => {
    playBtn.replaceChildren(icon(playing ? "Pause" : "Play", 18));
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    dock.classList.toggle("playing", playing);
  });
  preview.onTime((t) => {
    placePlayhead();
    const tl = tlNow();
    timeLabel.textContent = `${fmtTime(t)} / ${fmtTime(M.totalDuration(tl, scenesOf(app, tl)))}`;
    if (preview.playing) {
      const x = t * pps, left = scroller.scrollLeft, w = scroller.clientWidth;
      if (x > left + w - 40 || x < left) scroller.scrollLeft = Math.max(0, x - 60);
    }
  });
  let pending = false;
  const schedule = () => {
    if (!open) { syncBare(); return; }
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
  };
  for (const ev of ["doc", "change", "video:changed", "video:beats"]) app.bus.on(ev, schedule);
  new ResizeObserver(schedule).observe(scroller);

  const stageEl = app.shell.canvasHost.parentElement;
  stageEl.append(dock);
  dock.style.setProperty("--head-w", `${HEAD_W}px`);
  dock.style.setProperty("--lane-h", `${LANE_H}px`);
  setOpen(open, false);

  return {
    el: dock, render, select, addFiles,
    get selection() { return sel; },
    setOpen, get open() { return open; },
  };
}
