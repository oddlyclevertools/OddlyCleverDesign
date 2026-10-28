// Photo filters and adjustments on the GPU (Fabric's WebGL filter backend on the fast graphics
// card; it falls back to canvas 2D only when WebGL is missing, and says so). The chosen settings
// live in obj.data.filters so they can be edited again:
// { preset, intensity (0-100), adjust: { exposure, brightness, contrast, ... } }.
import { Canvas2dFilterBackend, FabricImage, WebGLFilterBackend, classRegistry, config, filters as F, setFilterBackend } from "fabric";
import { toast } from "../../ui/kit.js";

const { BaseFilter } = F;

// ---- the GPU backend ------------------------------------------------------------------------

/** Fabric's WebGL backend, but asking for the high-performance graphics card. */
class FastGLBackend extends WebGLFilterBackend {
  createWebGLCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const gl = canvas.getContext("webgl", {
      alpha: true, premultipliedAlpha: false, depth: false, stencil: false, antialias: false, powerPreference: "high-performance",
    });
    if (!gl) return;
    gl.clearColor(0, 0, 0, 0);
    this.canvas = canvas;
    this.gl = gl;
  }
}

let backend = "";

/** Set up the filter backend once: "gpu", or "cpu" (no WebGL; the user is told it may be slow). */
export function ensureGpuFilters() {
  if (backend) return backend;
  try {
    const b = new FastGLBackend({ tileSize: config.textureSize });
    if (b.gl) { setFilterBackend(b); backend = "gpu"; }
  } catch { /* no WebGL here */ }
  if (!backend) {
    setFilterBackend(new Canvas2dFilterBackend());
    backend = "cpu";
    toast("Photo effects can't use the graphics card in this browser, so big photos may be slow.", { ms: 6000 });
  }
  return backend;
}

// ---- a vignette filter of our own (GLSL + a 2D fallback) --------------------------------

const VIGNETTE_GLSL = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uAmount;
  varying vec2 vTexCoord;
  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    float d = length(vTexCoord - 0.5) * 1.4142;
    float s = smoothstep(0.32, 1.08, d);
    if (uAmount >= 0.0) color.rgb *= 1.0 - uAmount * s;
    else color.rgb = mix(color.rgb, vec3(color.a), -uAmount * s);
    gl_FragColor = color;
  }
`;

export class OcVignette extends BaseFilter {
  static type = "OcVignette";
  static defaults = { amount: 0 };
  static uniformLocations = ["uAmount"];

  getFragmentSource() { return VIGNETTE_GLSL; }
  isNeutralState() { return !this.amount; }
  sendUniformData(gl, loc) { gl.uniform1f(loc.uAmount, this.amount); }

  applyTo2d({ imageData: { data, width, height } }) {
    const a = this.amount;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x + 0.5) / width - 0.5, dy = (y + 0.5) / height - 0.5;
        const d = Math.hypot(dx, dy) * 1.4142;
        const t = Math.min(1, Math.max(0, (d - 0.32) / 0.76));
        const s = t * t * (3 - 2 * t);
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          data[i + c] = a >= 0 ? data[i + c] * (1 - a * s) : data[i + c] + (255 - data[i + c]) * -a * s;
        }
      }
    }
  }
}
classRegistry.setClass(OcVignette);

// ---- highlights and shadows ---------------------------------------------------------------

const TONE_GLSL = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uHighlights;
  uniform float uShadows;
  varying vec2 vTexCoord;
  void main() {
    vec4 c = texture2D(uTexture, vTexCoord);
    float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    float ws = 1.0 - smoothstep(0.0, 0.55, l);
    float wh = smoothstep(0.45, 1.0, l);
    c.rgb += uShadows * ws * 0.6 * (uShadows > 0.0 ? vec3(1.0) - c.rgb : c.rgb);
    c.rgb += uHighlights * wh * 0.6 * (uHighlights > 0.0 ? vec3(1.0) - c.rgb : c.rgb);
    gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
  }
`;

/** Lift or pull down the dark and the bright parts separately (-1..1 each). */
export class OcTone extends BaseFilter {
  static type = "OcTone";
  static defaults = { highlights: 0, shadows: 0 };
  static uniformLocations = ["uHighlights", "uShadows"];

  getFragmentSource() { return TONE_GLSL; }
  isNeutralState() { return !this.highlights && !this.shadows; }
  sendUniformData(gl, loc) {
    gl.uniform1f(loc.uHighlights, this.highlights);
    gl.uniform1f(loc.uShadows, this.shadows);
  }

