// Text feature: the OcText class (effects + curve), the Text panel with presets, the Effects
// panel, the contextual text toolbar and the text shortcuts.
import "./text.css";
import "./octext.js"; // registers the class for save / load
import { registerPanel, registerTool, registerShortcut } from "../../ui/shell.js";
import { Group } from "fabric";
import { toast } from "../../ui/kit.js";
import { renderTextPanel } from "./panel.js";
import { renderEffectsPanel } from "./fxpanel.js";
import { TOOL_GROUPS, toggleBold, toggleItalic, toggleFlag, setAlign, stepSize } from "./toolbar.js";
import { toggleUpper } from "./casing.js";
import { wireFit } from "./fit.js";
import { addBasic } from "./presets.js";
import { applyToTexts, isText, targets, textsIn } from "./helpers.js";

export { OcText } from "./octext.js";
// For the AI tools and scripts.
export { styleTextPart, popWord, applyTextStyle } from "./richtext.js";
export { setWeight } from "./weight.js";
export { setShrinkToFit, fitBoxToWords } from "./fit.js";
export { setCase } from "./casing.js";
export { setHighlight } from "./toolbar.js";

const hasText = (app) => targets(app).length > 0;

export function install(app) {
  registerPanel({ id: "text", icon: "Type", label: "Text", order: 30, render: renderTextPanel });
  // Opened from the toolbar's Effects button; its rail button is hidden in text.css.
  registerPanel({ id: "text-effects", icon: "Sparkles", label: "Text effects", order: 31, render: renderEffectsPanel });

  for (const g of TOOL_GROUPS) {
    registerTool({ id: g.id, order: g.order, match: (sel) => textsIn(sel).length > 0, render: (a) => g.render(a) });
  }

  const run = (fn) => async (a) => {
    try { await fn(a); } catch (e) { toast(e.message, { error: true }); }
  };
  registerShortcut({ keys: "t", label: "Add a text box", run: run((a) => addBasic(a, "body", { edit: true })) });
  registerShortcut({ keys: "mod+b", label: "Bold", when: hasText, run: run(toggleBold) });
  registerShortcut({ keys: "mod+i", label: "Italic", when: hasText, run: run(toggleItalic) });
  registerShortcut({ keys: "mod+u", label: "Underline", when: hasText, run: (a) => toggleFlag(a, "underline", "Underline") });
  registerShortcut({ keys: "mod+shift+s", label: "Strikethrough", when: hasText, run: (a) => toggleFlag(a, "linethrough", "Strikethrough") });
  registerShortcut({ keys: "mod+shift+l", label: "Align left", when: hasText, run: (a) => setAlign(a, "left") });
  registerShortcut({ keys: "mod+shift+c", label: "Align centre", when: hasText, run: (a) => setAlign(a, "center") });
  registerShortcut({ keys: "mod+shift+r", label: "Align right", when: hasText, run: (a) => setAlign(a, "right") });
  registerShortcut({ keys: "mod+shift+j", label: "Justify", when: hasText, run: (a) => setAlign(a, "justify") });
  registerShortcut({ keys: "mod+shift+k", label: "Uppercase (again: back to as typed)", when: hasText, run: (a) => toggleUpper(a) });
  registerShortcut({ keys: "mod+<|mod+shift+,", label: "Smaller text", when: hasText, run: (a) => stepSize(a, -1, true) });
  registerShortcut({ keys: "mod+>|mod+shift+.", label: "Bigger text", when: hasText, run: (a) => stepSize(a, 1, true) });
  registerShortcut({
    keys: "mod+alt+,|mod+alt+.", label: "Letter spacing", when: hasText,
    run: (a, e) => applyToTexts(a, (t) => t.set("charSpacing", (t.charSpacing || 0) + (e.key === "," ? -10 : 10)),
      "Letter spacing", { merge: true }),
  });

  // Esc while typing ends editing but keeps the text selected (the base Esc shortcut would
  // otherwise also deselect it, as the key reaches the window after Fabric exits editing).
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || app.view !== "editor") return;
    if (e.target?.closest?.(".popover, .modal-back")) return; // Esc there closes the popover only
    const t = app.editor.active();
    if (!t?.isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    t.exitEditing();
    app.editor.canvas.setActiveObject(t);
    app.editor.canvas.requestRenderAll();
  }, true);

  const canvas = app.editor.canvas;

  // While typing, Ctrl+B / I / U style the selected letters (app shortcuts are off while typing).
  window.addEventListener("keydown", (e) => {
    if (app.view !== "editor" || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const t = app.editor.active();
    if (!t?.isEditing) return;
    const k = e.key.toLowerCase();
    const fn = k === "b" ? toggleBold : k === "i" ? toggleItalic : k === "u" ? (a) => toggleFlag(a, "underline", "Underline") : null;
    if (!fn) return;
    e.preventDefault();
    e.stopPropagation();
    run(fn)(app);
  }, true);

  // The toolbar follows the letters selected while typing (it shows their colour, weight, size).
  let last = { editing: false, part: false };
  const followText = () => {
    const t = app.editor.active();
    const now = { editing: Boolean(t?.isEditing), part: Boolean(t?.isEditing && t.selectionStart !== t.selectionEnd) };
    const changed = now.editing !== last.editing || now.part || last.part;
    last = now;
    if (changed) app.refreshToolbar?.();
  };
  canvas.on("text:selection:changed", followText);
  canvas.on("text:editing:entered", followText);
  canvas.on("text:editing:exited", followText);
  wireFit(app);

  // Double-click a text combo (a preset group) to edit a word: it ungroups and edits that text.
  canvas.on("mouse:dblclick", (opt) => {
    const g = opt.target;
    if (!(g instanceof Group) || !g.data?.textCombo || g.locked) return;
    try {
      const p = canvas.getScenePoint(opt.e);
      const index = canvas.getObjects().indexOf(g);
      const objs = g.removeAll();
      canvas.remove(g);
      canvas.insertAt(index, ...objs);
      objs.forEach((o) => o.setCoords());
      const hit = [...objs].reverse().find((o) => isText(o) && o.containsPoint(p)) || objs.find(isText);
      app.editor.commit("Ungroup to edit");
      if (!hit) return;
      canvas.setActiveObject(hit);
      hit.enterEditing();
      hit.selectAll();
      canvas.requestRenderAll();
      toast("Ungrouped, so you can edit the words.");
    } catch (e) {
      toast(`Couldn't edit this text: ${e.message}`, { error: true });
    }
  });

  // Like Canva: a text box left empty after editing is removed.
  app.editor.canvas.on("text:editing:exited", ({ target }) => {
    if (isText(target) && !target.group && !(target.text || "").trim()) {
      setTimeout(() => app.editor.remove([target]));
    }
  });
}
