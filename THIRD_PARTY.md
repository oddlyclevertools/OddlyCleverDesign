# Third-party software and assets

All of these allow commercial use.

## Libraries (bundled in the built app)

| Package | Version | Licence | Used for |
|---|---|---|---|
| [Fabric.js](https://github.com/fabricjs/fabric.js) | 7.4.0 | MIT | Canvas engine: objects, selection, transforms, text editing, filters, SVG export |
| [Lucide](https://lucide.dev) | 1.62.0 | ISC | UI icons and the icons in the Elements panel |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.1 | MIT | PDF export |
| [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) | 5.2.2 | MIT | Packs the hardware-encoded video into MP4 files |
| [gifenc](https://github.com/mattdesl/gifenc) | 1.0.3 | MIT | Animated GIF export |
| [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript) | 1.3.0 | Apache-2.0 | Ask AI with Claude (called from your browser with your key) |
| [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) | 1.30.0 | MIT | Runs the background-remover model on your GPU (WebGPU) |
| [Transformers.js](https://github.com/huggingface/transformers.js) | 4.3.1 | Apache-2.0 | Runs Whisper for auto captions on your GPU (WebGPU). Its Node-only image helper (sharp, whose prebuilt libvips is LGPL-3.0) is never part of the web app's build |

## Downloaded on request (not bundled)

| Item | Licence | Used for |
|---|---|---|
| [IS-Net "general use"](https://github.com/xuebinqin/DIS) model, ONNX copy from [BritishWerewolf/IS-Net](https://huggingface.co/BritishWerewolf/IS-Net) | Apache-2.0 | Background remover. Downloaded once from Hugging Face after you agree, kept in your browser |
| [MI-GAN](https://github.com/Picsart-AI-Research/MI-GAN) inpainting model, ONNX copy from [andraniksargsyan/migan](https://huggingface.co/andraniksargsyan/migan) | MIT | Magic Eraser and Magic Grab. Downloaded once after you agree, kept in your browser |
| [Whisper base](https://github.com/openai/whisper), ONNX copy from [onnx-community/whisper-base_timestamped](https://huggingface.co/onnx-community/whisper-base_timestamped) | MIT | Auto captions with word timings. Downloaded once (about 210 MB) after you agree, kept in your browser |
| Stock photos and videos from [Pexels](https://www.pexels.com/license/), [Pixabay](https://pixabay.com/service/license-summary/) and [Openverse](https://openverse.org) | Pexels / Pixabay licences; Openverse results limited to CC0, Public Domain Mark, CC BY and CC BY-SA | Only what you pick is downloaded; the author, licence and page are kept with the design |

## Claude connector (`connector/`, a separate Node program, not in the web app)

| Package | Version | Licence | Used for |
|---|---|---|---|
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | 1.32.2 | MIT | Speaks MCP to Claude Desktop, Claude Code and other MCP apps |
| [ws](https://github.com/websockets/ws) | 8.22.0 | MIT | The local link to the app tab (127.0.0.1 only) |
| [zod](https://github.com/colinhacks/zod) | 4.6.7 | MIT | Tool input schemas for the MCP SDK |

## Fonts (bundled through @fontsource, version 5.3)

Under the [SIL Open Font License 1.1](https://openfontlicense.org):

Abril Fatface, Alfa Slab One, Anton, Archivo Black, Bangers, Barlow Condensed, Bebas Neue, Black Ops One, Bungee, Caveat, Dancing Script, DM Serif Display, Fredoka, Inter, Kanit, Lilita One, Lobster, Lora, Merriweather, Montserrat, Nunito, Oswald, Pacifico, Permanent Marker, Playfair Display, Poppins, Raleway, Righteous, Roboto, Rubik, Russo One, Space Grotesk, Teko, Titan One, and Noto Color Emoji (the COLRv1 build packaged as @infolektuell/noto-color-emoji; used only for emoji, so flags and emoji look the same on every system).

Under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0): Luckiest Guy.

## Development tools (not shipped)

| Package | Licence |
|---|---|
| [Vite](https://vite.dev) | MIT |
| [Vitest](https://vitest.dev) | MIT |
| [Playwright](https://playwright.dev) | Apache-2.0 |

## The Oddly Clever cast and brand: all rights reserved

Sparks, Brick, Milo, Rae and the Keeper, the Oddly Clever logo, avatar, wordmark and tag line, and the brand art in `public/brand/`, are the **owner's own property. All rights reserved.** They are not covered by this project's MIT licence, and they are not CC0. See [TRADEMARKS.md](TRADEMARKS.md). Forks must remove or replace them. Details: `src/features/characters/ASSETS.md` and `src/ui/ASSETS.md`.

## Artwork made for this project

These are our own work, released as CC0:

- Templates and their thumbnails: `src/features/templates/`.
- Shapes, frame masks, lines and arrowheads: `src/features/elements/geometry.js` and `lines.js`.
- Stickers and the frame placeholder picture: `src/features/elements/stickers.js` and `images.js`.
- The vignette shader: `src/features/elements/filters.js`.
- The 63 v0.2 templates in `src/features/templates/tv-*.js` and `ts-*.js`.
- The v0.2 illustrations, badges, decorations, backgrounds, charts and grids in `src/features/elements/`.

Not included: the Oddly Clever template pack, logo and favicon (see the section above).

The colour matrices for the Vintage, Kodachrome, Technicolor and Polaroid filters come from Fabric.js (MIT).

See also the `ASSETS.md` file in each feature folder.
