// Background patterns and scenes on the page: each is drawn at the page size into a canvas
// (Canvas 2D, GPU-backed) and placed as the locked background image, with its key and colours
// in data.scene so its colours can be changed later and it redraws when the page is resized.
import { toast } from "../../ui/kit.js";
import { SCENES } from "./scenes.js";
import { backgroundImage, coverPage, loadElement, setBackgroundImage } from "./images.js";

const MAX_SIDE = 2560;

export const sceneOf = (key) => SCENES.find((s) => s.key === key);
export const sceneColors = (s, colors = null) => Object.fromEntries(s.colors.map((c) => [c.id, colors?.[c.id] || c.value]));

/** Draw a scene into a new canvas. */
export function renderScene(key, w, h, colors = null) {
  const s = sceneOf(key);
  if (!s) throw new Error(`No background called ${key}.`);
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const ctx = c.getContext("2d");
  s.draw(ctx, c.width, c.height, sceneColors(s, colors));
  return c;
}

const thumbs = new Map();
/** A small picture of a scene for the panel (made once per colour set). */
export function sceneThumb(key, w = 192, h = 120, colors = null) {
  const id = `${key}|${w}x${h}|${JSON.stringify(colors || "")}`;
  if (!thumbs.has(id)) thumbs.set(id, renderScene(key, w, h, colors).toDataURL("image/jpeg", 0.85));
  return thumbs.get(id);
}

const toURL = (canvas) => canvas.toDataURL("image/jpeg", 0.92);

/** The scene background on the page, if there is one. */
export function currentScene(app) {
  const bg = backgroundImage(app);
  return bg?.data?.scene ? { bg, scene: bg.data.scene } : null;
}

/**
 * Put a scene on the page as its background (or recolour the current one).
 * @param {*} app
 * @param {string} key
 * @param {object|null} colors
 * @param {{commit?: boolean}} [o] commit: false while a colour is being dragged (merged later)
 */
export async function applyScene(app, key, colors = null, { commit = true, merge = false } = {}) {
  const ed = app.editor;
  try {
    const s = sceneOf(key);
    const col = sceneColors(s, colors);
    const url = toURL(renderScene(key, ed.width, ed.height, col));
    const cur = currentScene(app);
    if (cur) {
      await cur.bg.setElement(await loadElement(url));
      cur.bg.set({ name: s.label, data: { ...cur.bg.data, scene: { key, colors: col } } });
      coverPage(app, cur.bg);
      ed.canvas.requestRenderAll();
      if (commit) ed.commit("Background", { merge });
      return cur.bg;
    }
    const img = await setBackgroundImage(app, url, { scene: { key, colors: col } });
    img.set("name", s.label);
    return img;
  } catch (e) {
    toast(`Couldn't set that background: ${e.message}`, { error: true });
    return null;
  }
}

/** Redraw a scene background at the page's new size (after a resize). No undo step. */
export async function refitScene(app) {
  const cur = currentScene(app);
  if (!cur) return false;
  const ed = app.editor;
  const el = cur.bg.getElement?.();
  const ratioNow = el ? el.width / el.height : 0;
  if (Math.abs(ratioNow - ed.width / ed.height) < 0.01 && Math.abs(cur.bg.getScaledWidth() - ed.width) < 0.5) return false;
  const url = toURL(renderScene(cur.scene.key, ed.width, ed.height, cur.scene.colors));
  await cur.bg.setElement(await loadElement(url));
  coverPage(app, cur.bg);
  ed.canvas.requestRenderAll();
  return true;
}
