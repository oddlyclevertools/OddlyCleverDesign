// Image and frame toolbars: crop, filters, adjust (with auto-enhance and hold-to-compare),
// border, corners, outline, shadow, replace, set as background; the background photo's own
// toolbar (blur and darken, filters, move and zoom, back to a normal photo); plus the crop-mode
// toolbar (shapes, straighten, zoom).
import { FabricImage } from "fabric";
import { closePopover, colorButton, el, icon, popover, slider, toast } from "../../ui/kit.js";
import { registerTool } from "../../ui/shell.js";
import { ADJUSTMENTS, PRESETS, applyFilterSpec, autoAdjust, filterSpec, previewSource, renderPreset, showOriginal } from "./filters.js";
import { FRAMES, KEEP, OcImage, applyMask, detachBackground, fillWithSource, isBgPhoto, isEmptyFrame, isFrame, prepareImageFile, setBackgroundImage } from "./images.js";
import { CROP_RATIOS, MAX_STRAIGHTEN, cropState, cropZoom, finishCrop, resetCrop, setCropRatio, setStraighten, setZoom, startCrop } from "./crop.js";
import { dashOptions, segmented, setSlider, shadowButton, tbtn, throttledCommit } from "./controls.js";
import { saveUpload } from "./uploads-db.js";
import { outlinePath } from "./geometry.js";

const isImg = (o) => o instanceof FabricImage && !o.isBg && !o.data?.cropUI;

/** Make sure an image is an OcImage (needed for borders and outlines); swaps it in place. */
async function ensureOc(app, img) {
  if (img instanceof OcImage) return img;
  const c = app.editor.canvas;
  const next = await OcImage.fromObject(img.toObject(KEEP));
  const i = c.getObjects().indexOf(img);
  c.remove(img);
  c.insertAt(i, next);
  c.setActiveObject(next);
  c.requestRenderAll();
  return next;
}

/** Ask for an image file, then hand it to `fn(prepared)`. */
export function pickImage(fn) {
  const input = el("input", { type: "file", accept: "image/*", style: { display: "none" } });
  input.addEventListener("change", async () => {
    const f = input.files?.[0];
    input.remove();
    if (!f) return;
    try {
      const prep = await prepareImageFile(f);
      saveUpload({ name: prep.name, type: prep.type, width: prep.width, height: prep.height, src: prep.src, thumb: prep.thumb })
        .catch((e) => toast(`Not saved to your uploads: ${e.message}`, { error: true }));
      await fn(prep);
    } catch (e) {
      toast(e.message, { error: true });
    }
  });
  document.body.append(input);
  input.click();
}

async function replaceImage(app, img) {
  pickImage(async (prep) => {
    await fillWithSource(img, prep.src);
    app.editor.canvas.setActiveObject(img);
    app.editor.canvas.requestRenderAll();
    app.editor.commit(isFrame(img) ? "Fill frame" : "Replace image");
    app.refreshToolbar();
  });
}

// ---- hold to compare -------------------------------------------------------------------------

/** A button that shows the photo without filters and adjustments while it's held down. */
function compareBtn(app, img) {
  const b = el("button.btn.small.el-compare", { type: "button", title: "Hold to see the original photo",
    "aria-label": "Hold to compare with the original" }, icon("Columns2", 15), "Hold to compare");
  let on = false;
  const set = (v) => {
    if (v === on) return;
    on = v;
    try { showOriginal(img, v); } catch (e) { toast(e.message, { error: true }); }
    b.classList.toggle("on", v);
    app.editor.canvas.requestRenderAll();
  };
  b.addEventListener("pointerdown", (e) => { b.setPointerCapture?.(e.pointerId); set(true); });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture", "blur"]) b.addEventListener(t, () => set(false));
  b.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); set(true); } });
  b.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); set(false); } });
  return b;
}

/**
 * Auto-enhance: set the light, colour and detail sliders from the photo's own pixels.
 * One undo step. Returns the adjust settings used.
 * @param {*} app
 * @param {import("fabric").FabricImage} img
 * @returns {Record<string, number>}
 */
export function autoEnhance(app, img) {
  const spec = filterSpec(img);
  const next = { ...spec, adjust: { ...spec.adjust, ...autoAdjust(img) } };
  applyFilterSpec(img, next);
  app.editor.canvas.requestRenderAll();
  app.editor.commit("Auto-enhance");
  return next.adjust;
}

