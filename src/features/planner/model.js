// Content planner model: platforms, statuses, dates, repeating slots, post validation, and the
// text files of an upload kit. Pure (no DOM), so Node tests can import it.
//
// Post: { id, title, description, tags[], platforms[], date "YYYY-MM-DD" | "", time "HH:MM", tz,
//         status, designId, designs {platformId: projectId}, slotId, notes, created, updated }
// Slot: { id, label, weekdays [0=Sun..6=Sat], time "HH:MM", tz, platforms[], active }

/** Where posts go, with each platform's cover/thumbnail size and text limits. */
export const PLATFORMS = [
  { id: "youtube", name: "YouTube video", short: "YouTube", icon: "Play", color: "#ff4d5e",
    thumb: { w: 1280, h: 720, maxBytes: 2 * 1024 * 1024 }, titleMax: 100, textMax: 5000, tagsMax: 500 },
  { id: "shorts", name: "YouTube Shorts", short: "Shorts", icon: "Smartphone", color: "#ff7aa9",
    thumb: { w: 1080, h: 1920 }, titleMax: 100, textMax: 5000, tagsMax: 500 },
  { id: "instagram", name: "Instagram post", short: "Instagram", icon: "Camera", color: "#c084fc",
    thumb: { w: 1080, h: 1350 }, textMax: 2200, hashtagsMax: 30 },
  { id: "reels", name: "Instagram Reel", short: "Reels", icon: "Clapperboard", color: "#e879f9",
    thumb: { w: 1080, h: 1920 }, textMax: 2200, hashtagsMax: 30 },
  { id: "tiktok", name: "TikTok", short: "TikTok", icon: "Music2", color: "#8fe3ff",
    thumb: { w: 1080, h: 1920 }, textMax: 4000 },
  { id: "facebook", name: "Facebook", short: "Facebook", icon: "ThumbsUp", color: "#60a5fa",
    thumb: { w: 1280, h: 720 }, textMax: 63206 },
  { id: "x", name: "X", short: "X", icon: "AtSign", color: "#e5e7eb",
    thumb: { w: 1600, h: 900 }, textMax: 280 },
  { id: "rumble", name: "Rumble", short: "Rumble", icon: "Video", color: "#4ade80",
    thumb: { w: 1280, h: 720 }, titleMax: 100, textMax: 5000 },
];
export const platformById = (id) => PLATFORMS.find((p) => p.id === id) || null;

export const STATUSES = [
  { id: "idea", label: "Idea", color: "#b2a5b6", icon: "Lightbulb" },
  { id: "drafting", label: "Drafting", color: "#ffb15c", icon: "PenLine" },
  { id: "ready", label: "Ready", color: "#8fe3ff", icon: "CircleCheck" },
  { id: "posted", label: "Posted", color: "#4ade80", icon: "Send" },
];
export const statusById = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];

export const DEFAULT_TZ = "Europe/London";
/** The user's schedule: long videos Tue/Thu/Sat 17:00 London, plus Shorts (change freely). */
export const DEFAULT_SLOTS = [
  { id: "slot-long", label: "Long video", weekdays: [2, 4, 6], time: "17:00", tz: DEFAULT_TZ, platforms: ["youtube"], active: true },
  { id: "slot-shorts", label: "Short", weekdays: [1, 3, 5], time: "17:00", tz: DEFAULT_TZ, platforms: ["shorts"], active: true },
];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---- dates (plain "YYYY-MM-DD" strings; maths in UTC so clocks changing never shift a day) ----

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isYmd = (s) => DATE_RE.test(String(s)) && ymd(parseYmd(s)) === s;
export const isTime = (s) => TIME_RE.test(String(s));
export const parseYmd = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const ymd = (d) => d.toISOString().slice(0, 10);
/** Today in the given time zone (default: this computer's). */
export function today(tz) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(new Date());
}
export const addDays = (s, n) => { const d = parseYmd(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
export const weekday = (s) => parseYmd(s).getUTCDay();
/** The Monday of the week that holds `s`. */
export const startOfWeek = (s) => addDays(s, -((weekday(s) + 6) % 7));
export const addMonths = (s, n) => { const d = parseYmd(s); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); return ymd(d); };
/** 42 days (6 weeks from a Monday) covering the month of `s`. */
export function monthGrid(s) {
  const first = `${s.slice(0, 7)}-01`;
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
export const weekDays = (s) => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(s), i));
export function monthLabel(s) {
  return parseYmd(s).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
export function dayLabel(s, opts = { weekday: "short", day: "numeric", month: "short" }) {
  return parseYmd(s).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}

/** The UTC instant of a wall-clock time in a time zone. */
export function zonedToUtc(date, time, tz = DEFAULT_TZ) {
  const [y, m, d] = date.split("-").map(Number), [hh, mm] = time.split(":").map(Number);
  const want = Date.UTC(y, m - 1, d, hh, mm);
  let t = want;
  for (let i = 0; i < 3; i++) { // two passes settle any offset, including the clock-change days
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    const seen = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
    t += want - seen;
  }
  return t;
}
/** "17:00" in London as this computer's clock shows it, or "" when the zones agree. */
export function localEcho(date, time, tz, localTz = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  if (!tz || tz === localTz) return "";
  const t = zonedToUtc(date, time, tz);
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: localTz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const there = f.format(new Date(t));
  return there === time ? "" : `${there} your time`;
}
export const tzShort = (tz) => String(tz || "").split("/").pop().replace(/_/g, " ");

// ---- slots ------------------------------------------------------------------------------

export function normalizeSlot(s, i = 0) {
  const weekdays = [...new Set((s.weekdays || []).map(Number).filter((n) => n >= 0 && n <= 6))].sort();
  if (!weekdays.length) throw new Error("Pick at least one day for the slot.");
  if (!isTime(s.time)) throw new Error("Slot time must look like 17:00.");
  const platforms = (s.platforms || []).filter((p) => platformById(p));
  if (!platforms.length) throw new Error("Pick at least one platform for the slot.");
  return {
    id: String(s.id || `slot-${Date.now().toString(36)}${i}`).slice(0, 40),
    label: String(s.label || "Post").trim().slice(0, 40) || "Post",
    weekdays, time: s.time, tz: validTz(s.tz) ? s.tz : DEFAULT_TZ, platforms, active: s.active !== false,
  };
}
export function validTz(tz) {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return Boolean(tz); } catch { return false; }
}

