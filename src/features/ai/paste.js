// "Paste into any chat" (no key needed): copy a prompt with the design summary and the tool list,
// paste it into ChatGPT, Claude.ai or any chat, paste the JSON plan back, check it, then run it.
import { styleBrief } from "./refs/store.js";
import { designSummary } from "./summary.js";
import { validateInput } from "./validate.js";

export const MAX_PLAN_STEPS = 80;

/** @returns {string} the prompt to paste into a chat. */
export function buildPastePrompt(app, toolkit, request, { refs = [], styleName = "" } = {}) {
  const tools = (toolkit.TOOLS || []).map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
  return [
    "You are designing inside OddlyClever Design, a free design editor (thumbnails, Shorts covers, posts, posters).",
    "You can't touch the app directly. Instead, reply with a JSON plan of tool calls that I will run in the app.",
    "",
    toolkit.DESIGN_GUIDE ? `## How to design well here\n${toolkit.DESIGN_GUIDE}\n` : "",
    "## The design right now",
    designSummary(app),
    "",
    "## Tools you can use (JSON Schema for each input)",
    tools.length ? JSON.stringify(tools) : "(The tool list isn't ready yet. Reply with an empty plan and a note.)",
    "",
    "## Reply format",
    "Reply with ONE JSON object and nothing else, in this shape:",
    '{"plan": [{"tool": "<tool name>", "input": { ... }}, ...], "note": "<one short sentence for me>"}',
    `Use at most ${MAX_PLAN_STEPS} steps. Every input must match its tool's schema. You can't see results, so plan the whole design at once.`,
    "",
    refs.length ? `${styleBrief(refs, styleName)}\n(The pictures are attached to this chat message. If you can't see them, use the measured notes. Leave out look_at_design: plan the whole design at once.)\n` : "",
    "## What I want",
    request.trim() || "Make this design look great.",
  ].filter((l) => l !== null).join("\n");
}

/** Pull the JSON out of a chat reply (it may be wrapped in ``` fences or have words around it). */
function extractJson(reply) {
  const text = String(reply || "").trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fence?.[1], text];
  const first = text.indexOf("{"), last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  const a1 = text.indexOf("["), a2 = text.lastIndexOf("]");
  if (a1 >= 0 && a2 > a1) candidates.push(text.slice(a1, a2 + 1));
  for (const c of candidates) {
    if (!c) continue;
    try { return JSON.parse(c.trim()); } catch { /* try the next */ }
  }
  throw new Error("Couldn't find a JSON plan in that reply. Ask the AI to reply with only the JSON.");
}

/**
 * Check a pasted reply.
 * @returns {{ steps: {tool: string, input: object}[], problems: string[], note: string, counts: Record<string, number> }}
 */
export function parsePlan(reply, toolkit) {
  const data = extractJson(reply);
  const list = Array.isArray(data) ? data : data?.plan || data?.steps;
  if (!Array.isArray(list)) throw new Error("The reply has no “plan” list.");
  if (list.length > MAX_PLAN_STEPS) throw new Error(`The plan has ${list.length} steps; the most is ${MAX_PLAN_STEPS}.`);
  const tools = toolkit.TOOLS || [];
  const steps = [], problems = [], counts = {};
  list.forEach((s, i) => {
    const n = i + 1;
    const name = typeof s?.tool === "string" ? s.tool : typeof s?.name === "string" ? s.name : "";
    const input = s?.input ?? s?.arguments ?? {};
    if (!name) { problems.push(`Step ${n}: no tool name.`); return; }
    if (!input || typeof input !== "object" || Array.isArray(input)) { problems.push(`Step ${n} (${name}): the input must be an object.`); return; }
    const def = tools.find((t) => t.name === name);
    if (tools.length && !def) { problems.push(`Step ${n}: there's no tool called “${name}”.`); return; }
    const errs = def ? validateInput(def.input_schema, input) : [];
    if (errs.length) { problems.push(`Step ${n} (${name}): ${errs.join("; ")}.`); return; }
    steps.push({ tool: name, input });
    counts[name] = (counts[name] || 0) + 1;
  });
  const note = typeof data?.note === "string" ? data.note.slice(0, 300) : "";
  return { steps, problems, note, counts };
}
