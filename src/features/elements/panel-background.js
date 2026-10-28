// The Background panel: page colour, gradient presets, a custom gradient editor and a
// background image (cover-fit, locked at the bottom).
import { PALETTE, colorButton, el, icon, slider, toast } from "../../ui/kit.js";
import { cssFill, forPicker, fromFabricFill, mainColor, toFabricFill } from "./fill.js";
import { backgroundImage, isBgPhoto, removeBackgroundImage, setBackgroundImage } from "./images.js";
import { selectBackground } from "./bgphoto.js";
import { listUploads, getUpload, onUploadsChanged } from "./uploads-db.js";
import { segmented, throttledCommit } from "./controls.js";
import { pickImage } from "./toolbar-image.js";
import { SCENES } from "./scenes.js";
import { applyScene, currentScene, sceneOf, sceneThumb } from "./scene-apply.js";
import { peek, hidePeek } from "./peek.js";

const lin = (angle, ...colors) => ({ type: "linear", angle, stops: colors.map((c, i) => ({ offset: i / (colors.length - 1), color: c })) });
const rad = (...colors) => ({ type: "radial", stops: colors.map((c, i) => ({ offset: i / (colors.length - 1), color: c })) });

export const GRADIENT_PRESETS = [
  lin(135, "#ff5f6d", "#ffc371"), lin(135, "#8e2de2", "#4a00e0"), lin(135, "#00c6ff", "#0072ff"), lin(135, "#f7971e", "#ffd200"),
  lin(135, "#11998e", "#38ef7d"), lin(135, "#fc466b", "#3f5efb"), lin(160, "#0f2027", "#203a43", "#2c5364"), lin(135, "#ee9ca7", "#ffdde1"),
  lin(120, "#12c2e9", "#c471ed", "#f64f59"), lin(180, "#232526", "#414345"), lin(135, "#ff512f", "#dd2476"), lin(90, "#fdfc47", "#24fe41"),
  rad("#ffe259", "#ffa751"), rad("#d76d77", "#3a1c71"), rad("#5b5b86", "#0b0b14"), rad("#ffffff", "#c9d6ff"),
];
const SOLIDS = ["#ffffff", "#f4f1ea", "#fff4d6", "#e9f3ff", ...PALETTE.filter((c) => c !== "#ffffff")];

