// Make a popover grow out of the button that opened it. kit.js popover() places the popover and
// adds .show on the next frame; this sets the CSS variables overlays.css reads (--pop-origin and
// --pop-dy) before that, so the pop starts at the anchor and slides the right way (down when the
// popover sits under its button, up when it had to go above).

/**
 * @param {{ pop: HTMLElement } | null | undefined} handle what popover() returned
 * @param {Element} anchor the button the popover belongs to
 * @returns the same handle, so callers can keep using it
 */
export function popFrom(handle, anchor) {
  const pop = handle?.pop;
  if (!pop || typeof anchor?.getBoundingClientRect !== "function") return handle;
  const a = anchor.getBoundingClientRect();
  const left = parseFloat(pop.style.left) || 0, top = parseFloat(pop.style.top) || 0;
  const x = Math.max(0, Math.min(pop.offsetWidth, a.left + a.width / 2 - left));
  const above = top < a.top;
  pop.style.setProperty("--pop-origin", `${Math.round(x)}px ${above ? "100%" : "0"}`);
  pop.style.setProperty("--pop-dy", above ? "6px" : "-6px");
  return handle;
}
