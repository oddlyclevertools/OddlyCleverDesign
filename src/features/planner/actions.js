// Planner functions for the UI and the AI: list, add and change posts, slots, and the upload kit.
import { deletePost, getAllPosts, getPost, getSlots, putPost, putSlots } from "./db.js";
import { byWhen, isYmd, normalizePost, normalizeSlot, openSlots, STATUSES } from "./model.js";
import { buildKit, saveBytes } from "./kit.js";

/**
 * Planned posts, in date order (undated ideas last), plus the empty slots in the range.
 * @param {*} app
 * @param {{from?: string, to?: string, status?: string, withSlots?: boolean}} opts
 * @returns {Promise<{posts: object[], openSlots: object[]}>}
 */
export async function listPlan(app, { from = "", to = "", status = "", withSlots = true } = {}) {
  if (from && !isYmd(from)) throw new Error("from must look like 2026-10-31.");
  if (to && !isYmd(to)) throw new Error("to must look like 2026-10-31.");
  if (status && !STATUSES.some((s) => s.id === status)) throw new Error(`status must be one of: ${STATUSES.map((s) => s.id).join(", ")}.`);
  const all = (await getAllPosts()).sort(byWhen);
  const inRange = (p) => (!from || (p.date && p.date >= from)) && (!to || (p.date && p.date <= to));
  const posts = all.filter((p) => (!status || p.status === status) && (from || to ? inRange(p) : true));
  const slots = withSlots && from && to ? openSlots(await getSlots(), all, from, to) : [];
  return { posts, openSlots: slots };
}

/** Add a post. Missing fields get friendly defaults (status idea, 17:00 London). */
export async function addPost(app, fields = {}) {
  const { id: _ignored, ...rest } = fields;
  return putPost(normalizePost(rest));
}

/** Change some fields of a post. */
export async function updatePost(app, id, fields = {}) {
  const base = await getPost(id);
  if (!base) throw new Error("That post isn't in the planner any more.");
  const { id: _id, created: _c, ...rest } = fields;
  return putPost(normalizePost(rest, base));
}

/** Delete a post (the UI asks first). */
export const removePost = (app, id) => deletePost(id);

export const listSlots = () => getSlots();
/** Replace the repeating slots. */
export const saveSlots = (app, slots) => putSlots(slots.map(normalizeSlot));

/**
 * Make a post's upload kit and save it as a zip.
 * @returns {Promise<{filename: string, files: string[], aiPictures: string[], credits: number, notes: string[]}>}
 */
export async function downloadUploadKit(app, id, { onProgress, save = true } = {}) {
  const post = await getPost(id);
  if (!post) throw new Error("That post isn't in the planner any more.");
  const kit = await buildKit(app, post, { onProgress });
  if (save) saveBytes(kit.bytes, kit.filename);
  return { filename: kit.filename, files: kit.files, aiPictures: kit.aiPictures, credits: kit.credits.length, notes: kit.notes, bytes: save ? undefined : kit.bytes };
}
