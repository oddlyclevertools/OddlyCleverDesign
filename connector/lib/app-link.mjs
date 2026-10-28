// The link to the open OddlyClever Design tab: a WebSocket server on 127.0.0.1 only.
// Everything that arrives on the socket is untrusted: the Origin must be on the allowlist, the tab
// must send the pairing code first, messages are size-capped and shape-checked, and calls time out.
import { EventEmitter } from "node:events";
import { WebSocketServer } from "ws";
import { codesMatch } from "./state.mjs";

export const PROTOCOL = 1;
const MAX_MESSAGE = 24 * 1024 * 1024;     // a 4K PNG snapshot in base64 fits; anything bigger is refused
const HELLO_TIMEOUT_MS = 5000;
const PING_MS = 15000;
const MAX_TOOLS = 200;
const MAX_TEXT = 200 * 1024;              // text sent back to the AI per call
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

const log = (...a) => console.error("[oddlyclever]", ...a);

/** Keep only well-formed tools. Returns a fresh array; never trusts the input objects. */
export function sanitiseTools(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const t of list.slice(0, MAX_TOOLS)) {
    if (!t || typeof t !== "object" || !TOOL_NAME.test(t.name ?? "") || seen.has(t.name)) continue;
    const schema = t.input_schema ?? t.inputSchema;
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) continue;
    seen.add(t.name);
    out.push({
      name: t.name,
      description: typeof t.description === "string" ? t.description.slice(0, 4000) : "",
      inputSchema: { ...JSON.parse(JSON.stringify(schema)), type: "object" },
    });
  }
  return out;
}

/** Check one tool result from the app. Returns { text, image? } or throws. */
export function sanitiseResult(msg) {
  if (typeof msg.error === "string") throw new Error(msg.error.slice(0, 2000) || "The tool failed.");
  const text = typeof msg.text === "string" ? msg.text.slice(0, MAX_TEXT) : "";
  let image;
  if (msg.image && typeof msg.image === "object") {
    const { mediaType, data } = msg.image;
    if (!IMAGE_TYPES.has(mediaType) || typeof data !== "string" || !data.length || !BASE64.test(data)) {
      throw new Error("The app sent a picture the connector can't use.");
    }
    image = { mediaType, data };
  }
  return { text, image };
}

export class AppLink extends EventEmitter {
  /**
   * @param {{ port: number, host?: string, origins: Set<string>, getCode: () => string, callTimeoutMs?: number }} opts
   */
  constructor(opts) {
    super();
    this.port = opts.port;
    this.host = opts.host ?? "127.0.0.1";
    this.origins = opts.origins;
    this.getCode = opts.getCode;
    this.callTimeoutMs = opts.callTimeoutMs ?? 120000;
    this.session = null;          // { ws, tools, guide, info }
    this.pending = new Map();     // id -> { resolve, reject, timer, cleanup }
    this.nextId = 1;
    this.failures = 0;
    this.lockedUntil = 0;
    this.listenError = null;
    this.wss = null;
  }

  get connected() { return !!this.session; }
  get tools() { return this.session?.tools ?? []; }
  get guide() { return this.session?.guide ?? ""; }

  /**
   * Start listening. Resolves after the first attempt either way. A busy port (an old copy still
   * shutting down, or another Claude app running the connector) is retried every few seconds,
   * so this copy takes over as soon as the port is free.
   */
  start() {
    this._pinger = setInterval(() => this._ping(), PING_MS).unref();
    return new Promise((resolve) => this._listen(resolve));
  }

  _listen(firstDone) {
    if (this.closed) return;
    const wss = new WebSocketServer({
      host: this.host,
      port: this.port,
      maxPayload: MAX_MESSAGE,
      perMessageDeflate: false,
      clientTracking: true,
      verifyClient: (info, done) => this._verify(info, done),
    });
    wss.once("listening", () => {
      this.wss = wss;
      const was = this.listenError;
      this.listenError = null;
      log(`waiting for the app on ws://${this.host}:${this.port}`);
      if (was) this.emit("change");
      firstDone?.(true);
    });
    wss.on("error", (e) => {
      if (this.wss === wss) { log("server error:", e.message); return; }
      const first = !this.listenError;
      this.listenError = e.code === "EADDRINUSE"
        ? `Port ${this.port} is already in use (another copy of the connector is probably running, for example in Claude Desktop). Close it, or start this one with --port <number> and type the same port in the app. This copy keeps trying.`
        : `The connector couldn't listen on ${this.host}:${this.port}: ${e.message}`;
      if (first) log(this.listenError);
      try { wss.close(); } catch { /* never opened */ }
      this._relisten = setTimeout(() => this._listen(), first ? 1000 : 3000).unref();
      firstDone?.(false);
    });
    wss.on("connection", (ws, req) => this._onConnection(ws, req));
  }

  _verify(info, done) {
    const origin = info.origin || info.req.headers.origin || "";
    const host = String(info.req.headers.host || "").toLowerCase();
    const hostOk = host === `127.0.0.1:${this.port}` || host === `localhost:${this.port}` || host === `[::1]:${this.port}`;
    if (!hostOk) { log(`refused a connection for host "${host.slice(0, 80)}"`); return done(false, 403, "Forbidden host"); }
    if (!this.origins.has(origin)) {
      log(`refused a connection from origin "${String(origin).slice(0, 120)}" (not on the allowlist; see --allow-origin)`);
      return done(false, 403, "Origin not allowed");
    }
    done(true);
  }

