// Fill values: the kit's colour values (a CSS colour or {type:"linear", angle, stops}) and our
// radial variant ({type:"radial", stops}) turned into Fabric fills and back.
import { Gradient } from "fabric";

const isGrad = (v) => v && typeof v === "object" && (v.type === "linear" || v.type === "radial");

/** A kit colour value to a Fabric fill (a string or a Gradient in percentage units). */
export function toFabricFill(value) {
  if (!isGrad(value)) return value || "transparent";
  const colorStops = value.stops.map((s) => ({ offset: s.offset, color: s.color }));
  if (value.type === "radial") {
    return new Gradient({
      type: "radial", gradientUnits: "percentage", colorStops,
      coords: { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.72 },
    });
  }
  const a = ((value.angle ?? 90) * Math.PI) / 180;
  const dx = Math.sin(a), dy = -Math.cos(a);
  const half = (Math.abs(dx) + Math.abs(dy)) / 2; // like CSS: the line reaches the corners
  return new Gradient({
    type: "linear", gradientUnits: "percentage", colorStops,
    coords: { x1: 0.5 - dx * half, y1: 0.5 - dy * half, x2: 0.5 + dx * half, y2: 0.5 + dy * half },
  });
}

/** A Fabric fill back to a kit colour value, so pickers can show and edit it. */
export function fromFabricFill(fill) {
  if (!fill) return "transparent";
  if (typeof fill === "string") return fill;
  const stops = (fill.colorStops || [])
    .map((s) => ({ offset: s.offset, color: s.opacity != null && s.opacity < 1 ? withAlpha(s.color, s.opacity) : s.color }))
    .sort((a, b) => a.offset - b.offset);
  if (!stops.length) return "transparent";
  if (fill.type === "radial") return { type: "radial", stops };
  const c = fill.coords || {};
  const angle = Math.round((Math.atan2((c.x2 ?? 1) - (c.x1 ?? 0), -((c.y2 ?? 0) - (c.y1 ?? 0))) * 180) / Math.PI);
  return { type: "linear", angle: (angle + 360) % 360, stops };
}

function withAlpha(color, opacity) {
  const m = /^#([0-9a-f]{6})$/i.exec(color || "");
  if (!m) return color;
  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`;
}

/** CSS for any fill value, including radial (the kit's cssOf only knows linear). */
export function cssFill(v) {
  if (!v) return "transparent";
  if (typeof v === "string") return v;
  const stops = v.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(", ");
  if (v.type === "radial") return `radial-gradient(circle at 50% 50%, ${stops})`;
  return `linear-gradient(${v.angle ?? 90}deg, ${stops})`;
}

/** The kit picker only edits linear gradients: give it a linear stand-in for a radial fill. */
export function forPicker(v) {
  if (v && typeof v === "object" && v.type === "radial") return { type: "linear", angle: 90, stops: v.stops };
  return v;
}

/** One representative solid colour of a fill value (for swatches and icons). */
export function mainColor(v) {
  if (!v) return "#000000";
  if (typeof v === "string") return v;
  return v.stops?.[0]?.color || "#000000";
}

/** Relative brightness 0..1 of a CSS hex colour (anything else counts as light). */
export function brightness(color) {
  const m = /^#?([0-9a-f]{6})/i.exec(String(color || "").trim());
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

/** True when the page looks dark (its colour, gradient or scene background), so new graphics pick light ink. */
export function pageIsDark(app) {
  const ed = app.editor;
  const bg = ed.objects().find((o) => o.isBg);
  if (bg?.data?.scene?.colors) return brightness(Object.values(bg.data.scene.colors)[0]) < 0.42;
  const v = ed.page?.data?.fill ?? fromFabricFill(ed.page?.fill);
  return brightness(mainColor(v)) < 0.42;
}
