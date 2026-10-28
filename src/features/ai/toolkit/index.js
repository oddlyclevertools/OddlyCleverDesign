// The AI design toolkit: the one set of tools every AI uses to build designs, whether it runs
// inside the app (the AI panel) or outside it (Claude Desktop / Claude Code through the connector).
// CONTRACT (the panel and the connector depend on exactly this):
//   TOOLS: [{ name, description, input_schema }]   JSON-Schema tools, provider-neutral
//   runTool(app, name, input, { signal }) -> Promise<{ text: string, image?: { mediaType, data } }>
//     text  = a short result for the AI (JSON string or plain words); errors are thrown as Error
//     image = an optional base64 picture (e.g. a page snapshot for the AI to look at)
//   DESIGN_GUIDE: a system-prompt section that teaches the AI to design well in this app
//
// Files: schemas.js (TOOLS) · validate.js + rules.js (input checks) · context.js (undo steps,
// lookup, geometry) · read.js · assets.js · build.js · elements.js · edit.js · style.js · guide.js ·
// pictures.js (real pictures) · collage.js · draw.js (vector drawing, the user's library)
import { TOOLS } from "./schemas.js";
import { DESIGN_GUIDE } from "./guide.js";
import { validateToolInput } from "./validate.js";
import { enqueue, throwIfAborted } from "./context.js";
import { checkDesign, getDesign, lookAtDesign, styleReferences } from "./read.js";
import { listAssets } from "./assets.js";
import { addCharacter, addElement, addLine, addShape, addText, applyTemplateTool, newDesign, setBackground } from "./build.js";
import { deleteObjects, duplicateObjects, updateObjects } from "./edit.js";
import { animate, applyFontPairing, applyPalette, arrange, undo } from "./style.js";
import { addMyPicture, findMyPictures, generateImage, photoLook } from "./pictures.js";
import { makeCollage } from "./collage.js";
import { removeBackgroundTool } from "./cutout.js";
import { useFeature } from "./features.js";
import { drawVector, saveAsTemplateTool, saveElementTool } from "./draw.js";

export { TOOLS, DESIGN_GUIDE };

const HANDLERS = {
  style_references: styleReferences,
  get_design: getDesign,
  look_at_design: lookAtDesign,
  list_assets: listAssets,
  new_design: newDesign,
  apply_template: applyTemplateTool,
  set_background: setBackground,
  add_text: addText,
  add_shape: addShape,
  add_line: addLine,
  add_element: addElement,
  add_character: addCharacter,
  find_my_pictures: findMyPictures,
  add_my_picture: addMyPicture,
  generate_image: generateImage,
  photo_look: photoLook,
  make_collage: makeCollage,
  remove_background: removeBackgroundTool,
  use_feature: useFeature,
  draw_vector: drawVector,
  save_as_template: saveAsTemplateTool,
  save_element: saveElementTool,
  update_objects: updateObjects,
  duplicate_objects: duplicateObjects,
  delete_objects: deleteObjects,
  arrange,
  apply_palette: applyPalette,
  apply_font_pairing: applyFontPairing,
  animate,
  check_design: checkDesign,
  undo,
};

/**
 * Run one tool. Calls are queued, so two AIs never interleave edits. Throws Error with a
 * friendly message for bad input; the design is left unchanged when a call fails.
 * @param {object} app the app object (main.js)
 * @param {string} name a tool name from TOOLS
 * @param {object} input the tool input (checked against its schema)
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ text: string, image?: { mediaType: string, data: string } }>}
 */
export async function runTool(app, name, input, { signal } = {}) {
  const clean = validateToolInput(TOOLS, name, input);
  throwIfAborted(signal);
  return enqueue(async () => {
    throwIfAborted(signal);
    const out = await HANDLERS[name](app, clean, { signal });
    return { text: typeof out?.text === "string" ? out.text : "Done.", ...(out?.image ? { image: out.image } : {}) };
  });
}