  _onConnection(ws, req) {
    const origin = req.headers.origin;
    let authed = false;
    const helloTimer = setTimeout(() => ws.close(4008, "Pairing took too long"), HELLO_TIMEOUT_MS);
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("message", (data, isBinary) => {
      if (isBinary) return ws.close(4002, "Text messages only");
      let msg;
      try { msg = JSON.parse(data.toString("utf8")); } catch { return ws.close(4002, "Bad message"); }
      if (!msg || typeof msg !== "object") return ws.close(4002, "Bad message");
      if (!authed) {
        clearTimeout(helloTimer);
        authed = this._hello(ws, msg, origin);
        return;
      }
      if (this.session?.ws !== ws) return; // a replaced tab: ignore it
      this._onMessage(msg);
    });
    ws.on("close", () => {
      clearTimeout(helloTimer);
      if (this.session?.ws === ws) this._drop("The app tab disconnected.");
    });
    ws.on("error", (e) => log("socket error:", e.message));
  }

  _hello(ws, msg, origin) {
    if (msg.type !== "hello") { ws.close(4002, "Say hello first"); return false; }
    if (Date.now() < this.lockedUntil) {
      this._send(ws, { type: "error", reason: "locked", message: "Too many wrong pairing codes. Wait a minute and try again." });
      ws.close(4029, "Locked");
      return false;
    }
    if (!codesMatch(this.getCode(), msg.code)) {
      this.failures++;
      if (this.failures >= 5) { this.lockedUntil = Date.now() + 60000; this.failures = 0; }
      log("refused a tab: wrong pairing code");
      this._send(ws, { type: "error", reason: "code", message: "That pairing code doesn't match this connector." });
      ws.close(4003, "Wrong pairing code");
      return false;
    }
    this.failures = 0;
    if (this.session) {
      log("a new tab connected; the old one is disconnected");
      this._send(this.session.ws, { type: "replaced", message: "Another OddlyClever Design tab connected to Claude." });
      const old = this.session.ws;
      this._drop("Another tab took over.");
      old.close(4000, "Replaced by another tab");
    }
    const info = {
      app: typeof msg.app === "string" ? msg.app.slice(0, 60) : "app",
      version: typeof msg.version === "string" ? msg.version.slice(0, 20) : "",
      origin,
    };
    this.session = { ws, tools: sanitiseTools(msg.tools), guide: typeof msg.guide === "string" ? msg.guide : "", info };
    this._send(ws, {
      type: "welcome", protocol: PROTOCOL,
      connector: { node: process.execPath, script: process.argv[1] ?? "", port: this.port, version: "0.1.0" },
    });
    log(`app connected from ${origin} with ${this.session.tools.length} tools`);
    this.emit("change");
    return true;
  }

  _onMessage(msg) {
    if (msg.type === "result") {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      p.cleanup();
      try { p.resolve(sanitiseResult(msg)); } catch (e) { p.reject(e); }
    } else if (msg.type === "tools") {
      this.session.tools = sanitiseTools(msg.tools);
      if (typeof msg.guide === "string") this.session.guide = msg.guide;
      this.emit("change");
    } else if (msg.type === "bye") {
      this.session.ws.close(1000, "Bye");
    }
  }

  _drop(reason) {
    this.session = null;
    for (const [id, p] of this.pending) {
      this.pending.delete(id);
      p.cleanup();
      p.reject(new Error(`${reason} The step didn't finish.`));
    }
    log(reason);
    this.emit("change");
  }

  _ping() {
    for (const ws of this.wss?.clients ?? []) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch { /* closing */ }
    }
  }

  _send(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch (e) { log("send failed:", e.message); }
  }

  /** Run one tool in the app. Resolves { text, image? }; rejects on error, cancel or timeout. */
  call(name, input, { signal, timeoutMs = this.callTimeoutMs } = {}) {
    const s = this.session;
    if (!s) return Promise.reject(new Error("OddlyClever Design isn't connected."));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const cancel = (why) => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        cleanup();
        if (this.session?.ws === s.ws) this._send(s.ws, { type: "cancel", id });
        reject(new Error(why));
      };
      const onAbort = () => cancel("Cancelled.");
      const timer = setTimeout(() => cancel(`The app took longer than ${Math.round(timeoutMs / 1000)} s, so the step was stopped.`), timeoutMs);
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); };
      if (signal?.aborted) return reject(new Error("Cancelled."));
      signal?.addEventListener("abort", onAbort, { once: true });
      this.pending.set(id, { resolve, reject, cleanup });
      this._send(s.ws, { type: "call", id, name, input: input ?? {} });
    });
  }

  close() {
    this.closed = true;
    clearTimeout(this._relisten);
    clearInterval(this._pinger);
    for (const ws of this.wss?.clients ?? []) ws.close(1001, "Connector stopped");
    this.wss?.close();
  }
}
