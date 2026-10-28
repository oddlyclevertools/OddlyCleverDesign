// Badges and labels (our own artwork, CC0): a drawn plate (SVG) plus a real OcText, grouped.
// The words stay editable: double-click a badge to type (it opens up while you type and closes
// again around the new words), or use the text toolbar for font and colour. Labels that grow
// (pills, ribbons, tape, bubbles) redraw their plate to fit the words.
import { Group, loadSVGFromString } from "fabric";
import { ensureFont, nearestWeight } from "../../core/fonts.js";
import { OcText } from "../text/octext.js";
import { burstPath, rng } from "./art.js";

const INK = "#16121b";
const SW = 6;
const f = (n) => Number(n).toFixed(1);
const ol = `stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"`;

const font = (family, size, fill, extra = {}) => ({ fontFamily: family, fontSize: size, fill, fontWeight: 400, ...extra });

/** A pill around the text box. */
const pill = (tw, th, padX, padY, fill, extra = "") => {
  const w = tw + padX * 2, h = th + padY * 2;
  return { body: `<rect x="0" y="0" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" fill="${fill}" ${ol}/>${extra}`, tx: w / 2, ty: h / 2, w, h };
};

/** Torn paper edges for tape. */
function tornRect(w, h, seed) {
  const r = rng(seed);
  const n = Math.max(4, Math.round(h / 9));
  let left = "", right = "";
  for (let i = 0; i <= n; i++) {
    const y = (i / n) * h;
    right += ` L${f(w - (i % 2 ? 7 : 0) - r() * 4)} ${f(y)}`;
    left = ` L${f((i % 2 ? 7 : 0) + r() * 4)} ${f(y)}` + left;
  }
  return `M0 0${right}${left} Z`;
}

