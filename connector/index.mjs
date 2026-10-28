#!/usr/bin/env node
// OddlyClever Design connector: an MCP server (stdio) that lets Claude Desktop, Claude Code or any
// MCP client build designs in the OddlyClever Design tab open in your browser.
//
//   node index.mjs               run as an MCP server (Claude starts it for you)
//   node index.mjs --setup       print the lines to paste into Claude, and your pairing code
//   node index.mjs --new-code    make a new pairing code (the app must be paired again)
//
// Options (or environment variables):
//   --port <n>            OC_PORT          WebSocket port on 127.0.0.1 (default 47615)
//   --allow-origin <url>  OC_ALLOW_ORIGIN  extra web address allowed to connect (repeatable / comma list)
//   --export-dir <path>   OC_EXPORT_DIR    folder for save_picture (default Downloads/OddlyClever)
//   --no-export           OC_NO_EXPORT=1   turn save_picture off
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "node:url";
import { AppLink } from "./lib/app-link.mjs";
import { createMcpServer } from "./lib/mcp.mjs";
import { loadState, statePath } from "./lib/state.mjs";
import { defaultExportDir } from "./lib/export.mjs";

const VERSION = "0.1.0";
export const DEFAULT_PORT = 47615;
const DEFAULT_ORIGINS = ["http://localhost:5181", "http://localhost:5182", "http://127.0.0.1:5181", "http://127.0.0.1:5182"];

function parseArgs(argv) {
  const opts = { port: Number(process.env.OC_PORT) || DEFAULT_PORT, origins: [], exportDir: process.env.OC_EXPORT_DIR || "", export: process.env.OC_NO_EXPORT !== "1" };
  if (process.env.OC_ALLOW_ORIGIN) opts.origins.push(...process.env.OC_ALLOW_ORIGIN.split(","));
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new Error(`${a} needs a value`); return argv[++i]; };
    if (a === "--port") opts.port = Number(next());
    else if (a === "--allow-origin") opts.origins.push(next());
    else if (a === "--export-dir") opts.exportDir = next();
    else if (a === "--no-export") opts.export = false;
    else if (a === "--setup") opts.setup = true;
    else if (a === "--new-code") opts.newCode = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else throw new Error(`Unknown option ${a}. Try --help.`);
  }
  if (!Number.isInteger(opts.port) || opts.port < 1024 || opts.port > 65535) throw new Error("--port must be a number from 1024 to 65535");
  return opts;
}

/** Turn "https://me.github.io/app/" into the origin "https://me.github.io". Rejects anything else. */
function toOrigin(s) {
  const u = new URL(String(s).trim());
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error(`--allow-origin must be an http(s) address, not ${s}`);
  return u.origin;
}

function setupText(code, port) {
  const script = fileURLToPath(import.meta.url);
  const args = port === DEFAULT_PORT ? [script] : [script, "--port", String(port)];
  const desktop = { mcpServers: { "oddlyclever-design": { command: process.execPath, args } } };
  const quoted = (s) => (/[\s"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s);
  return [
    "OddlyClever Design connector",
    "",
    `Your pairing code: ${code}`,
    "(Paste it into the Connect Claude card in the app's AI panel. You only need to do this once.)",
    "",
    "Claude Desktop: Settings > Developer > Edit Config, and add this to claude_desktop_config.json:",
    JSON.stringify(desktop, null, 2),
    "",
    "Claude Code: run this once in a terminal:",
    `claude mcp add --scope user oddlyclever-design -- ${[process.execPath, ...args].map(quoted).join(" ")}`,
    "",
    `Settings file: ${statePath()}`,
  ].join("\n");
}

async function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (opts.help) { console.error(readHeader()); return; }
  const state = loadState({ resetCode: !!opts.newCode });
  if (opts.setup || opts.newCode) { console.log(setupText(state.pairingCode, opts.port)); return; }

  const origins = new Set(DEFAULT_ORIGINS);
  try { for (const o of opts.origins) if (o.trim()) origins.add(toOrigin(o)); } catch (e) { console.error(e.message); process.exit(2); }
  const exportDir = opts.export ? (opts.exportDir || defaultExportDir()) : "";

  const link = new AppLink({ port: opts.port, origins, getCode: () => state.pairingCode });
  await link.start();
  const server = createMcpServer({ link, version: VERSION, pairingCode: state.pairingCode, cachedGuide: state.guide, exportDir, port: opts.port });
  const transport = new StdioServerTransport();
  const shutdown = () => { link.close(); process.exit(0); };
  transport.onclose = shutdown;
  process.stdin.on("end", shutdown);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  if (process.stdin.isTTY) console.error("[oddlyclever] This is an MCP server: Claude starts it for you. Run with --setup to see what to paste into Claude.");
  await server.connect(transport);
}

function readHeader() {
  return "OddlyClever Design connector " + VERSION + "\n  --setup  --new-code  --port <n>  --allow-origin <url>  --export-dir <path>  --no-export\nSee README.md.";
}

main().catch((e) => { console.error("[oddlyclever] fatal:", e); process.exit(1); });
