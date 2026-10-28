// Full-page background patterns and scenes, drawn in code with Canvas 2D (our own CC0 work).
// Each entry: { key, label, group, tags, colors: [{ id, label, value }], draw(ctx, w, h, col) }.
// draw paints every pixel (opaque), is deterministic (seeded PRNG, never Math.random) and scales
// with u = min(w, h) / 720, so a thumbnail and a full page look the same, just sharper.
// Textures come from small cached tiles (<= 256 px) used as repeating patterns: no per-pixel loops
// over the page.

import { TAU, clamp, HEX_RE, isHex, rgbOf, toHex, mix, lighten, darken, withAlpha, luma, rng, hash, cellRng, noise1, lattices, lattice, smooth, vnoise, fbm, makeCanvas, reset, fill, linear, softStops, glow, vignette, shadow, noShadow, roundRect, neon, tiles, tile, grainTile, blotchTile, speckTile, overlayTile, grain, blotch, C, def } from "./scene-kit.js";
import { polkaDots, gridLines, graphPaper, diagonalStripes, checker, halftone, waves, contours, topography, filmGrain, grainyGradient, sunburst, meshBlobs, gradientMesh, aurora, paperFibres, paperTexture, pinstripes, chevron, memphis, plusPattern, blueprint, retroRainbow, duotoneSplit, lowPoly, gingham, terrazzo } from "./scenes-patterns.js";
import { brickWall, neonSkyline, starrySky, deskTop, studioSpotlight, rainyStreet } from "./scenes-places-a.js";
import { sunsetHills, stageCurtains, paperHills, synthwave, woodFrame, chalkboard, pushpin, corkBoard, cloudsDay } from "./scenes-places-b.js";

/* ================================================================= THE LIST */