/** Each badge: key, label, tags, default words, text style, wrap (fixed text width) and plate(tw, th). */
export const BADGES = [
  { key: "new", label: "NEW burst", tags: "new burst badge label star sticker", text: "NEW", tilt: -10,
    font: font("Anton", 64, INK), fixed: true,
    plate: () => ({ body: `<path d="${burstPath(110, 110, 104, 84, 18)}" fill="#ffc83d" ${ol}/>`, tx: 110, ty: 112, maxW: 128, maxH: 90 }) },
  { key: "sale", label: "SALE tag", tags: "sale tag price discount offer label", text: "SALE", tilt: -8,
    font: font("Anton", 58, "#fbf7ee"),
    plate: (tw, th) => {
      const h = th + 34, w = tw + 92;
      return { body: `<path d="M0 ${f(h / 2)} L${f(h * 0.42)} 0 L${f(w - 10)} 0 Q${f(w)} 0 ${f(w)} 10 L${f(w)} ${f(h - 10)} Q${f(w)} ${f(h)} ${f(w - 10)} ${f(h)} L${f(h * 0.42)} ${f(h)} Z" fill="#ff4141" ${ol}/>
        <circle cx="${f(h * 0.42)}" cy="${f(h / 2)}" r="9" fill="#fbf7ee" ${ol}/>`, tx: h * 0.42 + 22 + tw / 2, ty: h / 2 };
    } },
  { key: "live", label: "LIVE pill", tags: "live stream broadcast pill label red now", text: "LIVE",
    font: font("Inter", 40, "#fbf7ee", { fontWeight: 900, charSpacing: 120 }),
    plate: (tw, th) => {
      const p = pill(tw + 40, th, 26, 14, "#ff2e4f");
      return { ...p, body: `${p.body}<circle cx="${f(26 + 12)}" cy="${f(p.h / 2)}" r="11" fill="#fbf7ee"/>`, tx: p.w / 2 + 20 };
    } },
  { key: "free", label: "FREE seal", tags: "free seal badge round stamp giveaway", text: "FREE", tilt: 8,
    font: font("Anton", 60, "#fbf7ee"), fixed: true,
    plate: () => ({ body: `<path d="${burstPath(110, 110, 104, 94, 28)}" fill="#ff2e7e" ${ol}/>
      <circle cx="110" cy="110" r="76" fill="none" stroke="#fbf7ee" stroke-width="4" stroke-dasharray="10 8"/>`, tx: 110, ty: 112, maxW: 120, maxH: 80 }) },
  { key: "number1", label: "#1 rosette", tags: "number one first best rosette award winner medal", text: "#1",
    font: font("Anton", 76, INK), fixed: true,
    plate: () => ({ body: `<path d="M70 150 L46 238 L76 222 L96 248 L112 166 Z" fill="#ff2e7e" ${ol}/>
      <path d="M150 150 L174 238 L144 222 L124 248 L108 166 Z" fill="#c8155c" ${ol}/>
      <path d="${burstPath(110, 104, 98, 86, 22)}" fill="#ffc83d" ${ol}/>
      <circle cx="110" cy="104" r="68" fill="#ffd970" ${ol}/>`, tx: 110, ty: 106, maxW: 104, maxH: 92, w: 220, h: 252 }) },
  { key: "ribbon", label: "Ribbon banner", tags: "ribbon banner best seller title header", text: "BEST SELLER",
    font: font("Anton", 44, "#fbf7ee", { charSpacing: 40 }),
    plate: (tw, th) => {
      const w = tw + 70, h = th + 30, e = 44;
      return { body: `<path d="M-${e} 18 L18 18 L18 ${f(h + 18)} L-${e} ${f(h + 18)} L-${e - 18} ${f(h / 2 + 18)} Z" fill="#c8155c" ${ol}/>
        <path d="M${f(w + e)} 18 L${f(w - 18)} 18 L${f(w - 18)} ${f(h + 18)} L${f(w + e)} ${f(h + 18)} L${f(w + e - 18)} ${f(h / 2 + 18)} Z" fill="#c8155c" ${ol}/>
        <path d="M0 ${f(h)} L18 ${f(h + 18)} L18 ${f(h)} Z M${f(w)} ${f(h)} L${f(w - 18)} ${f(h + 18)} L${f(w - 18)} ${f(h)} Z" fill="${INK}" ${ol}/>
        <rect x="0" y="0" width="${f(w)}" height="${f(h)}" fill="#ff2e7e" ${ol}/>`, tx: w / 2, ty: h / 2 };
    } },
  { key: "legit", label: "Wavy seal", tags: "seal stamp guarantee legit quality certified", text: "100%\nLEGIT", tilt: -6,
    font: font("Anton", 44, INK, { lineHeight: 0.95 }), fixed: true,
    plate: () => ({ body: `<path d="${burstPath(110, 110, 104, 96, 34)}" fill="#8fe3ff" ${ol}/>
      <circle cx="110" cy="110" r="80" fill="none" stroke="${INK}" stroke-width="3"/>`, tx: 110, ty: 112, maxW: 118, maxH: 110 }) },
  { key: "price", label: "Price tag", tags: "price tag cost dollar paper label string", text: "$9.99", tilt: 10,
    font: font("Archivo Black", 46, INK),
    plate: (tw, th) => {
      const w = tw + 90, h = th + 44;
      return { body: `<path d="M-28 ${f(h / 2 - 40)} C-60 ${f(h / 2 - 60)} -70 ${f(h / 2 - 10)} -40 ${f(h / 2 - 6)}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
        <path d="M0 ${f(h / 2)} L34 0 L${f(w)} 0 L${f(w)} ${f(h)} L34 ${f(h)} Z" fill="#f3ead8" ${ol}/>
        <circle cx="26" cy="${f(h / 2)}" r="8" fill="#16121b"/>
        <path d="M44 10 L44 ${f(h - 10)}" stroke="#d8c7a6" stroke-width="3" stroke-dasharray="6 6"/>`, tx: 52 + (w - 52) / 2, ty: h / 2 };
    } },
  { key: "tape", label: "Paper tape label", tags: "tape paper label strip torn note quote loophole", text: "WE FOUND THE LOOPHOLE.", sample: "LOOPHOLE.", tilt: -3,
    font: font("Archivo Black", 30, INK, { charSpacing: 20 }),
    plate: (tw, th) => {
      const w = tw + 70, h = th + 30;
      return { body: `<path d="${tornRect(w, h, 3)}" fill="#f3ead8" ${ol}/><path d="M14 ${f(h - 7)} L${f(w - 14)} ${f(h - 7)}" stroke="#d8c7a6" stroke-width="4"/>`, tx: w / 2, ty: h / 2 };
    } },
  { key: "speech", label: "Speech bubble", tags: "speech bubble talk say chat quote comic", text: "Wait… it's FREE?", sample: "No way!", wrap: 330,
    font: font("Inter", 36, INK, { fontWeight: 800 }),
    plate: (tw, th) => {
      const w = tw + 60, h = th + 44;
      return { body: `<path d="M22 0 L${f(w - 22)} 0 Q${f(w)} 0 ${f(w)} 22 L${f(w)} ${f(h - 22)} Q${f(w)} ${f(h)} ${f(w - 22)} ${f(h)} L${f(w * 0.36)} ${f(h)} L${f(w * 0.16)} ${f(h + 46)} L${f(w * 0.2)} ${f(h)} L22 ${f(h)} Q0 ${f(h)} 0 ${f(h - 22)} L0 22 Q0 0 22 0 Z" fill="#fbf7ee" ${ol}/>`, tx: w / 2, ty: h / 2 };
    } },
  { key: "thought", label: "Thought bubble", tags: "thought bubble think idea cloud dream", text: "Hmm… what if?", sample: "Hmm…", wrap: 280,
    font: font("DM Serif Display", 40, INK, { fontStyle: "italic" }),
    plate: (tw, th) => {
      const w = tw + 90, h = th + 70, cx = w / 2, cy = h / 2;
      const n = 11;
      let bumps = "";
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        bumps += `<circle cx="${f(cx + Math.cos(a) * w * 0.42)}" cy="${f(cy + Math.sin(a) * h * 0.38)}" r="${f(Math.min(w, h) * 0.24)}" fill="#fbf7ee" ${ol}/>`;
      }
      return { body: `${bumps}<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(w * 0.44)}" ry="${f(h * 0.4)}" fill="#fbf7ee"/>
        <circle cx="${f(w * 0.2)}" cy="${f(h + 22)}" r="14" fill="#fbf7ee" ${ol}/><circle cx="${f(w * 0.1)}" cy="${f(h + 52)}" r="8" fill="#fbf7ee" ${ol}/>`, tx: cx, ty: cy };
    } },
  { key: "tip", label: "Callout box", tags: "callout box tip note info pro tip label", text: "PRO TIP: do this first", sample: "PRO TIP", wrap: 360,
    font: font("Inter", 32, "#fbf7ee", { fontWeight: 800 }),
    plate: (tw, th) => {
      const w = tw + 70, h = th + 40;
      return { body: `<rect x="0" y="0" width="${f(w)}" height="${f(h)}" rx="14" fill="#2b2433" ${ol}/>
        <rect x="14" y="14" width="10" height="${f(h - 28)}" rx="5" fill="#ff2e7e"/>`, tx: 24 + (w - 24) / 2, ty: h / 2 };
    } },
  { key: "num1", label: "Number circle", tags: "number circle step one 1 list", text: "1",
    font: font("Anton", 96, "#fbf7ee"), fixed: true,
    plate: () => ({ body: `<circle cx="80" cy="80" r="74" fill="#ff2e7e" ${ol}/>`, tx: 80, ty: 82, maxW: 100, maxH: 110 }) },
  { key: "num2", label: "Number square", tags: "number square step two 2 list", text: "2", tilt: -6,
    font: font("Anton", 96, INK), fixed: true,
    plate: () => ({ body: `<rect x="6" y="6" width="148" height="148" rx="26" fill="#ffc83d" ${ol}/>`, tx: 80, ty: 82, maxW: 104, maxH: 116 }) },
  { key: "doThis", label: "Check label", tags: "check tick yes do this correct right good label", text: "DO THIS",
    font: font("Inter", 36, INK, { fontWeight: 900 }),
    plate: (tw, th) => {
      const h = th + 30, w = tw + h + 44;
      const r = h / 2 - 2;
      return { body: `<rect x="0" y="0" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" fill="#fbf7ee" ${ol}/>
        <circle cx="${f(h / 2)}" cy="${f(h / 2)}" r="${f(r)}" fill="#3ddc84" ${ol}/>
        <path d="M${f(h / 2 - r * 0.45)} ${f(h / 2 + 2)} L${f(h / 2 - r * 0.1)} ${f(h / 2 + r * 0.38)} L${f(h / 2 + r * 0.5)} ${f(h / 2 - r * 0.36)}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
        tx: h + 10 + tw / 2, ty: h / 2 };
    } },
  { key: "notThis", label: "Cross label", tags: "cross x no not this wrong bad label", text: "NOT THIS",
    font: font("Inter", 36, INK, { fontWeight: 900 }),
    plate: (tw, th) => {
      const h = th + 30, w = tw + h + 44;
      const r = h / 2 - 2, c = h / 2, k = r * 0.38;
      return { body: `<rect x="0" y="0" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" fill="#fbf7ee" ${ol}/>
        <circle cx="${f(c)}" cy="${f(c)}" r="${f(r)}" fill="#ff4141" ${ol}/>
        <path d="M${f(c - k)} ${f(c - k)} L${f(c + k)} ${f(c + k)} M${f(c + k)} ${f(c - k)} L${f(c - k)} ${f(c + k)}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`,
        tx: h + 10 + tw / 2, ty: h / 2 };
    } },
  { key: "omg", label: "OMG bang", tags: "omg wow comic bang pow burst shock", text: "OMG!", tilt: -8,
    font: font("Bangers", 78, "#fbf7ee", { charSpacing: 30 }), fixed: true,
    plate: () => {
      const r = rng(9);
      const n = 14, pts = [];
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2;
        const rad = i % 2 ? 70 + r() * 10 : 106 + r() * 22;
        pts.push(`${f(130 + Math.cos(a) * rad * 1.18)} ${f(110 + Math.sin(a) * rad * 0.86)}`);
      }
      return { body: `<path d="M${pts.join(" L")} Z" fill="#ff2e7e" ${ol}/>`, tx: 130, ty: 112, maxW: 150, maxH: 90 };
    } },
  { key: "trending", label: "Trending pill", tags: "trending hot viral up pill label", text: "TRENDING",
    font: font("Inter", 34, INK, { fontWeight: 900, charSpacing: 60 }),
    plate: (tw, th) => {
      const p = pill(tw + 46, th, 24, 14, "#ffc83d");
      const x = 24, y = p.h / 2;
      return { ...p, body: `${p.body}<path d="M${x} ${f(y + 12)} L${x + 14} ${f(y - 2)} L${x + 22} ${f(y + 6)} L${x + 36} ${f(y - 10)}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M${x + 26} ${f(y - 12)} L${x + 38} ${f(y - 12)} L${x + 38} ${f(y)}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`, tx: p.w / 2 + 23 };
    } },
  { key: "approved", label: "APPROVED stamp", tags: "approved stamp rubber ok verified official", text: "APPROVED", tilt: -12,
    font: font("Black Ops One", 46, "#e0243c", { charSpacing: 60 }),
    plate: (tw, th) => {
      const w = tw + 56, h = th + 36;
      return { body: `<rect x="0" y="0" width="${f(w)}" height="${f(h)}" rx="10" fill="none" stroke="#e0243c" stroke-width="7"/>
        <rect x="9" y="9" width="${f(w - 18)}" height="${f(h - 18)}" rx="5" fill="none" stroke="#e0243c" stroke-width="3"/>`, tx: w / 2, ty: h / 2 };
    } },
  { key: "soldOut", label: "SOLD OUT band", tags: "sold out band strip banner gone over", text: "SOLD OUT", tilt: -8,
    font: font("Anton", 52, "#fbf7ee", { charSpacing: 80 }),
    plate: (tw, th) => {
      const w = tw + 120, h = th + 26;
      return { body: `<rect x="0" y="0" width="${f(w)}" height="${f(h)}" fill="#16121b"/>
        <rect x="0" y="7" width="${f(w)}" height="${f(h - 14)}" fill="#ff4141"/>`, tx: w / 2, ty: h / 2 };
    } },
  { key: "click", label: "Arrow label", tags: "click here arrow label button pointer cta", text: "CLICK HERE",
    font: font("Anton", 44, INK, { charSpacing: 30 }),
    plate: (tw, th) => {
      const h = th + 34, w = tw + 60;
      return { body: `<path d="M0 0 L${f(w)} 0 L${f(w + h * 0.5)} ${f(h / 2)} L${f(w)} ${f(h)} L0 ${f(h)} L${f(h * 0.3)} ${f(h / 2)} Z" fill="#8fe3ff" ${ol}/>`, tx: w / 2 + h * 0.14, ty: h / 2 };
    } },
  { key: "part", label: "Episode tab", tags: "part episode tab number series chapter", text: "PART 2", tilt: 4,
    font: font("Anton", 46, INK, { charSpacing: 40 }),
    plate: (tw, th) => {
      const w = tw + 60, h = th + 30;
      return { body: `<rect x="8" y="8" width="${f(w)}" height="${f(h)}" rx="12" fill="${INK}"/><rect x="0" y="0" width="${f(w)}" height="${f(h)}" rx="12" fill="#ffc83d" ${ol}/>`, tx: w / 2, ty: h / 2 };
    } },
  { key: "discount", label: "Discount burst", tags: "discount percent off sale burst deal", text: "-50%", tilt: 10,
    font: font("Anton", 64, "#fbf7ee"), fixed: true,
    plate: () => ({ body: `<path d="${burstPath(110, 110, 104, 80, 14)}" fill="#ff4141" ${ol}/>`, tx: 110, ty: 112, maxW: 124, maxH: 84 }) },
  { key: "neonOpen", label: "Neon sign", tags: "neon sign open glow night bar light", text: "open",
    font: font("Pacifico", 64, "#ff2e7e"), effect: { neon: { intensity: 70, tube: 45, color: null } },
    plate: (tw, th) => {
      const w = tw + 90, h = th + 50;
      return { body: `<rect x="0" y="0" width="${f(w)}" height="${f(h)}" rx="22" fill="#0d0a10" ${ol}/>
        <rect x="12" y="12" width="${f(w - 24)}" height="${f(h - 24)}" rx="14" fill="none" stroke="#8fe3ff" stroke-width="12" opacity="0.25"/>
        <rect x="12" y="12" width="${f(w - 24)}" height="${f(h - 24)}" rx="14" fill="none" stroke="#8fe3ff" stroke-width="4"/>`, tx: w / 2, ty: h / 2 };
    } },
  { key: "limited", label: "Corner flag", tags: "limited flag pennant label edition only", text: "LIMITED",
    font: font("Archivo Black", 34, "#fbf7ee", { charSpacing: 80 }),
    plate: (tw, th) => {
      const w = tw + 80, h = th + 30;
      return { body: `<path d="M0 0 L${f(w)} 0 L${f(w - 26)} ${f(h / 2)} L${f(w)} ${f(h)} L0 ${f(h)} Z" fill="#8b5cf6" ${ol}/>`, tx: (w - 26) / 2, ty: h / 2 };
    } },
  { key: "clever", label: "Clever script", tags: "clever script neon pink word accent", text: "clever", tilt: -6,
    font: font("Pacifico", 70, "#ff2e7e"), effect: { neon: { intensity: 60, tube: 40, color: null } },
    plate: (tw, th) => ({ body: `<path d="M20 ${f(th + 34)} Q${f(tw * 0.5)} ${f(th + 54)} ${f(tw + 40)} ${f(th + 26)}" fill="none" stroke="#ff2e7e" stroke-width="6" stroke-linecap="round"/>`, tx: tw / 2 + 30, ty: th / 2 + 10 }) },
];

