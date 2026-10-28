// The "Connect Claude" card shown in the AI panel. Owned by the connector builder.
// CONTRACT: renderConnectorCard(box, app) -> optional cleanup function.
// It only shows what to paste into Claude; it never touches the user's Claude config files.
import { el, icon, toast } from "../../ui/kit.js";
import { getBridge, autoStart, DEFAULT_PORT } from "./bridge.js";

const FOLDER_KEY = "oddlyclever-connector-folder";
const isWindows = /win/i.test(navigator.userAgentData?.platform || navigator.platform || "");
const SEP = isWindows ? "\\" : "/";
const PLACEHOLDER = isWindows ? "C:\\path\\to\\design-tool" : "/path/to/design-tool";

const STATUS = {
  off: { label: "Not connected", cls: "off" },
  connecting: { label: "Connecting…", cls: "wait" },
  waiting: { label: "Waiting for Claude", cls: "wait" },
  connected: { label: "Connected", cls: "on" },
  error: { label: "Couldn't connect", cls: "bad" },
};

function readFolder() { try { return localStorage.getItem(FOLDER_KEY) || ""; } catch { return ""; } }
function writeFolder(v) { try { localStorage.setItem(FOLDER_KEY, v); } catch { /* not remembered */ } }

/** Where node and connector/index.mjs are: what the connector told us, else from the folder box. */
function paths(bridge, folder) {
  const known = bridge.settings.connector;
  const port = bridge.settings.port || DEFAULT_PORT;
  const script = known?.script || `${(folder || PLACEHOLDER).replace(/[\\/]+$/, "")}${SEP}connector${SEP}index.mjs`;
  const node = known?.node || "node";
  const args = port === DEFAULT_PORT ? [script] : [script, "--port", String(port)];
  return { node, args, exact: !!known?.script };
}

function desktopSnippet(p) {
  return JSON.stringify({ mcpServers: { "oddlyclever-design": { command: p.node, args: p.args } } }, null, 2);
}

function codeSnippet(p) {
  const q = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
  return `claude mcp add --scope user oddlyclever-design -- ${[p.node, ...p.args].map(q).join(" ")}`;
}

