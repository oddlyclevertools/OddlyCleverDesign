// Brand kit logic: turning your colours into a palette, the ready-made Oddly Clever kit, and
// adding a logo to the page.
import { ensureFont } from "../../core/fonts.js";
import { addImage } from "../elements/images.js";
import { parse, contrast, toHsl } from "./color.js";
import { getKit, saveKit } from "./brand-db.js";

/** Your colours as a palette: the first is the page, the most readable one is the text. */
export function kitPalette(colors) {
  const cs = colors.filter((c) => parse(c));
  if (!cs.length) return null;
  const bg = cs[0];
  const rest = cs.slice(1);
  const best = (list) => list.reduce((a, b) => (contrast(parse(b), parse(bg)) > contrast(parse(a), parse(bg)) ? b : a));
  const fallbackInk = contrast(parse("#ffffff"), parse(bg)) > contrast(parse("#111111"), parse(bg)) ? "#ffffff" : "#111111";
  let ink = rest.length ? best(rest) : fallbackInk;
  if (contrast(parse(ink), parse(bg)) < 3) ink = fallbackInk;
  const others = rest.filter((c) => c !== ink);
  // the most colourful first: they make the best "main"
  others.sort((a, b) => toHsl(parse(b)).s - toHsl(parse(a)).s);
  const main = others[0] || ink;
  return { id: "brand", name: "Brand colours", mood: "Your kit", bg, ink, main, a1: others[1] || main, a2: others[2] || others[1] || main };
}

export const ODDLY_KIT = {
  colors: ["#0d0a10", "#f3ead8", "#ff2e7e", "#ffc83d", "#8fe3ff", "#16121b"],
  head: { family: "Archivo Black", weight: 400 },
  body: { family: "Inter", weight: 600 },
};

/** A code-drawn Oddly Clever wordmark (pink neon script "clever" over a white grotesk "ODDLY"). */
export async function oddlyWordmark() {
  await Promise.all([ensureFont("Archivo Black", 400), ensureFont("Pacifico", 400)]);
  const W = 900, H = 420;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = '400 168px "Archivo Black"';
  ctx.lineJoin = "round";
  ctx.lineWidth = 26;
  ctx.strokeStyle = "#16121b";
  ctx.strokeText("ODDLY", W / 2, 200);
  ctx.fillStyle = "#f3ead8";
  ctx.fillText("ODDLY", W / 2, 200);
  ctx.save();
  ctx.translate(W / 2 + 40, 330);
  ctx.rotate(-0.08);
  ctx.font = '400 150px "Pacifico"';
  ctx.shadowColor = "#ff2e7e";
  for (const b of [44, 18, 6]) {
    ctx.shadowBlur = b;
    ctx.fillStyle = "#ff2e7e";
    ctx.fillText("clever", 0, 0);
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffd3e3";
  ctx.fillText("clever", 0, 0);
  ctx.restore();
  return c.toDataURL("image/png");
}

/** Fill the kit with the Oddly Clever brand (keeps any logos already there). */
export async function startOddlyKit() {
  const kit = await getKit();
  const logos = kit.logos.some((l) => l.id === "oc-wordmark") ? kit.logos
    : [{ id: "oc-wordmark", name: "Oddly Clever wordmark", src: await oddlyWordmark() }, ...kit.logos];
  return saveKit({ ...kit, ...ODDLY_KIT, logos });
}

/** Add a logo near the bottom-right corner, about a fifth of the page wide. */
export async function addLogo(app, logo) {
  const ed = app.editor;
  const img = await addImage(app, logo.src, { name: logo.name || "Logo" });
  const side = Math.min(ed.width, ed.height) * 0.3;
  const k = side / Math.max(img.width, img.height);
  img.scale(k);
  const m = Math.min(ed.width, ed.height) * 0.05;
  img.setPositionByOrigin({ x: ed.width - m - (img.width * k) / 2, y: ed.height - m - (img.height * k) / 2 }, "center", "center");
  img.setCoords();
  img.set("data", { ...(img.data || {}), kind: "image", logo: true });
  ed.canvas.requestRenderAll();
  ed.commit("Add", { merge: true });
  return img;
}
