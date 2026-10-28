// The whole edge of a cut-out at once, on the GPU (Fabric's WebGL filter backend): shrink or grow
// it (to drop a thin halo of old background, or win back a lost rim) and soften (feather) it.
// Works on an alpha mask: a canvas that is white where the picture shows.
import { FabricImage, classRegistry, filters as F } from "fabric";
import { ensureGpuFilters } from "../elements/filters.js";

const MORPH_GLSL = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uDelta;
  uniform float uSteps;
  uniform float uGrow;
  varying vec2 vTexCoord;
  void main() {
    float a = texture2D(uTexture, vTexCoord).a;
    for (float i = 1.0; i <= 48.0; i++) {
      if (i > uSteps) break;
      float s1 = texture2D(uTexture, vTexCoord + uDelta * i).a;
      float s2 = texture2D(uTexture, vTexCoord - uDelta * i).a;
      a = uGrow > 0.0 ? max(a, max(s1, s2)) : min(a, min(s1, s2));
    }
    gl_FragColor = vec4(1.0, 1.0, 1.0, a);
  }
`;

/** Grow (radius > 0) or shrink (radius < 0) the opaque area by `radius` pixels: two passes, across then down. */
export class OcMorph extends F.BaseFilter {
  static type = "OcMorph";
  static defaults = { radius: 0 };
  static uniformLocations = ["uDelta", "uSteps", "uGrow"];

  getFragmentSource() { return MORPH_GLSL; }
  isNeutralState() { return !this.radius; }

  applyTo(options) {
    if (!options.webgl) { this.applyTo2d(options); return; }
    this._size = [options.sourceWidth, options.sourceHeight];
    options.passes++;
    for (const across of [true, false]) {
      this._setupFrameBuffer(options);
      this.across = across;
      this.applyToWebGL(options);
      this._swapTextures(options);
    }
  }

  sendUniformData(gl, loc) {
    const r = Math.abs(this.radius), steps = Math.min(48, Math.max(1, Math.ceil(r))), step = r / steps;
    const [w, h] = this._size;
    gl.uniform2fv(loc.uDelta, this.across ? [step / w, 0] : [0, step / h]);
    gl.uniform1f(loc.uSteps, steps);
    gl.uniform1f(loc.uGrow, this.radius > 0 ? 1 : -1);
  }

  applyTo2d({ imageData: { data, width, height } }) {
    const r = Math.round(Math.abs(this.radius)), grow = this.radius > 0;
    const a = new Uint8ClampedArray(width * height);
    for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3];
    const pass = (src, across) => {
      const out = new Uint8ClampedArray(src.length);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let v = src[y * width + x];
          for (let k = -r; k <= r; k++) {
            const xx = across ? Math.min(width - 1, Math.max(0, x + k)) : x, yy = across ? y : Math.min(height - 1, Math.max(0, y + k));
            const s = src[yy * width + xx];
            v = grow ? Math.max(v, s) : Math.min(v, s);
          }
          out[y * width + x] = v;
        }
      }
      return out;
    };
    const res = pass(pass(a, true), false);
    for (let i = 0; i < res.length; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 255; data[i * 4 + 3] = res[i]; }
  }
}
classRegistry.setClass(OcMorph);

/**
 * The mask with its whole edge moved by `shift` pixels (+ grows, - shrinks) and softened by
 * `feather` pixels. Returns a new canvas (or the same one when there's nothing to do).
 * @param {HTMLCanvasElement} alpha
 * @param {{shift?: number, feather?: number}} opts
 * @returns {HTMLCanvasElement}
 */
export function refineEdge(alpha, { shift = 0, feather = 0 } = {}) {
  if (!shift && !feather) return alpha;
  ensureGpuFilters();
  const tmp = new FabricImage(alpha);
  tmp.filters = [
    shift ? new OcMorph({ radius: shift }) : null,
    feather > 0 ? new F.Blur({ blur: feather / Math.min(alpha.width, alpha.height) }) : null,
  ].filter(Boolean);
  tmp.applyFilters();
  const out = document.createElement("canvas");
  out.width = alpha.width;
  out.height = alpha.height;
  out.getContext("2d").drawImage(tmp.getElement(), 0, 0, out.width, out.height);
  tmp.dispose?.();
  return out;
}
