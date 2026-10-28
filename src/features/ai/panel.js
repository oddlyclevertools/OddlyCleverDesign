// The "Ask AI" panel: a chat box with starter ideas, live progress with Stop, Undo AI, the
// provider chooser, the no-key paste mode and the Claude Desktop / Claude Code connector card.
import { el, icon, toast } from "../../ui/kit.js";
import { stagger } from "../../ui/motion.js";
import { BRAND } from "../../ui/brand.js";
import { renderPaste } from "./paste-ui.js";
import { chosenLabel, renderSettings } from "./settings-ui.js";
import { providerById, privacyLine } from "./presets.js";
import { providerSettings } from "./settings.js";
import { hasKey } from "./keys.js";
import { createRefTray } from "./refs/tray.js";
import { attachedRefs, attachedStyleName, setAttached } from "./refs/store.js";

/** One-click starters. `fill` ones end with "…" and wait for the user to finish the sentence. */
export const STARTERS = [
  { label: "YouTube thumbnail about…", text: "Make a YouTube thumbnail about ", fill: true, icon: "MonitorPlay" },
  { label: "In the style of my pictures…", text: "Make a YouTube thumbnail in the style of my reference pictures, about ", fill: true, refs: true, icon: "Images" },
  { label: "Give me 3 versions", text: "Give me 3 different versions of this design, side by side ideas I can choose from.", icon: "Copy" },
  { label: "Fix my design", text: "Check my design and fix what looks off: readability, spacing, contrast and alignment.", icon: "Wand2" },
  { label: "Make it more Oddly Clever", text: "Make it more Oddly Clever: neon night street mood, hot pink #ff2e7e and gold #ffc83d accents, heavy uppercase type with a script 'clever' accent.", icon: "Sparkles" },
  { label: "Write 5 title ideas", text: "Write 5 punchy title ideas for this design. Don't change the design, just list them.", icon: "Lightbulb" },
  { label: "Animate this", text: "Animate this design with a short, punchy intro animation.", icon: "Play" },
];

const TABS = [
  { id: "ask", label: "Ask AI", icon: "Sparkles" },
  { id: "paste", label: "No key? Paste", icon: "ClipboardPaste" },
  { id: "connect", label: "Connect", icon: "Plug" },
];

let lastTab = "ask";

function needsSetup() {
  const s = providerSettings();
  const p = providerById(s.id);
  return (!p.noKey && !hasKey(s.id)) || !s.model || !s.url;
}

function entryNode(e) {
  if (e.kind === "user") {
    const pics = e.refs?.length ? el("div.ai-msg-refs", { title: e.styleName ? `Style: ${e.styleName}` : "Style pictures" },
      e.refs.map((r) => el("img", { src: r.thumb, alt: r.name || "style picture" }))) : null;
    return el("div.ai-msg.user", {}, pics, e.text);
  }
  if (e.kind === "ai") return el("div.ai-msg.ai", { class: e.live ? "live" : null }, el("img.ai-face", { src: BRAND.sparksHead, alt: "" }), el("p", {}, e.text));
  if (e.kind === "step") {
    const ic = e.state === "ok" ? "Check" : e.state === "bad" ? "X" : "LoaderCircle";
    return el("div.ai-step", { class: e.state }, el("span.ai-step-ico", {}, icon(ic, 13)),
      el("span", {}, e.text, e.detail ? el("small", {}, e.detail) : null));
  }
  if (e.kind === "error") return el("div.ai-msg.err", { role: "alert" }, icon("TriangleAlert", 15), el("p", {}, e.text, e.hint ? el("small", {}, e.hint) : null));
  return el("div.ai-msg.note", {}, icon("Info", 14), el("p", {}, e.text));
}