  applyTo2d({ imageData: { data } }) {
    const hi = this.highlights, sh = this.shadows;
    const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i < data.length; i += 4) {
      const l = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
      const ws = 1 - sstep(0, 0.55, l), wh = sstep(0.45, 1, l);
      for (let c = 0; c < 3; c++) {
        let v = data[i + c] / 255;
        v += sh * ws * 0.6 * (sh > 0 ? 1 - v : v);
        v += hi * wh * 0.6 * (hi > 0 ? 1 - v : v);
        data[i + c] = v * 255;
      }
    }
  }
}
classRegistry.setClass(OcTone);

// ---- sharpen and clarity: the picture minus a local average, added back -----------------

const DETAIL_GLSL = `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uAmount;
  uniform float uMid;
  uniform vec2 uStep;
  varying vec2 vTexCoord;
  void main() {
    vec4 c = texture2D(uTexture, vTexCoord);
    vec3 sum = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853982;
      vec2 d = vec2(cos(a), sin(a)) * uStep;
      vec2 e = vec2(cos(a + 0.3927), sin(a + 0.3927)) * uStep;
      sum += texture2D(uTexture, vTexCoord + d).rgb;
      sum += texture2D(uTexture, vTexCoord + e * 0.66).rgb;
      sum += texture2D(uTexture, vTexCoord + d * 0.33).rgb;
    }
    vec3 diff = c.rgb - sum / 24.0;
    float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    float w = mix(1.0, 1.0 - pow(abs(l * 2.0 - 1.0), 2.0), uMid);
    gl_FragColor = vec4(clamp(c.rgb + diff * uAmount * w, 0.0, 1.0), c.a);
  }
`;

/** radius: in source pixels when >= 1, else a share of the shorter side. mid: 1 = midtones only (clarity). */
export class OcDetail extends BaseFilter {
  static type = "OcDetail";
  static defaults = { amount: 0, radius: 1.5, mid: 0 };
  static uniformLocations = ["uAmount", "uMid", "uStep"];

  getFragmentSource() { return DETAIL_GLSL; }
  isNeutralState() { return !this.amount; }

  _px(w, h) { return this.radius >= 1 ? this.radius : Math.max(2, this.radius * Math.min(w, h)); }

  applyTo(options) {
    this._size = [options.sourceWidth || options.imageData?.width || 1, options.sourceHeight || options.imageData?.height || 1];
    super.applyTo(options);
  }

  sendUniformData(gl, loc) {
    const [w, h] = this._size || [1, 1];
    const r = this._px(w, h);
    gl.uniform1f(loc.uAmount, this.amount);
    gl.uniform1f(loc.uMid, this.mid);
    gl.uniform2fv(loc.uStep, [r / w, r / h]);
  }

  applyTo2d({ imageData: { data, width, height } }) {
    const src = new Uint8ClampedArray(data);
    const r = this._px(width, height);
    const offs = [];
    for (let i = 0; i < 8; i++) {
      const a = i * 0.7853982, b = a + 0.3927;
      offs.push([Math.cos(a) * r, Math.sin(a) * r], [Math.cos(b) * r * 0.66, Math.sin(b) * r * 0.66], [Math.cos(a) * r * 0.33, Math.sin(a) * r * 0.33]);
    }
    const at = (x, y) => (Math.min(height - 1, Math.max(0, Math.round(y))) * width + Math.min(width - 1, Math.max(0, Math.round(x)))) * 4;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        let sr = 0, sg = 0, sb = 0;
        for (const [dx, dy] of offs) { const j = at(x + dx, y + dy); sr += src[j]; sg += src[j + 1]; sb += src[j + 2]; }
        const l = (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
        const k = this.amount * (1 - this.mid * Math.abs(l * 2 - 1) ** 2);
        data[i] = src[i] + (src[i] - sr / 24) * k;
        data[i + 1] = src[i + 1] + (src[i + 1] - sg / 24) * k;
        data[i + 2] = src[i + 2] + (src[i + 2] - sb / 24) * k;
      }
    }
  }
}
classRegistry.setClass(OcDetail);

// ---- presets ------------------------------------------------------------------------------

const I = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
const matrixOf = (Cls) => [...new Cls().matrix];
const SEPIA = [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0];
const tint = (r, g, b, o = [0, 0, 0]) => [r, 0, 0, 0, o[0], 0, g, 0, 0, o[1], 0, 0, b, 0, o[2], 0, 0, 0, 1, 0];