async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied the ${what}.`);
  } catch {
    toast("Couldn't copy. Select the text and press Ctrl+C.", { error: true });
  }
}

function snippetBox(text, what) {
  return el("div.cn-snippet", {},
    el("pre.cn-code", { tabindex: "0", "aria-label": what }, text),
    el("button.btn.small.cn-copy", { type: "button", title: `Copy the ${what}`, "aria-label": `Copy the ${what}`, on: { click: () => copy(text, what) } }, icon("Copy", 14), "Copy"));
}

export function renderConnectorCard(box, app) {
  ensureStyles();
  const bridge = autoStart(app); // reconnects if the user connected before and never pressed Disconnect
  let target = "desktop";
  let moreOpen = false;
  let setupOpen = false;
  let folder = readFolder();

  const card = el("section.cn-card", { "aria-label": "Connect Claude" });
  box.append(card);

  const render = () => {
    const st = STATUS[bridge.state] || STATUS.off;
    const p = paths(bridge, folder);
    const connected = bridge.state === "connected";
    const trying = bridge.state === "connecting" || bridge.state === "waiting";

    const codeInput = el("input.cn-input", {
      type: "text", value: bridge.settings.code, placeholder: "OC-XXXX-XXXX", autocomplete: "off", spellcheck: false,
      "aria-label": "Pairing code", disabled: connected || trying,
    });
    const portInput = el("input.cn-input.cn-port", { type: "number", min: 1024, max: 65535, value: bridge.settings.port, "aria-label": "Connector port", disabled: connected || trying });
    const go = () => bridge.connect({ code: codeInput.value, port: Number(portInput.value) });
    codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });

    const folderInput = el("input.cn-input", {
      type: "text", value: folder, placeholder: PLACEHOLDER, spellcheck: false, "aria-label": "The design-tool folder on this computer",
      on: { change: (e) => { folder = e.target.value.trim(); writeFolder(folder); render(); } },
    });

    const tabs = el("div.cn-tabs", { role: "tablist" },
      ...[["desktop", "Claude Desktop"], ["code", "Claude Code"]].map(([id, label]) =>
        el("button.cn-tab", { type: "button", role: "tab", "aria-selected": String(target === id), class: target === id ? "on" : null, on: { click: () => { target = id; render(); } } }, label)));

    card.replaceChildren(...[
      el("header.cn-head", {},
        el("span.cn-logo", { "aria-hidden": "true" }, icon("Plug", 18)),
        el("div", {}, el("h3.cn-title", {}, "Connect Claude"), el("p.cn-sub", {}, "Let Claude Desktop or Claude Code build designs here, with your normal Claude plan. No API key.")),
        el("span.cn-status", { class: st.cls, role: "status" }, el("i", { "aria-hidden": "true" }), st.label)),
      bridge.message && bridge.state !== "off" && !connected ? el("p.cn-msg", { class: bridge.state === "error" ? "bad" : null }, bridge.message) : null,

      connected ? el("div.cn-done", {},
        el("p.cn-help", {}, "Try asking Claude: ", el("i", {}, "“Make 3 thumbnail ideas for my next Short with Sparks.”"), " You'll see it build them here, and you can undo anything."),
        el("button.btn", { type: "button", on: { click: () => bridge.disconnect() } }, icon("Unplug", 16), "Disconnect")) : null,

      el(connected ? "details.cn-more" : "div", connected ? { open: setupOpen, on: { toggle: (e) => { setupOpen = e.target.open; } } } : {},
      connected ? el("summary", {}, "Setup steps") : null,
      el("ol.cn-steps", {},
        el("li", {},
          el("b", {}, "Copy the setup into Claude"),
          tabs,
          target === "desktop"
            ? el("p.cn-help", {}, "In Claude Desktop open Settings › Developer › Edit Config, and add this to claude_desktop_config.json (merge it with any servers already there):")
            : el("p.cn-help", {}, "Run this once in a terminal:"),
          snippetBox(target === "desktop" ? desktopSnippet(p) : codeSnippet(p), target === "desktop" ? "Claude Desktop setup" : "Claude Code command"),
          p.exact ? null : el("label.cn-field", {}, el("span", {}, "Where is the design-tool folder on this computer?"), folderInput),
          p.exact ? null : el("p.cn-help.faint", {}, "Not sure? Open a terminal in that folder and run ", el("code", {}, "node connector/index.mjs --setup"), ". It prints these exact lines and your pairing code.")),
        el("li", {},
          el("b", {}, "Restart Claude"),
          el("p.cn-help", {}, "Quit Claude Desktop fully (also from the tray) and open it again. In Claude Code, start a new session.")),
        el("li", {},
          el("b", {}, "Paste your pairing code, then Connect"),
          el("p.cn-help", {}, "Ask Claude \"connect to OddlyClever Design\" and it tells you the code. You only do this once: this browser remembers it."),
          el("div.cn-row", {},
            codeInput,
            connected || trying
              ? el("button.btn", { type: "button", on: { click: () => bridge.disconnect() } }, icon("Unplug", 16), "Disconnect")
              : el("button.btn.primary", { type: "button", on: { click: go } }, icon("Plug", 16), "Connect"))))),

      el("details.cn-more", { open: moreOpen, on: { toggle: (e) => { moreOpen = e.target.open; } } },
        el("summary", {}, "More options"),
        el("label.cn-field.cn-inline", {}, el("span", {}, "Port"), portInput),
        el("p.cn-help.faint", {}, `Only change this if you started the connector with --port. The default is ${DEFAULT_PORT}.`)),

      el("p.cn-note", {}, icon("ShieldCheck", 14),
        el("span", {}, "The connector runs on this PC and only talks to this tab on 127.0.0.1, after the code matches. Claude sees what its tools send back (your design's details and snapshots). It also works with other MCP apps, such as Cursor or VS Code: use the same command.")),
    ].filter(Boolean)); // native replaceChildren would print "null"
  };

  render();
  const off = bridge.on(render);
  return () => { off(); card.remove(); };
}

let styled = false;
function ensureStyles() {
  if (styled) return;
  styled = true;
  document.head.append(el("style", { id: "cn-card-styles" }, `
