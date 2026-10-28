// The tool definitions every AI sees: names, plain-English descriptions and JSON-Schema inputs.
// Provider-neutral: only standard keywords (no anyOf/oneOf, no type arrays), so the Anthropic,
// OpenAI-style and local-model providers all accept them. Big catalogues (templates, icons,
// illustrations) are plain strings checked at run time; list_assets shows the keys.
// Pure: imports only data modules, so the unit tests can load it in Node.
import { COLOR_PATTERN } from "./validate.js";
import { EFFECTS } from "../../text/effects.js";
import { LOOPS, MOTIONS, PAGE_PRESETS, SPEEDS, TEXT_MOTIONS } from "../../motion/catalog.js";
import { CAST, EXPRS, LOOKS } from "../../characters/cast.js";

const num = (description, min, max) => ({ type: "number", description, ...(min !== undefined ? { minimum: min } : {}), ...(max !== undefined ? { maximum: max } : {}) });
const int = (description, min, max) => ({ ...num(description, min, max), type: "integer" });
const str = (description, extra = {}) => ({ type: "string", description, ...extra });
const bool = (description) => ({ type: "boolean", description });
const color = (description) => str(description, { pattern: COLOR_PATTERN });
const obj = (properties, required = [], description) => ({
  type: "object", ...(description ? { description } : {}), properties, required, additionalProperties: false,
});
const ids = (description = "Object ids from get_design.") => ({ type: "array", description, items: str("An object id.", { minLength: 1, maxLength: 80 }), minItems: 1, maxItems: 100 });

export const CATALOGS = [
  "templates", "sizes", "illustrations", "badges", "decorations", "stickers", "icons", "charts", "photo_grids",
  "shapes", "lines", "scenes", "gradients", "characters", "fonts", "text_presets", "text_effects", "palettes",
  "font_pairings", "animations", "my_elements",
];
export const PHOTO_LOOKS = ["polaroid", "split_light", "bw_grain", "noir"];
export const ELEMENT_TYPES = ["illustration", "badge", "decoration", "sticker", "icon", "chart", "photo_grid", "image", "my_element"];
export const ARRANGE_ACTIONS = [
  "bring_to_front", "send_to_back", "bring_forward", "send_backward",
  "align_left", "align_center", "align_right", "align_top", "align_middle", "align_bottom",
  "distribute_horizontally", "distribute_vertically", "group", "ungroup",
];
export const INTROS = [...Object.keys(MOTIONS), ...Object.keys(TEXT_MOTIONS)];
export const OUTROS = Object.keys(MOTIONS);
export const LOOP_TYPES = Object.keys(LOOPS);
export const EFFECT_NAMES = Object.keys(EFFECTS);
const SPEED_IDS = SPEEDS.map((s) => s.id);
const CAPS = ["none", "arrow", "triangle", "circle", "square", "diamond", "bar"];

// ---- shared field groups ----------------------------------------------------------------

const PLACE = {
  x: num("Box left edge, page px from the top-left."),
  y: num("Box top edge, page px."),
  cx: num("Centre x (instead of x)."),
  cy: num("Centre y (instead of y)."),
  bleed: { type: "boolean", description: "May run past the page edge (full-bleed); else it's pulled back on." },
};
const SIZE = {
  w: num("Box width, page px (w or h alone keeps proportions).", 1, 20000),
  h: num("Box height, page px (w and h stretch a shape).", 1, 20000),
};
const LIKE = {
  type: "array", maxItems: 4, description: "Same person/place as these pictures (ids, or <collage id>:<cell>), sent as references. Still describe them.",
  items: { type: "string", minLength: 1, maxLength: 90 },
};
const LOOK_FIELDS = {
  angle: num("Rotation in degrees (clockwise).", -360, 360),
  opacity: num("0 (invisible) to 1 (solid).", 0, 1),
  name: str("Layer name.", { maxLength: 60 }),
};
const GRADIENT = obj({
  type: str("linear or radial.", { enum: ["linear", "radial"] }),
  angle: num("Linear direction in degrees: 90 = left to right, 180 = top to bottom.", 0, 360),
  stops: {
    type: "array", minItems: 2, maxItems: 8, description: "Colour stops from offset 0 to 1.",
    items: obj({ offset: num("Where the colour sits, 0 to 1.", 0, 1), color: color("The colour.") }, ["offset", "color"]),
  },
}, ["type", "stops"], "A gradient fill.");