/** Every slot time between two dates (inclusive), in date and time order. */
export function slotOccurrences(slots, from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = weekday(d);
    for (const s of slots) {
      if (s.active === false || !s.weekdays.includes(wd)) continue;
      out.push({ slotId: s.id, label: s.label, date: d, time: s.time, tz: s.tz, platforms: s.platforms });
    }
  }
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** Is this slot time already taken by a post (linked to the slot, or same day, time and platform)? */
export function slotFilled(occ, posts) {
  return posts.some((p) => p.date === occ.date && (p.slotId === occ.slotId
    || (p.time === occ.time && p.platforms.some((x) => occ.platforms.includes(x)))));
}

/** The empty slots to fill between two dates. */
export const openSlots = (slots, posts, from, to) => slotOccurrences(slots, from, to).filter((o) => !slotFilled(o, posts));

// ---- posts ------------------------------------------------------------------------------

export const newPostId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const text = (v, max) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max);

/** Tags from a list or "a, b, #c" text: trimmed, no #, no repeats. */
export function parseTags(v) {
  const list = Array.isArray(v) ? v : String(v || "").split(/[,\n]/);
  const out = [], seen = new Set();
  for (const raw of list) {
    const t = String(raw).replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, 100);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out.slice(0, 60);
}

/** How YouTube counts the tags box: commas between, quotes round tags with spaces. */
export const youtubeTagsLength = (tags) => tags.reduce((n, t, i) => n + t.length + (/\s/.test(t) ? 2 : 0) + (i ? 1 : 0), 0);

/**
 * A clean post from user/AI input, merged over `base` (an existing post) without changing it.
 * Throws a plain-English error for anything invalid.
 */
export function normalizePost(input = {}, base = null) {
  const src = { ...(base || {}), ...input };
  const status = src.status ?? "idea";
  if (!STATUSES.some((s) => s.id === status)) throw new Error(`Status must be one of: ${STATUSES.map((s) => s.id).join(", ")}.`);
  const date = src.date ?? "";
  if (date && !isYmd(date)) throw new Error("Date must look like 2026-10-31.");
  const time = src.time || "17:00";
  if (!isTime(time)) throw new Error("Time must look like 17:00 (24-hour clock).");
  const tz = src.tz || DEFAULT_TZ;
  if (!validTz(tz)) throw new Error(`Unknown time zone ${tz}.`);
  const platforms = [...new Set(Array.isArray(src.platforms) ? src.platforms : [src.platforms || "youtube"])];
  const bad = platforms.filter((p) => !platformById(p));
  if (bad.length) throw new Error(`Unknown platform ${bad.join(", ")}. Use: ${PLATFORMS.map((p) => p.id).join(", ")}.`);
  const designs = {};
  for (const [k, v] of Object.entries(src.designs || {})) if (platformById(k) && typeof v === "string" && v) designs[k] = v.slice(0, 64);
  const now = Date.now();
  return {
    id: String(src.id || newPostId()).slice(0, 64),
    title: text(src.title, 200).replace(/\n/g, " ").trim() || "Untitled post",
    description: text(src.description, 10000),
    tags: parseTags(src.tags),
    platforms: platforms.length ? platforms : ["youtube"],
    date, time, tz, status,
    designId: typeof src.designId === "string" ? src.designId.slice(0, 64) : "",
    designs,
    slotId: typeof src.slotId === "string" ? src.slotId.slice(0, 40) : "",
    notes: text(src.notes, 4000),
    created: Number(base?.created) || now,
    updated: now,
  };
}

/** Sort: dated posts by date and time, then undated ones by last change. */
export const byWhen = (a, b) => (a.date && b.date ? (a.date + a.time).localeCompare(b.date + b.time) : a.date ? -1 : b.date ? 1 : b.updated - a.updated);

// ---- AI pictures and the upload kit's text ---------------------------------------------------

