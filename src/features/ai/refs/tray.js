// The style-picture tray under the Ask AI box: add pictures (button, drag and drop, paste), see
// them as thumbnails, remove one, save them as a named style, and pick a saved style ("My styles").
import { confirmDialog, el, icon, popover, closePopover, toast } from "../../../ui/kit.js";
import {
  MAX_REFS, attachFiles, attachedRefs, attachedStyleName, deleteStyle, listStyles, onRefsChange,
  removeAttached, saveStyle, setAttached,
} from "./store.js";
import { openFolders } from "../pictures/folders-ui.js";

const imagesIn = (list) => [...(list || [])].filter((f) => f && /^image\//.test(f.type));

async function addFiles(files) {
  const pics = imagesIn(files);
  if (!pics.length) return;
  const errors = await attachFiles(pics);
  if (errors.length) toast(errors[0], { error: true });
}

/**
 * @param {{ onChange?: () => void }} [opts]
 * @returns {{ node: HTMLElement, pick: () => void, wire: (zone: HTMLElement, input?: HTMLElement) => () => void, dispose: () => void }}
 */
export function createRefTray({ onChange } = {}) {
  const file = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", multiple: true, hidden: true,
    on: { change: async () => { await addFiles(file.files); file.value = ""; } } });
  const chips = el("div.ai-refs-chips");
  const label = el("span.ai-refs-label");
  const addBtn = el("button.btn.small.ghost.ai-refs-add", { type: "button", title: "Add pictures whose style you like (or drop or paste them here)",
    on: { click: () => file.click() } }, icon("ImagePlus", 14), "Style picture");
  const stylesBtn = el("button.btn.small.ghost.ai-refs-styles", { type: "button", title: "Your saved styles",
    on: { click: () => openStyles(stylesBtn) } }, icon("Palette", 14), "My styles");
  const foldersBtn = el("button.btn.small.ghost.ai-refs-folders", { type: "button", title: "Picture folders on this PC the AI may use",
    on: { click: () => openFolders(foldersBtn) } }, icon("FolderOpen", 14), "My folders");
  const node = el("div.ai-refs", {}, file, el("div.ai-refs-row", {}, addBtn, stylesBtn, foldersBtn, el("span.grow"), label), chips);

  function draw() {
    const refs = attachedRefs();
    chips.replaceChildren(...refs.map((r) => el("div.ai-ref", { title: r.name },
      el("img", { src: r.thumb, alt: r.name }),
      el("button.ai-ref-x", { type: "button", "aria-label": `Remove ${r.name}`, on: { click: () => removeAttached(r.id) } }, icon("X", 12)))));
    chips.hidden = !refs.length;
    const style = attachedStyleName();
    label.textContent = refs.length ? (style ? `Style: ${style}` : `${refs.length}/${MAX_REFS} style picture${refs.length === 1 ? "" : "s"}`) : "";
    node.classList.toggle("has", refs.length > 0);
    onChange?.();
  }

  async function openStyles(anchor) {
    const list = el("div.ai-styles-list");
    const refs = attachedRefs();
    const nameIn = el("input.ai-style-name", { type: "text", maxLength: 40, placeholder: "Name, e.g. My channel look", "aria-label": "Style name" });
    const saveRow = refs.length ? el("div.ai-style-save", {}, nameIn,
      el("button.btn.small.primary", { type: "button", on: { click: async () => {
        try {
          const s = await saveStyle(nameIn.value, attachedRefs());
          setAttached(attachedRefs(), s.name);
          toast(`Saved “${s.name}”. Pick it any time from My styles.`);
          closePopover();
        } catch (e) { toast(e.message, { error: true }); }
      } } }, icon("Save", 14), "Save")) : el("p.ai-hint", {}, "Add style pictures, then save them here as a named style to use again.");
    const content = el("div.ai-styles", {}, el("b", {}, "My styles"), list, el("div.ai-styles-sep"), saveRow);
    popover(anchor, content, { cls: "ai-styles-pop" });
    let styles = [];
    try { styles = await listStyles(); } catch (e) { list.append(el("p.ai-hint", {}, `Couldn't open your styles: ${e.message}`)); return; }
    if (!styles.length) { list.append(el("p.ai-hint", {}, "No saved styles yet.")); return; }
    list.append(...styles.map((s) => el("div.ai-style", {},
      el("button.ai-style-use", { type: "button", title: `Use “${s.name}” for your next request`, on: { click: () => {
        setAttached(s.refs.map((r) => ({ ...r })), s.name);
        closePopover();
      } } }, el("img", { src: s.refs[0]?.thumb, alt: "" }), el("span", {}, el("b", {}, s.name), el("small", {}, `${s.refs.length} picture${s.refs.length === 1 ? "" : "s"}`))),
      el("button.ibtn.ai-style-del", { type: "button", "aria-label": `Delete ${s.name}`, title: "Delete this saved style", on: { click: async () => {
        if (!(await confirmDialog(`Delete “${s.name}”?`, "This removes the saved style from this browser. Designs you made with it stay.", "Delete"))) return;
        try { await deleteStyle(s.id); closePopover(); toast(`Deleted “${s.name}”.`); } catch (e) { toast(e.message, { error: true }); }
      } } }, icon("Trash2", 13)))));
  }

  /** Accept dropped and pasted pictures on a zone (and its text box). */
  function wire(zone, input = null) {
    const over = (e) => { if ([...(e.dataTransfer?.items || [])].some((i) => i.kind === "file")) { e.preventDefault(); zone.classList.add("ai-drop"); } };
    const leave = () => zone.classList.remove("ai-drop");
    const drop = (e) => {
      const pics = imagesIn(e.dataTransfer?.files);
      leave();
      if (!pics.length) return;
      e.preventDefault();
      addFiles(pics);
    };
    const paste = (e) => {
      const pics = imagesIn([...(e.clipboardData?.items || [])].filter((i) => i.kind === "file").map((i) => i.getAsFile()));
      if (!pics.length) return;
      e.preventDefault();
      addFiles(pics);
    };
    zone.addEventListener("dragover", over);
    zone.addEventListener("dragleave", leave);
    zone.addEventListener("drop", drop);
    input?.addEventListener("paste", paste);
    return () => {
      zone.removeEventListener("dragover", over);
      zone.removeEventListener("dragleave", leave);
      zone.removeEventListener("drop", drop);
      input?.removeEventListener("paste", paste);
    };
  }

  const off = onRefsChange(draw);
  draw();
  return { node, pick: () => file.click(), wire, dispose: off };
}