export function renderBackgroundPanel(box, app) {
  const ed = app.editor;
  const current = () => ed.page?.data?.fill ?? fromFabricFill(ed.page?.fill);
  const dragCommit = throttledCommit(app, "Background", 220);

  /** Set the page fill. Discrete picks go through editor.setBackground; drags merge. */
  const setFill = (value, done = true, drag = false) => {
    const page = ed.page;
    if (!page) return;
    page.set("data", { ...(page.data || {}), fill: value });
    if (!drag) ed.setBackground(toFabricFill(value));
    else {
      page.set("fill", toFabricFill(value));
      ed.canvas.requestRenderAll();
      dragCommit(done);
    }
    paintCurrent();
  };

  // Current colour + picker.
  const curBtn = colorButton({ value: forPicker(current()), gradient: true, title: "Page colour",
    onChange: (v, done) => setFill(v, done, !done) });
  const curLabel = el("span.el-bg-cur-label");
  const paintCurrent = () => {
    const v = current();
    curBtn.setValue(forPicker(v));
    curLabel.textContent = typeof v === "string" ? v : v.type === "radial" ? "Radial gradient" : "Gradient";
    for (const b of box.querySelectorAll(".el-bgsw")) b.classList.toggle("on", JSON.stringify(b._v) === JSON.stringify(v));
  };

  const sw = (v, title) => {
    const b = el("button.el-bgsw", { type: "button", title, "aria-label": title, style: { background: cssFill(v) }, on: { click: () => { setFill(v); editor.load(v); } } });
    b._v = v;
    return b;
  };

  // Custom gradient editor.
  const editor = gradientEditor((v, done) => setFill(v, done, !done));

  // Background image.
  const imgBox = el("div.el-bgimg");
  const paintImage = async () => {
    const bg = backgroundImage(app);
    let ups = [];
    try { ups = (await listUploads()).slice(0, 6); } catch { /* the library is optional here */ }
    imgBox.replaceChildren(
      el("div.row", {},
        el("button.btn.small", { type: "button", on: { click: () => pickImage(async (p) => { await setBackgroundImage(app, p.src); paintImage(); }) } }, icon("ImageUp", 15), "Upload image"),
        isBgPhoto(bg) ? el("button.btn.small", { type: "button", title: "Blur, darken, filter or move the background photo",
          on: { click: () => selectBackground(app) } }, icon("SlidersHorizontal", 15), "Edit background photo") : null,
        bg ? el("button.btn.small.el-danger", { type: "button", on: { click: () => { removeBackgroundImage(app); paintImage(); } } }, icon("ImageOff", 15), "Remove background image") : null),
      ups.length ? el("div.el-bg-ups", {}, ups.map((u) => el("button.el-bg-up", {
        type: "button", title: `Use ${u.name}`, "aria-label": `Use ${u.name} as background`,
        on: { click: async () => { try { const r = await getUpload(u.id); await setBackgroundImage(app, r.src); paintImage(); } catch (e) { toast(e.message, { error: true }); } } },
      }, el("img", { src: u.thumb, alt: "" })))) : el("p.el-hint", {}, "Upload a photo, or drag one onto the page and choose Set as background."),
    );
  };

  // Patterns and scenes (drawn backgrounds with adjustable colours).
  const sceneBox = el("div.el-scene-cur");
  const sceneCommit = throttledCommit(app, "Background colours", 260);
  let busy = Promise.resolve();
  let shown = "", editingUntil = 0;
  const paintScene = (soft = false) => {
    const cur = currentScene(app);
    for (const b of box.querySelectorAll(".el-scene")) b.classList.toggle("on", b.dataset.key === cur?.scene.key);
    // While a colour is being dragged, the history events from our own commits don't rebuild the pickers.
    const sig = JSON.stringify(cur?.scene || null);
    if (soft && (sig === shown || performance.now() < editingUntil)) return;
    shown = sig;
    if (!cur) { sceneBox.replaceChildren(); sceneBox.hidden = true; return; }
    const s = sceneOf(cur.scene.key);
    if (!s) { sceneBox.hidden = true; return; }
    sceneBox.hidden = false;
    let colors = { ...cur.scene.colors };
    sceneBox.replaceChildren(
      el("div.el-sec-head", {}, el("h4.sec-title", {}, `${s.label} colours`),
        el("button.el-seeall", { type: "button", title: "Back to the original colours", on: { click: () => { busy = busy.then(() => applyScene(app, s.key)).then(paintScene); } } }, "Reset")),
      el("div.el-scene-cols", {}, s.colors.map((c) => el("div.el-scene-col", {}, colorButton({ value: colors[c.id], title: c.label, onChange: (v, done) => {
        if (typeof v !== "string") return;
        colors = { ...colors, [c.id]: v };
        const snap = colors;
        editingUntil = performance.now() + (done ? 400 : 1500);
        busy = busy.then(() => applyScene(app, s.key, snap, { commit: false })).then(() => sceneCommit(done));
      } }), el("span", {}, c.label)))),
      el("button.btn.small.el-danger", { type: "button", on: { click: () => { removeBackgroundImage(app); paintScene(); paintImage(); } } }, icon("ImageOff", 15), "Remove this background"),
    );
  };
  const sceneTile = (s) => {
    const img = el("img", { alt: "", draggable: "false" });
    const b = el("button.el-scene", { type: "button", "aria-label": `Use the ${s.label} background`, dataset: { key: s.key },
      on: { click: async () => { hidePeek(); await applyScene(app, s.key); paintScene(); paintImage(); } } }, img, el("span", {}, s.label));
    requestAnimationFrame(() => { try { img.src = sceneThumb(s.key); } catch { img.alt = s.label; } });
    peek(b, () => ({ title: s.label, hint: "Click to use it. Change its colours after.", html: el("img", { src: sceneThumb(s.key, 384, 240), alt: "" }) }));
    return b;
  };
  const sceneGroup = (group, limit) => {
    const all = SCENES.filter((s) => s.group === group);
    const grid = el("div.el-scene-grid", {}, all.slice(0, limit).map(sceneTile));
    const more = all.length > limit ? el("button.el-seeall", { type: "button", on: { click: () => {
      grid.replaceChildren(...all.map(sceneTile));
      more.remove();
      paintScene();
    } } }, `See all ${all.length}`, icon("ChevronDown", 14)) : null;
    return el("section.el-sec", {}, el("div.el-sec-head", {}, el("h4.sec-title", {}, group), more), grid);
  };

  box.classList.add("el-panel");
  box.append(
    el("section.el-sec", {}, el("div.el-bg-cur", {}, curBtn, el("div", {}, el("b", {}, "Page colour"), curLabel))),
    el("section.el-sec", {}, sceneBox),
    sceneGroup("Scenes", 6),
    sceneGroup("Patterns", 6),
    el("section.el-sec", {}, el("h4.sec-title", {}, "Colours"), el("div.el-bg-grid", {}, SOLIDS.map((c) => sw(c, c)))),
    el("section.el-sec", {}, el("h4.sec-title", {}, "Gradients"), el("div.el-bg-grid.big", {}, GRADIENT_PRESETS.map((g) => sw(g, g.type === "radial" ? "Radial gradient" : "Gradient")))),
    el("section.el-sec", {}, el("h4.sec-title", {}, "Make a gradient"), editor.node),
    el("section.el-sec", {}, el("h4.sec-title", {}, "Background image"), imgBox),
  );
  const v0 = current();
  if (typeof v0 === "object") editor.load(v0);
  paintCurrent();
  paintImage();
  paintScene();
  const offs = [
    app.bus.on("history", () => { paintCurrent(); paintImage(); paintScene(true); }),
    onUploadsChanged(paintImage),
  ];
  return () => { offs.forEach((f) => f()); hidePeek(); };
}

