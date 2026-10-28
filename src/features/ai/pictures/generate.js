// Make a picture with the user's image AI (B.AI or OpenAI, OpenAI-style images API), called
// straight from this browser with the user's key. The prompt is sent, plus reference pictures
// when the AI asks for "the same person/place as" earlier pictures (images/edits). A rolling
// limit (the user's setting, per WINDOW_MS) keeps a runaway AI from spending money.
import { providerById, hostOf } from "../presets.js";
import { imageSettings, providerSettings } from "../settings.js";
import { getKey } from "../keys.js";

const TIMEOUT_MS = 240000;
const WINDOW_MS = 10 * 60 * 1000;
const SIZES = { landscape: "1536x1024", portrait: "1024x1536", square: "1024x1024" };
const made = []; // timestamps of recent pictures

/** How many pictures may still be made now, and the limit. */
export function pictureAllowance() {
  const now = Date.now();
  while (made.length && now - made[0] > WINDOW_MS) made.shift();
  const max = imageSettings().limit;
  return { left: Math.max(0, max - made.length), max, minutes: WINDOW_MS / 60000 };
}

async function post(url, key, body, signal, { form = false } = {}) {
  const ctl = new AbortController();
  const stop = () => ctl.abort();
  signal?.addEventListener("abort", stop, { once: true });
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const headers = form ? { authorization: `Bearer ${key}` } : { "content-type": "application/json", authorization: `Bearer ${key}` };
    return await fetch(url, { method: "POST", signal: ctl.signal, headers, body: form ? body : JSON.stringify(body) });
  } catch (e) {
    if (signal?.aborted) throw Object.assign(new Error("Stopped"), { name: "AbortError" });
    if (ctl.signal.aborted) throw new Error("Making the picture took too long. Try again, or use quality low.");
    throw new Error(`Couldn't reach ${hostOf(url)} to make the picture.`);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
}

async function errorOf(res) {
  let detail = "";
  try { const b = await res.json(); detail = b?.error?.message || b?.message || ""; } catch { /* not JSON */ }
  detail = String(detail).slice(0, 240);
  if (res.status === 401 || res.status === 403) return new Error("The image AI didn't accept the key. Check it in Ask AI settings.");
  if (res.status === 429) return new Error(`The image AI is busy or out of credit (rate limit). ${detail}`);
  if (res.status === 400 && /safety|policy|moderation|reject/i.test(detail)) return new Error(`The image AI refused this prompt (safety). Describe it differently. ${detail}`);
  return new Error(`The image AI returned an error (${res.status}). ${detail}`);
}

/** data URL from a b64 or a URL result. */
async function pictureOf(item, signal) {
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item?.url && /^https:\/\//.test(item.url)) {
    const res = await fetch(item.url, { signal });
    if (!res.ok) throw new Error("The picture was made but couldn't be downloaded.");
    const blob = await res.blob();
    if (!/^image\//.test(blob.type)) throw new Error("The image AI sent back something that isn't a picture.");
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Couldn't read the picture."));
      r.readAsDataURL(blob);
    });
  }
  throw new Error("The image AI sent back no picture.");
}

/** A data: URL as a Blob (for the multipart form). */
async function blobOf(dataUrl) {
  return (await fetch(dataUrl)).blob();
}

/**
 * Edit with reference pictures. Tries the JSON form ({images: [{image_url}]}) first, then the
 * classic multipart form (image[] files), since services differ.
 */
async function postWithReferences(base, key, body, references, signal) {
  const url = `${base}/images/edits`;
  let res = await post(url, key, { ...body, images: references.map((r) => ({ image_url: r })) }, signal);
  if (res.ok || ![400, 404, 405, 415, 422].includes(res.status)) return res;
  const form = new FormData();
  for (const [k, v] of Object.entries(body)) form.append(k, String(v));
  for (const [i, r] of references.entries()) form.append("image[]", await blobOf(r), `reference-${i + 1}.png`);
  res = await post(url, key, form, signal, { form: true });
  return res;
}

/** The image AI, its key and address, after the same checks generatePicture makes. */
function imageService() {
  const img = imageSettings();
  if (img.provider === "off") throw new Error("AI pictures are off. The user can turn them on in Ask AI settings (AI pictures).");
  const p = providerById(img.provider);
  const key = getKey(p.id);
  if (!key) throw new Error(`AI picture edits use ${p.name}, but its key isn't entered. Paste it in Ask AI settings.`);
  const allow = pictureAllowance();
  if (allow.left <= 0) throw new Error(`Picture limit reached (${allow.max} per ${allow.minutes} minutes, to protect the user's credit). Try again in a few minutes.`);
  return { img, key, base: providerSettings(p.id).url.replace(/\/+$/, "") };
}

