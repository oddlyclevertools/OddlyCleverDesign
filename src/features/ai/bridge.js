// The browser end of the Claude connector. It connects this tab to the local connector
// (connector/index.mjs, started by Claude Desktop / Claude Code), pairs with a code, sends the
// toolkit's TOOLS and DESIGN_GUIDE, and runs each incoming call through runTool one at a time.
// Owned by the connector builder. Everything from the socket is treated as untrusted input.
import { el, icon, toast } from "../../ui/kit.js";

export const DEFAULT_PORT = 47615;
const EXPORT_OP = "__oc_export";         // the connector's save_picture asks for a rendered picture
const STORE_KEY = "oddlyclever-connector";
const MAX_IN = 2 * 1024 * 1024;           // calls are small; refuse anything bigger
const MAX_IMAGE = 20 * 1024 * 1024;       // base64 characters
const IDLE_RUN_MS = 8000;                 // a pause this long ends one "Claude run" (for Undo Claude)
const RETRY_MAX_MS = 15000;
const NO_RETRY = new Set([4000, 4002, 4003, 4029]); // replaced, bad message, wrong code, locked

// Shared across module copies: in dev, Vite's hot reload can load this file twice (?t=...), and
// there must still be one bridge per app and one test toolkit.
const SHARED = (globalThis[Symbol.for("oddlyclever.connector")] ??= { bridges: new WeakMap(), testToolkit: null, toolkit: null });
const tk = () => SHARED.testToolkit || SHARED.toolkit;

/** Load the design tools only when connecting, so a broken toolkit can't stop the app booting. */
async function loadToolkit() {
  if (SHARED.testToolkit || SHARED.toolkit) return;
  const m = await import("./toolkit/index.js");
  if (!Array.isArray(m.TOOLS) || typeof m.runTool !== "function") throw new Error("The design tools are incomplete.");
  SHARED.toolkit = { TOOLS: m.TOOLS, runTool: m.runTool, DESIGN_GUIDE: m.DESIGN_GUIDE || "" };
}
/** Tests only: swap the toolkit (e.g. a fake TOOLS list) before connecting. */
export function setToolkitForTesting(fake) { SHARED.testToolkit = fake || null; }

// ---- remembered settings (code, port, auto-connect, connector paths) ---------------------

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return {
      code: typeof s.code === "string" ? s.code.slice(0, 40) : "",
      port: Number.isInteger(s.port) ? s.port : DEFAULT_PORT,
      auto: !!s.auto,
      connector: s.connector && typeof s.connector === "object"
        ? { node: String(s.connector.node || "").slice(0, 400), script: String(s.connector.script || "").slice(0, 400) }
        : null,
    };
  } catch {
    return { code: "", port: DEFAULT_PORT, auto: false, connector: null };
  }
}

function saveSettings(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* private mode: just not remembered */ }
}

const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

// ---- the bridge -------------------------------------------------------------------------

