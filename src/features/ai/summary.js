// A short, plain-text summary of the open design for the AI's system prompt. It is data about the
// page, not instructions; the AI can ask for more with the toolkit's own tools.
const MAX_OBJECTS = 40;
const MAX_TEXT = 70;

const r = (n) => Math.round(Number(n) || 0);

function colour(fill) {
  if (typeof fill === "string") return fill;
  if (fill && typeof fill === "object" && Array.isArray(fill.colorStops)) return "gradient";
  return "";
}

function describe(o, i) {
  const b = o.getBoundingRect ? o.getBoundingRect() : { left: o.left, top: o.top, width: o.width, height: o.height };
  const kind = o.type || "object";
  const parts = [`${i}. ${kind}`];
  if (o.name) parts.push(`"${String(o.name).slice(0, 40)}"`);
  if (o.id) parts.push(`id=${o.id}`);
  if (typeof o.text === "string") {
    const t = o.text.replace(/\s+/g, " ").trim();
    parts.push(`text="${t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT)}…` : t}"`);
    if (o.fontFamily) parts.push(`${o.fontFamily} ${r(o.fontSize)}px`);
  }
  const c = colour(o.fill);
  if (c) parts.push(`fill ${c}`);
  parts.push(`at ${r(b.left)},${r(b.top)} size ${r(b.width)}×${r(b.height)}`);
  if (o.angle) parts.push(`rotated ${r(o.angle)}°`);
  if (typeof o.opacity === "number" && o.opacity < 1) parts.push(`opacity ${o.opacity.toFixed(2)}`);
  if (o.locked) parts.push("locked");
  if (o.isBg) parts.push("background image");
  return parts.join(" ");
}

/** @returns {string} */
export function designSummary(app) {
  const ed = app.editor;
  if (!ed?.page) return "No design is open.";
  const objects = ed.objects();
  const lines = [
    `Design "${app.project?.name || "Untitled"}": page ${ed.width}×${ed.height} px, background ${colour(ed.page.fill) || "white"}.`,
    objects.length ? `${objects.length} object${objects.length === 1 ? "" : "s"}, back to front:` : "The page is empty.",
  ];
  objects.slice(0, MAX_OBJECTS).forEach((o, i) => lines.push(describe(o, i + 1)));
  if (objects.length > MAX_OBJECTS) lines.push(`…and ${objects.length - MAX_OBJECTS} more.`);
  const sel = ed.selection();
  if (sel.length) lines.push(`Selected: ${sel.map((o) => o.name || o.id || o.type).slice(0, 10).join(", ")}.`);
  return lines.join("\n");
}