// ---- filters ------------------------------------------------------------------------------

function filtersPanel(app, img) {
  let spec = filterSpec(img);
  const commit = throttledCommit(app, "Filter", 400);
  let raf = 0;
  const run = (done) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      try {
        applyFilterSpec(img, spec);
        app.editor.canvas.requestRenderAll();
        commit(done);
      } catch (e) { toast(`Couldn't apply that filter: ${e.message}`, { error: true }); }
    });
  };
  const src = previewSource(img);
  const tiles = PRESETS.map((p) => {
    const cv = el("canvas.el-ftile-img", { width: 1, height: 1 });
    const b = el("button.el-ftile", { type: "button", title: p.label, "aria-label": `${p.label} filter`, class: spec.preset === p.key ? "on" : null,
      on: { click: () => {
        spec = { ...spec, preset: p.key, intensity: p.key === spec.preset ? spec.intensity : 100 };
        tiles.forEach((t) => t.classList.toggle("on", t === b));
        intensity.classList.toggle("off", p.key === "none");
        intensity.querySelector("input.range").value = spec.intensity;
        intensity.querySelector("input.num").value = spec.intensity;
        run(true);
      } } }, cv, el("span", {}, p.label));
    b._cv = cv;
    b._key = p.key;
    return b;
  });
  // Draw the tiles a few per frame so the popover opens at once.
  let k = 0;
  const step = () => {
    for (let n = 0; n < 3 && k < tiles.length; n++, k++) {
      try { renderPreset(src, tiles[k]._key, tiles[k]._cv); } catch { /* a tile that can't render stays blank */ }
    }
    if (k < tiles.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  const intensity = el("div.el-intensity", { class: spec.preset === "none" ? "off" : null }, slider({
    label: "Intensity", min: 0, max: 100, value: spec.intensity, unit: "%",
    onInput: (v) => { spec = { ...spec, intensity: v }; run(false); }, onChange: (v) => { spec = { ...spec, intensity: v }; run(true); },
  }));
  return el("div.el-pop.el-filters", {}, el("div.el-pop-head", {}, el("h4.el-pop-title", {}, "Filters"), compareBtn(app, img)),
    el("div.el-ftiles", {}, tiles), intensity);
}

function adjustPanel(app, img) {
  let spec = filterSpec(img);
  const commit = throttledCommit(app, "Adjust", 400);
  let raf = 0;
  const run = (done) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      applyFilterSpec(img, spec);
      app.editor.canvas.requestRenderAll();
      commit(done);
    });
  };
  const box = el("div.el-sliders");
  const groups = [...new Set(ADJUSTMENTS.map((a) => a.group))];
  const build = () => box.replaceChildren(...groups.flatMap((g) => [el("h5.el-adj-group", {}, g), ...ADJUSTMENTS.filter((a) => a.group === g).map((a) => slider({
    label: a.label, min: a.min, max: a.max, value: spec.adjust[a.key] || 0,
    onInput: (v) => { spec = { ...spec, adjust: { ...spec.adjust, [a.key]: v } }; run(false); },
    onChange: (v) => { spec = { ...spec, adjust: { ...spec.adjust, [a.key]: v } }; run(true); },
  }))]));
  build();
  const reset = el("button.btn.small", { type: "button", on: { click: () => { spec = { ...spec, adjust: {} }; build(); run(true); } } }, "Reset");
  const auto = el("button.btn.small.el-auto", { type: "button", title: "Fix the light and colour in one click", on: { click: () => {
    cancelAnimationFrame(raf);
    try { autoEnhance(app, img); } catch (e) { toast(`Couldn't enhance this photo: ${e.message}`, { error: true }); return; }
    spec = filterSpec(img);
    build();
  } } }, icon("WandSparkles", 15), "Auto-enhance");
  return el("div.el-pop.el-adjust", {}, el("div.el-pop-head", {}, el("h4.el-pop-title", {}, "Adjust"), reset),
    el("div.el-adj-top", {}, auto, compareBtn(app, img)), box);
}

// ---- border, corners, outline ---------------------------------------------------------------