/** Each preset is a list of steps: [kind, value]. Intensity scales every step. */
export const PRESETS = [
  { key: "none", label: "None", steps: [] },
  { key: "bw", label: "B&W", steps: [["saturation", -1], ["contrast", 0.08]] },
  { key: "sepia", label: "Sepia", steps: [["matrix", SEPIA]] },
  { key: "vintage", label: "Vintage", steps: [["matrix", matrixOf(F.Vintage)], ["vignette", 0.25]] },
  { key: "vivid", label: "Vivid", steps: [["saturation", 0.45], ["contrast", 0.12]] },
  { key: "cool", label: "Cool", steps: [["matrix", tint(0.92, 1.0, 1.12, [0, 0.01, 0.04])], ["saturation", 0.05]] },
  { key: "warm", label: "Warm", steps: [["matrix", tint(1.1, 1.02, 0.86, [0.03, 0.01, 0])], ["saturation", 0.08]] },
  { key: "dramatic", label: "Dramatic", steps: [["contrast", 0.38], ["saturation", -0.22], ["brightness", -0.03], ["vignette", 0.45]] },
  { key: "fade", label: "Fade", steps: [["contrast", -0.25], ["brightness", 0.07], ["saturation", -0.25]] },
  { key: "noir", label: "Noir", steps: [["saturation", -1], ["contrast", 0.5], ["brightness", -0.05], ["vignette", 0.55]] },
  { key: "retro", label: "Retro", steps: [["matrix", matrixOf(F.Kodachrome)]] },
  { key: "pop", label: "Pop", steps: [["matrix", matrixOf(F.Technicolor)], ["contrast", 0.05]] },
  { key: "instant", label: "Instant", steps: [["matrix", matrixOf(F.Polaroid)]] },
];

const gain = (k) => [k, 0, 0, 0, 0, 0, k, 0, 0, 0, 0, 0, k, 0, 0, 0, 0, 0, 1, 0];

/**
 * The adjust sliders (-100..100; sharpen and blur 0..100), in the order they run.
 * `to` maps a slider value to a filter step; `group` is the heading they sit under.
 */
export const ADJUSTMENTS = [
  { key: "sharpen", label: "Sharpen", group: "Detail", min: 0, max: 100, to: (v) => ["detail", { amount: v / 40, radius: 1.5, mid: 0 }] },
  { key: "clarity", label: "Clarity", group: "Detail", min: -100, max: 100, to: (v) => ["detail", { amount: v / 90, radius: 0.012, mid: 1 }] },
  { key: "exposure", label: "Exposure", group: "Light", min: -100, max: 100, to: (v) => ["matrix", gain(2 ** (v / 85))] },
  { key: "brightness", label: "Brightness", group: "Light", min: -100, max: 100, to: (v) => ["brightness", v / 250] },
  { key: "contrast", label: "Contrast", group: "Light", min: -100, max: 100, to: (v) => ["contrast", v / 180] },
  { key: "highlights", label: "Highlights", group: "Light", min: -100, max: 100, to: (v) => ["tone", { highlights: v / 100, shadows: 0 }] },
  { key: "shadows", label: "Shadows", group: "Light", min: -100, max: 100, to: (v) => ["tone", { highlights: 0, shadows: v / 100 }] },
  { key: "saturation", label: "Saturation", group: "Colour", min: -100, max: 100, to: (v) => ["saturation", v / 100] },
  { key: "warmth", label: "Warmth", group: "Colour", min: -100, max: 100, to: (v) => ["matrix", tint(1 + v / 700, 1, 1 - v / 500)] },
  { key: "tint", label: "Tint", group: "Colour", min: -100, max: 100, to: (v) => ["matrix", tint(1 + v / 600, 1 - v / 420, 1 + v / 600)] },
  { key: "hue", label: "Hue", group: "Colour", min: -100, max: 100, to: (v) => ["hue", v / 100] },
  { key: "vignette", label: "Vignette", group: "Effects", min: -100, max: 100, to: (v) => ["vignette", v / 110] },
  { key: "blur", label: "Blur", group: "Effects", min: 0, max: 100, to: (v) => ["blur", (v / 100) * 0.22] },
];

export const EMPTY = { preset: "none", intensity: 100, adjust: {} };

function stepToFilter([kind, v], t = 1) {
  switch (kind) {
    case "brightness": return new F.Brightness({ brightness: v * t });
    case "contrast": return new F.Contrast({ contrast: v * t });
    case "saturation": return new F.Saturation({ saturation: v * t });
    case "hue": return new F.HueRotation({ rotation: v * t });
    case "blur": return new F.Blur({ blur: v * t });
    case "vignette": return new OcVignette({ amount: v * t });
    case "matrix": return new F.ColorMatrix({ matrix: v.map((x, i) => I[i] + (x - I[i]) * t) });
    case "tone": return new OcTone({ highlights: v.highlights * t, shadows: v.shadows * t });
    case "detail": return new OcDetail({ ...v, amount: v.amount * t });
    default: return null;
  }
}

