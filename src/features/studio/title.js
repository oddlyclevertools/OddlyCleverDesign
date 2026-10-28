// Video title fit: YouTube shows at most two lines of a title under a thumbnail and cuts the rest
// with "…". This measures the title in the same font and width as the feed preview's mock, so
// the feed preview (live counter) and Check my design agree on what gets cut.

export const TITLE_MAX = 100; // YouTube's title limit, in characters

/** Where a title is shown: text column width (px) and font, as in the feed preview's CSS. */
export const SPOTS = {
  home: { label: "the home page", width: 282, font: "600 16px/22px Roboto, Inter, Arial, sans-serif", line: 22 },
  phone: { label: "phones", width: 288, font: "500 14px/20px Roboto, Inter, Arial, sans-serif", line: 20 },
};
const LINES = 2;

let probe = null;
function measureBox(spot) {
  if (!probe) {
    probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:fixed;left:-9999px;top:0;visibility:hidden;pointer-events:none;white-space:normal;word-break:normal;overflow-wrap:anywhere;";
    document.body.append(probe);
  }
  probe.style.width = `${spot.width}px`;
  probe.style.font = spot.font;
  return probe;
}

const linesOf = (box, text, line) => {
  box.textContent = text;
  return Math.round(box.scrollHeight / line);
};

/**
 * How a title shows in one spot.
 * @param {string} title
 * @param {"home"|"phone"} where
 * @returns {{ fits: boolean, lines: number, shown: string, hidden: string }}
 *   shown = what people read before the "…", hidden = the words they never see
 */
export function titleFit(title, where = "home") {
  const spot = SPOTS[where] || SPOTS.home;
  const text = String(title || "").replace(/\s+/g, " ").trim();
  if (!text) return { fits: true, lines: 0, shown: "", hidden: "" };
  const box = measureBox(spot);
  const lines = linesOf(box, text, spot.line);
  if (lines <= LINES) return { fits: true, lines, shown: text, hidden: "" };
  // Longest run of words that still fits in two lines with the "…" after it.
  const words = text.split(" ");
  let lo = 0, hi = words.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (linesOf(box, `${words.slice(0, mid).join(" ")}…`, spot.line) <= LINES) lo = mid; else hi = mid - 1;
  }
  return { fits: false, lines, shown: words.slice(0, lo).join(" "), hidden: words.slice(lo).join(" ") };
}

/** The worst of the feed spots for a title: the one that cuts the most. */
export function worstFit(title) {
  let worst = null;
  for (const id of Object.keys(SPOTS)) {
    const f = { ...titleFit(title, id), where: id, label: SPOTS[id].label };
    if (!f.fits && (!worst || f.hidden.length > worst.hidden.length)) worst = f;
  }
  return worst || { fits: true, where: "home", label: SPOTS.home.label, ...titleFit(title, "home") };
}