function imageBorderPanel(app, img) {
  const st = { color: "#ffffff", width: 0, style: "solid", ...(img.data?.border || {}) };
  const commit = throttledCommit(app, "Border", 300);
  const apply = (done) => {
    img.set("data", { ...img.data, border: st.width > 0 ? { ...st } : null });
    img.set("dirty", true);
    app.editor.canvas.requestRenderAll();
    commit(done);
  };
  const weight = slider({ label: "Weight", min: 0, max: 80, value: st.width, onInput: (v) => { st.width = v; apply(false); }, onChange: (v) => { st.width = v; apply(true); } });
  const ensureWidth = () => { if (!st.width) { st.width = 8; setSlider(weight, 8); } };
  return el("div.el-pop", {}, el("h4.el-pop-title", {}, "Border"),
    segmented(dashOptions(), st.style, (v) => { st.style = v; ensureWidth(); apply(true); }, "Border style"),
    weight,
    el("div.el-field", {}, el("span", {}, "Colour"), colorButton({ value: st.color, title: "Border colour",
      onChange: (v, done) => { if (typeof v !== "string") return; st.color = v; ensureWidth(); apply(done); } })));
}

function cornersPanel(app, img) {
  const W = img.getScaledWidth(), H = img.getScaledHeight();
  const max = Math.round(Math.min(W, H) / 2);
  const cur = img.data?.mask?.shape === "roundRect" ? img.data.mask.radius || 0 : 0;
  const commit = throttledCommit(app, "Corners", 300);
  const apply = (v, done) => {
    img.set("data", { ...img.data, mask: v > 0 || isFrame(img) ? { shape: "roundRect", radius: v } : null });
    applyMask(img);
    app.editor.canvas.requestRenderAll();
    commit(done);
  };
  return el("div.el-pop", {}, el("h4.el-pop-title", {}, "Corner rounding"),
    slider({ label: "Radius", min: 0, max, value: Math.min(cur, max), unit: "px", onInput: (v) => apply(v, false), onChange: (v) => apply(v, true) }));
}

function frameShapePanel(app, img) {
  const cur = img.data?.mask?.shape;
  return el("div.el-pop", {}, el("h4.el-pop-title", {}, "Frame shape"), el("div.el-shape-pick", {}, FRAMES.map((f) => {
    const b = el("button.el-shape-opt", { type: "button", title: f.label, "aria-label": f.label, class: cur === (f.key === "rect" ? "rect" : f.key) ? "on" : null,
      on: { click: () => {
        img.set("data", { ...img.data, mask: { shape: f.key, radius: f.radius || 0 } });
        applyMask(img);
        app.editor.canvas.requestRenderAll();
        app.editor.commit("Frame shape");
        b.parentNode.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      } } });
    b.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${f.key === "roundRect" ? "M10 4 L30 4 Q36 4 36 10 L36 30 Q36 36 30 36 L10 36 Q4 36 4 30 L4 10 Q4 4 10 4 Z" : outlinePath(f.key, 32, 32, 4, 4)}"/></svg>`;
    return b;
  })));
}

function outlinePanel(app, img) {
  const st = { color: "#ffffff", width: 0, ...(img.data?.outline || {}) };
  const commit = throttledCommit(app, "Outline", 300);
  const apply = (done) => {
    img.set("data", { ...img.data, outline: st.width > 0 ? { ...st } : null });
    img._outline = null;
    img.set("dirty", true);
    app.editor.canvas.requestRenderAll();
    commit(done);
  };
  const thick = slider({ label: "Thickness", min: 0, max: 40, value: st.width, unit: "px", onInput: (v) => { st.width = v; apply(false); }, onChange: (v) => { st.width = v; apply(true); } });
  return el("div.el-pop", {}, el("h4.el-pop-title", {}, "Sticker outline"),
    el("p.el-hint", {}, "An outline around the shape of a cut-out picture (a PNG with a transparent background)."),
    thick,
    el("div.el-field", {}, el("span", {}, "Colour"), colorButton({ value: st.color, title: "Outline colour",
      onChange: (v, done) => { if (typeof v !== "string") return; st.color = v; if (!st.width) { st.width = 10; setSlider(thick, 10); } apply(done); } })));
}

/** A button that opens a popover for an (upgraded) image. */
function popBtn(app, img, iconName, label, panel, opts = {}) {
  const b = tbtn(iconName, label, async () => {
    const target = opts.upgrade ? await ensureOc(app, img) : img;
    popover(b, panel(app, target), { cls: "el-popover" });
  }, opts);
  return b;
}

