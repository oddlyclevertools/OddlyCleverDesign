// use_feature: one door for the AI into the app's bigger features (video, stock, planner, bulk,
// translate, share, and later magic edits and pages). Their actions and fields are listed by
// action "help", so the always-sent tool list stays small for local models. Design changes run as
// one "AI: …" undo step; calendar, sharing and exports don't touch the design.
import { editorOf, findObjects, json, step } from "./context.js";
import { ToolInputError } from "./validate.js";
import { fitBoxToWords, setShrinkToFit, setWeight, styleTextPart } from "../../text/index.js";
import { addTemplatePage } from "../../templates/engine.js";
import { TEMPLATES } from "../../templates/registry.js";

/** feature -> { api: the app object it lives on, about, actions: { name: { doc, run, edits? } } } */
const FEATURES = {
  video: {
    api: "video", about: "Video timeline: scenes (the pages), video/voice/music/sfx clips, captions, MP4 export.",
    actions: {
      list_timeline: { doc: "{} -> scenes, clips (ids, tracks, times) and media ids", run: (v) => v.listTimeline() },
      add_clip: { doc: "{mediaId, track: video|voice|music|sfx, start?, in?, out?, speed?, volume?}", run: (v, a) => v.addClip(a), edits: true },
      add_music: { doc: "{mediaId, start?, volume?, duck?: true, fadeIn?, fadeOut?}", run: (v, a) => v.addMusic(a), edits: true },
      trim_clip: { doc: "{id, in?, out?, startAt?, endAt?} seconds", run: (v, a) => v.trimClip(a), edits: true },
      split_clip: { doc: "{id, at} seconds on the timeline", run: (v, a) => v.splitClip(a), edits: true },
      move_clip: { doc: "{id, start?, track?}", run: (v, a) => v.moveClip(a), edits: true },
      delete_clip: { doc: "{id}", run: (v, a) => v.deleteClip(a), edits: true },
      set_volume: { doc: "{id, volume?: 0..2, fadeIn?, fadeOut?, muted?}", run: (v, a) => v.setVolume(a), edits: true },
      set_speed: { doc: "{id, speed: 0.1..10, reverse?, keepPitch?: true}", run: (v, a) => v.setSpeed(a), edits: true },
      freeze_frame: { doc: "{id, at?: seconds, hold?: 2}", run: (v, a) => v.freezeFrame(a), edits: true },
      ripple_delete: { doc: "{id} delete a clip and close the gap", run: (v, a) => v.rippleDelete(a), edits: true },
      set_fit: { doc: "{id, fit: cover|contain|blur|color|free, fill?: colour} how a clip fills a page of another shape (blur = blurred copy behind, for Shorts)", run: (v, a) => v.setFit(a), edits: true },
      add_transition: { doc: "{id, type?: cut|crossfade|dip|slide|wipe|zoom|whip|spin, dur?: 0.6}", run: (v, a) => v.addTransition(a), edits: true },
      set_scene_duration: { doc: "{id?: \"page\", duration} seconds", run: (v, a) => v.setSceneDuration(a), edits: true },
      set_ducking: { doc: "{on, amount?: 0..1} music dips under the voice", run: (v, a) => v.setDucking(a), edits: true },
      picture_in_picture: { doc: "{id, on?: true, left?, top?, width?} page pixels", run: (v, a) => v.setPictureInPicture(a), edits: true },
      find_beats: { doc: "{id} a music clip -> bpm and beat times", run: (v, a) => v.findBeats(a) },
      snap_to_beats: { doc: "{id} scene changes land on the music's beats", run: (v, a) => v.snapToBeats(a), edits: true },
      add_captions: { doc: "{cues: [{start, end, text, words?: [{text, start, end}]}], style?}", run: (v, a) => v.addCaptionTrack(a.cues, a.style), edits: true },
      auto_captions: { doc: "{} transcribe the voice on this PC's GPU, word by word (asks the user once for the speech model)", run: (v) => v.autoCaptions({}) },
      caption_style: { doc: "{preset?: highlight|karaoke|pop|boxed|outline|minimal|neon, font?, color?, highlight?, size?, y?}", run: (v, a) => v.setCaptionStyle(a), edits: true },
      edit_caption: { doc: "{id, text?, start?, end?}", run: (v, a) => v.editCaption(a), edits: true },
      add_caption: { doc: "{at, text}", run: (v, a) => v.addCaption(a), edits: true },
      remove_caption: { doc: "{id}", run: (v, a) => v.removeCaption(a), edits: true },
      export_video: { doc: "{quality?: 1080p|4k, fps?: 30|60} downloads an MP4", run: (v, a) => v.exportVideo({ quality: a.quality, fps: a.fps }) },
    },
  },
  stock: {
    api: "stock", about: "Free stock photos and videos (Pexels, Pixabay, Openverse), commercial-use licences only; credits are kept automatically.",
    actions: {
      search: { doc: "{query, kind?: photo|video, source?: all|pexels|pixabay|openverse, orientation?: any|landscape|portrait|square, color?, limit?: 12}", run: (s, a) => s.searchStock(a) },
      add: { doc: "{id (from search), place?: {x, y} page point | \"background\"} downloads it into the design (videos go on the timeline)", run: (s, a) => s.addStock(a.id, a.place ?? null), edits: true },
      credits: { doc: "{} -> the credit lines for the description", run: (s) => s.creditsText() },
    },
  },
  planner: {
    api: "planner", about: "Content calendar (it never posts). Post fields: title, date YYYY-MM-DD, time HH:MM, tz, status idea|drafting|ready|posted, platforms [youtube, shorts, instagram, reels, tiktok, …], description, tags, notes, designId.",
    actions: {
      list: { doc: "{from?, to?, status?} -> posts and empty slots", run: (p, a) => p.listPlan(a) },
      add_post: { doc: "{...post fields}", run: (p, a) => p.addPost(a) },
      update_post: { doc: "{id, ...post fields}", run: (p, { id, ...rest }) => p.updatePost(id, rest) },
      upload_kit: { doc: "{id} downloads a zip: pictures per platform, title, description, tags, checklist", run: (p, a) => p.downloadUploadKit(a.id) },
    },
  },
  bulk: {
    api: "bulk", about: "One design per table row: put {{column}} in texts, or map columns to object ids.",
    actions: {
      targets: { doc: "{} -> what columns can fill (keys, kinds, placeholders)", run: (b) => b.targets() },
      create: { doc: "{rows: [{column: value}], mapping?: {column: objectId}, output?: designs|pages|png|jpg, fit?: true} picture values: a file name from My folders", run: (b, a) => b.bulkCreate({ ...a, download: a.output === "png" || a.output === "jpg" }) },
    },
  },
  translate: {
    api: "translate", about: "Translate the open design with the user's AI (right-to-left and fonts handled).",
    actions: {
      languages: { doc: "{} -> codes and names", run: (t) => t.languages() },
      translate: { doc: "{languages: [code or name], asNew?: false (pages) | true (new designs), scope?: all|selection}", run: (t, a) => t.translateDesign(a) },
    },
  },
  text: {
    api: "", about: "Text boxes by id: style just some letters, font weight, shrink to fit.",
    actions: {
      style_part: { doc: "{id, find: \"word\" | start + end, color?, weight?: 100..900, size?, underline?, highlight?: colour} style only those letters", run: (_, a, app) => styleTextPart(app, { ...a, target: pick(app, a.id) }), edits: true },
      weight: { doc: "{id, weight: 100..900} (only the weights the font has)", run: (_, a, app) => (pick(app, a.id, true), setWeight(app, a.weight)), edits: true },
      shrink_to_fit: { doc: "{id, on?: true} text shrinks to stay inside its box", run: (_, a, app) => (pick(app, a.id, true), setShrinkToFit(app, a.on ?? true)), edits: true },
      fit_box: { doc: "{id} the box hugs its words", run: (_, a, app) => (pick(app, a.id, true), fitBoxToWords(app)), edits: true },
    },
  },
  photo: {
    api: "photoTools", about: "Photo adjustments by id; the page background photo too.",
    actions: {
      adjust: { doc: "{id, exposure?, contrast?, highlights?, shadows?, saturation?, warmth?, tint?, sharpen?, clarity?, blur?, ...} each -100..100", run: (p, { id, ...v }, app) => p.adjust(v, pick(app, id)), edits: true },
      auto_enhance: { doc: "{id}", run: (p, a, app) => p.autoEnhance(pick(app, a.id)), edits: true },
      crop: { doc: "{id, ratio?: w/h number | \"original\", straighten?: -45..45}", run: (p, a, app) => p.crop(pick(app, a.id), { ratio: a.ratio, straighten: a.straighten }), edits: true },
      background_to_photo: { doc: "{} the page background photo becomes a normal photo", run: (_, _a, app) => app.bgPhoto.detach(), edits: true },
    },
  },
  export: {
    api: "files", about: "Downloads of the open design (the user gets the file).",
    actions: {
      download: { doc: "{type: png|jpg|webp|pdf|svg, scale?: 1|2|4, pages?: [0-based indexes] | all, limitKB?, transparent?}", run: (f, { type, ...o }) => f.exportDesign(type, o) },
      copy_image: { doc: "{scale?, pages?} the open page (or \"all\"/[i]) to the clipboard", run: (f, a) => f.copyImage(a) },
    },
  },
  templates: {
    api: "", about: "Templates as extra pages (list_assets templates has the ids).",
    actions: {
      add_page: { doc: "{template} add it as a new page after this one", run: (_, a, app) => addTemplatePage(app, template(a.template)), edits: true },
    },
  },
  magic: {
    api: "magic", about: "Photo edits on a picture by id. Eraser and grab are free (on the user's GPU); edit and expand spend one AI picture each. Boxes are page pixels {x, y, w, h}.",
    actions: {
      erase: { doc: "{id, box} remove what's in the box and fill it naturally", run: (m, a, app) => m.magicErase(app, picture(app, a.id), a.box), edits: true },
      edit: { doc: "{id, prompt, box?} change the box (or the whole picture) as the words say", run: (m, a, app) => m.magicEdit(app, picture(app, a.id), a.prompt, a.box || null), edits: true },
      expand: { doc: "{id, aspect?: 16:9|9:16|1:1|4:5|page, percent?, prompt?} grow the photo, AI fills the new area", run: (m, a, app) => m.magicExpand(app, picture(app, a.id), a), edits: true },
      grab: { doc: "{id} lift the subject onto its own layer and fill the hole", run: (m, a, app) => m.magicGrab(app, picture(app, a.id), { ask: false }), edits: true },
      restore: { doc: "{id} back to the photo before any magic edit", run: (m, a, app) => m.restoreOriginal(app, picture(app, a.id)), edits: true },
    },
  },
  pages: {
    api: "pages", about: "Pages of the open design (all the same size; indexes start at 0), Present mode and Smart resize.",
    actions: {
      list: { doc: "{} -> pages with index, name, notes, current", run: (p) => p.list() },
      add: { doc: "{at?, name?, notes?} a blank page, shown", run: (p, a) => p.add(a), edits: true },
      duplicate: { doc: "{index?} copy a page right after it", run: (p, a) => p.duplicate(a.index), edits: true },
      delete: { doc: "{index}", run: (p, a) => p.remove(a.index), edits: true },
      go_to: { doc: "{index} show a page (not an undo step)", run: (p, a) => p.goTo(a.index) },
      move: { doc: "{from, to}", run: (p, a) => p.move(a.from, a.to), edits: true },
      rename: { doc: "{index, name}", run: (p, a) => p.rename(a.index, a.name), edits: true },
      notes: { doc: "{index, notes} speaker notes", run: (p, a) => p.setNotes(a.index, a.notes), edits: true },
      smart_resize: { doc: "{size: a size id from list_assets sizes, or {w, h}, asNewDesign?: false} keeps the subject and headline big, text out of platform overlays", run: (p, a) => p.smartResize(a.size, { asNewDesign: Boolean(a.asNewDesign) }), edits: true },
      resize_to_many: { doc: "{sizes: [size id or {w, h}]} one new design per size", run: (p, a) => p.resizeToMany(a.sizes) },
    },
  },
  share: {
    api: "share", about: "Share as files (no server): an offline .html viewer, or a review copy others pin comments on.",
    actions: {
      export: { doc: "{mode?: view|review} downloads the .html", run: (s, a) => s.exportShareFile({ mode: a.mode || "view" }) },
      comments: { doc: "{} -> review comments on this design", run: (s) => s.comments() },
      resolve_comment: { doc: "{id, resolved?: true}", run: (s, a) => s.resolveComment(a.id, a.resolved ?? true) },
    },
  },
};

