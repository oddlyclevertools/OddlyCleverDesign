// The "My folders" menu: add a picture folder, allow access again after a restart, rescan, remove.
import { closePopover, el, icon, popover, toast } from "../../../ui/kit.js";
import { addFolder, allowFolders, canUseFolders, listFolders, removeFolder, rescan } from "./folders.js";

export async function openFolders(anchor) {
  const list = el("div.ai-folders-list");
  const content = el("div.ai-styles.ai-folders", {},
    el("b", {}, "My folders"),
    el("p.ai-hint", {}, "Folders on this PC the AI may look in for your own pictures. It can only read them, and nothing is uploaded unless a picture goes into a design you send to a cloud AI."),
    list);
  popover(anchor, content, { cls: "ai-styles-pop" });
  if (!canUseFolders()) { list.append(el("p.ai-hint.warn", {}, "This browser can't open folders. Use Chrome or Edge.")); return; }

  async function draw() {
    let folders = [];
    try { folders = await listFolders(); } catch (e) { list.replaceChildren(el("p.ai-hint", {}, e.message)); return; }
    const needAllow = folders.some((f) => f.state !== "granted");
    list.replaceChildren(
      ...folders.map((f) => el("div.ai-style", {},
        el("span.ai-folder", {}, icon(f.state === "granted" ? "FolderOpen" : "FolderLock", 16),
          el("span", {}, el("b", {}, f.name), el("small", {}, f.state === "granted" ? (f.count === null ? "Allowed" : `${f.count} pictures`) : "Needs Allow"))),
        el("button.ibtn.ai-style-del", { type: "button", "aria-label": `Remove ${f.name}`, title: "Stop using this folder (nothing on disk changes)",
          on: { click: async () => { await removeFolder(f.id); draw(); } } }, icon("X", 13)))),
      folders.length ? null : el("p.ai-hint", {}, "No folders yet."),
      el("div.row.ai-folder-actions", {},
        el("button.btn.small.primary", { type: "button", on: { click: async () => {
          try {
            const f = await addFolder();
            if (f) toast(`The AI can now look in “${f.name}”.`);
            draw();
          } catch (e) { toast(e.message, { error: true }); }
        } } }, icon("FolderPlus", 14), "Add folder"),
        needAllow ? el("button.btn.small", { type: "button", title: "Chrome asks again after a restart", on: { click: async () => {
          const n = await allowFolders();
          toast(n ? `Allowed ${n} folder${n === 1 ? "" : "s"}.` : "Not allowed.", { error: !n });
          draw();
        } } }, icon("Unlock", 14), "Allow") : null,
        folders.length ? el("button.btn.small.ghost", { type: "button", title: "Look again for new pictures", on: { click: () => { rescan(); toast("The AI will look again next time."); closePopover(); } } },
          icon("RefreshCw", 14), "Look again") : null));
  }
  draw();
}
