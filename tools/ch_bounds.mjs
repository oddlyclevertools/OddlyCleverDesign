// Measures each rig's figure-space bounds (union over expressions and looks) for the viewBox table.
export default async ({ page }) => page.evaluate(async () => {
  const { HEROES2 } = await import("/src/features/characters/rigs/heroes2.js");
  const { STICK } = await import("/src/features/characters/rigs/stick.js");
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "10"); svg.setAttribute("height", "10");
  document.body.append(svg);
  const out = {};
  const looks = [[0.35, 0], [-0.6, 0], [0, -0.7], [0, 0.7], [0, 0]];
  for (const who of ["sparks", "brick", "milo", "rae", "keeper"]) for (const head of [false, true]) {
    let b = [1e9, 1e9, -1e9, -1e9];
    for (const expr of ["smug", "worried", "shock", "grin"]) for (const look of looks) {
      const m = who === "keeper" ? STICK.draw({ who, x: 0, y: 0, s: 1, head, eye: 1, grin: 1 })
        : HEROES2.draw({ who, x: 0, y: 0, s: 1, expr, look, head });
      svg.innerHTML = m;
      const r = svg.firstElementChild.getBBox();
      b = [Math.min(b[0], r.x), Math.min(b[1], r.y), Math.max(b[2], r.x + r.width), Math.max(b[3], r.y + r.height)];
    }
    out[`${who}${head ? ":head" : ""}`] = b.map((v) => Math.round(v));
  }
  svg.remove();
  return out;
});