const specOf = (key) => BADGES.find((b) => b.key === key);

/** Panel preview: the plate as drawn, with SVG text standing in for the real text. */
export function badgePreview(key) {
  const b = specOf(key);
  const s = b.font.fontSize;
  const lines = (b.sample || b.text).split("\n");
  const tw = b.fixed ? 100 : Math.min(b.wrap || 9999, Math.max(...lines.map((l) => l.length)) * s * 0.56);
  const th = s * 1.1 * lines.length;
  const pl = b.plate(tw, th);
  const fam = `'${b.font.fontFamily}', Impact, sans-serif`;
  const txt = lines.map((l, i) => `<text x="${f(pl.tx)}" y="${f(pl.ty + (i - (lines.length - 1) / 2) * s * 1.02 + s * 0.36)}" text-anchor="middle" font-family="${fam}" font-size="${b.fixed ? Math.min(s, 70) : s}" font-weight="${b.font.fontWeight}" ${b.font.fontStyle ? `font-style="${b.font.fontStyle}"` : ""} fill="${b.font.fill}">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`).join("");
  const W = pl.w || (b.fixed ? pl.tx * 2 : tw + 120), H = pl.h || (b.fixed ? pl.ty * 2 : th + 40);
  const pad = 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(-pad - 40)} ${f(-pad)} ${f(W + pad * 2 + 80)} ${f(H + pad * 2 + 40)}" preserveAspectRatio="xMidYMid meet" style="overflow:visible"><g transform="rotate(${b.tilt || 0} ${f(pl.tx)} ${f(pl.ty)})">${pl.body}${txt}</g></svg>`;
}

