// The "No key? Paste into any chat" tab: copy a prompt, paste the reply, check it, run it.
import { el, icon, toast } from "../../ui/kit.js";
import { buildPastePrompt, parsePlan } from "./paste.js";
import { createRefTray } from "./refs/tray.js";
import { attachedRefs, attachedStyleName } from "./refs/store.js";

async function copyText(text) {
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000));
  try { await Promise.race([navigator.clipboard.writeText(text), timeout]); return true; } catch { return false; }
}

export function renderPaste(app, ctrl) {
  const ask = el("textarea.ai-paste-ask", { rows: 3, placeholder: "What should it make? e.g. A YouTube thumbnail about saving money", "aria-label": "What should the AI make?" });
  const promptBox = el("textarea.ai-paste-prompt", { rows: 5, readOnly: true, hidden: true, "aria-label": "The prompt to copy" });
  const reply = el("textarea.ai-paste-reply", { rows: 5, placeholder: 'Paste the reply here, e.g. {"plan": [...]}', "aria-label": "The AI's reply" });
  const preview = el("div.ai-preview", { role: "status" });

  const copy = el("button.btn.small.ai-copy", { type: "button", on: { click: async () => {
    const refs = attachedRefs();
    const text = buildPastePrompt(app, await ctrl.toolkitReady(), ask.value, { refs, styleName: attachedStyleName() });
    if (await copyText(text)) {
      promptBox.hidden = true;
      toast(refs.length ? `Prompt copied. Paste it into any AI chat and attach your ${refs.length} style picture${refs.length === 1 ? "" : "s"} there too.`
        : "Prompt copied. Paste it into any AI chat, then paste its reply below.");
    } else {
      promptBox.value = text;
      promptBox.hidden = false;
      promptBox.focus();
      promptBox.select();
      toast("Couldn't reach the clipboard. The prompt is selected: press Ctrl+C.");
    }
  } } }, icon("Copy", 14), "Copy prompt");

  let plan = null;
  const check = el("button.btn.small.ai-check", { type: "button", on: { click: async () => {
    plan = null;
    if (!reply.value.trim()) { toast("Paste the AI's reply first.", { error: true }); return; }
    try {
      plan = parsePlan(reply.value, await ctrl.toolkitReady());
    } catch (e) {
      preview.className = "ai-preview bad";
      preview.replaceChildren(icon("CircleX", 14), e.message);
      return;
    }
    const kinds = Object.entries(plan.counts).map(([k, n]) => `${k.replace(/_/g, " ")} ×${n}`).join(", ");
    const run = el("button.btn.primary.small.ai-run-plan", { type: "button", disabled: !plan.steps.length || ctrl.running, on: { click: async () => {
      run.disabled = true;
      await ctrl.runPlan(plan.steps, plan.note);
    } } }, icon("Play", 14), `Run ${plan.steps.length} step${plan.steps.length === 1 ? "" : "s"}`);
    preview.className = `ai-preview ${plan.problems.length ? "warn" : "ok"}`;
    preview.replaceChildren(...[
      el("b", {}, `${plan.steps.length} step${plan.steps.length === 1 ? "" : "s"} ready`),
      kinds ? el("span", {}, kinds) : null,
      plan.note ? el("em", {}, plan.note) : null,
      plan.problems.length ? el("details", {}, el("summary", {}, `${plan.problems.length} step${plan.problems.length === 1 ? "" : "s"} skipped`),
        el("ul", {}, plan.problems.slice(0, 12).map((p) => el("li", {}, p)))) : null,
      run].filter(Boolean));
  } } }, icon("ClipboardCheck", 14), "Check reply");

  const tray = createRefTray();
  const root = el("div.ai-paste", {},
    el("p.ai-lede", {}, "No key needed. This works with your normal ChatGPT or ", el("b", {}, "Claude.ai"), " subscription."),
    el("div.ai-stepnum", {}, el("span", {}, "1"), "Say what you want, then copy the prompt"), ask, tray.node, el("div.row", {}, copy), promptBox,
    el("div.ai-stepnum", {}, el("span", {}, "2"), "Paste it into any AI chat"),
    el("div.ai-stepnum", {}, el("span", {}, "3"), "Paste its reply here"), reply, el("div.row", {}, check),
    preview);
  tray.wire(root, ask);
  return root;
}
