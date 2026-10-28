// The paper-cut illustration library (sets A and B), as recolourable vector groups.
import { svgToGroup } from "./vector.js";
import { ILLUSTRATIONS_A } from "./illustrations-a.js";
import { ILLUSTRATIONS_B } from "./illustrations-b.js";

export const ILLUSTRATIONS = [...ILLUSTRATIONS_A, ...ILLUSTRATIONS_B];

const cache = new Map();
/** The SVG markup of an illustration (made once). */
export function illustrationSVG(key) {
  if (!cache.has(key)) {
    const it = ILLUSTRATIONS.find((x) => x.key === key);
    if (!it) throw new Error(`No illustration called ${key}.`);
    cache.set(key, it.svg());
  }
  return cache.get(key);
}

export async function createIllustration(key, app) {
  const it = ILLUSTRATIONS.find((x) => x.key === key);
  if (!it) throw new Error(`No illustration called ${key}.`);
  const short = Math.min(app.editor.width, app.editor.height);
  const g = await svgToGroup(illustrationSVG(key), Math.round(short * 0.4));
  g.set({ name: it.label, data: { kind: "illustration", illustration: key } });
  return g;
}