export const FEATURE_NAMES = Object.keys(FEATURES);

/** An object by id; with `select`, also make it the selection (the text tools work on it). */
function pick(app, id, select = false) {
  const ed = editorOf(app);
  const [o] = findObjects(ed, [id]);
  if (select) { ed.canvas.setActiveObject(o); ed.canvas.requestRenderAll(); }
  return o;
}

function template(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new ToolInputError(`No template "${id}". list_assets with catalog "templates" has the ids.`);
  return t;
}

/** A picture on the page by id (for the magic edits). */
function picture(app, id) {
  const [o] = findObjects(editorOf(app), [id]);
  if (!/image/i.test(o?.type || "")) throw new ToolInputError(`"${id}" isn't a picture. Magic edits work on photos.`);
  return o;
}

/** Add actions for a feature that installs later (magic edits, pages). */
export function registerFeatureActions(name, def) {
  FEATURES[name] = { ...(FEATURES[name] || {}), ...def, actions: { ...(FEATURES[name]?.actions || {}), ...def.actions } };
}

function help(name, f) {
  const lines = Object.entries(f.actions).map(([a, d]) => `- ${a}: ${d.doc}`);
  return `${name}: ${f.about}\nActions (put the fields in args):\n${lines.join("\n")}`;
}

export async function useFeature(app, inp, { signal }) {
  const f = FEATURES[inp.feature];
  if (!f) throw new ToolInputError(`Unknown feature "${inp.feature}". Use: ${FEATURE_NAMES.join(", ")}.`);
  const api = f.api ? app[f.api] : app;
  if (!api) throw new ToolInputError(`The ${inp.feature} feature isn't installed in this app.`);
  if (inp.action === "help") return { text: help(inp.feature, f) };
  const act = f.actions[inp.action];
  if (!act) throw new ToolInputError(`${inp.feature} has no action "${inp.action}". Use action "help" to list them: ${Object.keys(f.actions).join(", ")}.`);
  const args = inp.args || {};
  const run = async () => {
    try { return await act.run(api, args, app); } catch (e) {
      if (e?.name === "AbortError") throw e;
      throw new ToolInputError(e?.message || String(e));
    }
  };
  const out = act.edits ? await step(app, `${inp.feature} ${inp.action}`.replace(/_/g, " "), run, { signal }) : await run();
  return { text: typeof out === "string" ? out : json(out ?? { done: true }) };
}