class Bridge {
  constructor(app) {
    this.app = app;
    this.settings = loadSettings();
    this.state = "off";         // off | connecting | waiting | connected | error
    this.message = "Not connected.";
    this.ws = null;
    this.wanted = false;
    this.retryMs = 1000;
    this.retryTimer = null;
    this.queue = [];            // [{ id, name, input, ctrl }]
    this.current = null;
    this.listeners = new Set();
    this.runMark = null;        // history index before Claude's current run
    this.runSteps = 0;
    this.idleTimer = null;
    this.pill = null;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _set(state, message) { this.state = state; this.message = message; for (const fn of this.listeners) fn(this); }
  get busy() { return !!this.current || this.queue.length > 0; }

  updateSettings(patch) { this.settings = { ...this.settings, ...patch }; saveSettings(this.settings); }

  /** Connect with a pairing code. The code and port are remembered on this computer. */
  connect({ code = this.settings.code, port = this.settings.port } = {}) {
    code = String(code || "").trim();
    port = Number(port) || DEFAULT_PORT;
    if (!code) { this._set("error", "Paste the pairing code first."); return; }
    if (!Number.isInteger(port) || port < 1024 || port > 65535) { this._set("error", "The port must be a number from 1024 to 65535."); return; }
    this.updateSettings({ code, port, auto: true });
    this.wanted = true;
    this.retryMs = 1000;
    this._open();
  }

  /** Disconnect and stop reconnecting. */
  disconnect() {
    this.wanted = false;
    this.updateSettings({ auto: false });
    clearTimeout(this.retryTimer);
    this.stop("Disconnected in the app.");
    if (this.ws) { try { this.ws.send(JSON.stringify({ type: "bye" })); } catch { /* closing */ } this.ws.close(1000); }
    this.ws = null;
    this._set("off", "Not connected.");
  }

  async _open() {
    clearTimeout(this.retryTimer);
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null; }
    const { code, port } = this.settings;
    this._set("connecting", "Connecting…");
    try {
      await loadToolkit();
    } catch (e) {
      console.error("[connector] toolkit failed to load", e);
      this.wanted = false;
      this._set("error", "The design tools couldn't load, so Claude can't connect yet. Reload the page and try again.");
      return;
    }
    if (!this.wanted) return; // Disconnect pressed while loading
    let ws;
    try { ws = new WebSocket(`ws://127.0.0.1:${port}`); } catch { this._retry(); return; }
    this.ws = ws;
    let welcomed = false;
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "hello", code, app: "oddlyclever-design", version: "0.3",
        tools: tk().TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema })),
        guide: tk().DESIGN_GUIDE || "",
      }));
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string" || ev.data.length > MAX_IN) return;
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (!isPlainObject(msg)) return;
      if (msg.type === "welcome") {
        welcomed = true;
        this.retryMs = 1000;
        if (isPlainObject(msg.connector)) this.updateSettings({ connector: { node: String(msg.connector.node || "").slice(0, 400), script: String(msg.connector.script || "").slice(0, 400) } });
        this._set("connected", "Connected. Ask Claude to design something.");
      } else if (msg.type === "error") {
        this._set("error", typeof msg.message === "string" ? msg.message.slice(0, 200) : "The connector refused this tab.");
      } else if (msg.type === "replaced") {
        this.wanted = false;
      } else if (welcomed && msg.type === "call") {
        this._enqueue(msg);
      } else if (welcomed && msg.type === "cancel") {
        this._cancel(msg.id, "Cancelled by Claude.");
      }
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.stop("The connection closed.");
      if (ev.code === 4000) { this.wanted = false; this._set("off", "Another tab is connected to Claude now."); return; }
      if (ev.code === 4003) { this.wanted = false; this._set("error", "That pairing code doesn't match. Check it and try again."); return; }
      if (ev.code === 4029) { this.wanted = false; this._set("error", "Too many wrong codes. Wait a minute, then try again."); return; }
      if (NO_RETRY.has(ev.code) || !this.wanted) { if (this.state !== "error") this._set("off", "Not connected."); return; }
      this._retry(welcomed);
    };
  }

  _retry(wasConnected = false) {
    if (!this.wanted) return;
    this._set("waiting", wasConnected
      ? "Claude closed the connection. Reconnecting when it's back…"
      : "Can't reach the connector yet. Open (or restart) Claude after adding the connector. Retrying…");
    this.retryTimer = setTimeout(() => this._open(), this.retryMs);
    this.retryMs = Math.min(RETRY_MAX_MS, this.retryMs * 2);
  }

  // ---- calls, one at a time --------------------------------------------------------------

  _enqueue(msg) {
    const id = msg.id;
    if (!(typeof id === "number" || typeof id === "string") || String(id).length > 40) return;
    const reply = (obj) => this._reply({ type: "result", id, ...obj });
    const name = msg.name;
    const known = name === EXPORT_OP || tk().TOOLS.some((t) => t.name === name);
    if (typeof name !== "string" || !known) return reply({ error: `Unknown tool "${String(name).slice(0, 64)}".` });
    if (!isPlainObject(msg.input ?? {})) return reply({ error: "The tool input must be an object." });
    this.queue.push({ id, name, input: msg.input ?? {}, ctrl: new AbortController(), reply });
    this._pump();
  }

  async _pump() {
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift();
    this.current = job;
    this._startRun();
    this._showPill(job.name);
    try {
      const r = job.name === EXPORT_OP ? this._exportPicture(job.input) : await tk().runTool(this.app, job.name, job.input, { signal: job.ctrl.signal });
      if (job.ctrl.signal.aborted) throw new Error(job.ctrl.signal.reason || "Stopped.");
      job.reply(this._cleanResult(r));
      this.runSteps++;
    } catch (e) {
      job.reply({ error: String(e?.message || e || "The tool failed.").slice(0, 2000) });
    } finally {
      this.current = null;
      this._endRunSoon();
      this._pump();
    }
  }

  _cleanResult(r) {
    const out = { text: typeof r?.text === "string" ? r.text : "Done." };
    if (r?.image) {
      const { mediaType, data } = r.image;
      if (typeof data === "string" && data.length <= MAX_IMAGE && typeof mediaType === "string") out.image = { mediaType, data };
      else out.text += " (The picture was too big to send.)";
    }
    return out;
  }

  _exportPicture(input) {
    const ed = this.app.editor;
    if (this.app.view !== "editor" || !ed?.page) throw new Error("Open a design first.");
    const scale = input.scale === 2 ? 2 : 1;
    const jpg = input.format === "jpg";
    const url = ed.renderPage({ scale }).toDataURL(jpg ? "image/jpeg" : "image/png", 0.92);
    return { text: `${ed.width * scale}×${ed.height * scale}`, image: { mediaType: jpg ? "image/jpeg" : "image/png", data: url.slice(url.indexOf(",") + 1) } };
  }

  _reply(obj) {
    try { this.ws?.send(JSON.stringify(obj)); } catch { /* the tab or connector went away */ }
  }

  _cancel(id, why) {
    if (this.current?.id === id) { this.current.ctrl.abort(why); return; }
    const i = this.queue.findIndex((j) => j.id === id);
    if (i >= 0) { const [job] = this.queue.splice(i, 1); job.reply({ error: why }); }
  }

  /** Stop what Claude is doing now and drop its queued steps. */
  stop(why = "The user pressed Stop in OddlyClever Design. Don't continue until they ask you to.") {
    for (const job of this.queue.splice(0)) job.reply({ error: why });
    this.current?.ctrl.abort(why);
  }

  // ---- "Claude is designing…" pill and Undo Claude ------------------------------------------

  _startRun() {
    clearTimeout(this.idleTimer);
    if (this.runMark == null) { this.runMark = this.app.editor?.history?.index ?? null; this.runSteps = 0; }
  }

  _endRunSoon() {
    if (this.busy) return;
    this._showPill(null);
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => { this.runMark = null; this._hidePill(); }, IDLE_RUN_MS);
  }

  async undoRun() {
    const h = this.app.editor?.history;
    const mark = this.runMark;
    if (!h || mark == null || this.busy) return;
    let guard = 200;
    while (h.index > mark && h.canUndo && guard--) await h.undo();
    this.runMark = null;
    this._hidePill();
    toast("Undid Claude's changes.");
  }

  _showPill(toolName) {
    ensureStyles();
    if (!this.pill) {
      this.pill = el("div.cn-pill", { role: "status", "aria-live": "polite" });
      document.body.append(this.pill);
      requestAnimationFrame(() => this.pill?.classList.add("show"));
    }
    const working = !!toolName;
    const label = working ? `Claude is designing… ${String(toolName).replace(/_/g, " ")}` : "Claude is done.";
    this.pill.classList.toggle("idle", !working);
    this.pill.replaceChildren(
      el("span.cn-pill-dot", { "aria-hidden": "true" }),
      el("span.cn-pill-text", {}, label),
      working
        ? el("button.btn.small.cn-pill-btn", { type: "button", title: "Stop Claude's current step", "aria-label": "Stop Claude", on: { click: () => this.stop() } }, icon("Square", 14), "Stop")
        : el("button.btn.small.cn-pill-btn", { type: "button", title: "Undo everything Claude just changed", "aria-label": "Undo Claude's changes", disabled: this.runMark == null, on: { click: () => this.undoRun() } }, icon("Undo2", 14), "Undo Claude"),
    );
  }

  _hidePill() {
    const p = this.pill;
    this.pill = null;
    if (!p) return;
    p.classList.remove("show");
    setTimeout(() => p.remove(), 250);
  }
}

