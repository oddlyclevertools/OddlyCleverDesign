// End-to-end test of the Claude connector without Claude:
//   node tools/mcp_client_test.mjs [--real]
// Spawns connector/index.mjs over stdio with the MCP SDK client, opens the app in headless Chrome,
// pairs the tab through the real Connect card, then drives tools and checks the page.
// Without --real it injects a small fake toolkit (only in this test); --real uses the app's toolkit.
import { Client } from "../connector/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js";
import { StdioClientTransport } from "../connector/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";
import { ToolListChangedNotificationSchema } from "../connector/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js";
import WebSocket from "../connector/node_modules/ws/wrapper.mjs";
import { chromium } from "@playwright/test";
import { mkdtempSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REAL = process.argv.includes("--real");
const PORT = 47699;
const CODE = "OC-TEST-K7QZ";
const APP = process.env.DT_URL || "http://localhost:5181/";
const SHOT = resolve(REAL ? "tools/mcp_connected_real.png" : "tools/mcp_connected.png");
const tmp = mkdtempSync(join(tmpdir(), "oc-mcp-"));
const exportDir = join(tmp, "exports");

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail: String(detail).slice(0, 160) }); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const textOf = (r) => (r.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");

// ---- 1. start the connector the way Claude does ------------------------------------------
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve("connector/index.mjs"), "--port", String(PORT), "--export-dir", exportDir],
  env: { ...process.env, OC_CONFIG_DIR: join(tmp, "cfg"), OC_PAIRING_CODE: CODE },
  stderr: "pipe",
});
let stderr = "";
transport.stderr?.on("data", (d) => { stderr += d; });
const client = new Client({ name: "oc-test", version: "1.0.0" });
let listChanged = 0;
client.setNotificationHandler(ToolListChangedNotificationSchema, () => { listChanged++; });
await client.connect(transport);
check("server instructions present", (client.getInstructions() || "").includes("OddlyClever"));

// ---- 2. no app connected ---------------------------------------------------------------
let tools = (await client.listTools()).tools.map((t) => t.name);
check("no-app: only how_to_connect", tools.length === 1 && tools[0] === "how_to_connect", tools.join(","));
let r = await client.callTool({ name: "how_to_connect", arguments: {} });
check("no-app: steps include pairing code", textOf(r).includes(CODE) && textOf(r).includes("Connect"), textOf(r).split("\n")[0]);
r = await client.callTool({ name: "add_text", arguments: { text: "x" } });
check("no-app: other tool -> error with steps", r.isError && textOf(r).includes("pairing code"));

