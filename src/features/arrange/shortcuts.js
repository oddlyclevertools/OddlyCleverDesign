// Keyboard shortcuts of the arrange feature. Copy/cut/paste use the DOM clipboard events
// (see clipboard.js); their entries here only label them for the shortcut list.
import { registerShortcut } from "../../ui/shell.js";
import { pasteStyle, copyStyle } from "./clipboard.js";
import { isFixed, isMulti } from "./geom.js";
import { duplicate, group, lock, nudge, order, tidy, ungroup } from "./ops.js";
import { getPrefs, setPref } from "./state.js";
import { toast } from "../../ui/kit.js";

const NUDGE = 1, NUDGE_BIG = 10;

export function registerArrangeShortcuts(app) {
  const ed = app.editor;
  const hasSel = () => ed.selection().some((o) => !isFixed(o));
  const movable = () => {
    const a = ed.active();
    return Boolean(a) && (isMulti(a) || !a.locked);
  };
  const onCanvas = () => {
    const f = document.activeElement;
    return !f || f === document.body || app.shell.canvasHost.contains(f);
  };

  registerShortcut({ keys: "mod+c", label: "Copy", when: () => false, run: () => {} });
  registerShortcut({ keys: "mod+x", label: "Cut", when: () => false, run: () => {} });

  const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
  for (const [key, [x, y]] of Object.entries(arrows)) {
    registerShortcut({ keys: key, label: null, when: movable, run: () => nudge(app, x * NUDGE, y * NUDGE) });
    registerShortcut({ keys: `shift+${key}`, label: null, when: movable, run: () => nudge(app, x * NUDGE_BIG, y * NUDGE_BIG) });
  }
  registerShortcut({ keys: "arrowleft", label: "Nudge (Shift for 10 px)", when: () => false, run: () => {} });

  registerShortcut({ keys: "mod+d", label: "Duplicate", when: hasSel, run: () => duplicate(app) });
  registerShortcut({ keys: "mod+g", label: "Group", when: hasSel, run: () => group(app) });
  registerShortcut({ keys: "mod+shift+g", label: "Ungroup", when: hasSel, run: () => ungroup(app) });
  registerShortcut({ keys: "mod+]", label: "Bring forward", when: hasSel, run: (_, e) => order(app, e?.shiftKey ? "front" : "forward") });
  registerShortcut({ keys: "mod+[", label: "Send backward", when: hasSel, run: (_, e) => order(app, e?.shiftKey ? "back" : "backward") });
  registerShortcut({ keys: "mod+shift+]|mod+}|mod+alt+]", label: "Bring to front", when: hasSel, run: () => order(app, "front") });
  registerShortcut({ keys: "mod+shift+[|mod+{|mod+alt+[", label: "Send to back", when: hasSel, run: () => order(app, "back") });
  registerShortcut({ keys: "mod+shift+l|alt+shift+l", label: "Lock", when: hasSel, run: () => lock(app) });
  registerShortcut({ keys: "alt+shift+t", label: "Tidy up", when: () => ed.selection().length > 1, run: () => tidy(app) });
  registerShortcut({
    keys: "mod+alt+c|mod+alt+ç", label: "Copy style", when: hasSel,
    run: () => { if (copyStyle(app)) toast("Style copied. Press Ctrl+Alt+V on another object."); },
  });
  registerShortcut({ keys: "mod+alt+v|mod+alt+√", label: "Paste style", when: hasSel, run: () => pasteStyle(app) });
  registerShortcut({ keys: "tab", label: "Select next", when: onCanvas, run: () => cycle(app, 1) });
  registerShortcut({ keys: "shift+tab", label: "Select previous", when: onCanvas, run: () => cycle(app, -1) });
  registerShortcut({ keys: "shift+r", label: "Show rulers", run: () => setPref("rulers", !getPrefs().rulers) });
  registerShortcut({ keys: "alt+1", label: "Show layers", run: () => app.openPanel(app.currentPanel?.() === "layers" ? null : "layers") });
}

/** Tab / Shift+Tab: select the next or previous object in stacking order. */
function cycle(app, dir) {
  const ed = app.editor;
  const list = ed.objects().filter((o) => !o.locked && o.visible !== false && o.selectable !== false && !o.isBg);
  if (!list.length) return;
  const sel = ed.selection();
  const cur = sel.length ? Math.max(...sel.map((o) => list.indexOf(o))) : -1;
  const next = cur < 0 ? (dir > 0 ? 0 : list.length - 1) : (cur + dir + list.length) % list.length;
  ed.select([list[next]]);
}
