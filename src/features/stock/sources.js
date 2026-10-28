// Stock sources: how to ask Pexels, Pixabay and Openverse for photos and videos, and how to read
// their answers into one shape. Pure (no DOM, no fetch), so Node tests can import it.
//
// Item: { id: "pexels:123", source, kind: "photo"|"video", title, width, height, thumb, full,
//         fallback, videoUrl?, duration?, color?, author, authorUrl, pageUrl, license, licenseUrl,
//         attribution? }
// Every string from a service is plain text; the UI only ever puts it in textContent.

export const DEFAULT_BASES = {
  pexels: "https://api.pexels.com",
  pixabay: "https://pixabay.com/api",
  openverse: "https://api.openverse.org",
};
let bases = { ...DEFAULT_BASES };

/** The API base URLs in use. */
export const getBases = () => ({ ...bases });
/** Point the sources at other servers (the tests use a local mock). Call with nothing to reset. */
export function setStockBases(next = null) {
  bases = { ...DEFAULT_BASES, ...(next || {}) };
  // A local test server (http) is allowed only while the services point at it.
  testHosts = new Set(Object.values(next || {}).map((u) => { try { return new URL(u).host; } catch { return ""; } }).filter(Boolean));
}
let testHosts = new Set();

export const SOURCES = {
  pexels: {
    id: "pexels", name: "Pexels", needsKey: true, kinds: ["photo", "video"], colors: true,
    site: "https://www.pexels.com", keyUrl: "https://www.pexels.com/api/",
    license: { name: "Pexels License", url: "https://www.pexels.com/license/" },
  },
  pixabay: {
    id: "pixabay", name: "Pixabay", needsKey: true, kinds: ["photo", "video"], colors: true,
    site: "https://pixabay.com", keyUrl: "https://pixabay.com/api/docs/",
    license: { name: "Pixabay Content License", url: "https://pixabay.com/service/license-summary/" },
  },
  openverse: {
    id: "openverse", name: "Openverse", needsKey: false, kinds: ["photo"], colors: false,
    site: "https://openverse.org", keyUrl: "",
    license: null, // per result
  },
};
export const SOURCE_IDS = Object.keys(SOURCES);

/** Openverse licences we offer: all allow commercial use and changes (no NC, no ND). */
export const OPENVERSE_LICENSES = new Set(["cc0", "pdm", "by", "by-sa"]);

/** Colour filter: our id -> each service's word (null: not offered there). */
export const COLORS = [
  { id: "red", label: "Red", hex: "#e5484d", pexels: "red", pixabay: "red" },
  { id: "orange", label: "Orange", hex: "#f76b15", pexels: "orange", pixabay: "orange" },
  { id: "yellow", label: "Yellow", hex: "#ffd60a", pexels: "yellow", pixabay: "yellow" },
  { id: "green", label: "Green", hex: "#30a46c", pexels: "green", pixabay: "green" },
  { id: "turquoise", label: "Turquoise", hex: "#12a594", pexels: "turquoise", pixabay: "turquoise" },
  { id: "blue", label: "Blue", hex: "#0090ff", pexels: "blue", pixabay: "blue" },
  { id: "violet", label: "Violet", hex: "#8e4ec6", pexels: "violet", pixabay: "lilac" },
  { id: "pink", label: "Pink", hex: "#e93d82", pexels: "pink", pixabay: "pink" },
  { id: "brown", label: "Brown", hex: "#8e5a3c", pexels: "brown", pixabay: "brown" },
  { id: "black", label: "Black", hex: "#111111", pexels: "black", pixabay: "black" },
  { id: "gray", label: "Grey", hex: "#8b8d98", pexels: "gray", pixabay: "gray" },
  { id: "white", label: "White", hex: "#ffffff", pexels: "white", pixabay: "white" },
  { id: "bw", label: "Black and white", hex: "linear-gradient(90deg,#000 50%,#fff 50%)", pexels: null, pixabay: "grayscale" },
];
export const ORIENTATIONS = [
  { id: "any", label: "Any shape" },
  { id: "landscape", label: "Wide" },
  { id: "portrait", label: "Tall" },
  { id: "square", label: "Square" },
];
export const PAGE_SIZE = { pexels: 30, pixabay: 30, openverse: 20 };
const MAX_QUERY = 100;

