// The chart editor popover: type, rows (label, value, colour), palettes and display options.
// Every change rebuilds the chart in place; typing and slider drags merge into one undo step.
import { colorButton, el, icon, slider, toggle, select, toast } from "../../ui/kit.js";
import { CHART_FONTS, PALETTES, updateChart } from "./charts.js";
import { segmented } from "./controls.js";

const SERIES = [
  { value: "bar", label: "Bars", icon: "ChartColumn" }, { value: "hbar", label: "Rows", icon: "ChartBar" },
  { value: "line", label: "Line", icon: "ChartLine" }, { value: "pie", label: "Pie", icon: "ChartPie" },
  { value: "donut", label: "Donut", icon: "Donut" },
];
const GAUGES = [{ value: "progress", label: "Bar", icon: "Minus" }, { value: "ring", label: "Ring", icon: "CircleDashed" }];
const MAX_ROWS = 12;

/**
 * @param {*} app
 * @param {import("fabric").Group} group the chart
 */
export function chartEditor(app, group) {
  let g = group;
  let queue = Promise.resolve();
  const ch = () => g.data.chart;

  /** Rebuild with a patch. merge: part of a drag or typing burst. */
  const apply = (patch, { merge = false, repaint = false } = {}) => {
    queue = queue.then(async () => {
      try {
        g = await updateChart(app, g, patch);
        app.editor.commit("Edit chart", { merge });
        if (repaint) paint();
      } catch (e) {
        toast(`Couldn't update the chart: ${e.message}`, { error: true });
      }
    });
    return queue;
  };

  const body = el("div.el-chart-body");
  const root = el("div.el-pop.el-chart-pop", {}, el("div.el-pop-head", {}, el("h4.el-pop-title", {}, "Edit chart"),
    el("span.el-hint", {}, "Changes show on the page")), body);

  function rowsEditor() {
    const list = el("div.el-chart-rows");
    const rows = ch().rows || [];
    rows.forEach((r, i) => {
      const setRow = (patch, opts) => apply({ rows: ch().rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }, opts);
      list.append(el("div.el-chart-row", {},
        colorButton({ value: r.color, title: `Colour of ${r.label || "row " + (i + 1)}`, onChange: (v, done) => typeof v === "string" && setRow({ color: v }, { merge: !done }) }),
        el("input.el-chart-in", { type: "text", value: r.label, "aria-label": `Label ${i + 1}`, placeholder: "Label",
          on: { input: (e) => setRow({ label: e.target.value }, { merge: true }) } }),
        el("input.el-chart-in.num", { type: "number", value: r.value, step: "any", "aria-label": `Value ${i + 1}`,
          on: { input: (e) => e.target.value !== "" && setRow({ value: Number(e.target.value) }, { merge: true }) } }),
        el("button.ibtn", { type: "button", title: "Remove this row", "aria-label": "Remove this row", disabled: rows.length <= 1,
          on: { click: () => apply({ rows: ch().rows.filter((_, j) => j !== i) }, { repaint: true }) } }, icon("X", 15))));
    });
    const add = el("button.btn.small", { type: "button", on: { click: () => {
      const cur = ch().rows;
      if (cur.length >= MAX_ROWS) return toast(`A chart can have up to ${MAX_ROWS} rows.`);
      const pal = PALETTES.brand;
      apply({ rows: [...cur, { label: `Item ${cur.length + 1}`, value: Math.round((cur.at(-1)?.value || 10) * 0.8), color: pal[cur.length % pal.length] }] }, { repaint: true });
    } } }, icon("Plus", 15), "Add row");
    const pals = el("div.el-chart-pals", {}, Object.entries(PALETTES).map(([name, cols]) => el("button.el-chart-pal", {
      type: "button", title: `${name[0].toUpperCase()}${name.slice(1)} colours`, "aria-label": `Use ${name} colours`,
      on: { click: () => apply({ rows: ch().rows.map((r, i) => ({ ...r, color: cols[i % cols.length] })) }, { repaint: true }) },
    }, cols.slice(0, 4).map((c) => el("i", { style: { background: c } })))));
    return [el("div.el-field", {}, el("span", {}, "Data")), list, el("div.row.el-chart-tools", {}, add, pals)];
  }

  function gaugeEditor() {
    const c = ch();
    return [
      slider({ label: "Value", min: 0, max: 100, value: Number(c.value) || 0, unit: "%",
        onInput: (v) => apply({ value: v }, { merge: true }), onChange: (v) => apply({ value: v }) }),
      el("label.el-field", {}, el("span", {}, "Label"), el("input.el-chart-in.wide", { type: "text", value: c.label || "", "aria-label": "Label",
        on: { input: (e) => apply({ label: e.target.value }, { merge: true }) } })),
      el("div.el-field", {}, el("span", {}, "Colour"), colorButton({ value: c.color, title: "Bar colour", onChange: (v, done) => typeof v === "string" && apply({ color: v }, { merge: !done }) })),
      el("div.el-field", {}, el("span", {}, "Track"), colorButton({ value: c.track, title: "Track colour", onChange: (v, done) => typeof v === "string" && apply({ track: v }, { merge: !done }) })),
    ];
  }

  function statEditor() {
    const c = ch();
    return [
      el("label.el-field", {}, el("span", {}, "Number"), el("input.el-chart-in.wide", { type: "text", value: c.number || "", "aria-label": "Big number",
        on: { input: (e) => apply({ number: e.target.value }, { merge: true }) } })),
      el("label.el-field", {}, el("span", {}, "Caption"), el("input.el-chart-in.wide", { type: "text", value: c.label || "", "aria-label": "Caption",
        on: { input: (e) => apply({ label: e.target.value }, { merge: true }) } })),
      el("div.el-field", {}, el("span", {}, "Colour"), colorButton({ value: c.color, title: "Number colour", onChange: (v, done) => typeof v === "string" && apply({ color: v }, { merge: !done }) })),
    ];
  }

  function paint() {
    const c = ch();
    const isSeries = SERIES.some((s) => s.value === c.type);
    const isGauge = GAUGES.some((s) => s.value === c.type);
    body.replaceChildren(...[
      isSeries ? segmented(SERIES.map((s) => ({ ...s, text: null })), c.type, (v) => apply({ type: v }, { repaint: true }), "Chart type") : null,
      isGauge ? segmented(GAUGES, c.type, (v) => apply({ type: v }, { repaint: true }), "Progress style") : null,
      ...(isSeries ? rowsEditor() : isGauge ? gaugeEditor() : statEditor()),
      el("div.el-chart-opts", {},
        toggle({ label: "Values", value: c.showValues, onChange: (v) => apply({ showValues: v }) }),
        toggle({ label: c.type === "stat" ? "Caption" : "Labels", value: c.showLabels, onChange: (v) => apply({ showLabels: v }) }),
        isSeries ? toggle({ label: "Outline", value: c.outline, onChange: (v) => apply({ outline: v }) }) : null),
      el("div.el-field", {}, el("span", {}, "Text colour"), el("div.row", {},
        el("button.el-chip", { type: "button", title: "Dark text (for light pages)", on: { click: () => apply({ ink: "#16121b" }, { repaint: true }) } }, "Dark"),
        el("button.el-chip", { type: "button", title: "Light text (for dark pages)", on: { click: () => apply({ ink: "#fbf7ee" }, { repaint: true }) } }, "Light"),
        colorButton({ value: c.ink, title: "Text colour", onChange: (v, done) => typeof v === "string" && apply({ ink: v }, { merge: !done }) }))),
      el("div.el-field", {}, el("span", {}, "Font"), select({ value: c.font, title: "Chart font",
        options: CHART_FONTS.map((f) => ({ value: f, label: f })), onChange: (v) => apply({ font: v }) })),
    ].filter(Boolean));
  }
  paint();
  return root;
}