/** The width of the widest line of a text, in its own units. */
function textWidth(t) {
  let w = 0;
  for (let i = 0; i < t._textLines.length; i++) w = Math.max(w, t.getLineWidth(i));
  return w;
}

/** Make the text for a badge, measured. */
async function makeBadgeText(spec, text, style = null) {
  const { effect: userEffect, curve: _curve, ...s } = { ...spec.font, ...(style || {}) };
  const weight = nearestWeight(s.fontFamily, s.fontWeight || 400);
  await ensureFont(s.fontFamily, weight, s.fontStyle || "normal");
  const t = new OcText(text, {
    ...s, fontWeight: weight, textAlign: "center", width: spec.wrap || 4000, lineHeight: s.lineHeight || 1.05,
    splitByGrapheme: false, originX: "center", originY: "center",
    data: { keepName: true, ...(userEffect || spec.effect ? { effect: userEffect || spec.effect } : {}) },
  });
  if (!spec.wrap) {
    t.set("width", textWidth(t) + 4);
    t.initDimensions();
  }
  return t;
}

/** The style a user may have given the badge's text (kept when the badge is rebuilt). */
function textStyle(t) {
  return {
    fontFamily: t.fontFamily, fontSize: t.fontSize, fontWeight: t.fontWeight, fontStyle: t.fontStyle, fill: t.fill,
    charSpacing: t.charSpacing, lineHeight: t.lineHeight, underline: t.underline, stroke: t.stroke, strokeWidth: t.strokeWidth,
    effect: t.data?.effect, curve: t.data?.curve,
  };
}