const clean = (s, max = 200) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Only http(s) links get through (no javascript:, data: or other schemes from a service). */
export function safeUrl(u) {
  try {
    const url = new URL(String(u || ""));
    // https only: results and credits come from other people's data
    return url.protocol === "https:" || (url.protocol === "http:" && testHosts.has(url.host)) ? url.href : "";
  } catch {
    return "";
  }
}

/** Can this source search this kind with these filters? */
export const supports = (source, kind) => Boolean(SOURCES[source]?.kinds.includes(kind));

/**
 * The request for one page of one source. `cacheKey` never contains the key.
 * @returns {{url: string, headers: Record<string,string>, cacheKey: string}}
 */
export function buildRequest(source, { query, kind = "photo", orientation = "any", color = "", page = 1 } = {}, key = "") {
  const q = clean(query, MAX_QUERY);
  if (!q) throw new Error("Type something to search for.");
  if (!supports(source, kind)) throw new Error(`${SOURCES[source]?.name || source} has no ${kind}s.`);
  const per = PAGE_SIZE[source];
  const col = COLORS.find((c) => c.id === color);
  const p = new URLSearchParams();
  let url, headers = {};
  if (source === "pexels") {
    p.set("query", q);
    p.set("per_page", per);
    p.set("page", page);
    if (orientation !== "any") p.set("orientation", orientation);
    if (kind === "photo" && col?.pexels) p.set("color", col.pexels);
    url = `${bases.pexels}/v1/${kind === "video" ? "videos/search" : "search"}`;
    headers = { Authorization: key };
  } else if (source === "pixabay") {
    p.set("q", q);
    p.set("per_page", per);
    p.set("page", page);
    p.set("safesearch", "true");
    if (kind === "photo") {
      p.set("image_type", "photo");
      if (orientation === "landscape") p.set("orientation", "horizontal");
      if (orientation === "portrait") p.set("orientation", "vertical");
      if (col?.pixabay) p.set("colors", col.pixabay);
    }
    url = `${bases.pixabay}/${kind === "video" ? "videos/" : ""}`;
  } else {
    p.set("q", q);
    p.set("page", page);
    p.set("page_size", per);
    p.set("license_type", "commercial");
    p.set("mature", "false");
    const ar = { landscape: "wide", portrait: "tall", square: "square" }[orientation];
    if (ar) p.set("aspect_ratio", ar);
    url = `${bases.openverse}/v1/images/`;
  }
  const cacheKey = `${source}|${url}?${p}`;
  if (source === "pixabay") p.set("key", key); // Pixabay only takes the key in the query string
  return { url: `${url}?${p}`, headers, cacheKey };
}

/** "cc0" + "1.0" -> "CC0 1.0" and so on. */
export function licenseLabel(code, version = "") {
  const c = String(code || "").toLowerCase();
  if (c === "pdm") return "Public Domain Mark";
  if (c === "cc0") return `CC0${version ? ` ${version}` : ""}`;
  return `CC ${c.toUpperCase()}${version ? ` ${version}` : ""}`;
}

/** Orientation of a w x h picture, for filters a service can't do itself. */
export function shapeOf(w, h) {
  const r = (Number(w) || 1) / (Number(h) || 1);
  if (r > 1.1) return "landscape";
  if (r < 0.9) return "portrait";
  return "square";
}

/** Pexels: a resized copy of the original (their image server takes w/h). */
function pexelsSized(original, side) {
  const u = safeUrl(original);
  if (!u) return "";
  const url = new URL(u);
  url.searchParams.set("auto", "compress");
  url.searchParams.set("cs", "tinysrgb");
  url.searchParams.set("w", side);
  return url.href;
}

/** Pick the best MP4 at most `maxW` wide (Pexels video_files). */
function pickPexelsFile(files = []) {
  const mp4 = files.filter((f) => /mp4/i.test(f.file_type || "") && safeUrl(f.link));
  const ok = mp4.filter((f) => (f.width || 0) <= 1920).sort((a, b) => (b.width || 0) - (a.width || 0));
  return ok[0] || mp4.sort((a, b) => (a.width || 0) - (b.width || 0))[0] || null;
}

