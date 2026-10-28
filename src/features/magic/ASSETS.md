# Magic photo edits: third-party assets

| Asset | Source | Licence |
|---|---|---|
| `migan.onnx` (MI-GAN inpainting pipeline, 29.5 MB) | https://huggingface.co/andraniksargsyan/migan (Picsart AI Research) | MIT |

Served from `public/models/migan.onnx` when `tools/get_models.mjs` has fetched it, otherwise downloaded once (after the user agrees) into the browser's private storage (OPFS). Runs with onnxruntime-web on WebGPU.
