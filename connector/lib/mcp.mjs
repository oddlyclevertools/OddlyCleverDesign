// The MCP side: a stdio server whose tools are whatever the connected app tab offers.
// It never hard-codes design tools; it forwards them. With no tab connected it offers one tool
// that tells the AI (and so the user) how to connect.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema, CallToolRequestSchema,
  ListResourcesRequestSchema, ReadResourceRequestSchema,
  ListPromptsRequestSchema, GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { saveExport } from "./export.mjs";
import { saveGuide } from "./state.mjs";

export const EXPORT_OP = "__oc_export"; // reserved call the app's bridge answers with a rendered picture
const GUIDE_URI = "oddlyclever://design-guide";
const T_CONNECT = "how_to_connect";
const T_GUIDE = "design_guide";
const T_SAVE = "save_picture";

const BASE_INSTRUCTIONS = `This server drives OddlyClever Design, a free design editor (YouTube thumbnails, Shorts covers, social posts, posters) that runs in the user's browser. Its design tools appear once the user's app tab is connected; until then only "${T_CONNECT}" exists. Every change you make is visible live in their tab and can be undone there. Look at your work with the app's snapshot tool and fix what looks wrong before you say you're done. If you haven't read the design guide below, call "${T_GUIDE}" first.`;

const text = (t) => ({ type: "text", text: t });
const fail = (t) => ({ isError: true, content: [text(t)] });

