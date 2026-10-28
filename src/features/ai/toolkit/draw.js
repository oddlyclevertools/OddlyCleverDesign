// Drawing and keeping, for the AI: draw_vector turns SVG the AI writes (a character, an icon, a
// prop, a scene, a logo-free badge) into editable vector art on the page; save_as_template and
// save_element keep its work in the user's library for any later design.
//
// The SVG is cleaned before Fabric sees it: only drawing elements survive, no scripts, no event
// attributes, no links to anything outside the SVG (so it can't fetch or track), sizes capped.
import { svgToGroup } from "../../elements/vector.js";
import { elementObjects, libraryObject, listLibrary, saveDesignAsTemplate, saveElement } from "../../library/index.js";
import { brief, collisionNote, editorOf, findObjects, json, place, step } from "./context.js";
import { ToolInputError } from "./validate.js";

const ALLOWED = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan",
  "defs", "lineargradient", "radialgradient", "stop", "clippath", "use", "title", "desc",
]);
const MAX_NODES = 5000;

/** Clean SVG markup. Returns { svg, dropped } or throws a ToolInputError. */
export function cleanSVG(markup) {
  const doc = new DOMParser().parseFromString(String(markup), "image/svg+xml");
  const root = doc.documentElement;
  if (doc.querySelector("parsererror") || root?.nodeName.toLowerCase() !== "svg") {
    throw new ToolInputError("That isn't valid SVG. Send one <svg> element with a viewBox (well-formed XML: close every tag, quote every attribute).");
  }
  if (!root.getAttribute("viewBox") && !(root.getAttribute("width") && root.getAttribute("height"))) {
    throw new ToolInputError("Give the <svg> a viewBox (e.g. viewBox=\"0 0 400 600\") so its size is known.");
  }
  const dropped = new Set();
  let count = 0;
  const walk = (node) => {
    for (const child of [...node.children]) {
      const tag = child.nodeName.toLowerCase();
      if (!ALLOWED.has(tag)) { dropped.add(tag); child.remove(); continue; }
      if (++count > MAX_NODES) throw new ToolInputError(`That drawing has over ${MAX_NODES} parts. Simplify it.`);
      for (const a of [...child.attributes]) {
        const name = a.name.toLowerCase(), v = a.value;
        const external = /url\(\s*['"]?(?!#)/i.test(v) || /^\s*(javascript|data|https?):/i.test(v);
        if (name.startsWith("on") || ((name === "href" || name === "xlink:href") && !v.startsWith("#")) || external || (name === "style" && /@import|expression\(/i.test(v))) {
          if (external && (name === "fill" || name === "stroke")) child.setAttribute(a.name, "none"); // not the default black
          else child.removeAttribute(a.name);
        }
      }
      walk(child);
    }
  };
  walk(root);
  for (const a of [...root.attributes]) if (a.name.toLowerCase().startsWith("on")) root.removeAttribute(a.name);
  if (!count) throw new ToolInputError("That SVG has nothing to draw.");
  return { svg: new XMLSerializer().serializeToString(root), dropped: [...dropped] };
}

export async function drawVector(app, inp, { signal }) {
  const ed = editorOf(app);
  const { svg, dropped } = cleanSVG(inp.svg);
  let g;
  try { g = await svgToGroup(svg, inp.w || inp.h ? 100 : Math.min(ed.width, ed.height) * 0.6); } catch (e) {
    throw new ToolInputError(`The SVG couldn't be drawn: ${e.message}`);
  }
  g.set({ name: inp.name || "Drawing", data: { kind: "drawing" }, objectCaching: false, subTargetCheck: true });
  return step(app, `Draw ${(inp.name || "drawing").slice(0, 30)}`, () => {
    ed.add(g, { center: true, select: false, name: g.name });
    const fix = place(g, inp, ed);
    const note = [fix, dropped.length ? `Left out unsupported parts: ${dropped.join(", ")}.` : "", collisionNote(ed, g)].filter(Boolean).join(" ");
    return { text: json({ added: brief(g), parts: g.getObjects().length, page: { w: ed.width, h: ed.height }, ...(note ? { note } : {}),
      tip: "Look at it with look_at_design. Keep it for later with save_element." }) };
  }, { signal });
}

export async function saveAsTemplateTool(app, inp) {
  const ed = editorOf(app);
  if (!ed.objects().length) throw new ToolInputError("The page is empty: there's nothing to save as a template.");
  const rec = await saveDesignAsTemplate(app, { name: inp.name, tags: inp.tags || [], by: "ai" });
  return { text: json({ saved: { template_id: rec.id, name: rec.name, size: `${rec.w}x${rec.h}` },
    note: "It's in the user's Templates under My templates. Use it with new_design {template} or apply_template." }) };
}

export async function saveElementTool(app, inp) {
  const ed = editorOf(app);
  const objs = findObjects(ed, inp.ids);
  if (objs.some((o) => o.isBg)) throw new ToolInputError("The page background can't be saved as an element.");
  const rec = await saveElement(app, objs, { name: inp.name, tags: inp.tags || [], by: "ai" });
  return { text: json({ saved: { element_id: rec.id, name: rec.name, size: `${Math.round(rec.w)}x${Math.round(rec.h)}` },
    note: "It's in the user's Elements panel under My elements. Add it again with add_element {type: \"my_element\", key}." }) };
}

/** add_element type my_element: a saved element as one object. */
export async function myElement(key) {
  try {
    await elementObjects(key); // a clear error for an unknown key
    return { obj: await libraryObject(key), label: "my element" };
  } catch (e) { throw new ToolInputError(`${e.message} list_assets {catalog: "my_elements"} shows the saved ones.`); }
}

/** list_assets catalog my_elements. */
export async function myElementsCatalog() {
  const list = await listLibrary("element").catch(() => []);
  return list.map((r) => ({ key: r.id, name: r.name, tags: r.tags, size: `${Math.round(r.w)}x${Math.round(r.h)}`, by: r.by }));
}