function pickPixabayFile(videos = {}) {
  for (const k of ["medium", "large", "small", "tiny"]) {
    const v = videos[k];
    if (v && safeUrl(v.url) && v.size !== 0) return v;
  }
  return null;
}

/**
 * Read a service's JSON into items. Filters what the service can't (Pixabay square, Pixabay
 * video shape, Openverse licences) and says whether another page exists.
 * @returns {{items: object[], hasMore: boolean}}
 */
export function parseResponse(source, kind, json, { page = 1, orientation = "any" } = {}) {
  const per = PAGE_SIZE[source];
  let items = [], hasMore = false;
  if (source === "pexels" && kind === "photo") {
    const lic = SOURCES.pexels.license;
    items = (json?.photos || []).map((p) => ({
      id: `pexels:${p.id}`, source, kind, title: clean(p.alt, 120) || "Pexels photo",
      width: p.width, height: p.height, color: /^#[0-9a-f]{3,8}$/i.test(p.avg_color || "") ? p.avg_color : "",
      thumb: safeUrl(p.src?.medium || p.src?.small), full: pexelsSized(p.src?.original, 2600), fallback: safeUrl(p.src?.large2x),
      author: clean(p.photographer, 80) || "Unknown", authorUrl: safeUrl(p.photographer_url), pageUrl: safeUrl(p.url),
      license: lic.name, licenseUrl: lic.url,
    }));
    hasMore = Boolean(json?.next_page);
  } else if (source === "pexels" && kind === "video") {
    const lic = SOURCES.pexels.license;
    items = (json?.videos || []).map((v) => {
      const f = pickPexelsFile(v.video_files);
      return f && {
        id: `pexels-video:${v.id}`, source, kind, title: clean(v.url?.split("/").filter(Boolean).pop()?.replace(/-\d+$/, "").replace(/-/g, " "), 120) || "Pexels video",
        width: f.width || v.width, height: f.height || v.height, duration: Number(v.duration) || 0,
        thumb: safeUrl(v.image), full: safeUrl(v.image), fallback: "", videoUrl: safeUrl(f.link),
        author: clean(v.user?.name, 80) || "Unknown", authorUrl: safeUrl(v.user?.url), pageUrl: safeUrl(v.url),
        license: lic.name, licenseUrl: lic.url,
      };
    }).filter(Boolean);
    hasMore = Boolean(json?.next_page);
  } else if (source === "pixabay" && kind === "photo") {
    const lic = SOURCES.pixabay.license;
    items = (json?.hits || []).map((h) => ({
      id: `pixabay:${h.id}`, source, kind, title: clean(h.tags, 120) || "Pixabay image",
      width: h.imageWidth, height: h.imageHeight,
      thumb: safeUrl(h.webformatURL || h.previewURL), full: safeUrl(h.largeImageURL), fallback: safeUrl(h.webformatURL),
      author: clean(h.user, 80) || "Unknown",
      authorUrl: h.user && h.user_id ? `https://pixabay.com/users/${encodeURIComponent(h.user)}-${Number(h.user_id) || 0}/` : "",
      pageUrl: safeUrl(h.pageURL), license: lic.name, licenseUrl: lic.url,
    }));
    if (orientation === "square") items = items.filter((i) => shapeOf(i.width, i.height) === "square");
    hasMore = page * per < Math.min(500, Number(json?.totalHits) || 0);
  } else if (source === "pixabay" && kind === "video") {
    const lic = SOURCES.pixabay.license;
    items = (json?.hits || []).map((h) => {
      const f = pickPixabayFile(h.videos);
      return f && {
        id: `pixabay-video:${h.id}`, source, kind, title: clean(h.tags, 120) || "Pixabay video",
        width: f.width, height: f.height, duration: Number(h.duration) || 0,
        thumb: safeUrl(h.videos?.tiny?.thumbnail || f.thumbnail), full: safeUrl(f.thumbnail || h.videos?.tiny?.thumbnail), fallback: "",
        videoUrl: safeUrl(f.url), author: clean(h.user, 80) || "Unknown",
        authorUrl: h.user && h.user_id ? `https://pixabay.com/users/${encodeURIComponent(h.user)}-${Number(h.user_id) || 0}/` : "",
        pageUrl: safeUrl(h.pageURL), license: lic.name, licenseUrl: lic.url,
      };
    }).filter(Boolean);
    if (orientation !== "any") items = items.filter((i) => shapeOf(i.width, i.height) === orientation);
    hasMore = page * per < Math.min(500, Number(json?.totalHits) || 0);
  } else if (source === "openverse") {
    items = (json?.results || [])
      .filter((r) => OPENVERSE_LICENSES.has(String(r.license || "").toLowerCase()))
      .map((r) => {
        const thumb = safeUrl(r.thumbnail);
        let proxied = "";
        if (thumb) { const u = new URL(thumb); u.searchParams.set("full_size", "true"); u.searchParams.set("compressed", "false"); proxied = u.href; }
        return {
          id: `openverse:${clean(r.id, 64)}`, source, kind: "photo", title: clean(r.title, 120) || "Untitled",
          width: r.width || 0, height: r.height || 0, thumb, full: proxied || safeUrl(r.url), fallback: proxied ? safeUrl(r.url) : thumb,
          author: clean(r.creator, 80) || "Unknown", authorUrl: safeUrl(r.creator_url), pageUrl: safeUrl(r.foreign_landing_url),
          license: licenseLabel(r.license, r.license_version), licenseCode: String(r.license || "").toLowerCase(),
          licenseUrl: safeUrl(r.license_url), attribution: clean(r.attribution, 400), provider: clean(r.source || r.provider, 60),
        };
      });
    hasMore = Number(json?.page || page) < Number(json?.page_count || 0);
  }
  return { items, hasMore };
}

