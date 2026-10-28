// Picture-in-picture: a video clip shown as an object on the design. The object (VdVideo) is a
// rect that saves only its position, size, corners and data.vdClip (the clip id); each time it
// is drawn it asks its canvas for the clip's frame at the current time:
//   canvas.__vdPip(clipId) -> a video/canvas to draw, null (hidden right now) or undefined
//   (not loaded yet: draw a placeholder). The editor canvas uses the edit provider below.
import { Rect, classRegistry } from "fabric";

let editProvider = null;
/** Set what the editor canvas shows inside picture-in-picture objects. */
export function setEditProvider(fn) { editProvider = fn; }

/** Draw `src` to fill (cover) or fit inside (contain) the box x, y, w, h. */
export function drawFitted(ctx, src, x, y, w, h, fit = "cover") {
  const sw = src.videoWidth || src.displayWidth || src.width, sh = src.videoHeight || src.displayHeight || src.height;
  if (!sw || !sh) return;
  const k = fit === "contain" ? Math.min(w / sw, h / sh) : Math.max(w / sw, h / sh);
  const dw = sw * k, dh = sh * k;
  ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export class VdVideo extends Rect {
  static type = "VdVideo";

  /** Every draw shows a new video frame, so it is never cached. */
  shouldCache() {
    this.ownCaching = false;
    return false;
  }

  /** The clip this object shows. */
  get clipId() { return this.data?.vdClip || null; }

  _render(ctx) {
    const w = this.width, h = this.height, x = -w / 2, y = -h / 2;
    const prov = this.canvas?.__vdPip || editProvider;
    let src;
    try { src = prov ? prov(this.clipId) : undefined; } catch { src = undefined; }
    if (src === null) return; // the clip isn't playing at this moment
    ctx.save();
    const r = Math.min(this.rx || 0, w / 2, h / 2);
    ctx.beginPath();
    if (r > 0) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.clip();
    if (src) {
      ctx.fillStyle = "#000";
      ctx.fillRect(x, y, w, h);
      drawFitted(ctx, src, x, y, w, h, this.data?.vdFit || "cover");
    } else {
      placeholder(ctx, x, y, w, h);
    }
    ctx.restore();
  }
}
classRegistry.setClass(VdVideo);

function placeholder(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#2a2132");
  g.addColorStop(1, "#140c0f");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const s = Math.min(w, h) * 0.18;
  ctx.fillStyle = "rgba(255, 46, 126, 0.9)";
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - s * 0.45, y + h / 2 - s * 0.6);
  ctx.lineTo(x + w / 2 + s * 0.65, y + h / 2);
  ctx.lineTo(x + w / 2 - s * 0.45, y + h / 2 + s * 0.6);
  ctx.closePath();
  ctx.fill();
}

/** The picture-in-picture objects of a canvas (or a list of objects). */
export function pipObjects(objects) {
  const out = [];
  const walk = (o) => {
    if (o instanceof VdVideo || o?.type === "VdVideo") out.push(o);
    o?._objects?.forEach(walk);
  };
  objects.forEach(walk);
  return out;
}

/** Clip ids shown as picture-in-picture in a saved design JSON. */
export function pipIdsInDoc(doc) {
  const ids = new Set();
  const walk = (o) => {
    if (o?.type === "VdVideo" && o.data?.vdClip) ids.add(o.data.vdClip);
    o?.objects?.forEach?.(walk);
  };
  (doc?.canvas?.objects || []).forEach(walk);
  return ids;
}