/**
 * Build a badge group. `state` restores a user's edits: { text, style, plateColors }.
 * @returns {Promise<Group>}
 */
export async function buildBadge(key, state = {}) {
  const spec = specOf(key);
  if (!spec) throw new Error(`No badge called ${key}.`);
  const words = state.text ?? spec.text;
  const t = await makeBadgeText(spec, words, state.style);
  if (state.style?.curve) t.set("data", { ...t.data, curve: state.style.curve });
  let tw = spec.wrap ? textWidth(t) : t.width, th = t.height;
  const pl = spec.plate(tw, th);
  if (spec.fixed && pl.maxW) {
    // Fixed plates: shrink the words to fit inside.
    const k = Math.min(1, pl.maxW / tw, (pl.maxH || Infinity) / th);
    if (k < 1) {
      t.set({ fontSize: t.fontSize * k });
      t.set("width", textWidth(t) + 4);
      t.initDimensions();
      tw = t.width; th = t.height;
    }
  }
  const { objects } = await loadSVGFromString(`<svg xmlns="http://www.w3.org/2000/svg">${pl.body}</svg>`);
  const plate = objects.filter(Boolean);
  (state.plateColors || []).forEach((c, i) => { if (plate[i] && c) plate[i].set({ fill: c.fill, stroke: c.stroke }); });
  plate.forEach((o) => o.set({ data: { badgePlate: true } }));
  t.set({ left: pl.tx, top: pl.ty });
  const g = new Group([...plate, t], { objectCaching: true });
  g.set({ name: spec.label, data: { kind: "badge", badge: key } });
  return g;
}