/** Round-robin merge (one from each source in turn), dropping repeats. */
export function interleave(lists) {
  const out = [], seen = new Set();
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const l of lists) {
      const it = l[i];
      if (it && !seen.has(it.id)) { seen.add(it.id); out.push(it); }
    }
  }
  return out;
}

// ---- credits ------------------------------------------------------------------------------

/**
 * The credit stored on a design object (data.credit). Its keys avoid "src"/"source"/"href":
 * the design sanitizer drops objects whose such keys aren't data: URLs.
 */
export function creditOf(item) {
  return {
    site: SOURCES[item.source]?.name || item.source, kind: item.kind, title: item.title, author: item.author,
    authorUrl: item.authorUrl || "", pageUrl: item.pageUrl || "", license: item.license, licenseUrl: item.licenseUrl || "",
    ...(item.attribution ? { attribution: item.attribution } : {}), id: item.id,
  };
}

/** One line for a video description, in the form each service asks for. */
export function creditLine(c) {
  const what = c.kind === "video" ? "Video" : "Photo";
  const link = c.pageUrl ? `: ${c.pageUrl}` : "";
  if (c.site === "Pexels") return `${what} by ${c.author} on Pexels${link}`;
  if (c.site === "Pixabay") return `${c.kind === "video" ? "Video" : "Image"} by ${c.author} from Pixabay${link}`;
  const lic = c.licenseUrl ? `${c.license} (${c.licenseUrl})` : c.license;
  return `"${c.title}" by ${c.author}, ${lic}, via Openverse${link}`;
}

/** Every distinct credit in a list (same id or same page counts once). */
export function uniqueCredits(list) {
  const seen = new Set(), out = [];
  for (const c of list) {
    if (!c || typeof c !== "object") continue;
    const k = c.id || c.pageUrl || `${c.site}|${c.title}|${c.author}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/** The text block for a description: a heading and one line per credit. Empty when none. */
export function creditsText(list) {
  const u = uniqueCredits(list);
  if (!u.length) return "";
  return ["Stock credits:", ...u.map((c) => `- ${creditLine(c)}`)].join("\n");
}

/** Walk saved design JSON (objects, with groups) and collect data.credit. */
export function creditsInObjects(objects = []) {
  const out = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    const c = o.data?.credit;
    // credits come from design files, which may be untrusted: plain text, and only an https link
    if (c && typeof c === "object") out.push({ ...c, title: String(c.title ?? ""), author: String(c.author ?? ""), site: String(c.site ?? ""), license: String(c.license ?? ""), pageUrl: safeUrl(c.pageUrl) });
    (o.objects || o._objects || []).forEach(walk);
  };
  objects.forEach(walk);
  return uniqueCredits(out);
}
