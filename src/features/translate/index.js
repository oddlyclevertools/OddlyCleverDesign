// Translate (like Magic Switch): copies of the design in other languages, styles kept,
// right-to-left handled, long text auto-fitted. The words come from the user's AI: the AI
// feature sets app.ai.translate(texts, lang, info) -> Promise<string[]>.
import "./translate.css";
import { registerPanel } from "../../ui/shell.js";
import { LANGUAGES } from "./languages.js";
import { renderTranslatePanel } from "./panel.js";
import { textsToTranslate, translateDesign } from "./translate.js";

export function install(app) {
  app.translate = {
    /** Translate into languages; translator defaults to app.ai.translate. See translate.js. */
    translateDesign: (opts = {}) => translateDesign(app, { translator: app.ai?.translate, ...opts }),
    /** The texts that would be translated: [{id, text}]. */
    texts: (scope = "all") => textsToTranslate(app, { scope }),
    languages: () => LANGUAGES.map(({ code, name, rtl }) => ({ code, name, rtl })),
  };
  registerPanel({ id: "translate", icon: "Languages", label: "Translate", order: 74, render: (box) => renderTranslatePanel(box, app) });
}
