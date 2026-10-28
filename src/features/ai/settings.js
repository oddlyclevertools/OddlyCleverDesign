// Non-secret AI settings (which provider, model, address, vision, effort), kept in localStorage so
// they survive a reload. Keys are NEVER stored here: they live in keys.js.
import { CLAUDE_MODELS, defaultEffort, effortsFor, providerById } from "./presets.js";

const STORE_KEY = "oddlyclever.ai.settings";
const ALLOWED = ["model", "url", "vision", "effort"];

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch { return {}; }
}

let state = read();

function write(next) {
  state = next;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage blocked: memory only */ }
}

export function currentProviderId() {
  return providerById(state.provider).id;
}

/** The full settings for one provider, with defaults filled in. */
export function providerSettings(id = currentProviderId()) {
  const p = providerById(id);
  const saved = state.per?.[p.id] || {};
  return {
    id: p.id,
    kind: p.kind,
    url: typeof saved.url === "string" && saved.url ? saved.url : p.url,
    model: typeof saved.model === "string" && saved.model ? saved.model : (p.kind === "anthropic" ? CLAUDE_MODELS[0].id : ""),
    vision: typeof saved.vision === "boolean" ? saved.vision : Boolean(p.vision),
    effort: effortsFor(p).some((e) => e.id === saved.effort) ? saved.effort : defaultEffort(p),
  };
}

export function chooseProvider(id) {
  write({ ...state, provider: providerById(id).id });
}

/** Change some settings of one provider (unknown fields are ignored). */
export function updateProviderSettings(id, patch) {
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => ALLOWED.includes(k)));
  const per = { ...(state.per || {}) };
  per[id] = { ...(per[id] || {}), ...clean };
  write({ ...state, per });
}

// ---- AI pictures (generate_image) -------------------------------------------------------------

/** Providers with an OpenAI-style images API, and the image model each starts with. */
export const IMAGE_PROVIDERS = { bai: "gpt-image-2", openai: "gpt-image-1" };
const QUALITIES = ["low", "medium", "high"];
/** How many pictures the AI may make per 10 minutes (a collage needs one per panel). */
export const PICTURE_LIMITS = [4, 8, 12, 20];

/**
 * Where AI pictures come from. provider "off" turns generate_image off; it starts on the chat
 * provider when that one can make pictures.
 */
export function imageSettings() {
  const saved = state.images || {};
  const chat = currentProviderId();
  const fallback = IMAGE_PROVIDERS[chat] ? chat : "off";
  const provider = saved.provider === "off" || IMAGE_PROVIDERS[saved.provider] ? saved.provider : fallback;
  return {
    provider,
    model: typeof saved.model === "string" && saved.model ? saved.model : IMAGE_PROVIDERS[provider] || "",
    quality: QUALITIES.includes(saved.quality) ? saved.quality : "medium",
    limit: PICTURE_LIMITS.includes(saved.limit) ? saved.limit : 8,
  };
}

export function updateImageSettings(patch) {
  const next = { ...(state.images || {}) };
  if (patch.provider !== undefined) { next.provider = patch.provider; next.model = ""; }
  if (patch.model !== undefined) next.model = String(patch.model).trim().slice(0, 80);
  if (patch.quality !== undefined && QUALITIES.includes(patch.quality)) next.quality = patch.quality;
  if (patch.limit !== undefined && PICTURE_LIMITS.includes(patch.limit)) next.limit = patch.limit;
  write({ ...state, images: next });
}