/** Make a new badge sized for the page. */
export async function createBadge(key, app) {
  const spec = specOf(key);
  const g = await buildBadge(key);
  const short = Math.min(app.editor.width, app.editor.height);
  const target = spec.fixed ? short * 0.34 : Math.min(short * 0.62, Math.max(g.width, g.height));
  g.scale(target / Math.max(g.width, g.height));
  g.set("angle", spec.tilt || 0);
  return g;
}

export const isBadge = (o) => o?.type === "group" && o.data?.kind === "badge";

/** What a badge currently looks like, so it can be rebuilt the same. */
export function badgeState(g, textObj = null) {
  const kids = g ? g.getObjects() : [];
  const t = textObj || kids.find((o) => o instanceof OcText);
  const plate = kids.filter((o) => o.data?.badgePlate);
  return { text: t?.text, style: t ? textStyle(t) : null, plateColors: plate.map((o) => ({ fill: o.fill, stroke: o.stroke })) };
}

/** Copy a group's place on the page onto a rebuilt one (same centre, scale, angle). */
export function takePlace(next, prev, center) {
  next.set({
    scaleX: prev.scaleX, scaleY: prev.scaleY, angle: prev.angle, flipX: prev.flipX, flipY: prev.flipY,
    opacity: prev.opacity, shadow: prev.shadow, id: prev.id, name: prev.name, locked: prev.locked,
    globalCompositeOperation: prev.globalCompositeOperation,
    data: { ...prev.data, ...next.data },
  });
  next.setPositionByOrigin(center, "center", "center");
  next.setCoords();
}

