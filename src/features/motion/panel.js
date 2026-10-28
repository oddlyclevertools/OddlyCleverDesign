// The Animate panel, the "Animate" toolbar button and the Play/Stop top button.
// Hovering a tile plays it live on the canvas; clicking applies it (one undo step).
import { el, icon, slider, toast } from "../../ui/kit.js";
import { stagger } from "../../ui/motion.js";
import { GROUPS, LOOPS, MOTIONS, PAGE_PRESETS, SPEEDS, TEXT_MOTIONS, motionLabel, speedK } from "./catalog.js";
import {
  applyPhase, applyPreset, presetPlan, previewLength, removeAnimations, setTiming, withPhase,
} from "./presets.js";
import {
  DEFAULT_DURATION, MAX_DURATION, MIN_DURATION, animOf, hasAnimation, isText, pageDuration, stateAt, writePageDuration,
} from "./timeline.js";

const TABS = [
  { id: "in", label: "Intro", icon: "LogIn", help: "How it arrives" },
  { id: "loop", label: "Loop", icon: "Repeat", help: "Keeps moving while on screen" },
  { id: "out", label: "Outro", icon: "LogOut", help: "How it leaves at the end" },
];
let tab = "in";

// ---- tiny tile previews (the same stateAt as the canvas, on a CSS glyph) ----------------

const GLYPH_GEO = { w: 30, h: 30, pw: 120, ph: 70, D: 70 };
const fakeObj = (anim) => ({ data: { anim }, fill: "#ff2e7e", getScaledWidth: () => 30, getScaledHeight: () => 30 });

function glyphLoop(glyph, anim, from, to, duration) {
  const obj = fakeObj(anim);
  let raf = 0;
  const t0 = performance.now();
  const step = (now) => {
    const t = from + (((now - t0) / 1000) % Math.max(0.2, to - from));
    const st = stateAt(obj, t, { duration, pw: 120, ph: 70, geo: GLYPH_GEO });
    const k = 0.5; // the glyph is a small stand-in: tame the travel a little
    glyph.style.transform = `translate(${st.dx * k}px, ${st.dy * k}px) rotate(${st.rot}deg) skewX(${st.skewX}deg) scale(${st.sx}, ${st.sy})`;
    glyph.style.opacity = Math.max(0, Math.min(1, st.op));
    const f = [];
    if (st.blur > 0.05) f.push(`blur(${(st.blur * 0.25).toFixed(1)}px)`);
    if (st.glow) f.push(`drop-shadow(0 0 ${(st.glow.b * 0.4).toFixed(1)}px ${st.glow.color})`);
    glyph.style.filter = f.join(" ");
    glyph.style.clipPath = st.clip?.type === "wipe"
      ? (st.clip.dir >= 0 ? `inset(-20% ${(1 - st.clip.p) * 140 - 20}% -20% -20%)` : `inset(-20% -20% -20% ${(1 - st.clip.p) * 140 - 20}%)`)
      : "";
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(raf);
    glyph.style.cssText = "";
  };
}

/** Preview window for one phase of an animation (intro, loop or outro). */
function windowFor(phase, spec, duration) {
  if (phase === "in") return { from: 0, to: (spec.delay || 0) + spec.dur + 0.5 };
  if (phase === "loop") return { from: 0, to: LOOPS[spec.type].period * speedK(spec.speed) * 2 };
  return { from: Math.max(0, duration - spec.dur - 0.5), to: duration + 0.35 };
}

// ---- panel --------------------------------------------------------------------------------