export function renderAiPanel(box, app, ctrl) {
  const cleanups = [];
  const body = el("div.ai-body");
  const tabs = el("div.ai-tabs", { role: "tablist" }, TABS.map((t) =>
    el("button.ai-tab", { type: "button", role: "tab", dataset: { tab: t.id }, on: { click: () => show(t.id) } }, icon(t.icon, 14), t.label)));
  box.append(
    el("div.ai-hero", {}, el("img", { src: BRAND.sparksHead, alt: "" }),
      el("div", {}, el("b", {}, "Tell it. It builds."), el("span", {}, "Your AI designs right on your page. Undo any time."))),
    tabs, body);

  function show(id) {
    lastTab = id;
    for (const b of tabs.children) {
      const on = b.dataset.tab === id;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", String(on));
    }
    while (cleanups.length) cleanups.pop()?.();
    body.replaceChildren();
    if (id === "ask") renderAsk(body);
    else if (id === "paste") renderPasteTab(body);
    else renderConnect(body);
  }

  // ---- Ask tab ---------------------------------------------------------------------------
  function renderAsk(host) {
    const chipName = el("b");
    const chipWhere = el("span.ai-where");
    const settings = renderSettings({ onChange: () => { ctrl.resetConversation(); syncChip(); } });
    const settingsBox = el("div.ai-settings-box", { hidden: !needsSetup() }, settings);
    const chip = el("button.ai-chip", { type: "button", title: "Choose your AI", "aria-expanded": String(!settingsBox.hidden),
      on: { click: () => {
        settingsBox.hidden = !settingsBox.hidden;
        chip.setAttribute("aria-expanded", String(!settingsBox.hidden));
      } } }, icon("Bot", 16), chipName, chipWhere, el("span.grow"), el("span.ai-change", {}, "Change"), icon("ChevronDown", 14));
    function syncChip() {
      const s = providerSettings();
      chipName.textContent = chosenLabel();
      const local = privacyLine(s.url).local;
      chipWhere.textContent = local ? "On this PC" : "Cloud";
      chipWhere.className = `ai-where ${local ? "local" : "cloud"}`;
    }
    syncChip();

    const log = el("div.ai-log", { "aria-live": "polite" });
    const nodes = new Map();
    const starters = el("div.ai-starters", {}, STARTERS.map((st) => el("button.ai-starter", { type: "button", on: { click: () => starter(st) } }, icon(st.icon, 14), st.label)));
    const empty = el("div.ai-empty", {},
      el("h4", {}, "What should I make?"),
      el("p", {}, "Pick an idea or type your own. The AI adds and changes things on your page, step by step."),
      starters);
    // Three bouncing dots while the AI thinks and nothing is streaming yet.
    const typing = el("div.ai-typing", { "aria-hidden": "true" }, el("img.ai-face", { src: BRAND.sparksHead, alt: "" }),
      el("span.ai-typing-dots", {}, el("i"), el("i"), el("i")));

    const input = el("textarea.ai-input", { rows: 2, placeholder: "Ask for anything: “a bold thumbnail about crypto scams”", "aria-label": "Ask the AI",
      on: { keydown: (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); } } } });
    const sendBtn = el("button.btn.primary.ai-send", { type: "button", title: "Send (Enter)", "aria-label": "Send", on: { click: () => submit() } }, icon("SendHorizontal", 16));
    const stopBtn = el("button.btn.ai-stop", { type: "button", title: "Stop the AI", "aria-label": "Stop", on: { click: () => ctrl.stop() } }, icon("Square", 14), "Stop");
    const status = el("div.ai-status", { role: "status" }, el("span.ai-dot"), el("span.ai-status-text"));
    const undoBtn = el("button.btn.small.ai-undo", { type: "button", title: "Put the design back to how it was before the AI's last run",
      on: { click: () => ctrl.undoAI() } }, icon("Undo2", 14), "Undo AI");
    const newBtn = el("button.btn.small.ghost.ai-new", { type: "button", title: "Start a new chat (the design stays)",
      on: { click: () => ctrl.newChat() } }, icon("MessageSquarePlus", 14), "New chat");
    const starterRow = el("div.ai-starters.mini", {}, STARTERS.slice(1).map((st) => el("button.ai-starter", { type: "button", on: { click: () => starter(st) } }, st.label)));
    const tray = createRefTray({ onChange: () => {
      input.placeholder = attachedRefs().length ? "What should it make in this style? “a thumbnail about my $1 meal”" : "Ask for anything: “a bold thumbnail about crypto scams”";
    } });
    const composer = el("div.ai-composer", {}, input, el("div.ai-actions", {}, sendBtn, stopBtn));
    cleanups.push(tray.dispose, tray.wire(host, input));

    host.append(chip, settingsBox, log, status, tray.node, composer,
      el("div.ai-runbar", {}, undoBtn, el("span.grow"), newBtn),
      starterRow);

    function starter(st) {
      if (st.refs && !attachedRefs().length) tray.pick(); // "in my style" needs pictures first
      if (st.fill || ctrl.running) {
        input.value = st.text;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        return;
      }
      input.value = st.text;
      submit();
    }

    async function submit() {
      const text = input.value.trim();
      if (!text || ctrl.running) return;
      if (needsSetup()) {
        settingsBox.hidden = false;
        chip.setAttribute("aria-expanded", "true");
        const p = providerById(providerSettings().id);
        toast(p.noKey ? "Type the model name first." : "Paste your API key first, or use “No key? Paste”.", { error: true });
        return;
      }
      const refs = attachedRefs(), styleName = attachedStyleName();
      const before = ctrl.entries.length;
      input.value = "";
      setAttached([]); // pictures go with this message, like a chat attachment
      settingsBox.hidden = true;
      chip.setAttribute("aria-expanded", "false");
      await ctrl.send(text, { refs, styleName });
      if (ctrl.entries.length === before) { // cancelled before sending: give the words and pictures back
        input.value = text;
        setAttached(refs, styleName);
      }
    }

    function drawLog() {
      const entries = ctrl.entries;
      const keep = new Set(entries.map((e) => e.id));
      for (const [id, n] of nodes) if (!keep.has(id)) { n.node.remove(); nodes.delete(id); }
      for (const e of entries) {
        const have = nodes.get(e.id);
        if (have && have.entry === e) continue;
        const node = entryNode(e);
        if (have) { node.classList.add("ai-settled"); have.node.replaceWith(node); } else log.append(node); // updates don't re-play the entrance
        nodes.set(e.id, { entry: e, node });
      }
      const wasEmpty = empty.isConnected;
      empty.remove();
      if (!entries.length) {
        log.append(empty);
        if (!wasEmpty) stagger(starters);
      }
      placeTyping();
      starterRow.hidden = !entries.length || ctrl.running;
      log.scrollTop = log.scrollHeight;
    }
    function drawState() {
      const busy = ctrl.running;
      sendBtn.hidden = busy;
      stopBtn.hidden = !busy;
      input.disabled = false;
      status.classList.toggle("on", busy);
      status.querySelector(".ai-status-text").textContent = ctrl.status || (busy ? "Working…" : "");
      undoBtn.disabled = !ctrl.canUndo();
      newBtn.disabled = busy || !ctrl.entries.length;
      starterRow.hidden = !ctrl.entries.length || busy;
      placeTyping();
    }
    function placeTyping() {
      const last = ctrl.entries.at(-1);
      const show = ctrl.running && !(last?.kind === "ai" && last.live);
      if (!show) { typing.remove(); return; }
      if (log.lastElementChild !== typing) { log.append(typing); log.scrollTop = log.scrollHeight; }
    }
    drawLog();
    drawState();
    cleanups.push(ctrl.onChange((ev) => {
      if (ev.type === "entry" || ev.type === "all") drawLog();
      if (ev.type === "needs-settings") { settingsBox.hidden = false; chip.setAttribute("aria-expanded", "true"); }
      drawState();
    }));
    cleanups.push(app.bus.on("history", drawState));
    if (!needsSetup()) requestAnimationFrame(() => input.focus());
  }

  function renderPasteTab(host) {
    host.append(renderPaste(app, ctrl));
    const log = el("div.ai-log.compact", { "aria-live": "polite" });
    const draw = () => log.replaceChildren(...ctrl.entries.slice(-30).map(entryNode));
    draw();
    host.append(log);
    cleanups.push(ctrl.onChange(draw));
  }

  function renderConnect(host) {
    const card = el("div.ai-connect");
    host.append(el("p.ai-lede", {}, "Let Claude Desktop, Claude Code or any MCP app build in this window."), card);
    let gone = false;
    cleanups.push(() => { gone = true; });
    // Loaded lazily, so a problem in the connector never stops the panel (or the app) from opening.
    import("./connector-ui.js").then((m) => {
      if (gone) return;
      const done = m.renderConnectorCard(card, app);
      if (typeof done === "function") cleanups.push(done);
      if (!card.childNodes.length) card.append(el("p.ai-hint", {}, "Coming soon."));
    }).catch((e) => card.append(el("p.ai-hint", {}, `This part couldn't open: ${e.message}`)));
  }

  show(lastTab);
  return () => { while (cleanups.length) cleanups.pop()?.(); };
}