registerTool({
  id: "el-image", order: 37,
  match: (sel) => !cropState() && sel.length === 1 && isImg(sel[0]),
  render(app, [img]) {
    const frame = isFrame(img);
    if (isEmptyFrame(img)) {
      return el("div.tgroup", {},
        tbtn("ImagePlus", "Add image", () => replaceImage(app, img), { text: true, cls: "accent" }),
        tbtn("FolderOpen", "From uploads", () => app.openPanel("uploads"), { text: true }),
        popBtn(app, img, "Shapes", "Frame shape", frameShapePanel),
        popBtn(app, img, "SquareDashed", "Border", imageBorderPanel, { upgrade: true, on: Boolean(img.data?.border) }));
    }
    const masked = Boolean(img.data?.mask && img.data.mask.shape !== "roundRect" && img.data.mask.shape !== "rect");
    return el("div.tgroup", {},
      tbtn(frame ? "Move" : "Crop", frame ? "Reposition" : "Crop", () => startCrop(app, img), { text: true }),
      popBtn(app, img, "Sparkles", "Filters", filtersPanel, { text: true, on: Boolean(img.data?.filters?.preset && img.data.filters.preset !== "none") }),
      popBtn(app, img, "SlidersHorizontal", "Adjust", adjustPanel, { text: true, on: Boolean(img.data?.filters && Object.values(img.data.filters.adjust || {}).some(Boolean)) }),
      el("span.sep"),
      frame ? popBtn(app, img, "Shapes", "Frame shape", frameShapePanel) : null,
      popBtn(app, img, "SquareDashed", "Border", imageBorderPanel, { upgrade: true, on: Boolean(img.data?.border) }),
      !masked ? popBtn(app, img, "SquareRoundCorner", "Corner rounding", cornersPanel, { on: Boolean(img.data?.mask?.radius) }) : null,
      !frame && !img.data?.mask ? popBtn(app, img, "Scissors", "Sticker outline", outlinePanel, { upgrade: true, on: Boolean(img.data?.outline) }) : null,
      shadowButton(app, [img]),
      el("span.sep"),
      tbtn("Replace", frame ? "Replace image" : "Replace image (keeps size and position)", () => replaceImage(app, img)),
      !frame ? tbtn("Wallpaper", "Set as background", () => setBackgroundImage(app, img).catch((e) => toast(e.message, { error: true }))) : null,
    );
  },
});

// ---- the background photo -------------------------------------------------------------------

/** Quick looks for a backdrop: [label, blur, exposure]. */
const BACKDROP_LOOKS = [["Clear", 0, 0], ["Soft", 30, 0], ["Dim", 0, -45], ["Soft + dim", 35, -40], ["Dreamy", 45, 25]];

function backdropPanel(app, img) {
  let spec = filterSpec(img);
  const commit = throttledCommit(app, "Background blur and light", 400);
  let raf = 0;
  const run = (done) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      applyFilterSpec(img, spec);
      app.editor.canvas.requestRenderAll();
      commit(done);
    });
  };
  const set = (key, v, done) => { spec = { ...spec, adjust: { ...spec.adjust, [key]: v } }; run(done); };
  const blur = slider({ label: "Blur", min: 0, max: 100, value: spec.adjust.blur || 0, onInput: (v) => set("blur", v, false), onChange: (v) => set("blur", v, true) });
  const light = slider({ label: "Darken / brighten", min: -100, max: 100, value: spec.adjust.exposure || 0, onInput: (v) => set("exposure", v, false), onChange: (v) => set("exposure", v, true) });
  const looks = el("div.el-looks", {}, BACKDROP_LOOKS.map(([label, b, x]) => el("button.btn.small", { type: "button", title: `${label} background`,
    on: { click: () => {
      spec = { ...spec, adjust: { ...spec.adjust, blur: b, exposure: x } };
      setSlider(blur, b);
      setSlider(light, x);
      run(true);
    } } }, label)));
  return el("div.el-pop", {}, el("div.el-pop-head", {}, el("h4.el-pop-title", {}, "Blur and light"), compareBtn(app, img)),
    el("p.el-hint", {}, "A softer, darker background makes words and faces on top stand out."), looks, blur, light);
}

