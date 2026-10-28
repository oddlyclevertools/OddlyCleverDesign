// The Uploads panel: upload button, drop zone, and the library of uploads (kept across designs).
import { confirmDialog, el, icon, toast } from "../../ui/kit.js";
import { DRAG_TYPE, insertItem, uploadFiles } from "./actions.js";
import { deleteUpload, getUpload, listUploads, onUploadsChanged } from "./uploads-db.js";
import { setBackgroundImage } from "./images.js";

export function renderUploadsPanel(box, app) {
  const input = el("input.el-file", { type: "file", accept: "image/*", multiple: true, "aria-label": "Choose images to upload" });
  const busy = el("div.el-busy", { hidden: true }, el("span.el-spin"), "Uploading…");
  const run = async (files) => {
    busy.hidden = false;
    try { await uploadFiles(app, files); } finally { busy.hidden = true; }
  };
  input.addEventListener("change", () => { const f = [...(input.files || [])]; input.value = ""; if (f.length) run(f); });
  const button = el("button.btn.primary.el-upload-btn", { type: "button", on: { click: () => input.click() } }, icon("Upload", 17), "Upload images");
  const drop = el("div.el-dropzone", {}, icon("ImageUp", 22), el("b", {}, "Drop images here"),
    el("span", {}, "or paste one with Ctrl+V. Big pictures are shrunk to 4096 px."));
  const grid = el("div.el-uploads");
  const count = el("span.el-count");

  let dragDepth = 0;
  box.addEventListener("dragenter", (e) => { if (hasFiles(e)) { dragDepth++; box.classList.add("el-drop-active"); } });
  box.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) box.classList.remove("el-drop-active"); });
  box.addEventListener("dragover", (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
  box.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    box.classList.remove("el-drop-active");
    run([...e.dataTransfer.files]);
  });

  async function paint() {
    let list;
    try { list = await listUploads(); } catch (e) {
      grid.replaceChildren(el("p.el-empty", {}, `Your uploads couldn't be loaded: ${e.message}`));
      return;
    }
    count.textContent = list.length ? `${list.length}` : "";
    if (!list.length) {
      grid.replaceChildren(el("p.el-empty", {}, "Nothing here yet. Images you upload stay here for all your designs."));
      return;
    }
    const cols = [el("div.el-col"), el("div.el-col")];
    const heights = [0, 0];
    for (const u of list) {
      const i = heights[0] <= heights[1] ? 0 : 1;
      heights[i] += (u.height || 1) / (u.width || 1);
      cols[i].append(uploadTile(app, u));
    }
    grid.replaceChildren(...cols);
  }

  const off = onUploadsChanged(paint);
  box.classList.add("el-panel");
  box.append(el("div.el-up-top", {}, button, input), drop, busy,
    el("div.el-sec-head", {}, el("h4.sec-title", {}, "Your uploads ", count)), grid);
  paint();
  return () => off();
}

const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");

function uploadTile(app, u) {
  const img = el("img", { src: u.thumb, alt: u.name, draggable: false, loading: "lazy" });
  const remove = el("button.el-up-act", { type: "button", title: "Remove from uploads", "aria-label": `Remove ${u.name} from uploads`,
    on: { click: async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog("Remove this upload?", "It goes from your uploads library. Designs that already use it keep their copy.", "Remove");
      if (!ok) return;
      try { await deleteUpload(u.id); toast("Upload removed."); } catch (err) { toast(err.message, { error: true }); }
    } } }, icon("Trash2", 15));
  const asBg = el("button.el-up-act", { type: "button", title: "Use as background", "aria-label": `Use ${u.name} as background`,
    on: { click: async (e) => {
      e.stopPropagation();
      try { const rec = await getUpload(u.id); await setBackgroundImage(app, rec.src); } catch (err) { toast(err.message, { error: true }); }
    } } }, icon("Wallpaper", 15));
  const b = el("div.el-up", {
    role: "button", tabindex: 0, draggable: "true", title: `${u.name} (${u.width} × ${u.height})`, "aria-label": `Add ${u.name}`,
    style: { aspectRatio: `${u.width || 1} / ${u.height || 1}` },
    on: {
      click: () => insertItem(app, { kind: "upload", key: u.id }),
      keydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); insertItem(app, { kind: "upload", key: u.id }); } },
      dragstart: (e) => { e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind: "upload", key: u.id })); e.dataTransfer.effectAllowed = "copy"; },
    },
  }, img, el("div.el-up-acts", {}, asBg, remove));
  return b;
}
