// AI feature (v0.3): bring your own AI. The "Ask AI" panel (Claude first, any OpenAI-compatible
// API, or "paste into any chat" with no key), a top-bar button and Ctrl+K commands.
// app.ai exposes the controller for other features and the tests.
import "./ai.css";
import { el, icon } from "../../ui/kit.js";
import { registerCommands, registerPanel, registerTopAction } from "../../ui/shell.js";
import { createController } from "./controller.js";
import { forgetKey, loadRememberedKeys, setKey } from "./keys.js";
import { updateImageSettings, updateProviderSettings } from "./settings.js";
import { addFolderHandle, removeFolder, rescan } from "./pictures/folders.js";
import { renderAiPanel, STARTERS } from "./panel.js";
import { parsePlan, buildPastePrompt } from "./paste.js";
import { attachedRefs, attachedStyleName, findStyle, listStyles, deleteStyle } from "./refs/store.js";
import { aiTranslate } from "./translate.js";

export function install(app) {
  const ctrl = createController(app);
  loadRememberedKeys();
  // Reconnect to the Claude connector if the user paired before (loaded lazily so it can't break boot).
  import("./bridge.js").then((m) => m.autoStart(app)).catch((e) => console.error("[ai] connector bridge failed to load", e));

  registerPanel({ id: "ai", icon: "Sparkles", label: "Ask AI", order: 5, render: (box) => renderAiPanel(box, app, ctrl) });

  const openAi = () => { if (app.currentPanel?.() !== "ai") app.openPanel("ai"); };

  registerTopAction({
    id: "ai", order: 5,
    render: () => {
      const b = el("button.btn.small.ai-top", { type: "button", title: "Ask AI to build or fix your design", on: { click: openAi } },
        icon("Sparkles", 16), el("span", {}, "Ask AI"));
      ctrl.onChange((ev) => { if (ev.type === "running") b.classList.toggle("busy", ctrl.running); });
      return b;
    },
  });

  registerCommands((a) => {
    if (a.view !== "editor") return [];
    const list = [
      { id: "ai:open", label: "Ask AI to make something", group: "AI", icon: "Sparkles", keywords: "ai claude chatgpt assistant generate build design help",
        run: openAi },
      { id: "ai:paste", label: "Use any AI chat (no key)", group: "AI", icon: "ClipboardPaste", keywords: "ai paste chatgpt claude.ai prompt free",
        run: () => { openAi(); requestAnimationFrame(() => document.querySelector('.ai-tab[data-tab="paste"]')?.click()); } },
      ...STARTERS.filter((s) => !s.fill).map((s, i) => ({ id: `ai:starter${i}`, label: `AI: ${s.label}`, group: "AI", icon: s.icon, keywords: "ai",
        run: () => { openAi(); ctrl.send(s.text); } })),
    ];
    if (ctrl.canUndo()) list.push({ id: "ai:undo", label: "Undo AI (the whole last AI run)", group: "AI", icon: "Undo2", keywords: "ai revert", run: () => ctrl.undoAI() });
    if (ctrl.running) list.push({ id: "ai:stop", label: "Stop the AI", group: "AI", icon: "Square", keywords: "ai cancel", run: () => ctrl.stop() });
    return list;
  });

  app.ai = {
    /** Translate texts with the user's AI (the Translate feature). See translate.js. */
    translate: aiTranslate,
    /** @param {string} text @param {{ refs?: object[], styleName?: string }} [opts] */
    send: (text, opts) => ctrl.send(text, opts),
    stop: () => ctrl.stop(),
    undo: () => ctrl.undoAI(),
    canUndo: () => ctrl.canUndo(),
    newChat: () => ctrl.newChat(),
    runPlan: (steps, note) => ctrl.runPlan(steps, note),
    parsePlan: async (reply) => parsePlan(reply, await ctrl.toolkitReady()),
    buildPrompt: async (request, opts) => buildPastePrompt(app, await ctrl.toolkitReady(), request, opts),
    /** Swap the toolkit (tests); pass null for the real one. */
    setToolkit: (tk) => ctrl.setToolkit(tk),
    get running() { return ctrl.running; },
    get entries() { return ctrl.entries; },
    open: openAi,
    /** Run one design tool on the open design (the same toolkit the AI uses). */
    runTool: async (name, input) => (await ctrl.toolkitReady()).runTool(app, name, input),
    /** Settings, keys (memory only unless remembered) and folders, through the app's own module copies. */
    internals: {
      settings: { updateProviderSettings, updateImageSettings },
      keys: { setKey, forgetKey },
      folders: { addFolderHandle, removeFolder, rescan },
    },
    /** Style pictures (refs/store.js), through the app's own copy of the module. */
    refs: { attached: attachedRefs, styleName: attachedStyleName, listStyles, findStyle, deleteStyle },
  };
}