// ---- 3. hostile sockets ------------------------------------------------------------------
const tryWs = (origin, hello) => new Promise((done) => {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`, { origin });
  ws.on("unexpected-response", (_req, res) => done({ http: res.statusCode }));
  ws.on("open", () => ws.send(JSON.stringify(hello)));
  ws.on("close", (code) => done({ close: code }));
  ws.on("error", () => {});
});
let w = await tryWs("https://evil.example", { type: "hello", code: CODE });
check("wrong Origin rejected (403)", w.http === 403, JSON.stringify(w));
w = await tryWs("http://localhost:5181", { type: "hello", code: "OC-AAAA-BBBB", tools: [] });
check("wrong pairing code rejected (4003)", w.close === 4003, JSON.stringify(w));
w = await tryWs("http://localhost:5181", { type: "call", id: 1 });
check("no hello first -> closed (4002)", w.close === 4002, JSON.stringify(w));

// ---- 4. the app in headless Chrome, paired through the real card ------------------------
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") pageErrors.push(m.text()); });
await page.goto(APP);
await page.waitForFunction(() => window.__app);
await page.evaluate(() => { try { localStorage.removeItem("oddlyclever-connector"); } catch { /* fresh */ } });
await page.evaluate(() => window.__app.newDesign({ size: "yt-thumb" }));
await page.waitForFunction(() => window.__app.view === "editor");

await page.evaluate(async (real) => {
  const bridge = await import("/src/features/ai/bridge.js");
  const ui = await import("/src/features/ai/connector-ui.js");
  if (!real) {
    const { Textbox } = await import("/node_modules/.vite/deps/fabric.js");
    const app = window.__app;
    const obj = { type: "object", properties: {} };
    bridge.setToolkitForTesting({
      DESIGN_GUIDE: "FAKE GUIDE: big bold text, one idea.",
      TOOLS: [
        { name: "get_design", description: "Describe the design.", input_schema: obj },
        { name: "add_text", description: "Add text.", input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
        { name: "snapshot", description: "Picture of the page.", input_schema: obj },
        { name: "slow", description: "Takes 4 s.", input_schema: obj },
      ],
      async runTool(a, name, input, { signal } = {}) {
        const ed = a.editor;
        if (name === "get_design") return { text: JSON.stringify({ width: ed.width, height: ed.height, objects: ed.objects().length }) };
        if (name === "add_text") {
          const t = new Textbox(String(input.text), { left: 120, top: 260, width: 1040, fontSize: 120, fontFamily: "Anton", fill: "#ffc83d" });
          ed.add(t);
          return { text: `Added text "${input.text}".` };
        }
        if (name === "snapshot") {
          const url = ed.renderPage({ scale: 0.25 }).toDataURL("image/png");
          return { text: "Here is the page.", image: { mediaType: "image/png", data: url.split(",")[1] } };
        }
        if (name === "slow") {
          await new Promise((res, rej) => { const t = setTimeout(res, 4000); signal?.addEventListener("abort", () => { clearTimeout(t); rej(new Error(String(signal.reason))); }); });
          return { text: "slow done" };
        }
        throw new Error("unknown");
      },
    });
    void app;
  }
  const host = document.createElement("div");
  host.id = "cn-test-host";
  Object.assign(host.style, { position: "fixed", right: "16px", top: "76px", width: "360px", maxHeight: "calc(100vh - 100px)", overflow: "auto", zIndex: 70 });
  document.body.append(host);
  ui.renderConnectorCard(host, window.__app);
}, REAL);

// Start a wait in Claude, then connect in the UI like a person would.
const waiting = client.callTool({ name: "how_to_connect", arguments: { wait_seconds: 30 } });
await page.click("#cn-test-host summary");
await page.fill("#cn-test-host input[aria-label='Connector port']", String(PORT));
await page.fill("#cn-test-host input[aria-label='Pairing code']", "oc test k7qz"); // sloppy typing still works
await page.click("#cn-test-host button:has-text('Connect')");
r = await waiting;
check("wait_seconds returns once the tab connects", textOf(r).includes("is connected"), textOf(r));
await page.waitForSelector("#cn-test-host .cn-status.on", { timeout: 5000 });
check("card shows Connected", true);
await sleep(300);
check("tools/list_changed sent on connect", listChanged >= 1, `count=${listChanged}`);

tools = (await client.listTools()).tools.map((t) => t.name);
check("tools forwarded from the app", tools.includes("design_guide") && tools.includes("save_picture") && !tools.includes("how_to_connect") && tools.length >= 3, tools.join(","));

// ---- 5. drive the design -----------------------------------------------------------------
const pick = (...names) => names.find((n) => tools.includes(n));
const T_GET = pick("get_design", "describe_design", "read_design");
const T_TEXT = pick("add_text", "add_heading", "create_text");
const T_SNAP = pick("look_at_design", "snapshot", "get_snapshot", "look", "view_design", "render_snapshot", "screenshot");
r = await client.callTool({ name: "design_guide", arguments: {} });
check("design_guide returns the app's guide", textOf(r).length > 10, textOf(r).slice(0, 60));
if (T_GET) { r = await client.callTool({ name: T_GET, arguments: {} }); check(`${T_GET} works`, !r.isError, textOf(r).slice(0, 120)); }
else check("found a get-design tool", false, tools.join(","));
const before = await page.evaluate(() => window.__app.editor.objects().length);
if (T_TEXT) {
  r = await client.callTool({ name: T_TEXT, arguments: { text: "MADE BY CLAUDE" } });
  check(`${T_TEXT} works`, !r.isError, textOf(r).slice(0, 120));
  const found = await page.evaluate(() => window.__app.editor.objects().some((o) => String(o.text || "").toUpperCase().includes("MADE BY CLAUDE")));
  check("the text object really appeared on the page", found);
} else check("found an add-text tool", false, tools.join(","));
if (T_SNAP) {
  r = await client.callTool({ name: T_SNAP, arguments: {} });
  const img = (r.content || []).find((c) => c.type === "image");
  check(`${T_SNAP} returns an image block`, img && img.mimeType.startsWith("image/") && img.data.length > 1000, img ? `${img.mimeType} ${img.data.length} b64 chars` : textOf(r));
} else check("found a snapshot tool", false, tools.join(","));

r = await client.callTool({ name: "save_picture", arguments: { name: "../../evil/../thumb a" } });
const saved = (textOf(r).match(/Saved (.+)$/) || [])[1];
check("save_picture writes only inside the export folder", saved && existsSync(saved) && resolve(saved).startsWith(resolve(exportDir)) && statSync(saved).size > 1000, saved || textOf(r));

// Undo is normal: one undo removes Claude's text.
const afterAdd = await page.evaluate(() => window.__app.editor.objects().length);
await page.evaluate(() => window.__app.editor.history.undo());
const afterUndo = await page.evaluate(() => window.__app.editor.objects().length);
check("undo removes Claude's change", afterAdd > before && afterUndo === afterAdd - 1, `${before}->${afterAdd}->${afterUndo}`);
await page.evaluate(() => window.__app.editor.history.redo());

// "Undo Claude" in the pill rolls back Claude's whole run in one click.
if (T_TEXT) {
  await client.callTool({ name: T_TEXT, arguments: { text: "SECOND" } });
  await page.waitForSelector(".cn-pill.idle button:has-text('Undo Claude')", { timeout: 3000 });
  const n1 = await page.evaluate(() => window.__app.editor.objects().length);
  await page.click(".cn-pill button:has-text('Undo Claude')");
  await sleep(500);
  const n2 = await page.evaluate(() => window.__app.editor.objects().length);
  check("Undo Claude rolls back the whole run", n1 >= 2 && n2 === before, `${n1}->${n2}`);
  await page.evaluate(async () => { const h = window.__app.editor.history; while (h.canRedo) await h.redo(); });
}

// Activity pill + Stop (fake toolkit only: needs the slow tool).
if (!REAL) {
  const slow = client.callTool({ name: "slow", arguments: {} });
  try { await page.waitForSelector(".cn-pill:not(.idle)", { timeout: 3000 }); }
  catch (e) { console.log("slow result:", JSON.stringify(await slow).slice(0, 300), await page.evaluate(() => document.querySelectorAll(".cn-pill").length)); throw e; }
  await page.screenshot({ path: SHOT });
  await page.click(".cn-pill button:has-text('Stop')");
  r = await slow;
  check("Stop in the pill cancels Claude's step", r.isError && /Stop/.test(textOf(r)), textOf(r).slice(0, 100));
  // Claude-side cancel: abort the request, the app aborts the run.
  const ac = new AbortController();
  const p2 = client.callTool({ name: "slow", arguments: {} }, undefined, { signal: ac.signal }).catch((e) => ({ aborted: true, e: e.message }));
  await sleep(500); ac.abort();
  const res2 = await p2;
  await sleep(300);
  const idle = await page.evaluate(async () => !(await import("/src/features/ai/bridge.js")).getBridge(window.__app).busy);
  check("client cancel reaches the app", res2.aborted && idle, JSON.stringify(res2).slice(0, 80));
} else {
  await page.screenshot({ path: SHOT });
}

// ---- 6. disconnect -------------------------------------------------------------------------
const lcBefore = listChanged;
await page.close();
await sleep(800);
tools = (await client.listTools()).tools.map((t) => t.name);
check("tab closed -> back to how_to_connect", tools.length === 1 && tools[0] === "how_to_connect", tools.join(","));
check("tools/list_changed sent on disconnect", listChanged > lcBefore, `count=${listChanged}`);
r = await client.callTool({ name: T_TEXT || "add_text", arguments: { text: "x" } });
check("calls after disconnect fail politely", r.isError, textOf(r).split("\n")[0]);

await browser.close();
await client.close();
const unexpected = pageErrors.filter((e) => !/WebSocket connection/.test(e));
check("no page errors", unexpected.length === 0, unexpected.slice(0, 3).join(" | "));

const failed = results.filter((x) => !x.ok);
for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.detail ? `  (${x.detail})` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passed. Screenshot: ${SHOT}`);
if (failed.length) console.log("connector stderr:\n" + stderr.slice(-1500));
process.exit(failed.length ? 1 : 0);