export const SCENES = [
  // Patterns
  def("dots", "Polka dots", "Patterns", "dots spots polka pattern retro",
    [C("bg", "Background", "#f3ead8"), C("fg", "Dots", "#ff2e7e")], polkaDots),
  def("graph-paper", "Graph paper", "Patterns", "grid graph paper squares math notebook",
    [C("bg", "Paper", "#fbf8f1"), C("fg", "Lines", "#5b9bd5")], graphPaper),
  def("stripes", "Diagonal stripes", "Patterns", "stripes diagonal lines candy bold",
    [C("bg", "Background", "#16121b"), C("fg", "Stripes", "#ff2e7e")], diagonalStripes),
  def("checker", "Checkerboard", "Patterns", "checker checkerboard squares chess racing",
    [C("a", "Colour 1", "#16121b"), C("b", "Colour 2", "#f3ead8")], checker),
  def("halftone", "Halftone", "Patterns", "halftone dots comic pop art print gradient",
    [C("bg", "Background", "#ffc83d"), C("fg", "Dots", "#16121b")], halftone),
  def("waves", "Waves", "Patterns", "waves wavy lines water calm",
    [C("bg", "Background", "#e3f4f7"), C("fg", "Lines", "#2f9cc0")], waves),
  def("topography", "Topography", "Patterns", "topography contour map lines terrain",
    [C("bg", "Background", "#0d0a10"), C("fg", "Lines", "#8fe3ff")], topography),
  def("film-grain", "Film grain", "Patterns", "noise grain film texture dark cinematic",
    [C("bg", "Colour", "#2a2230")], filmGrain),
  def("grainy-gradient", "Grainy gradient", "Patterns", "gradient grain noise warm trendy",
    [C("a", "Colour 1", "#ff2e7e"), C("b", "Colour 2", "#ffc83d")], grainyGradient),
  def("sunburst", "Sunburst", "Patterns", "sunburst rays burst retro circus starburst",
    [C("bg", "Background", "#ffb627"), C("fg", "Rays", "#ffd166")], sunburst),
  def("gradient-mesh", "Gradient mesh", "Patterns", "gradient mesh blur soft pastel blobs",
    [C("a", "Colour 1", "#ff9ec4"), C("b", "Colour 2", "#8fe3ff"), C("c", "Colour 3", "#ffe08a")], gradientMesh),
  def("neon-aurora", "Neon aurora", "Patterns", "aurora gradient mesh dark neon glow",
    [C("bg", "Background", "#0d0a10"), C("a", "Glow 1", "#ff2e7e"), C("b", "Glow 2", "#8fe3ff")], aurora),
  def("paper", "Paper texture", "Patterns", "paper texture fibre grain warm craft",
    [C("bg", "Paper", "#f3ead8")], paperTexture),
  def("pinstripes", "Pinstripes", "Patterns", "pinstripe suit fabric lines classy",
    [C("bg", "Fabric", "#1f2433"), C("fg", "Stripes", "#e9e4d8")], pinstripes),
  def("chevron", "Chevron", "Patterns", "chevron zigzag stripes",
    [C("bg", "Background", "#16121b"), C("fg", "Zigzag", "#ffc83d")], chevron),
  def("memphis", "Memphis confetti", "Patterns", "memphis confetti shapes squiggle 90s party",
    [C("bg", "Background", "#f3ead8"), C("a", "Colour 1", "#ff2e7e"), C("b", "Colour 2", "#3ec6e8")], memphis),
  def("plus", "Plus signs", "Patterns", "plus cross pattern swiss",
    [C("bg", "Background", "#ff2e7e"), C("fg", "Plus", "#ffe3ec")], plusPattern),
  def("blueprint", "Blueprint", "Patterns", "blueprint grid technical drawing engineering",
    [C("bg", "Blueprint", "#1d4f91"), C("fg", "Lines", "#d6ecff")], blueprint),
  def("retro-rainbow", "70s rainbow", "Patterns", "retro 70s rainbow arcs sun stripes groovy",
    [C("bg", "Background", "#f3ead8"), C("a", "Inner", "#ff2e7e"), C("b", "Outer", "#ffc83d")], retroRainbow),
  def("duotone-split", "Duotone split", "Patterns", "duotone split diagonal two tone bold",
    [C("a", "Side 1", "#ff2e7e"), C("b", "Side 2", "#16121b"), C("line", "Accent line", "#ffc83d")], duotoneSplit),
  def("low-poly", "Low poly", "Patterns", "triangles low poly geometric facets",
    [C("base", "Base", "#1c1830"), C("accent", "Glow", "#ff2e7e")], lowPoly),
  def("gingham", "Gingham", "Patterns", "gingham picnic check plaid tablecloth",
    [C("bg", "Background", "#ffffff"), C("fg", "Check", "#ff7aa2")], gingham),
  def("terrazzo", "Terrazzo", "Patterns", "terrazzo chips stone speckle calm",
    [C("bg", "Stone", "#f1ebe2"), C("a", "Chips 1", "#e07a5f"), C("b", "Chips 2", "#3d8a7a")], terrazzo),
  // Scenes
  def("brick-wall-night", "Brick wall at night", "Scenes", "brick wall night lamp street light warm urban",
    [C("brick", "Brick", "#9a4630"), C("light", "Lamp light", "#ffb347"), C("night", "Night", "#1a1430")], brickWall),
  def("neon-skyline", "Neon city skyline", "Scenes", "city skyline neon night buildings urban",
    [C("sky", "Sky", "#2a1240"), C("neon", "Neon", "#ff2e7e"), C("accent", "Accent", "#8fe3ff")], neonSkyline),
  def("starry-sky", "Starry sky", "Scenes", "stars night sky moon milky way space",
    [C("top", "Sky top", "#070b1f"), C("horizon", "Horizon", "#3d2a6e"), C("moon", "Moon", "#f3ead8")], starrySky),
  def("desk", "Desk top-down", "Scenes", "desk wood workspace notebook coffee pencil flat lay",
    [C("wood", "Wood", "#9c6a43"), C("main", "Accent 1", "#ff2e7e"), C("second", "Accent 2", "#ffc83d")], deskTop),
  def("studio-spotlight", "Studio spotlight", "Scenes", "spotlight stage studio light dark show",
    [C("dark", "Dark", "#0d0a10"), C("light", "Light", "#fff1d6")], studioSpotlight),
  def("rainy-neon-street", "Rainy neon street", "Scenes", "rain neon street night wet reflections cyberpunk",
    [C("night", "Night", "#0f0c1c"), C("neon1", "Neon 1", "#ff2e7e"), C("neon2", "Neon 2", "#8fe3ff")], rainyStreet),
  def("sunset-hills", "Sunset hills", "Scenes", "sunset sun hills evening landscape warm",
    [C("sky", "Sky", "#ff7a59"), C("sun", "Sun", "#ffd36b"), C("hills", "Hills", "#4a1f45")], sunsetHills),
  def("stage-curtains", "Stage curtains", "Scenes", "stage curtains theatre show velvet red",
    [C("curtain", "Curtain", "#a3162f"), C("light", "Light", "#ffe2a8")], stageCurtains),
  def("paper-hills", "Paper-cut hills", "Scenes", "paper cut layers hills mountains craft pastel",
    [C("sky", "Sky", "#fde8d7"), C("land", "Land", "#e0607e"), C("sun", "Sun", "#ffc83d")], paperHills),
  def("synthwave", "Synthwave horizon", "Scenes", "synthwave retro 80s grid sun outrun vaporwave",
    [C("sky", "Sky", "#2a0f45"), C("grid", "Grid", "#ff2e7e"), C("sun", "Sun", "#ffc83d")], synthwave),
  def("chalkboard", "Chalkboard", "Scenes", "chalkboard blackboard school class chalk",
    [C("board", "Board", "#24372e"), C("frame", "Frame", "#8a5a35")], chalkboard),
  def("cork-board", "Cork board", "Scenes", "cork board pinboard notes polaroid pins",
    [C("cork", "Cork", "#c4935f"), C("frame", "Frame", "#6b4428"), C("pin", "Pins", "#ff2e7e")], corkBoard),
  def("clouds", "Cloudy sky", "Scenes", "clouds sky day blue calm soft",
    [C("sky", "Sky", "#7cc4f0"), C("cloud", "Clouds", "#ffffff")], cloudsDay),
];