registerTool({
  id: "el-bgphoto", order: 37,
  match: (sel) => !cropState() && sel.length === 1 && isBgPhoto(sel[0]),
  render(app, [img]) {
    const adj = img.data?.filters?.adjust || {};
    const filtered = Boolean(img.data?.filters?.preset && img.data.filters.preset !== "none");
    return el("div.tgroup", {},
      el("span.el-bgtag", { title: "The page background. It stays at the bottom and fills the page." }, icon("Wallpaper", 15), "Background photo"),
      popBtn(app, img, "Droplet", "Blur and light", backdropPanel, { text: true, on: Boolean(adj.blur || adj.exposure) }),
      popBtn(app, img, "Sparkles", "Filters", filtersPanel, { text: true, on: filtered }),
      popBtn(app, img, "SlidersHorizontal", "Adjust", adjustPanel, { text: true, on: Object.values(adj).some(Boolean) }),
      tbtn("Move", "Move and zoom", () => startCrop(app, img, "frame"), { text: true }),
      el("span.sep"),
      tbtn("Replace", "Replace the background photo", () => replaceImage(app, img)),
      tbtn("ImageMinus", "Make it a normal photo (no longer the background)", () => detachBackground(app, img)),
    );
  },
});

// ---- crop mode ----------------------------------------------------------------------------

/** Shape picker for crop mode: a button showing the current shape, with a popover of choices. */
function ratioButton(s) {
  const b = el("button.btn.small.el-ratio-btn", { type: "button", title: "Crop shape", "aria-haspopup": "true",
    on: { click: () => popover(b, el("div.el-pop.el-ratios", {}, el("h4.el-pop-title", {}, "Crop shape"),
      el("div.el-ratio-grid", {}, CROP_RATIOS.map(([label, v]) => {
        const r = typeof v === "number" ? v : null;
        const w = r ? (r >= 1 ? 26 : 26 * r) : 22, h = r ? (r >= 1 ? 26 / r : 26) : 22;
        return el("button.el-ratio", { type: "button", class: s.ratioKey === label ? "on" : null, "aria-label": `${label} crop`,
          on: { click: () => { setCropRatio(v, label); closePopover(); s.app.refreshToolbar(); } } },
        el("span.el-ratio-shape", { class: r ? null : v ? "orig" : "free", style: { width: `${w}px`, height: `${h}px` } }), el("span", {}, label));
      }))), { cls: "el-popover" }) } }, icon("Ratio", 15), el("span", {}, s.ratioKey), icon("ChevronDown", 13));
  return b;
}

/** A compact inline slider for the crop bar. Double-click puts it back to the middle (or start). */
function barSlider(label, iconName, { min, max, step = 1, value, unit = "", onInput }) {
  const num = el("span.el-bar-num", {}, `${value}${unit}`);
  const range = el("input.range", { type: "range", min, max, step, value, "aria-label": label, title: label });
  const paint = () => range.style.setProperty("--p", `${((range.value - min) / (max - min)) * 100}%`);
  range.addEventListener("input", () => { paint(); num.textContent = `${range.value}${unit}`; onInput(Number(range.value)); });
  range.addEventListener("dblclick", () => { range.value = String(min < 0 ? 0 : min); range.dispatchEvent(new Event("input")); });
  paint();
  return el("label.el-bar-slider", { title: label }, icon(iconName, 15), el("span.el-bar-label", {}, label), range, num);
}

registerTool({
  id: "el-crop", order: 30,
  match: () => Boolean(cropState()),
  render() {
    const s = cropState();
    const crop = s.mode === "crop";
    return el("div.tgroup.el-cropbar", {},
      el("span.el-cropbar-label", {}, crop ? "Crop" : "Drag or zoom the picture"),
      crop ? ratioButton(s) : barSlider("Zoom", "ZoomIn", { min: 100, max: 400, value: Math.round(cropZoom() * 100), unit: "%", onInput: (v) => setZoom(v / 100) }),
      barSlider("Straighten", "RotateCw", { min: -MAX_STRAIGHTEN, max: MAX_STRAIGHTEN, step: 0.5, value: s.straighten, unit: "°", onInput: (v) => setStraighten(v) }),
      tbtn("RotateCcw", crop ? "Reset crop" : "Reset position", () => { resetCrop(); s.app.refreshToolbar(); }),
      el("span.sep"),
      el("button.btn.small", { type: "button", title: "Cancel (Esc)", on: { click: () => finishCrop(false) } }, "Cancel"),
      el("button.btn.small.primary", { type: "button", title: "Done (Enter)", on: { click: () => finishCrop(true) } }, "Done"),
    );
  },
});
