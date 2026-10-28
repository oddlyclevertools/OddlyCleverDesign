// Motion feature (v0.2): element and page animations, live preview, MP4 and GIF export.
//   catalog.js  the motions, loops, speeds and one-click page presets
//   timeline.js stateAt(obj, t): the one time function preview and export share
//   render.js   draws a state (transform + blur/glow/wipe/letter hooks) and restores it exactly
//   player.js   the in-editor preview (requestAnimationFrame)
//   presets.js  applying/removing animations (one undo step each)
//   panel.js    the Animate panel, toolbar button and Play button
//   export.js   MP4 (WebCodecs on the GPU + mp4-muxer) and GIF (gifenc)
import "./motion.css";
import { registerPanel, registerShortcut, registerTool, registerTopAction } from "../../ui/shell.js";
import { createPlayer } from "./player.js";
import { installRenderHook } from "./render.js";
import { renderPanel, animateTool, playButton } from "./panel.js";
import { registerExports, renderGif, renderMp4 } from "./export.js";
import { applyPhase, applyPreset, removeAnimations } from "./presets.js";
import { animOf, hasAnimation, pageDuration, stateAt, writePageDuration } from "./timeline.js";

export function install(app) {
  const ed = app.editor;
  installRenderHook();

  const onPlayState = [];
  const player = createPlayer(app, (playing, mode) => {
    for (const fn of onPlayState) fn(playing, mode);
  });

  // While a preview plays, saving, undo snapshots and thumbnails must see the design at rest.
  const toJSON = ed.toJSON.bind(ed);
  const renderPage = ed.renderPage.bind(ed);
  ed.toJSON = (...args) => player.atRest(() => toJSON(...args));
  ed.renderPage = (...args) => player.atRest(() => renderPage(...args));

  app.motion = {
    player, onPlayState, stateAt, animOf, pageDuration,
    play: () => player.play({ mode: "page" }),
    stop: () => player.stop(),
    applyPreset: (id) => applyPreset(ed, id),
    animate: (objs, phase, type) => applyPhase(ed, objs, phase, type),
    remove: (objs) => removeAnimations(ed, objs),
    setDuration: (s) => { writePageDuration(ed, s); ed.commit("Page length"); },
    renderMp4: (opts) => renderMp4(app, opts),
    renderGif: (opts) => renderGif(app, opts),
  };

  // Anything that replaces the design (undo, opening another design, going home) ends a preview.
  app.bus.on("doc", () => player.stop());
  app.bus.on("view", () => player.stop());

  registerPanel({ id: "animate", icon: "WandSparkles", label: "Animate", order: 55, render: renderPanel });
  registerTool({
    id: "motion", order: 60,
    match: (sel) => sel.length > 0 && !sel.some((o) => o.isPage),
    render: (a) => animateTool(a),
  });
  registerTopAction({ id: "motion-play", order: 85, render: playButton });
  registerShortcut({
    keys: "alt+p", label: "Play or stop animations", group: "Animate",
    when: () => hasAnimation(ed.objects()) || player.playing,
    run: () => (player.playing ? player.stop() : player.play({ mode: "page" })),
  });

  registerExports(app);
}