/** The one bridge for this app (created on first use). */
export function getBridge(app) {
  let b = SHARED.bridges.get(app);
  if (!b) { b = new Bridge(app); SHARED.bridges.set(app, b); }
  return b;
}

/** Reconnect on page load if the user connected before and never pressed Disconnect. */
export function autoStart(app) {
  const b = getBridge(app);
  if (b.settings.auto && b.settings.code && b.state === "off") b.connect();
  return b;
}

let styled = false;
function ensureStyles() {
  if (styled) return;
  styled = true;
  document.head.append(el("style", { id: "cn-bridge-styles" }, `
.cn-pill { position: fixed; left: 50%; top: calc(var(--top-h) + 64px); translate: -50% -8px; z-index: 80; display: flex; align-items: center; gap: 10px;
  padding: 6px 6px 6px 14px; border-radius: 999px; background: var(--glass); border: 1px solid var(--line-2); box-shadow: var(--shadow), var(--glow-cyan);
  backdrop-filter: blur(10px); color: var(--text); font: 600 13px var(--ui); opacity: 0; transition: opacity .2s var(--ease), translate .2s var(--ease); }
.cn-pill.show { opacity: 1; translate: -50% 0; }
.cn-pill.idle { box-shadow: var(--shadow); }
.cn-pill-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--cyan); box-shadow: 0 0 10px var(--cyan); animation: cn-pulse 1.1s var(--ease) infinite; }
.cn-pill.idle .cn-pill-dot { background: var(--ok); box-shadow: none; animation: none; }
.cn-pill-text { max-width: 46vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cn-pill-btn { border-radius: 999px; }
@keyframes cn-pulse { 50% { opacity: .35; transform: scale(.8); } }
@media (prefers-reduced-motion: reduce) { .cn-pill-dot { animation: none; } }
`));
}
