// Toolbars for shapes, lines, icons and stickers.
import { closePopover, colorButton, el, popover, slider, toHex } from "../../ui/kit.js";
import { registerTool } from "../../ui/shell.js";
import { forPicker, fromFabricFill, toFabricFill } from "./fill.js";
import { OcLine, CAPS, CAP_LABELS } from "./lines.js";
import { groupColors, replaceGroupColor } from "./vector.js";
import { applyMask, createFrame } from "./images.js";
import { shapeKeyOf } from "./shapes.js";
import { dashArray, dashOptions, segmented, setSlider, shadowButton, tbtn, throttledCommit } from "./controls.js";
import { cropState } from "./crop.js";

const SHAPE_TYPES = new Set(["rect", "circle", "ellipse", "triangle", "polygon", "path"]);
const helper = (o) => Boolean(o?.data?.cropUI || o?.excludeFromExport);

export const isShape = (o) => !helper(o) && !o.isPage && !o.isBg && !(o instanceof OcLine)
  && (o.data?.kind === "shape" || (SHAPE_TYPES.has(o.type) && !o.data?.kind));
export const isLine = (o) => o instanceof OcLine;
const VECTOR_KINDS = new Set(["icon", "sticker", "illustration", "decor"]);
export const isVector = (o) => o?.type === "group" && VECTOR_KINDS.has(o.data?.kind);

const all = (sel, fn) => sel.length > 0 && sel.every(fn);
const idle = () => !cropState();

// ---- shapes -----------------------------------------------------------------------------

function fillControl(app, objs) {
  const commit = throttledCommit(app, "Fill", 200);
  return colorButton({
    value: forPicker(fromFabricFill(objs[0].fill)), gradient: true, title: "Fill colour",
    onChange: (v, done) => {
      for (const o of objs) { o.set("fill", toFabricFill(v)); o.set("dirty", true); }
      app.editor.canvas.requestRenderAll();
      commit(done);
    },
  });
}

function borderPanel(app, objs) {
  const o = objs[0];
  const st = { color: typeof o.stroke === "string" && o.stroke ? o.stroke : "#1b1b1f", width: o.strokeWidth && o.stroke ? o.strokeWidth : 0, style: o.data?.borderStyle || "solid" };
  const commit = throttledCommit(app, "Border", 200);
  const apply = (done) => {
    for (const x of objs) {
      x.set({
        stroke: st.width > 0 ? st.color : null, strokeWidth: st.width, strokeUniform: true,
        strokeDashArray: dashArray(st.style, st.width), strokeLineCap: st.style === "dotted" ? "round" : "butt",
        strokeLineJoin: "round", data: { ...(x.data || {}), borderStyle: st.style },
      });
      x.set("dirty", true);
      x.setCoords();
    }
    app.editor.canvas.requestRenderAll();
    commit(done);
  };
  const weight = slider({ label: "Weight", min: 0, max: 60, value: st.width, onInput: (v) => { st.width = v; apply(false); }, onChange: (v) => { st.width = v; apply(true); } });
  const ensureWidth = () => { if (!st.width) { st.width = 6; setSlider(weight, 6); } };
  return el("div.el-pop", {},
    el("h4.el-pop-title", {}, "Border"),
    segmented(dashOptions(), st.style, (v) => { st.style = v; ensureWidth(); apply(true); }, "Border style"),
    weight,
    el("div.el-field", {}, el("span", {}, "Colour"), colorButton({
      value: st.color, title: "Border colour",
      onChange: (v, done) => { if (typeof v !== "string") return; st.color = v; ensureWidth(); apply(done); },
    })),
  );
}

function cornerPanel(app, rects) {
  const r0 = rects[0].data?.radius ?? Math.round((rects[0].rx || 0) * rects[0].scaleX);
  const max = Math.round(Math.max(...rects.map((r) => Math.min(r.getScaledWidth(), r.getScaledHeight()) / 2)));
  const commit = throttledCommit(app, "Corners", 200);
  const apply = (v, done) => {
    for (const r of rects) {
      r.set({ rx: v / r.scaleX, ry: v / r.scaleY, data: { ...(r.data || {}), radius: v } });
      r.set("dirty", true);
    }
    app.editor.canvas.requestRenderAll();
    commit(done);
  };
  return el("div.el-pop", {}, el("h4.el-pop-title", {}, "Corner rounding"),
    slider({ label: "Radius", min: 0, max, value: Math.min(r0, max), unit: "px", onInput: (v) => apply(v, false), onChange: (v) => apply(v, true) }));
}

/** Swap a shape for an empty frame of the same outline and size. */
function turnIntoFrame(app, shape) {
  const key = shapeKeyOf(shape) || (shape.type === "circle" ? "circle" : "rect");
  const ed = app.editor, c = ed.canvas;
  const w = shape.width * shape.scaleX, h = (shape.height || shape.width) * shape.scaleY;
  const frame = createFrame(key, { w, h });
  if (key === "roundRect" || key === "rect") frame.set("data", { ...frame.data, mask: { shape: "roundRect", radius: shape.data?.radius || 0 } });
  frame.set({ angle: shape.angle, flipX: shape.flipX, flipY: shape.flipY, id: shape.id, name: "Frame" });
  frame.setPositionByOrigin(shape.getCenterPoint(), "center", "center");
  applyMask(frame);
  const i = c.getObjects().indexOf(shape);
  c.remove(shape);
  c.insertAt(i, frame);
  frame.setCoords();
  c.setActiveObject(frame);
  c.requestRenderAll();
  ed.commit("Turn into frame");
}

