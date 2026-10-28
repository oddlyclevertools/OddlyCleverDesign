// Download the Whisper speech-to-text model (auto captions) into public/models/whisper-base/
// (git-ignored), so the app serves it itself and never has to ask. Run once:
//   node tools/vx_get_whisper.mjs
// (The lead can fold this list into tools/get_models.mjs.) Model: onnx-community/whisper-base_timestamped,
// ONNX weights of OpenAI Whisper base (MIT on GitHub, Apache-2.0 on Hugging Face).
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const REPO = "https://huggingface.co/onnx-community/whisper-base_timestamped/resolve/main/";
const FILES = [
  ["config.json", 2243], ["generation_config.json", 3832], ["preprocessor_config.json", 339],
  ["tokenizer.json", 2480466], ["tokenizer_config.json", 282682],
  ["onnx/encoder_model.onnx", 82451730], ["onnx/decoder_model_merged_q4.onnx", 123738327],
];

for (const [file, bytes] of FILES) {
  const out = `public/models/whisper-base/${file}`;
  mkdirSync(dirname(out), { recursive: true });
  if (existsSync(out) && statSync(out).size === bytes) { console.log(`${file}: already here`); continue; }
  console.log(`${file}: downloading ${(bytes / 1e6).toFixed(1)} MB…`);
  const res = await fetch(REPO + file);
  if (!res.ok) throw new Error(`${file}: download failed (${res.status})`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(out));
  if (statSync(out).size !== bytes) throw new Error(`${file}: incomplete download, run again`);
  console.log(`${file}: done`);
}
