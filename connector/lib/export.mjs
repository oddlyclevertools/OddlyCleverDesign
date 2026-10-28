// The one place the connector touches the disk for designs: saving a finished picture into a single
// folder the user chose (default: Downloads/OddlyClever, created only on the first save).
// Names are reduced to safe characters, there are no sub-folders, and nothing is ever overwritten.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const MAX_BYTES = 40 * 1024 * 1024;
const EXT = { "image/png": "png", "image/jpeg": "jpg" };

export const defaultExportDir = () => join(homedir(), "Downloads", "OddlyClever");

/** A safe file stem: letters, digits, space, dash, underscore; at most 60 characters. */
export function safeStem(name) {
  const s = String(name ?? "").normalize("NFKD").replace(/[^\w\- ]+/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return s.replace(/^[.\- ]+/, "") || "design";
}

/** Write base64 picture data into `dir`. Returns the absolute path written. */
export function saveExport(dir, { name, mediaType, data }) {
  const ext = EXT[mediaType];
  if (!ext) throw new Error("Only PNG or JPG pictures can be saved.");
  const bytes = Buffer.from(String(data), "base64");
  if (!bytes.length) throw new Error("The picture was empty.");
  if (bytes.length > MAX_BYTES) throw new Error("The picture is too big to save (over 40 MB).");
  const folder = resolve(dir);
  mkdirSync(folder, { recursive: true });
  const stem = safeStem(name);
  let file = join(folder, `${stem}.${ext}`);
  for (let i = 2; existsSync(file); i++) {
    if (i > 999) throw new Error("Too many files with that name already.");
    file = join(folder, `${stem}-${i}.${ext}`);
  }
  writeFileSync(file, bytes, { flag: "wx" }); // "wx": fail rather than overwrite, even in a race
  return file;
}