export function renderPanel(box, app) {
  const ed = app.editor;
  const player = app.motion.player;
  const body = el("div.mo-panel");
  box.append(body);
  let stopGlyph = null;

  const stopHover = () => {
    stopGlyph?.();
    stopGlyph = null;
    if (player.mode === "hover") player.stop();
  };

  const hoverable = (node, glyph, start) => {
    node.addEventListener("pointerenter", () => {
      stopHover();
      const g = start();
      if (g && glyph) stopGlyph = glyphLoop(glyph, g.anim, g.from, g.to, g.duration);
    });
    node.addEventListener("pointerleave", stopHover);
    node.addEventListener("focus", () => node.dispatchEvent(new Event("pointerenter")));
    node.addEventListener("blur", stopHover);
  };

  const playOnce = (objs) => {
    const anims = objs.map(animOf);
    player.play({ mode: "hover", objects: objs, from: 0, to: Math.min(pageDuration(ed), previewLength(anims)) });
  };

  let shownKey = "";
  function render() {
    stopHover();
    const sel = ed.selection().filter((o) => !o.isPage);
    body.replaceChildren(...(sel.length ? elementView(sel) : pageView()));
    // Tiles reveal one by one when the view changes (not on every edit).
    const key = sel.length ? `el:${tab}` : "page";
    if (key !== shownKey) body.querySelectorAll(".mo-grid, .mo-presets").forEach((g) => stagger(g, { max: 12 }));
    shownKey = key;
  }

  // -- one or more selected elements --
  function elementView(sel) {
    const allText = sel.every(isText);
    const anims = sel.map(animOf);
    const phaseOf = (p) => {
      const specs = anims.map((a) => a?.[p] || null);
      const first = specs[0];
      const same = specs.every((s) => (s?.type || null) === (first?.type || null));
      return { spec: same ? first : null, mixed: !same };
    };
    const cur = phaseOf(tab);
    const D = pageDuration(ed);

    const tabs = el("div.mo-tabs", { role: "tablist", "aria-label": "Animation part" }, TABS.map((t) => {
      const has = anims.some((a) => a?.[t.id]);
      return el("button.mo-tab", {
        type: "button", role: "tab", "aria-selected": t.id === tab, class: t.id === tab ? "on" : null, title: t.help,
        on: { click: () => { tab = t.id; render(); } },
      }, icon(t.icon, 15), el("span", {}, t.label), has ? el("i.mo-dot", { "aria-label": "set" }) : null);
    }));

    const groups = tab === "loop" ? GROUPS.loop : GROUPS.intro;
    const tile = (type) => {
      const label = motionLabel(type);
      const on = cur.spec?.type === type;
      const glyph = el("span.mo-glyph", { "aria-hidden": "true" }, TEXT_MOTIONS[type] ? "Aa" : null);
      const b = el("button.mo-tile", {
        type: "button", class: on ? "on" : null, title: `${label}: hover to preview, click to use`, "aria-pressed": on,
        on: { click: () => {
          stopHover();
          applyPhase(ed, sel, tab, type);
          render();
          playOnce(sel);
        } },
      }, el("span.mo-stage", {}, glyph), el("span.mo-tile-label", {}, label));
      hoverable(b, glyph, () => {
        const objsAnim = new Map(sel.map((o) => [o, withPhase(o, tab, type)]));
        const spec = objsAnim.get(sel[0])[tab];
        const preview = (o) => ({ [tab]: objsAnim.get(o)[tab] });
        const win = windowFor(tab, spec, D);
        player.play({ mode: "hover", objects: sel, anim: preview, from: win.from, to: win.to, loop: true });
        return { anim: { [tab]: spec }, ...win, duration: D };
      });
      return b;
    };
    const none = el("button.mo-tile.mo-none", {
      type: "button", class: !cur.spec && !cur.mixed ? "on" : null, title: "No animation here",
      on: { click: () => { applyPhase(ed, sel, tab, null); render(); } },
    }, el("span.mo-stage", {}, icon("Ban", 18)), el("span.mo-tile-label", {}, "None"));

    const grid = [];
    for (const g of groups) {
      if (g.text && !allText) continue;
      grid.push(el("h4.sec-title.mo-group", {}, g.title));
      grid.push(el("div.mo-grid", {}, g === groups[0] ? none : null, g.items.map(tile)));
    }
    if (!allText && tab !== "loop") {
      grid.push(el("p.mo-hint", {}, "Select text to see the Typewriter and other letter effects."));
    }

    const timing = cur.spec ? timingView(sel, cur.spec) : null;
    const summary = anims.some(Boolean)
      ? el("div.mo-summary", {}, icon("Sparkles", 14), describe(anims))
      : el("div.mo-summary.mo-empty", {}, icon("MousePointerClick", 14), "Hover a style to preview it. Click to use it.");

    const remove = el("button.btn.small.mo-remove", {
      type: "button", disabled: !anims.some(Boolean),
      on: { click: () => { stopHover(); if (removeAnimations(ed, sel)) toast("Animation removed."); render(); } },
    }, icon("Trash2", 15), "Remove animation");

    const playBtn = el("button.btn.small", {
      type: "button", disabled: !anims.some(Boolean), title: "Play these elements' animation",
      on: { click: () => playOnce(sel) },
    }, icon("Play", 15), "Preview");

    return [summary, tabs, el("p.mo-tabhelp", {}, TABS.find((t) => t.id === tab).help), ...grid,
      timing, el("div.mo-actions", {}, playBtn, remove), pageLink()];
  }

  function timingView(sel, spec) {
    const speedRow = el("div.mo-seg", { role: "group", "aria-label": "Speed" }, SPEEDS.map((s) => el("button", {
      type: "button", class: spec.speed === s.id ? "on" : null, "aria-pressed": spec.speed === s.id,
      on: { click: () => {
        const fields = tab === "loop" ? { speed: s.id } : { speed: s.id, dur: round1(baseOf(spec.type) * s.k) };
        setTiming(ed, sel, tab, fields);
        render();
        playOnce(sel);
      } },
    }, s.label)));
    const parts = [el("div.mo-row", {}, el("span.mo-label", {}, "Speed"), speedRow)];
    if (tab !== "loop") {
      parts.push(slider({
        label: "Duration", unit: "s", min: 0.2, max: 5, step: 0.1, value: spec.dur,
        onInput: (v) => setTiming(ed, sel, tab, { dur: v, speed: "custom" }, { merge: true }),
        onChange: (v) => { setTiming(ed, sel, tab, { dur: v, speed: "custom" }); render(); },
      }));
    }
    if (tab === "in") {
      parts.push(slider({
        label: "Start after", unit: "s", min: 0, max: Math.max(1, pageDuration(ed) - 0.5), step: 0.1, value: spec.delay || 0,
        onInput: (v) => setTiming(ed, sel, tab, { delay: v }, { merge: true }),
        onChange: (v) => { setTiming(ed, sel, tab, { delay: v }); render(); },
      }));
    }
    return el("section.sec.mo-timing", {}, el("h4.sec-title", {}, "Timing"), ...parts);
  }

  function pageLink() {
    return el("button.btn.small.ghost.mo-pagelink", {
      type: "button", title: "Animate every element at once",
      on: { click: () => { ed.canvas.discardActiveObject(); ed.canvas.requestRenderAll(); } },
    }, icon("LayoutTemplate", 15), "Animate the whole page instead");
  }

  // -- nothing selected: the page --
  function pageView() {
    const objs = ed.objects();
    const D = pageDuration(ed);
    const current = objs.map((o) => animOf(o)?.preset).find(Boolean);
    const cards = PAGE_PRESETS.map((p) => {
      const glyph = el("span.mo-glyph.mo-glyph-wide", { "aria-hidden": "true" }, el("b"), el("b"), el("b"));
      const card = el("button.mo-preset", {
        type: "button", class: current === p.id ? "on" : null, title: `${p.label}: ${p.help}. Hover to preview, click to use.`,
        on: { click: () => {
          stopHover();
          if (!objs.length) { toast("Add something to your design first."); return; }
          applyPreset(ed, p.id);
          toast(`${p.label} animation added to every element.`);
          render();
          player.play({ mode: "page" });
        } },
      }, el("span.mo-stage.mo-stage-wide", {}, glyph), el("b.mo-preset-name", {}, p.label), el("small", {}, p.help));
      hoverable(card, null, () => {
        const plan = presetPlan(ed, p.id);
        const anims = [...plan.values()];
        const to = Math.min(D, previewLength(anims));
        player.play({ mode: "hover", anim: (o) => plan.get(o) ?? null, from: 0, to, loop: true });
        return null;
      });
      return card;
    });

    const length = slider({
      label: "Page length", unit: "s", min: MIN_DURATION, max: MAX_DURATION, step: 0.5, value: D,
      onInput: () => {},
      onChange: (v) => { writePageDuration(ed, v); ed.commit("Page length"); },
    });

    const animated = hasAnimation(objs);
    return [
      el("p.mo-lead", {}, "Bring the whole design to life in one click. Hover to preview."),
      el("div.mo-presets", {}, cards),
      el("section.sec.mo-timing", {}, length,
        el("p.mo-hint", {}, `Videos and GIFs run for the page length (default ${DEFAULT_DURATION} s).`)),
      el("div.mo-actions", {},
        el("button.btn.small.primary", {
          type: "button", disabled: !animated, on: { click: () => player.play({ mode: "page" }) },
        }, icon("Play", 15), "Play"),
        el("button.btn.small.mo-remove", {
          type: "button", disabled: !animated,
          on: { click: () => { stopHover(); if (removeAnimations(ed, objs)) toast("All animations removed."); render(); } },
        }, icon("Trash2", 15), "Remove all")),
      el("p.mo-hint", {}, objs.length
        ? "Select one element to give it its own intro, loop or outro."
        : "Your page is empty. Add text or a picture, then come back here."),
    ];
  }

  render();
  const offs = [
    app.bus.on("selection", render),
    app.bus.on("doc", render),
    app.bus.on("change", (label) => { if (label === "History") render(); }),
  ];
  return () => {
    stopHover();
    offs.forEach((off) => off());
  };
}

