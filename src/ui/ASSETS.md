# Interface assets

## Oddly Clever brand art: the user's own property, all rights reserved

These files are **not** under the project's open-source licence. They are not CC0, not MIT and not
free to reuse. They show the user's own channel brand and character (Sparks), and are included only
so this app carries its owner's brand. Forks must remove or replace them.

| File | Made from | How |
|---|---|---|
| `public/brand/avatar-96.png`, `avatar-256.png`, `apple-touch-icon.png`, `public/favicon.png` | the Oddly Clever brand kit's avatar | downscaled with PIL (Lanczos) |
| `public/brand/watermark.png` | the brand kit's watermark | re-saved (optimised) |
| `public/brand/sparks.png`, `sparks_grin.png`, `sparks_head.png` | the Sparks rig from the Oddly Clever cast kit | rendered to a transparent PNG in headless Chrome, then a die-cut paper border and soft shadow added with PIL |

The neon sign, the paper labels and the brick wall are drawn in CSS and inline SVG in this repo
(`src/styles/*.css`, `src/features/templates/templates.css`): our own work, under the project licence.
The phrase "We found the loophole. You didn't." is the brand's tagline (the user's).

## Code-drawn UI

Icons are Lucide (ISC). Fonts (Inter, Archivo Black, Pacifico) come from @fontsource (SIL OFL), already
listed in `THIRD_PARTY.md`.