/**
 * Edit a picture with the image AI (Magic Edit, Magic Expand, and the eraser when there's no
 * local model). Posts to {base}/images/edits: JSON (images + mask as image_url) first, then the
 * classic multipart form (image[] + mask). Counts against the picture allowance.
 * @param {{ image: string, mask?: string|null, prompt: string, aspect?: "landscape"|"portrait"|"square", quality?: string }} req
 *   image: a data:image URL; mask: a PNG data URL the same size, transparent = the area to change
 * @returns {Promise<{ src: string, model: string, host: string, form: "json"|"multipart" }>}
 */
export async function editPicture({ image, mask = null, prompt, aspect = "landscape", quality }, { signal } = {}) {
  if (!/^data:image\//.test(String(image || ""))) throw new Error("editPicture needs the picture as a data:image URL.");
  const { img, key, base } = imageService();
  const url = `${base}/images/edits`;
  const body = { model: img.model, prompt: String(prompt || "").slice(0, 4000), n: 1, size: SIZES[aspect] || SIZES.landscape, quality: quality || img.quality };
  made.push(Date.now()); // every edit counts, failed ones too
  let form = "json";
  let res = await post(url, key, { ...body, images: [{ image_url: image }], ...(mask ? { mask: { image_url: mask } } : {}) }, signal);
  const multipart = async (fields) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, String(v));
    f.append("image[]", await blobOf(image), "image.png");
    if (mask) f.append("mask", await blobOf(mask), "mask.png");
    form = "multipart";
    return post(url, key, f, signal, { form: true });
  };
  if (!res.ok && [400, 404, 405, 415, 422].includes(res.status)) res = await multipart(body);
  if (!res.ok && res.status === 400) { // some services take only "auto" sizes or no quality
    const { size: _s, quality: _q, ...plain } = body;
    res = await multipart(plain);
  }
  if (!res.ok) throw await errorOf(res);
  const data = await res.json().catch(() => null);
  return { src: await pictureOf(data?.data?.[0], signal), model: img.model, host: hostOf(url), form };
}

/**
 * @param {{ prompt: string, aspect?: "landscape"|"portrait"|"square", quality?: string, references?: string[] }} req
 *   references: data:image URLs of pictures to keep consistent with (same person, same place)
 * @returns {Promise<{ src: string, model: string, host: string, usedReferences: boolean, note?: string }>}
 */
export async function generatePicture({ prompt, aspect = "landscape", quality, references = [] }, { signal } = {}) {
  const img = imageSettings();
  if (img.provider === "off") throw new Error("AI pictures are off. The user can turn them on in Ask AI settings (AI pictures), or use their folders.");
  const p = providerById(img.provider);
  const key = getKey(p.id);
  if (!key) throw new Error(`AI pictures use ${p.name}, but its key isn't entered. Ask the user to paste it in Ask AI settings.`);
  const allow = pictureAllowance();
  if (allow.left <= 0) throw new Error(`Picture limit reached (${allow.max} per ${allow.minutes} minutes, to protect the user's credit). Use what you made, or their folders.`);
  const base = providerSettings(p.id).url.replace(/\/+$/, "");
  const url = `${base}/images/generations`;
  const body = { model: img.model, prompt: String(prompt).slice(0, 4000), n: 1, size: SIZES[aspect] || SIZES.landscape, quality: quality || img.quality };
  made.push(Date.now()); // count attempts too: a failing loop must not spend without limit
  let note = "";
  if (references.length) {
    const res = await postWithReferences(base, key, body, references.slice(0, 8), signal);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      return { src: await pictureOf(data?.data?.[0], signal), model: img.model, host: hostOf(url), usedReferences: true };
    }
    if ([401, 403, 429].includes(res.status)) throw await errorOf(res);
    note = `The image AI didn't take the reference pictures (${(await errorOf(res)).message.slice(0, 160)}), so this one was made from the words only: describe the person or place in the same detail to keep them alike.`;
  }
  let res = await post(url, key, body, signal);
  if (!res.ok && res.status === 400) { // some services take only "auto" sizes or no quality
    const { size: _s, quality: _q, ...plain } = body;
    res = await post(url, key, plain, signal);
  }
  if (!res.ok) throw await errorOf(res);
  const data = await res.json().catch(() => null);
  return { src: await pictureOf(data?.data?.[0], signal), model: img.model, host: hostOf(url), usedReferences: false, ...(note ? { note } : {}) };
}