/** Colour-valued effect settings (the rest are numbers: direction in degrees, others 0 to 100). */
export const isEffectColorKey = (k) => /^(color|colorA|colorB|edge|tint)$/.test(k);
const effectWords = (id) => Object.keys(EFFECTS[id].defaults).map((k) => (isEffectColorKey(k) ? `${k} (colour)` : k)).join(", ");
// Settings are described in words (not one schema per effect) to keep the tool list small;
// runTool checks every setting name and range.
const EFFECT = {
  type: "object",
  description: "Text effects to switch on, by name, each with its settings ({} = defaults). Numbers are 0-100 except direction (degrees). Layers stack; only one look at a time. Thumbnails: outline + shadow. "
    + EFFECT_NAMES.map((id) => `${id} [${EFFECTS[id].kind}]: ${effectWords(id)}`).join("; ") + ".",
  properties: Object.fromEntries(EFFECT_NAMES.map((id) => [id, { type: "object", description: EFFECTS[id].hint }])),
  additionalProperties: false,
};

const TEXT_STYLE = {
  font: str("Font family. See list_assets fonts (e.g. Anton, Archivo Black, Inter, Pacifico).", { maxLength: 60 }),
  font_size: num("Font size in page pixels.", 4, 2000),
  weight: int("Font weight 100 to 900 (snaps to the weights the font has).", 100, 900),
  italic: bool("Italic."),
  color: color("Text colour."),
  gradient: GRADIENT,
  align: str("Text alignment.", { enum: ["left", "center", "right", "justify"] }),
  line_height: num("Line spacing, 0.6 to 3 (1.1 is tight and punchy).", 0.6, 3),
  letter_spacing: num("Letter spacing in thousandths of an em (0 normal, 100 wide, -30 tight).", -300, 2000),
  uppercase: bool("Turn the words into CAPITALS."),
  effect: EFFECT,
  remove_effects: { type: "array", description: "Effect names to switch off, or [\"all\"].", items: str("Effect name.", { enum: [...EFFECT_NAMES, "all"] }), maxItems: 20 },
  curve: num("Bend the text on an arc: -100 (down) to 100 (up), 0 = straight.", -100, 100),
};

const CHART = obj({
  rows: {
    type: "array", minItems: 1, maxItems: 12, description: "Bar, row, line, pie and donut data.",
    items: obj({ label: str("Category label.", { maxLength: 40 }), value: num("The number."), color: color("Colour for this row.") }, ["label", "value"]),
  },
  value: num("Progress bar or ring: the percent, 0 to 100.", 0, 100),
  number: str("Big number chart: the figure shown, e.g. \"2.4M\".", { maxLength: 16 }),
  label: str("Progress or big number caption.", { maxLength: 60 }),
  color: color("Main colour for progress, ring and big number."),
  ink: color("Colour of labels and values."),
  font: str("Chart font: Inter, Archivo Black, Anton, Poppins, Montserrat, Space Grotesk or Barlow Condensed.", { maxLength: 40 }),
  show_values: bool("Show the numbers."),
  show_labels: bool("Show the labels."),
}, [], "Chart data. Only the fields for your chart type are used.");

const CHARACTER_FIELDS = {
  who: str("Cast member.", { enum: CAST.map((c) => c.who) }),
  expression: str("Face.", { enum: EXPRS.map((e) => e.id) }),
  facing: str("Which way the body faces.", { enum: ["right", "left"] }),
  look: str("Where the eyes point.", { enum: LOOKS.map((l) => l.id) }),
  head_only: bool("Draw the head only (big-head close-up)."),
  sticker: bool("White die-cut sticker outline with a drop shadow."),
};

// ---- the tools ------------------------------------------------------------------------------

