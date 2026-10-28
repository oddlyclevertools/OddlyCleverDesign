// The platform safe zones (Shorts buttons, caption area…) drawn over the playing preview, so
// captions and titles can be checked against them while the video plays. It follows the
// studio's "Show safe zones" switch (one setting for the editor and the preview) and has its
// own button on the preview. Never part of an export.
import { el, icon } from "../../ui/kit.js";
import { autoKind, drawZones, zonesFor } from "../studio/zones.js";

const OWN_KEY = "vd-preview-zones";

export function createZoneLayer(app) {
  const ed = app.editor;
  const canvas = el("canvas.vd-zones", { "aria-hidden": "true" });
  const button = el("button.vd-zones-btn", { type: "button" }, icon("Frame", 15), el("span", {}, "Safe zones"));
  let own = (() => { try { return localStorage.getItem(OWN_KEY) === "1"; } catch { return false; } })();
  const studio = () => app.studio?.overlay || null;
  const isOn = () => (studio() ? studio().on : own);
  const kind = () => (studio() ? studio().kind() : autoKind(ed.width, ed.height));
  let size = { w: 0, h: 0 };

  let listening = false, last = "";
  /** Draw at the preview's size (in CSS px); skipped when nothing changed unless `force`. */
  function paint(w = size.w, h = size.h, force = false) {
    size = { w, h };
    if (!listening && studio()?.onChange) { listening = true; studio().onChange(() => paint(size.w, size.h, true)); }
    const on = isOn();
    const key = `${w}x${h}|${on}|${kind()}|${ed.width}x${ed.height}`;
    if (key === last && !force) return;
    last = key;
    button.classList.toggle("on", on);
    button.title = on ? "Hide the safe zones on the preview" : "Show the platform's safe zones on the preview";
    button.setAttribute("aria-pressed", String(on));
    canvas.hidden = !on;
    if (!on || !w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const set = zonesFor(kind(), ed.width, ed.height);
    if (!set) return;
    const z = (w / ed.width) * dpr;
    drawZones(ctx, set, [z, 0, 0, z, 0, 0]);
  }

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    if (studio()) studio().toggle();
    else {
      own = !own;
      try { localStorage.setItem(OWN_KEY, own ? "1" : "0"); } catch { /* private mode */ }
    }
    paint(size.w, size.h, true);
  });
  return { canvas, button, paint };
}