/** Fabric filter instances for a settings object. */
export function buildFilters(spec = EMPTY) {
  ensureGpuFilters();
  const out = [];
  const adjust = (a) => {
    const v = Number(spec.adjust?.[a.key] || 0);
    if (v) out.push(stepToFilter(a.to(v)));
  };
  // Detail first (it works on the photo itself), then the preset, then light and colour; blur last.
  ADJUSTMENTS.filter((a) => a.group === "Detail").forEach(adjust);
  const preset = PRESETS.find((p) => p.key === spec.preset);
  const t = Math.max(0, Math.min(1, (spec.intensity ?? 100) / 100));
  if (preset && t > 0) for (const s of preset.steps) out.push(stepToFilter(s, t));
  ADJUSTMENTS.filter((a) => a.group !== "Detail").forEach(adjust);
  return out.filter((f) => f && !f.isNeutralState());
}

export const filterSpec = (img) => ({ ...EMPTY, ...(img.data?.filters || {}), adjust: { ...(img.data?.filters?.adjust || {}) } });

export function isNeutral(spec) {
  return (spec.preset || "none") === "none" && !Object.values(spec.adjust || {}).some(Boolean);
}

/** Apply settings to an image now (no history step; the caller commits). */
export function applyFilterSpec(img, spec) {
  img.filters = buildFilters(spec);
  img.applyFilters();
  img.set("data", { ...(img.data || {}), filters: isNeutral(spec) ? null : spec });
  img._outline = null;
  img.set("dirty", true);
}

/** Show the photo without its filters while `on` (hold-to-compare); no history step. */
export function showOriginal(img, on) {
  if (on) {
    if (img._compare) return;
    img._compare = img.filters || [];
    img.filters = [];
    img.applyFilters();
  } else {
    if (!img._compare) return;
    img.filters = img._compare;
    img._compare = null;
    img.applyFilters();
  }
  img._outline = null;
  img.set("dirty", true);
}

// ---- auto-enhance -------------------------------------------------------------------------

/**
 * Adjust settings that fix a dull, dark or flat photo, measured from its own pixels
 * (exposure, contrast, highlights, shadows, saturation, warmth, clarity, sharpen).
 * @returns {Record<string, number>}
 */
export function autoAdjust(img) {
  const src = previewSource(img, 160);
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const hist = new Uint32Array(256);
  let n = 0, sumL = 0, sumS = 0, sumR = 0, sumB = 0, dark = 0, bright = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const l = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    hist[l]++;
    n++;
    sumL += l;
    sumS += mx ? (mx - mn) / mx : 0;
    sumR += r;
    sumB += b;
    if (l < 40) dark++;
    if (l > 235) bright++;
  }
  if (!n) return {};
  const pct = (p) => { let acc = 0; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * p) return i / 255; } return 1; };
  const lo = pct(0.01), hi = pct(0.99), mean = sumL / n / 255, sat = sumS / n;
  const clamp = (v, a, b) => Math.round(Math.max(a, Math.min(b, v)));
  const out = {
    exposure: clamp(Math.log2(0.48 / Math.max(0.05, mean)) * 85 * 0.6, -45, 45),
    contrast: clamp((0.92 - (hi - lo)) * 90, 0, 35),
    shadows: clamp(dark / n > 0.12 ? (dark / n) * 120 : 0, 0, 35),
    highlights: clamp(bright / n > 0.04 ? -(bright / n) * 300 : 0, -40, 0),
    saturation: clamp((0.32 - sat) * 80, -10, 25),
    warmth: clamp(((sumB - sumR) / n / 255) * 150, -25, 25),
    clarity: 15,
    sharpen: 12,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v));
}

// ---- preview tiles ------------------------------------------------------------------------

/** A small copy of the image's visible area, for preset tiles. */
export function previewSource(img, side = 132) {
  const el = img._originalElement || img.getElement();
  const w = img.width, h = img.height;
  const k = Math.min(1, side / Math.max(w, h)) * 1.4;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext("2d").drawImage(el, img.cropX || 0, img.cropY || 0, w, h, 0, 0, c.width, c.height);
  return c;
}

/** Render `source` through a preset into `target` (a canvas). Uses the GPU backend. */
export function renderPreset(source, presetKey, target) {
  ensureGpuFilters();
  const tmp = new FabricImage(source);
  tmp.filters = buildFilters({ preset: presetKey, intensity: 100, adjust: {} });
  tmp.applyFilters();
  const out = tmp.getElement();
  target.width = source.width;
  target.height = source.height;
  const ctx = target.getContext("2d");
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(out, 0, 0, target.width, target.height);
  tmp.dispose?.();
}