/**
 * Double-click a badge: open it up and edit the words in place. When editing ends the badge
 * is rebuilt around the new words (one undo step).
 */
export function editBadgeText(app, g) {
  const ed = app.editor, c = ed.canvas;
  const spec = specOf(g.data?.badge);
  if (!spec || g.locked) return;
  const before = badgeState(g);
  const place = { scaleX: g.scaleX, scaleY: g.scaleY, angle: g.angle, flipX: g.flipX, flipY: g.flipY, opacity: g.opacity,
    shadow: g.shadow, id: g.id, name: g.name, locked: g.locked, globalCompositeOperation: g.globalCompositeOperation, data: g.data };
  const center = g.getCenterPoint();
  const index = c.getObjects().indexOf(g);
  ed.history.pause();
  c.discardActiveObject();
  const kids = g.removeAll();
  c.remove(g);
  c.insertAt(index, ...kids);
  const t = kids.find((o) => o instanceof OcText);
  for (const o of kids) if (o !== t) o.set({ selectable: false, evented: false });
  ed.history.resume();
  if (!t) return;
  c.setActiveObject(t);
  t.enterEditing();
  t.selectAll();
  c.requestRenderAll();

  const finish = async () => {
    t.off("editing:exited", finish);
    const state = badgeState(null, t);
    state.plateColors = before.plateColors;
    if (!(state.text || "").trim()) state.text = before.text;
    // Text inside a group is unscaled, so take the size back out of the baked-in scale.
    if (state.style) state.style = { ...state.style, fontSize: t.fontSize * (t.scaleY / (place.scaleY || 1)) };
    ed.history.pause();
    try {
      c.remove(...kids);
      const next = await buildBadge(spec.key, state);
      c.insertAt(Math.min(index, c.getObjects().length), next);
      takePlace(next, place, center);
      c.setActiveObject(next);
    } catch (e) {
      // Put the old badge back if the rebuild fails.
      const back = await buildBadge(spec.key, before);
      c.insertAt(Math.min(index, c.getObjects().length), back);
      takePlace(back, place, center);
    } finally {
      ed.history.resume();
    }
    c.requestRenderAll();
    ed.commit("Edit badge text");
    app.refreshToolbar?.();
  };
  t.on("editing:exited", finish);
}

/** Rebuild a badge in place (after a colour or text-style change that should refit the plate). */
export async function rebuildBadge(app, g, patch = {}) {
  const ed = app.editor, c = ed.canvas;
  const state = { ...badgeState(g), ...patch };
  const next = await buildBadge(g.data.badge, state);
  const index = c.getObjects().indexOf(g);
  const center = g.getCenterPoint();
  ed.history.pause();
  c.remove(g);
  c.insertAt(index, next);
  takePlace(next, g, center);
  c.setActiveObject(next);
  ed.history.resume();
  c.requestRenderAll();
  return next;
}

for (const b of BADGES) b.svg = () => badgePreview(b.key);
