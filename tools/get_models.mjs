// Download the on-device AI models into public/models/ (git-ignored), so the app serves them
// itself and never has to ask. Run once: node tools/get_models.mjs
import { dirname } from "node:path";
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MODELS = [
  { file: "isnet-general-use.onnx", bytes: 178_648_008, licence: "Apache-2.0",
    url: "https://huggingface.co/BritishWerewolf/IS-Net/resolve/main/onnx/model.onnx" },
  { file: "migan.onnx", bytes: 29_546_882, licence: "MIT",
    url: "https://huggingface.co/andraniksargsyan/migan/resolve/main/migan.onnx" },
  // Auto captions: OpenAI Whisper base (MIT), ONNX from onnx-community/whisper-base_timestamped.
  ...[["config.json", 2243], ["generation_config.json", 3832], ["preprocessor_config.json", 339],
    ["tokenizer.json", 2480466], ["tokenizer_config.json", 282682],
    ["onnx/encoder_model.onnx", 82451730], ["onnx/decoder_model_merged_q4.onnx", 123738327]].map(([f, bytes]) => ({
    file: `whisper-base/${f}`, bytes, licence: "MIT",
    url: `https://huggingface.co/onnx-community/whisper-base_timestamped/resolve/main/${f}` })),
];

mkdirSync("public/models", { recursive: true });
for (const m of MODELS) {
  const out = `public/models/${m.file}`;
  mkdirSync(dirname(out), { recursive: true });
  if (existsSync(out) && statSync(out).size === m.bytes) { console.log(`${m.file}: already here`); continue; }
  console.log(`${m.file}: downloading ${Math.round(m.bytes / 1e6)} MB (${m.licence})…`);
  const res = await fetch(m.url);
  if (!res.ok) throw new Error(`${m.file}: download failed (${res.status})`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(out));
  if (statSync(out).size !== m.bytes) throw new Error(`${m.file}: incomplete download, run again`);
  console.log(`${m.file}: done`);
}
