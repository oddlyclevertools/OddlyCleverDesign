// Small helpers shared by the files feature: file names, sizes, blobs and downloads.

/** Longest side an export may have (big canvases run the browser out of memory). */
export const MAX_EXPORT_SIDE = 8000;
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 4;
/** 1 KB = 1000 bytes, like Canva's "Limit file size" (and safely under YouTube's 2 MB). */
export const KB = 1000;

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/** A safe file name (no extension) from a design name. */
export function sanitizeFilename(name, fallback = "design") {
  let s = String(name ?? "")
    // Characters Windows, macOS or Linux refuse in file names, plus control characters.
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, "");
  if (s.length > 80) s = s.slice(0, 80).trim();
  if (!s) s = fallback;
  if (RESERVED.test(s)) s = `${s}_`;
  return s;
}

/** "840 KB", "1.84 MB" (decimal units, matching the KB limit). */
export function formatBytes(n) {
  if (!Number.isFinite(n)) return "";
  if (n < KB) return `${n} B`;
  if (n < KB * KB) return `${Math.round(n / KB)} KB`;
  return `${(n / (KB * KB)).toFixed(2)} MB`;
}

/** The largest multiplier allowed for a w x h design. */
export function maxScaleFor(w, h) {
  return Math.min(MAX_SCALE, MAX_EXPORT_SIDE / Math.max(w, h));
}

/** Clamp a multiplier into the allowed range for a design. */
export function clampScale(scale, w, h) {
  const hi = maxScaleFor(w, h);
  const s = Number(scale);
  return Math.max(Math.min(MIN_SCALE, hi), Math.min(hi, Number.isFinite(s) ? s : 1));
}

/** Output pixel size for a multiplier. */
export function outputSize(w, h, scale) {
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The browser couldn't encode the image (it may be too big)."))),
      type, quality);
  });
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error("Couldn't read the file."));
    r.readAsDataURL(blob);
  });
}

/** Let the browser paint (so progress shows) before heavy work. */
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** Save a blob through a temporary Blob URL. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.append(a);
  a.click();
  a.remove();
  // Revoke later: revoking at once can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Per-browser remembered settings (never required: storage may be blocked). */
export function loadPrefs(key, defaults) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v && typeof v === "object" ? { ...defaults, ...v } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

export function savePrefs(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: fine */ }
}

/**
 * Run fn with the page rect and the canvas clip drawn without their default 1 px stroke box.
 * Fabric's default strokeWidth (1) shifts their fill by half a pixel, which leaves a
 * semi-transparent hairline round every export. Restored straight after (synchronous only).
 */
export function withCrispPage(editor, fn) {
  const targets = [editor.page, editor.canvas.clipPath].filter((o) => o && o.strokeWidth);
  const saved = targets.map((o) => o.strokeWidth);
  targets.forEach((o) => o.set({ strokeWidth: 0 }));
  try {
    return fn();
  } finally {
    targets.forEach((o, i) => o.set({ strokeWidth: saved[i] }));
  }
}