const CHANGE = obj({
  id: str("The object's id from get_design.", { minLength: 1, maxLength: 80 }),
  ...PLACE, ...SIZE, ...LOOK_FIELDS,
  flip_x: bool("Mirror left-right."),
  flip_y: bool("Mirror top-bottom."),
  locked: bool("Lock (true) or unlock (false). Locked objects can't be changed until unlocked."),
  visible: bool("Show or hide."),
  fill: color("Fill colour: shapes and text; a line's colour; for a graphic (icon, illustration, sticker) its main colour."),
  gradient: GRADIENT,
  stroke: color("Border colour of a shape."),
  stroke_width: num("Border width in pixels (0 = none).", 0, 400),
  radius: num("Corner radius of a rectangle, in pixels.", 0, 2000),
  recolor: obj({ from: color("A colour now in the graphic (see get_design colors)."), to: color("The new colour.") }, ["from", "to"],
    "Swap one colour inside a graphic or group."),
  text: str("New words for a text, a text group with one text, or a badge.", { maxLength: 2000 }),
  ...TEXT_STYLE,
  // Same names and settings as add_text's effect, without repeating each effect's hint.
  effect: { ...EFFECT, description: "Text effects to switch on, as in add_text (e.g. {\"outline\": {\"thickness\": 50, \"color\": \"#000000\"}}).",
    properties: Object.fromEntries(EFFECT_NAMES.map((id) => [id, { type: "object" }])) },
  ...CHARACTER_FIELDS,
  chart: { ...CHART, description: "New chart data (same fields as add_element chart)." },
}, ["id"]);