/** Names of pictures in saved design JSON that were made with AI. */
export function aiPicturesIn(objects = []) {
  const out = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    const d = o.data || {};
    if (d.made_with || d.madeWith || d.ai === true || d.generated === true || /(^|[-_ ])ai([-_ ]|$)/i.test(String(d.kind || ""))) out.push(o.name || "picture");
    (o.objects || o._objects || []).forEach(walk);
  };
  objects.forEach(walk);
  return out;
}

const lim = (n, max) => (max && n > max ? ` (TOO LONG: ${n}/${max})` : max ? ` (${n}/${max})` : "");
const whenText = (post) => (post.date ? `${dayLabel(post.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} at ${post.time} (${post.tz})` : "no date yet");

/** description.txt: the description, then the stock credits. */
export function descriptionText(post, creditsBlock = "") {
  return [post.description.trim(), creditsBlock].filter(Boolean).join("\n\n") + "\n";
}
/** tags.txt: a comma list for YouTube's tags box and a hashtag line for the others. */
export function tagsText(post) {
  if (!post.tags.length) return "(no tags yet)\n";
  const hash = post.tags.map((t) => `#${t.replace(/[^\p{L}\p{N}_]+/gu, "")}`).filter((t) => t.length > 1);
  return `${post.tags.join(", ")}\n\nHashtags: ${hash.join(" ")}\n`;
}

/**
 * checklist.txt: what to do on each platform, with limits checked and the AI-disclosure reminder.
 * @param {*} post
 * @param {{thumbs: {platform: string, file: string, w: number, h: number, bytes: number, cropped: boolean}[], aiPictures: string[], credits: number, missing: string[]}} info
 */
export function checklistText(post, { thumbs = [], aiPictures = [], credits = 0, missing = [] } = {}) {
  const L = [`UPLOAD CHECKLIST: ${post.title}`, `When: ${whenText(post)}`, `Status: ${statusById(post.status).label}`, "",
    "This app never posts anything. Upload on each site yourself and tick these off.", ""];
  const desc = descriptionText(post).trim().length;
  const tagsLen = youtubeTagsLength(post.tags);
  if (aiPictures.length) {
    L.push("!! AI PICTURES: this design uses AI-made pictures (" + aiPictures.slice(0, 5).join(", ") + (aiPictures.length > 5 ? ", ..." : "") + ").",
      "!! Tell each platform when the content looks realistic (see the AI lines below).", "");
  }
  for (const id of post.platforms) {
    const p = platformById(id);
    if (!p) continue;
    const th = thumbs.filter((t) => t.platform === id);
    L.push(`== ${p.name} ==`);
    if (id === "youtube" || id === "shorts" || id === "rumble") {
      L.push(`[ ] Upload the video${id === "shorts" ? " (vertical, up to 3 minutes)" : ""}`);
      L.push(`[ ] Title: paste title.txt${lim(post.title.length, p.titleMax)}`);
      L.push(`[ ] Description: paste description.txt${lim(desc, p.textMax)}`);
      if (id !== "rumble") L.push(`[ ] Tags: paste the first line of tags.txt${lim(tagsLen, p.tagsMax)}`);
    } else {
      L.push(`[ ] Caption: description.txt plus the hashtag line of tags.txt${lim(desc, p.textMax)}`);
      if (p.hashtagsMax && post.tags.length > p.hashtagsMax) L.push(`[ ] Cut hashtags to ${p.hashtagsMax} (you have ${post.tags.length})`);
    }
    for (const t of th) {
      const what = id === "youtube" || id === "rumble" || id === "facebook" ? "thumbnail" : "cover";
      L.push(`[ ] ${what[0].toUpperCase() + what.slice(1)}: ${t.file} (${t.w}x${t.h}, ${(t.bytes / 1024 / 1024).toFixed(2)} MB)`
        + (t.cropped ? " - cropped from a different shape: check nothing important is cut off" : ""));
    }
    if (missing.includes(id)) L.push("[ ] No design is linked for this platform: make a cover before posting");
    if (aiPictures.length) {
      if (id === "youtube" || id === "shorts") L.push("[ ] AI: in Details > 'Altered or synthetic content', answer Yes if it shows realistic people, places or events that didn't happen");
      else if (id === "instagram" || id === "reels" || id === "facebook") L.push("[ ] AI: turn on the 'AI info' label if the pictures look realistic");
      else if (id === "tiktok") L.push("[ ] AI: switch on 'AI-generated content' in More options");
      else L.push("[ ] AI: say in the text that some pictures were made with AI");
    }
    if (credits) L.push(`[ ] Keep the ${credits} stock credit${credits > 1 ? "s" : ""} at the end of the description`);
    if (post.date) L.push(id === "youtube" || id === "shorts" ? `[ ] Visibility: Schedule for ${post.date} ${post.time} (${post.tz})` : `[ ] Schedule or post on ${post.date} at ${post.time} (${post.tz})`);
    L.push("");
  }
  L.push("[ ] Set the post to Posted in the planner when it's live", "");
  return L.join("\n");
}

/** A short, safe file name part. */
export const slug = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 50) || "post";