/** Edit a gradient: type, angle and 2–6 colour stops. onChange(value, done). */
function gradientEditor(onChange) {
  let g = lin(135, "#8c52ff", "#ff66c4");
  const preview = el("div.el-grad-preview");
  const rows = el("div.el-grad-stops");
  const angle = el("div");
  const typeSeg = el("div");
  const emit = (done) => {
    const out = { ...g, stops: sortStops(g.stops) };
    preview.style.background = cssFill(out);
    onChange(out, done);
  };
  const paint = () => {
    preview.style.background = cssFill({ ...g, stops: sortStops(g.stops) });
    typeSeg.replaceChildren(segmented([{ value: "linear", label: "Linear" }, { value: "radial", label: "Radial" }], g.type, (t) => {
      g = t === "radial" ? { type: "radial", stops: g.stops } : { type: "linear", angle: g.angle ?? 135, stops: g.stops };
      paint();
      emit(true);
    }, "Gradient type"));
    angle.replaceChildren(g.type === "linear" ? slider({ label: "Angle", min: 0, max: 360, value: g.angle ?? 135, unit: "°",
      onInput: (v) => { g = { ...g, angle: v }; emit(false); }, onChange: (v) => { g = { ...g, angle: v }; emit(true); } }) : el("span"));
    rows.replaceChildren(...g.stops.map((s, i) => el("div.el-grad-stop", {},
      colorButton({ value: s.color, title: `Colour ${i + 1}`, onChange: (v, done) => {
        if (typeof v !== "string") return;
        g = { ...g, stops: g.stops.map((x, j) => (j === i ? { ...x, color: v } : x)) };
        emit(done);
      } }),
      slider({ label: "Position", min: 0, max: 100, value: Math.round(s.offset * 100), unit: "%",
        onInput: (v) => { g = { ...g, stops: g.stops.map((x, j) => (j === i ? { ...x, offset: v / 100 } : x)) }; emit(false); },
        onChange: () => { g = { ...g, stops: sortStops(g.stops) }; paint(); emit(true); } }),
      g.stops.length > 2 ? el("button.ibtn", { type: "button", title: "Remove this colour", "aria-label": "Remove this colour",
        on: { click: () => { g = { ...g, stops: g.stops.filter((_, j) => j !== i) }; paint(); emit(true); } } }, icon("X", 15)) : el("span.el-grad-gap"))));
  };
  const add = el("button.btn.small", { type: "button", on: { click: () => {
    if (g.stops.length >= 6) return toast("Six colours is the most a gradient can have here.");
    const last = g.stops[g.stops.length - 1];
    const prev = g.stops[g.stops.length - 2];
    const mid = { offset: (last.offset + prev.offset) / 2, color: mainColor(last.color) };
    g = { ...g, stops: sortStops([...g.stops, mid]) };
    paint();
    emit(true);
  } } }, icon("Plus", 15), "Add colour");
  const node = el("div.el-grad", {}, preview, typeSeg, angle, rows, el("div.row", {}, add));
  paint();
  return {
    node,
    load(v) { if (v && typeof v === "object") { g = JSON.parse(JSON.stringify(v)); paint(); } },
  };
}

const sortStops = (stops) => [...stops].sort((a, b) => a.offset - b.offset);