export function createMcpServer({ link, version, pairingCode, cachedGuide, exportDir, port }) {
  let lastGuide = cachedGuide || "";
  const instructions = lastGuide ? `${BASE_INSTRUCTIONS}\n\n# Design guide\n${lastGuide}` : BASE_INSTRUCTIONS;
  const server = new Server(
    { name: "oddlyclever-design", title: "OddlyClever Design", version },
    { capabilities: { tools: { listChanged: true }, resources: {}, prompts: {} }, instructions },
  );

  const connectSteps = () => {
    if (link.listenError) return `The connector is running but can't accept the app: ${link.listenError}`;
    return [
      "OddlyClever Design isn't connected yet. Ask the user to:",
      "1. Open OddlyClever Design in their browser (for example http://localhost:5181).",
      "2. Open the AI panel and find the \"Connect Claude\" card.",
      `3. Paste this pairing code: ${pairingCode} (they only do this once; the app remembers it).`,
      "4. Click Connect.",
      port !== 47615 ? `The connector listens on port ${port}, so they should type ${port} in the card's port box.` : "",
      `Then call "${T_CONNECT}" again with wait_seconds (up to 120) to wait for the tab, and the design tools will appear.`,
    ].filter(Boolean).join("\n");
  };

  const nativeTools = () => {
    if (!link.connected) {
      return [{
        name: T_CONNECT,
        title: "How to connect OddlyClever Design",
        description: "OddlyClever Design isn't connected. Call this to get the steps (and the pairing code) to give the user, and optionally wait for their tab to connect.",
        inputSchema: {
          type: "object",
          properties: { wait_seconds: { type: "number", minimum: 0, maximum: 120, description: "Wait this long for the app tab to connect (0 = just get the steps)." } },
        },
      }];
    }
    const appNames = new Set(link.tools.map((t) => t.name));
    const extra = [];
    if (!appNames.has(T_GUIDE)) {
      extra.push({
        name: T_GUIDE, title: "Design guide",
        description: "Read the OddlyClever Design guide: how to design well with these tools. Call it once before your first design.",
        inputSchema: { type: "object", properties: {} },
      });
    }
    if (exportDir && !appNames.has(T_SAVE)) {
      extra.push({
        name: T_SAVE, title: "Save the design as a picture",
        description: `Save the current design as a PNG or JPG file in the user's export folder (${exportDir}). Never overwrites a file. Use only when the user asks for a file.`,
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 60, description: "File name without extension, e.g. \"thumbnail-a\"." },
            format: { type: "string", enum: ["png", "jpg"], default: "png" },
            scale: { type: "number", enum: [1, 2], default: 1, description: "2 = double resolution." },
          },
          required: ["name"],
        },
      });
    }
    return [...link.tools, ...extra];
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: nativeTools() }));

  server.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
    const { name } = req.params;
    const args = req.params.arguments ?? {};
    if (name === T_CONNECT) return connectTool(link, args, extra.signal, connectSteps);
    if (!link.connected) return fail(connectSteps());
    if (name === T_GUIDE && !link.tools.some((t) => t.name === T_GUIDE)) {
      return { content: [text(link.guide || lastGuide || "No design guide was sent by the app.")] };
    }
    if (name === T_SAVE && exportDir && !link.tools.some((t) => t.name === T_SAVE)) {
      return savePicture(link, args, extra.signal, exportDir);
    }
    if (!link.tools.some((t) => t.name === name)) return fail(`There's no tool called "${name}". List the tools again.`);
    try {
      const r = await link.call(name, args, { signal: extra.signal });
      const content = [text(r.text || "Done.")];
      if (r.image) content.push({ type: "image", data: r.image.data, mimeType: r.image.mediaType });
      return { content };
    } catch (e) {
      return fail(e.message || String(e));
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [{ uri: GUIDE_URI, name: "design-guide", title: "OddlyClever Design guide", mimeType: "text/markdown" }],
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    if (req.params.uri !== GUIDE_URI) throw new Error("Unknown resource.");
    return { contents: [{ uri: GUIDE_URI, mimeType: "text/markdown", text: link.guide || lastGuide || "Connect the app to get the design guide." }] };
  });
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [{ name: "design_guide", title: "OddlyClever design guide", description: "Load the guide for designing in OddlyClever Design." }],
  }));
  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    if (req.params.name !== "design_guide") throw new Error("Unknown prompt.");
    return { messages: [{ role: "user", content: text(link.guide || lastGuide || "Connect the app to get the design guide.") }] };
  });

  // Tell the client when the tool list changes (the tab connected, left, or sent new tools).
  let lastSig = "";
  link.on("change", () => {
    if (link.guide && link.guide !== lastGuide) { lastGuide = link.guide; saveGuide(lastGuide); }
    const sig = JSON.stringify(nativeTools().map((t) => t.name));
    if (sig === lastSig) return;
    lastSig = sig;
    server.sendToolListChanged().catch(() => { /* not connected to a client yet */ });
  });
  lastSig = JSON.stringify(nativeTools().map((t) => t.name));

  return server;
}

async function connectTool(link, args, signal, connectSteps) {
  const wait = Math.max(0, Math.min(120, Number(args.wait_seconds) || 0));
  if (!link.connected && wait > 0) {
    await new Promise((resolve) => {
      const done = () => { clearTimeout(timer); link.off("change", onChange); signal?.removeEventListener("abort", done); resolve(); };
      const onChange = () => { if (link.connected) done(); };
      const timer = setTimeout(done, wait * 1000);
      link.on("change", onChange);
      signal?.addEventListener("abort", done, { once: true });
    });
  }
  if (link.connected) {
    return { content: [text(`OddlyClever Design is connected with ${link.tools.length} design tools. List the tools again to see them.`)] };
  }
  return { content: [text(connectSteps())] };
}

async function savePicture(link, args, signal, exportDir) {
  const format = args.format === "jpg" ? "jpg" : "png";
  const scale = Number(args.scale) === 2 ? 2 : 1;
  try {
    const r = await link.call(EXPORT_OP, { format, scale }, { signal });
    if (!r.image) return fail("The app didn't send a picture.");
    const file = saveExport(exportDir, { name: args.name, mediaType: r.image.mediaType, data: r.image.data });
    return { content: [text(`Saved ${file}`)] };
  } catch (e) {
    return fail(e.message || String(e));
  }
}
