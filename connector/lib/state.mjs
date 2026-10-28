// Settings the connector keeps between runs: the pairing code and the last design guide the app sent.
// Stored in one small JSON file in the user's app-data folder, readable only by the user.
import { randomInt, createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no 0/O, 1/I/L, U: easy to read aloud
const CODE_LEN = 8; // 30^8 ≈ 6.6e11 codes; with the failed-attempt lockout, guessing is hopeless
const GUIDE_MAX = 64 * 1024;

export function configDir() {
  if (process.env.OC_CONFIG_DIR) return process.env.OC_CONFIG_DIR;
  if (process.platform === "win32") return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "OddlyClever Design");
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", "OddlyClever Design");
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "oddlyclever-design");
}

export const statePath = () => join(configDir(), "connector.json");

export function newPairingCode() {
  let s = "";
  for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `OC-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Normalise what a person typed: case, spaces, dashes and the OC prefix don't matter. */
export function normaliseCode(input) {
  if (typeof input !== "string" || input.length > 64) return "";
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.startsWith("OC") && s.length === CODE_LEN + 2 ? s.slice(2) : s;
}

/** Constant-time comparison of two codes (hashed first, so lengths never leak). */
export function codesMatch(expected, given) {
  const a = createHash("sha256").update(normaliseCode(expected)).digest();
  const b = createHash("sha256").update(normaliseCode(given)).digest();
  return normaliseCode(given).length === CODE_LEN && timingSafeEqual(a, b);
}

function read() {
  try {
    const raw = JSON.parse(readFileSync(statePath(), "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function write(state) {
  const dir = configDir();
  mkdirSync(dir, { recursive: true });
  const file = statePath();
  writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
  try { chmodSync(file, 0o600); } catch { /* Windows ignores POSIX modes; the file is in the user's profile */ }
}

/** Load the state, creating a pairing code on first run. `env.OC_PAIRING_CODE` wins when set. */
export function loadState({ resetCode = false } = {}) {
  const state = read();
  const fromEnv = normaliseCode(process.env.OC_PAIRING_CODE || "");
  let code = state.pairingCode;
  if (fromEnv.length === CODE_LEN) code = `OC-${fromEnv.slice(0, 4)}-${fromEnv.slice(4)}`;
  if (resetCode || normaliseCode(code || "").length !== CODE_LEN) {
    code = newPairingCode();
    write({ ...state, pairingCode: code });
  }
  return { pairingCode: code, guide: typeof state.guide === "string" ? state.guide.slice(0, GUIDE_MAX) : "" };
}

/** Remember the design guide the app sent, so the next start can put it in the server instructions. */
export function saveGuide(guide) {
  if (typeof guide !== "string") return;
  const state = read();
  const next = guide.slice(0, GUIDE_MAX);
  if (state.guide === next) return;
  try { write({ ...state, guide: next }); } catch { /* not fatal: the guide is still served live */ }
}

export const stateExists = () => existsSync(statePath());
