// The page eyedropper: click anywhere on the design (or any other drawing on the page) to pick
// its colour. It reads the pixels of the canvas under the pointer, so it works in every browser,
// and a loupe shows the pixels around the pointer. Esc cancels.
import { el } from "./kit.js";

const ZOOM = 8, SPAN = 11; // the loupe shows 11 x 11 pixels, 8 x bigger

const hex2 = (n) => n.toString(16).padStart(2, "0");
let scratchCtx = null;
/** A 1 x 1 canvas made for reading back (so reads never slow the editor's own canvas down). */
const scratch = () => (scratchCtx ||= Object.assign(document.createElement("canvas"), { width: 1, height: 1 })
  .getContext("2d", { willReadFrequently: true }));

/** The canvas pixel under a screen point: { canvas, x, y } in canvas pixels, or null. */
function canvasAt(cx, cy) {
  for (const node of document.elementsFromPoint(cx, cy)) {
    if (node.tagName !== "CANVAS" || node.classList.contains("upper-canvas")) continue;
    const r = node.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const x = Math.floor(((cx - r.left) / r.width) * node.width), y = Math.floor(((cy - r.top) / r.height) * node.height);
    if (x < 0 || y < 0 || x >= node.width || y >= node.height) continue;
    try {
      const sc = scratch();
      sc.clearRect(0, 0, 1, 1);
      sc.drawImage(node, x, y, 1, 1, 0, 0, 1, 1);
      const [rr, g, b, a] = sc.getImageData(0, 0, 1, 1).data;
      if (a === 0) continue; // see-through here: look at what's underneath
      return { canvas: node, x, y, color: `#${hex2(rr)}${hex2(g)}${hex2(b)}` };
    } catch {
      continue; // a picture from another site makes a canvas unreadable
    }
  }
  return null;
}

/**
 * Let the user click a point on the page. Resolves "#rrggbb", or null when cancelled.
 * @param {{hint?: string}} [opts]
 */
export function pickFromPage({ hint = "Click on the design to pick a colour. Esc cancels." } = {}) {
  return new Promise((resolve) => {
    const layer = el("div.cp-eye-layer", { "aria-hidden": "true" });
    const zoom = el("canvas", { width: SPAN * ZOOM, height: SPAN * ZOOM });
    const chip = el("span.cp-loupe-chip");
    const label = el("span.cp-loupe-hex", {}, "–");
    const loupe = el("div.cp-loupe", {}, zoom, el("div.cp-loupe-foot", {}, chip, label));
    const tip = el("div.cp-eye-tip", { role: "status" }, hint);
    document.body.append(layer, loupe, tip);
    const zctx = zoom.getContext("2d");
    let last = null;

    const show = (e) => {
      loupe.style.transform = `translate(${Math.min(e.clientX + 18, innerWidth - 110)}px, ${Math.min(e.clientY + 18, innerHeight - 130)}px)`;
      last = canvasAt(e.clientX, e.clientY);
      zctx.clearRect(0, 0, zoom.width, zoom.height);
      if (!last) {
        label.textContent = "–";
        chip.style.background = "transparent";
        return;
      }
      zctx.imageSmoothingEnabled = false;
      const h = (SPAN - 1) / 2;
      zctx.drawImage(last.canvas, last.x - h, last.y - h, SPAN, SPAN, 0, 0, zoom.width, zoom.height);
      zctx.strokeStyle = "#fff";
      zctx.lineWidth = 2;
      zctx.strokeRect(h * ZOOM, h * ZOOM, ZOOM, ZOOM);
      label.textContent = last.color;
      chip.style.background = last.color;
    };
    const finish = (color) => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
      layer.remove();
      loupe.remove();
      tip.remove();
      resolve(color);
    };
    // Window-level capture listeners run first, so the click never reaches the canvas or closes
    // the colour popover.
    const move = (e) => show(e);
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      show(e);
      finish(last?.color || null);
    };
    const key = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      finish(null);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
  });
}