.cn-card { display: grid; gap: 12px; padding: 14px; border-radius: var(--radius); background: var(--bg-2); border: 1px solid var(--line); }
.cn-head { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; align-items: start; }
.cn-logo { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--bg-4); color: var(--cyan); box-shadow: var(--glow-cyan); }
.cn-title { margin: 0; font: 800 15px var(--ui); color: var(--text); }
.cn-sub { margin: 2px 0 0; font-size: 12px; color: var(--muted); line-height: 1.4; }
.cn-status { grid-column: 1 / -1; justify-self: start; display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px;
  background: var(--bg-3); border: 1px solid var(--line); font-size: 12px; font-weight: 600; color: var(--muted); }
.cn-status i { width: 7px; height: 7px; border-radius: 50%; background: var(--faint); }
.cn-status.on { color: var(--ok); } .cn-status.on i { background: var(--ok); box-shadow: 0 0 8px var(--ok); }
.cn-status.wait { color: var(--gold); } .cn-status.wait i { background: var(--gold); animation: cn-blink 1s var(--ease) infinite; }
.cn-status.bad { color: var(--danger); } .cn-status.bad i { background: var(--danger); }
.cn-msg { margin: 0; font-size: 12px; color: var(--muted); } .cn-msg.bad { color: var(--danger); }
.cn-steps { margin: 0; padding-left: 20px; display: grid; gap: 14px; }
.cn-steps > li { display: grid; gap: 6px; font-size: 13px; color: var(--text); }
.cn-steps > li::marker { color: var(--accent-2); font-weight: 800; }
.cn-help { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.45; }
.cn-help.faint { color: var(--faint); }
.cn-help code { font-size: 11px; background: var(--bg-3); padding: 1px 4px; border-radius: 4px; color: var(--text); }
.cn-tabs { display: flex; gap: 4px; }
.cn-tab { flex: 1; height: 28px; border-radius: var(--radius-sm); border: 1px solid var(--line); background: transparent; color: var(--muted); font: 600 12px var(--ui); cursor: pointer;
  transition: background .15s var(--ease), color .15s var(--ease); }
.cn-tab:hover { background: var(--bg-3); color: var(--text); }
.cn-tab.on { background: var(--bg-4); color: var(--text); border-color: var(--line-2); }
.cn-snippet { position: relative; }
.cn-code { margin: 0; padding: 10px 10px 34px; max-height: 180px; overflow: auto; border-radius: var(--radius-sm); background: var(--bg); border: 1px solid var(--line);
  font: 11px/1.5 ui-monospace, Consolas, monospace; color: var(--cyan); white-space: pre-wrap; word-break: break-all; user-select: all; }
.cn-copy { position: absolute; right: 6px; bottom: 6px; }
.cn-field { display: grid; gap: 4px; font-size: 12px; color: var(--muted); }
.cn-field.cn-inline { grid-template-columns: auto 110px; align-items: center; justify-content: start; gap: 10px; }
.cn-input { width: 100%; min-width: 0; font-family: ui-monospace, Consolas, monospace; letter-spacing: .04em; }
.cn-row { display: flex; gap: 8px; }
.cn-row .cn-input { flex: 1; }
.cn-done { display: grid; gap: 8px; justify-items: start; }
.cn-more summary { cursor: pointer; font-size: 12px; color: var(--muted); }
.cn-more[open] { display: grid; gap: 8px; }
.cn-note { margin: 0; display: flex; gap: 8px; align-items: flex-start; font-size: 11px; color: var(--faint); line-height: 1.45; }
.cn-note .icon { flex: none; margin-top: 1px; color: var(--ok); }
@keyframes cn-blink { 50% { opacity: .3; } }
@media (prefers-reduced-motion: reduce) { .cn-status.wait i { animation: none; } }
`));
}