registerTool({
  id: "el-shape", order: 31,
  match: (sel) => idle() && all(sel, isShape),
  render(app, sel) {
    const rects = sel.filter((o) => o.type === "rect");
    const bb = tbtn("SquareDashed", "Border", () => popover(bb, borderPanel(app, sel), { cls: "el-popover" }), { on: sel.some((o) => o.stroke && o.strokeWidth) });
    const cb = rects.length === sel.length ? tbtn("SquareRoundCorner", "Corner rounding", () => popover(cb, cornerPanel(app, rects), { cls: "el-popover" })) : null;
    const frame = sel.length === 1 && shapeKeyOf(sel[0]) ? tbtn("Frame", "Turn into a frame (holds a photo)", () => turnIntoFrame(app, sel[0])) : null;
    return el("div.tgroup", {}, fillControl(app, sel), bb, cb, shadowButton(app, sel), frame);
  },
});

// ---- lines ------------------------------------------------------------------------------

function capIcon(cap, end) {
  const flip = end ? "" : ` transform="scale(-1 1) translate(-36 0)"`;
  const heads = {
    none: "", arrow: `<path d="M24 5 L31 10 L24 15" fill="none"/>`, triangle: `<path d="M23 4 L33 10 L23 16 Z" class="f"/>`,
    circle: `<circle cx="29" cy="10" r="4.5" class="f"/>`, square: `<rect x="25" y="6" width="8" height="8" class="f"/>`,
    diamond: `<path d="M29 4.5 L34.5 10 L29 15.5 L23.5 10 Z" class="f"/>`, bar: `<path d="M31 3.5 L31 16.5"/>`,
  };
  const s = el("span.el-cap");
  s.innerHTML = `<svg viewBox="0 0 36 20" width="36" height="20" aria-hidden="true"><g${flip}><path d="M3 10 L${cap === "none" ? 33 : 26} 10"/>${heads[cap] || ""}</g></svg>`;
  return s;
}

function capPicker(app, lines, which) {
  const prop = which === "start" ? "startCap" : "endCap";
  const btn = el("button.el-tbtn.el-capbtn", { type: "button", title: which === "start" ? "Line start" : "Line end", "aria-label": which === "start" ? "Line start" : "Line end" },
    capIcon(lines[0][prop], which === "end"));
  btn.addEventListener("click", () => popover(btn, el("div.el-pop.el-caps", {}, el("h4.el-pop-title", {}, which === "start" ? "Start" : "End"),
    el("div.el-cap-grid", {}, CAPS.map((c) => el("button.el-cap-opt", {
      type: "button", title: CAP_LABELS[c], "aria-label": CAP_LABELS[c], class: lines[0][prop] === c ? "on" : null,
      on: { click: () => { app.editor.update({ [prop]: c }, lines, "Line end"); app.refreshToolbar(); closePopover(); } },
    }, capIcon(c, which === "end"))))), { cls: "el-popover" }));
  return btn;
}

function lineWeight(app, lines) {
  const b = tbtn("PencilLine", "Line weight and style", () => popover(b, el("div.el-pop", {}, el("h4.el-pop-title", {}, "Line"),
    segmented(dashOptions(), lines[0].lineStyle || "solid", (v) => app.editor.update({ lineStyle: v }, lines, "Line style"), "Line style"),
    slider({ label: "Weight", min: 1, max: 60, value: lines[0].strokeWidth, unit: "px",
      onInput: (v) => app.editor.update({ strokeWidth: v }, lines, "Line weight", { merge: true }),
      onChange: (v) => app.editor.update({ strokeWidth: v }, lines, "Line weight") })), { cls: "el-popover" }));
  return b;
}

registerTool({
  id: "el-line", order: 33,
  match: (sel) => idle() && all(sel, isLine),
  render(app, sel) {
    const commit = throttledCommit(app, "Line colour", 200);
    const color = colorButton({
      value: sel[0].stroke, title: "Line colour",
      onChange: (v, done) => {
        if (typeof v !== "string") return;
        for (const l of sel) l.set("stroke", v);
        app.editor.canvas.requestRenderAll();
        commit(done);
      },
    });
    return el("div.tgroup", {}, color, lineWeight(app, sel), capPicker(app, sel, "start"), capPicker(app, sel, "end"), shadowButton(app, sel));
  },
});

// ---- icons and stickers: one tile per colour ---------------------------------------------

registerTool({
  id: "el-vector", order: 35,
  match: (sel) => idle() && sel.length === 1 && isVector(sel[0]),
  render(app, [g]) {
    const colors = groupColors(g).slice(0, g.data?.kind === "illustration" ? 8 : 6);
    const tiles = colors.map((c) => {
      let current = c;
      const commit = throttledCommit(app, "Colour", 200);
      return colorButton({
        value: c, title: g.data?.kind === "icon" ? "Icon colour" : "Colour",
        onChange: (v, done) => {
          if (typeof v !== "string") return;
          const next = toHex(v) || v;
          replaceGroupColor(g, current, next);
          current = next;
          if (g.data?.kind === "icon") g.set("data", { ...g.data, color: next });
          app.editor.canvas.requestRenderAll();
          commit(done);
        },
      });
    });
    return el("div.tgroup", {}, tiles, shadowButton(app, [g]));
  },
});