const round1 = (v) => Math.round(v * 10) / 10;
const baseOf = (type) => MOTIONS[type]?.base ?? TEXT_MOTIONS[type]?.base ?? 0.7;

function describe(anims) {
  const set = anims.filter(Boolean);
  if (anims.length > 1 && set.length !== anims.length) return `${set.length} of ${anims.length} elements animated`;
  const a = set[0];
  const same = set.every((b) => JSON.stringify([b.in?.type, b.loop?.type, b.out?.type]) === JSON.stringify([a.in?.type, a.loop?.type, a.out?.type]));
  if (!same) return "Mixed animations";
  const bits = [];
  if (a.in) bits.push(`Intro: ${motionLabel(a.in.type)}`);
  if (a.loop) bits.push(`Loop: ${motionLabel(a.loop.type)}`);
  if (a.out) bits.push(`Outro: ${motionLabel(a.out.type)}`);
  return bits.join(" · ");
}

// ---- toolbar and top bar ------------------------------------------------------------------

export function animateTool(app) {
  const sel = app.editor.selection();
  const on = sel.some((o) => animOf(o));
  return el("div.tgroup", {}, el("button.btn.small.ghost.mo-tool", {
    type: "button", class: on ? "on" : null,
    title: on ? "This element is animated. Open Animate to change it." : "Animate this element",
    "aria-label": "Animate",
    on: { click: () => { if (app.currentPanel?.() !== "animate") app.openPanel("animate"); } },
  }, icon("WandSparkles", 16), el("span", {}, on ? "Animated" : "Animate")));
}

export function playButton(app) {
  const label = el("span", {}, "Play");
  const btn = el("button.btn.mo-play", {
    type: "button", title: "Play your animations", "aria-label": "Play animations",
    on: { click: () => {
      const p = app.motion.player;
      if (p.playing && p.mode === "page") { p.stop(); return; }
      if (!hasAnimation(app.editor.objects())) {
        toast("Nothing is animated yet. Open Animate and pick a style.");
        app.openPanel("animate");
        return;
      }
      p.play({ mode: "page" });
    } },
  }, icon("Play", 16), label);
  const show = (playing) => {
    btn.firstChild.replaceWith(icon(playing ? "Square" : "Play", 16));
    label.textContent = playing ? "Stop" : "Play";
    btn.title = playing ? "Stop the preview" : "Play your animations";
    btn.setAttribute("aria-label", playing ? "Stop animation preview" : "Play animations");
    btn.classList.toggle("on", playing);
  };
  app.motion.onPlayState.push((playing, mode) => show(playing && mode === "page"));
  return btn;
}