export const TOOLS = [
  {
    name: "get_design",
    description: "Read the open design: page size, background, safe zones, the user's current selection, and every object bottom to top with its id, kind, name, box (x, y, w, h in page pixels from the top-left), angle, colours, text and font, character, lock and animation. Call this first and after big changes; use the ids with the other tools.",
    input_schema: obj({}),
  },
  {
    name: "look_at_design",
    description: "See the page as a picture (long side up to 1568 px). Use it to check your work like a designer would: hierarchy, readability at small size, balance, overlaps. With mark_ids the picture shows numbered boxes and the text says which number is which object id.",
    input_schema: obj({
      mark_ids: bool("Draw each object's box with a number, to match what you see to ids."),
      max_side: int("Long side of the picture in pixels (256 to 1568, default 1568).", 256, 1568),
    }),
  },
  {
    name: "style_references",
    description: "The user's style reference pictures in this app: the ones attached right now, and their saved styles (named sets, e.g. \"my channel look\"). Without input it lists them with measured colours and layout. With style (a saved style's name, or \"attached\") it shows one picture so you can match its style; picture picks which (1 = first).",
    input_schema: obj({
      style: str("A saved style's name, or \"attached\" for the pictures attached in the chat.", { maxLength: 60 }),
      picture: int("Which picture of that style to show (1 = first).", 1, 5),
    }),
  },
  {
    name: "list_assets",
    description: `Search the built-in catalogues: ${CATALOGS.join(", ")}. Returns keys/ids to pass to other tools, with names and tags. Everything is local and free to use.`,
    input_schema: obj({
      catalog: str("Which catalogue.", { enum: CATALOGS }),
      query: str("Words to search for (optional), e.g. \"money\", \"neon\", \"arrow\".", { maxLength: 80 }),
      limit: int("How many results (default 40).", 1, 200),
      offset: int("Skip this many results (for paging).", 0, 5000),
    }, ["catalog"]),
  },
  {
    name: "new_design",
    description: "Start a new design and open it. The user's open design is saved first and stays in their Home list. Give a size preset id (list_assets sizes; default yt-thumb 1280x720) or width and height, or a template id to start from that template at its own size. Clears undo history.",
    input_schema: obj({
      size: str("Size preset id, e.g. yt-thumb, shorts, ig-post, ig-story, presentation, a4.", { maxLength: 40 }),
      width: int("Custom width in pixels (with height).", 16, 8000),
      height: int("Custom height in pixels (with width).", 16, 8000),
      name: str("Design name.", { maxLength: 80 }),
      template: str("Start from this template id (list_assets templates).", { maxLength: 80 }),
      background: color("Start with this page colour."),
    }),
  },
  {
    name: "apply_template",
    description: "Replace everything on the page with a template (scaled to fit the page), as one undo step. If the page already has objects you must pass replace: true, and only do that when the user wants it; otherwise start a new_design with the template.",
    input_schema: obj({
      template_id: str("Template id from list_assets templates.", { minLength: 1, maxLength: 80 }),
      replace: bool("Confirm replacing the objects already on the page."),
    }, ["template_id"]),
  },
  {
    name: "set_background",
    description: "Set the page background: a solid colour, a gradient, or a drawn scene/pattern (list_assets scenes, e.g. rainy-neon-street, brick-wall-night, neon-skyline). Give exactly one of color, gradient or scene. A colour or gradient removes a scene.",
    input_schema: obj({
      color: color("Solid page colour."),
      gradient: GRADIENT,
      scene: str("Scene or pattern key.", { maxLength: 60 }),
      scene_colors: { type: "object", description: "Scene colour slots to change, e.g. {\"bg\": \"#0d0a10\"} (slot ids from list_assets scenes).", additionalProperties: color("Colour.") },
    }),
  },
  {
    name: "add_text",
    description: "Add a text box. Without x/y it is centred; without w it hugs the words (up to 90% of the page). Use a preset (list_assets text_presets) for a styled look, then override any field. Returns the id and box.",
    input_schema: obj({
      text: str("The words. Use \\n for a new line.", { minLength: 1, maxLength: 2000 }),
      preset: str("Text preset id to copy the style from.", { maxLength: 60 }),
      ...PLACE,
      w: num("Wrap width in page pixels.", 10, 20000),
      ...TEXT_STYLE,
      angle: LOOK_FIELDS.angle, opacity: LOOK_FIELDS.opacity, name: LOOK_FIELDS.name,
    }, ["text"]),
  },
  {
    name: "add_shape",
    description: "Add a shape (list_assets shapes: rect, roundRect, circle, triangle, star5, heart, arrowRight, bubble, burst, blob...). Default size is about a third of the page; centred without x/y.",
    input_schema: obj({
      shape: str("Shape key.", { minLength: 1, maxLength: 40 }),
      ...PLACE, ...SIZE,
      fill: color("Fill colour (default hot pink)."),
      gradient: GRADIENT,
      stroke: color("Border colour."),
      stroke_width: num("Border width in pixels.", 0, 400),
      radius: num("Corner radius for rect and roundRect.", 0, 2000),
      ...LOOK_FIELDS,
    }, ["shape"]),
  },
  {
    name: "add_line",
    description: "Add a straight line or arrow from (x1, y1) to (x2, y2) in page pixels.",
    input_schema: obj({
      x1: num("Start x."), y1: num("Start y."), x2: num("End x."), y2: num("End y."),
      color: color("Line colour (default near-black)."),
      width: num("Thickness in pixels (default 8).", 1, 200),
      style: str("Line style.", { enum: ["solid", "dashed", "dotted"] }),
      start_cap: str("Start end.", { enum: CAPS }),
      end_cap: str("Finish end (triangle = arrowhead).", { enum: CAPS }),
      opacity: LOOK_FIELDS.opacity, name: LOOK_FIELDS.name,
    }, ["x1", "y1", "x2", "y2"]),
  },
  {
    name: "add_element",
    description: "Add a ready-made graphic: illustration (paper-cut art), badge (a label with your words), decoration (blobs, squiggles, light leaks, grain), sticker (thumbnail arrows, circles, emoji), icon (Lucide line icons), chart (with your data), photo_grid (empty photo frames the user fills; to fill them yourself use make_collage), image (an inline data:image picture) or my_element (something saved in the user's library; keys from list_assets my_elements). Keys come from list_assets.",
    input_schema: obj({
      type: str("What to add.", { enum: ELEMENT_TYPES }),
      key: str("Catalogue key (icon name for icons, chart type for charts, layout for photo grids). Not needed for image.", { maxLength: 80 }),
      text: str("Badge words.", { maxLength: 200 }),
      color: color("Main colour of an icon, sticker or decoration."),
      chart: CHART,
      image_data: str("type image only: data:image/png|jpeg|webp|gif;base64,...", { maxLength: 8_500_000 }),
      ...PLACE, ...SIZE, ...LOOK_FIELDS,
    }, ["type"]),
  },
  {
    name: "add_character",
    description: "Add an Oddly Clever cast member as an editable vector character: sparks (reckless), brick (unbothered), milo (nervous wreck), rae (troublemaker), keeper (hooded memory dealer). Default height: 72% of the page (50% for head only). The cast keeps its own colours.",
    input_schema: obj({
      ...CHARACTER_FIELDS,
      height: num("Height in page pixels.", 20, 20000),
      ...PLACE, angle: LOOK_FIELDS.angle, opacity: LOOK_FIELDS.opacity, name: LOOK_FIELDS.name,
    }, ["who"]),
  },
  {
    name: "find_my_pictures",
    description: "Search the user's own picture folders on their PC (the folders they allowed under My folders) by words in file and folder names, e.g. \"lustig\", \"eiffel tower\", \"thumb\". Returns numbered paths and a contact sheet picture of them so you can pick the right one. Prefer the user's own pictures when they fit.",
    input_schema: obj({
      search: str("Words to look for in folder and file names (empty lists recent ones).", { maxLength: 120 }),
      folder: str("Only this allowed folder (its name).", { maxLength: 120 }),
      limit: int("How many to show (default 12).", 1, 16),
    }),
  },
  {
    name: "add_my_picture",
    description: "Place one of the user's own pictures (a path exactly as find_my_pictures listed it). Optionally give it a photo look at once.",
    input_schema: obj({
      picture: str("Folder/path/name.png exactly as find_my_pictures listed it.", { minLength: 3, maxLength: 600 }),
      look: { type: "string", enum: PHOTO_LOOKS, description: "Optional photo look (see photo_look)." },
      caption: str("Polaroid caption (handwritten), e.g. \"Paris, 1925\".", { maxLength: 60 }),
      ...PLACE, ...SIZE, angle: LOOK_FIELDS.angle, opacity: LOOK_FIELDS.opacity, name: LOOK_FIELDS.name,
    }, ["picture"]),
  },
  {
    name: "generate_image",
    description: "Make a new picture with the user's image AI and place it (it costs them credit and only a few are allowed per 10 minutes: make each count). For real-looking people, places, objects and scenes the app doesn't have. Write a detailed prompt: subject, framing, lighting, era, mood, colours, background. No text in the picture (use add_text). No logos, brands, known characters or living people's likenesses.",
    input_schema: obj({
      prompt: str("What to draw, in detail.", { minLength: 10, maxLength: 2000 }),
      aspect: { type: "string", enum: ["landscape", "portrait", "square"], description: "Picture shape (default landscape)." },
      quality: { type: "string", enum: ["low", "medium", "high"], description: "Higher costs more. Default: the user's setting." },
      like: LIKE,
      look: { type: "string", enum: PHOTO_LOOKS, description: "Optional photo look (see photo_look)." },
      caption: str("Polaroid caption (handwritten).", { maxLength: 60 }),
      ...PLACE, ...SIZE, angle: LOOK_FIELDS.angle, opacity: LOOK_FIELDS.opacity, name: LOOK_FIELDS.name,
    }, ["prompt"]),
  },
  {
    name: "make_collage",
    description: "Fill the page (or a box) with a photo collage in one call: every cell gets a picture cropped around its subject. Per cell: id (a picture on the page, moved in), picture (from find_my_pictures) or prompt (a new AI picture; they're made in parallel and count toward the limit). It goes behind everything; add text on top after. Layouts: g5s (2 + tall middle + 2, the 'vs' look), g3m, g2h, g3l, g3c, g4, g4l, g5, g6.",
    input_schema: obj({
      layout: str("Layout key, e.g. g5s.", { minLength: 2, maxLength: 20 }),
      cells: {
        type: "array", minItems: 1, maxItems: 6, description: "One per cell in layout order (g5s: left top, left bottom, middle, right top, right bottom).",
        items: obj({
          id: str("A picture on the page, or <collage id>:<cell>.", { maxLength: 90 }),
          picture: str("A find_my_pictures path.", { maxLength: 600 }),
          prompt: str("A new picture (like generate_image).", { minLength: 10, maxLength: 2000 }),
          like: LIKE,
          quality: { type: "string", enum: ["low", "medium", "high"], description: "Default: the user's setting." },
          focus: { type: "string", enum: ["auto", "top", "center", "bottom", "left", "right"], description: "Kept in view when cropping (auto = the subject)." },
        }),
      },
      x: PLACE.x, y: PLACE.y,
      w: num("Width (default: the page).", 40, 20000),
      h: num("Height (default: the page).", 40, 20000),
      gap: num("Space between cells (default ~1% of the page).", 0, 400),
      radius: num("Cell corner radius (default 0).", 0, 400),
      to_back: bool("Behind everything else (default true)."),
      name: LOOK_FIELDS.name,
    }, ["layout", "cells"]),
  },
  {
    name: "draw_vector",
    description: "Draw new vector art by writing SVG, like a designer drawing in code: an original character, prop, icon, map, badge or scene. It becomes an editable group (every shape selectable and recolourable). One <svg> with a viewBox; path, rect, circle, ellipse, line, polyline, polygon, g, text, gradients, clipPath, use (no images, scripts or links). See the guide for drawing characters. Then look_at_design.",
    input_schema: obj({
      svg: str("One <svg viewBox='...'>...</svg> element.", { minLength: 20, maxLength: 200000 }),
      ...PLACE, ...SIZE, angle: LOOK_FIELDS.angle, opacity: LOOK_FIELDS.opacity, name: LOOK_FIELDS.name,
    }, ["svg"]),
  },
  {
    name: "save_as_template",
    description: "Save the open design as a template in the user's library (Templates, My templates) for new_design or apply_template later. When asked, or offer it after a design they like.",
    input_schema: obj({
      name: str("Template name.", { minLength: 1, maxLength: 80 }),
      tags: { type: "array", maxItems: 12, items: str("A search word.", { maxLength: 30 }), description: "Search words." },
    }, ["name"]),
  },
  {
    name: "save_element",
    description: "Save objects (a drawn character, a badge, a text lockup) as one element in the user's library (Elements, My elements); add_element type my_element places it later.",
    input_schema: obj({
      ids: ids("The objects to keep together as one element."),
      name: str("Element name, e.g. 'Grumpy shopkeeper'.", { minLength: 1, maxLength: 80 }),
      tags: { type: "array", maxItems: 12, items: str("A search word.", { maxLength: 30 }), description: "Search words." },
    }, ["ids", "name"]),
  },
  {
    name: "use_feature",
    description: "The app's bigger features: video (timeline, music, captions, MP4), stock (free photos and videos), planner (posting calendar, upload kits), bulk (a design per table row), translate, share (offline .html files), pages (add, reorder, smart resize), magic (photo eraser, edit, expand, grab), text (style one word, weight, fit), photo (adjust, crop), export, templates (as a page). Call action \"help\" first: it lists that feature's actions and fields.",
    input_schema: obj({
      feature: str("Which feature.", { enum: ["video", "stock", "planner", "bulk", "translate", "share", "pages", "magic", "text", "photo", "export", "templates"] }),
      action: str("\"help\", or an action help listed.", { minLength: 1, maxLength: 40 }),
      args: { type: "object", description: "The action's fields." },
    }, ["feature", "action"]),
  },
  {
    name: "remove_background",
    description: "Cut the subject (person, product, animal) out of a picture, on the user's GPU, free. layer: true keeps the photo and puts the cut-out on top, so a headline can sit behind the subject (a strong thumbnail look).",
    input_schema: obj({
      id: str("The picture's id.", { minLength: 1, maxLength: 80 }),
      layer: bool("Keep the photo and add the cut-out above it (default false: cut out in place)."),
    }, ["id"]),
  },
  {
    name: "photo_look",
    description: "Give a picture a photo look, baked in: polaroid (instant-photo paper, handwritten caption, slight tilt, shadow), split_light (black and white lit cyan from the left and red from the right, with a dashed split line: the 'real vs fake' look), bw_grain (punchy black and white, grain, vignette), noir (darker, harder). Apply once per picture.",
    input_schema: obj({
      id: str("The picture's id.", { minLength: 1, maxLength: 80 }),
      look: { type: "string", enum: PHOTO_LOOKS, description: "The look." },
      caption: str("Polaroid caption (handwritten).", { maxLength: 60 }),
      line: bool("split_light: draw the dashed split line (default true)."),
    }, ["id", "look"]),
  },
  {
    name: "update_objects",
    description: "Change one or more objects in one undo step: move (x/y or cx/cy), resize (w/h; for text, w is the wrap width and font_size sets the size), rotate, recolour, change words, font and effects, opacity, lock, flip, a character's face/pose, or a chart's data. Only the fields you give change.",
    input_schema: obj({
      changes: { type: "array", minItems: 1, maxItems: 60, description: "One entry per object.", items: CHANGE },
    }, ["changes"]),
  },
  {
    name: "duplicate_objects",
    description: "Copy objects, offset by dx/dy pixels (default 30, 30). Returns the new ids.",
    input_schema: obj({ ids: ids(), dx: num("Horizontal offset.", -20000, 20000), dy: num("Vertical offset.", -20000, 20000) }, ["ids"]),
  },
  {
    name: "delete_objects",
    description: "Delete objects by id (one undo step). Locked objects must be unlocked first. Don't delete the user's own content unless they asked.",
    input_schema: obj({ ids: ids() }, ["ids"]),
  },
  {
    name: "arrange",
    description: "Layer order, alignment, spacing and grouping. align_* with one object aligns it to the page; with several, to their shared box (or pass relative_to: page). distribute_* needs 3+ objects. group returns the new group's id; ungroup takes one group.",
    input_schema: obj({
      action: str("What to do.", { enum: ARRANGE_ACTIONS }),
      ids: ids(),
      relative_to: str("Align to the page or to the objects' shared box.", { enum: ["page", "selection"] }),
    }, ["action", "ids"]),
  },
  {
    name: "apply_palette",
    description: "Recolour the whole design with a palette by role (page, text, main colour, accents), keeping text readable. Characters and photos keep their colours. Use a palette id (list_assets palettes, e.g. oddly) or your own five colours.",
    input_schema: obj({
      palette_id: str("Palette id.", { maxLength: 40 }),
      colors: obj({ bg: color("Page."), ink: color("Text."), main: color("Main colour."), a1: color("Accent 1."), a2: color("Accent 2.") },
        ["bg", "ink", "main", "a1", "a2"], "A custom palette."),
      variation: int("0 to 11: other ways to map the same palette (like Shuffle).", 0, 11),
    }),
  },
  {
    name: "apply_font_pairing",
    description: "Set every text's font: the biggest texts get the heading font, the rest the body font. Use a pairing id (list_assets font_pairings, e.g. oddly, thumb-anton) or your own.",
    input_schema: obj({
      pairing_id: str("Font pairing id.", { maxLength: 40 }),
      heading: obj({ font: str("Font family.", { maxLength: 60 }), weight: int("Weight.", 100, 900), italic: bool("Italic.") }, ["font"]),
      body: obj({ font: str("Font family.", { maxLength: 60 }), weight: int("Weight.", 100, 900) }, ["font"]),
    }),
  },
  {
    name: "animate",
    description: "Animate for video/GIF export. Either a whole-page preset (page_preset) or per object: intro (how it arrives), loop (keeps moving) and outro (how it leaves). Text-only intros: typewriter, words, letters, baseline. Use \"none\" to remove one phase, or remove: true for all. duration sets the page length in seconds.",
    input_schema: obj({
      page_preset: str("Animate every object in one style.", { enum: PAGE_PRESETS.map((p) => p.id) }),
      ids: { ...ids(), minItems: 0 },
      intro: str("Intro motion.", { enum: [...INTROS, "none"] }),
      loop: str("Loop motion.", { enum: [...LOOP_TYPES, "none"] }),
      outro: str("Outro motion.", { enum: [...OUTROS, "none"] }),
      speed: str("Speed.", { enum: SPEED_IDS }),
      delay: num("Intro delay in seconds.", 0, 30),
      remove: bool("Remove all animation from these objects."),
      duration: num("Page length in seconds.", 1, 30),
    }),
  },
  {
    name: "check_design",
    description: "Run the studio's design check: text too small at feed size, low contrast, things off the page or under platform UI (safe zones), too many fonts. Each finding has an id and, when possible, a fix; pass fix: <finding id> to apply it (one undo step).",
    input_schema: obj({
      fix: str("A finding id to fix.", { maxLength: 120 }),
      zones: str("Which platform's safe zones to check (default: matches the page size).",
        { enum: ["auto", "yt-thumb", "shorts", "story", "banner", "ig-grid", "print"] }),
    }),
  },
  {
    name: "undo",
    description: "Undo your last change(s). It only undoes steps the AI made; if the user changed something since, it stops and says so (pass force: true only if the user asked).",
    input_schema: obj({ steps: int("How many steps (default 1).", 1, 30), force: bool("Undo even the user's own changes.") }),
  },
];
