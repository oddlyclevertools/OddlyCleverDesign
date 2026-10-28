// Branded tooltips for elements with a `data-tip` attribute (shell chrome). Buttons from features keep
// their native `title` tooltips; this only adds a nicer, faster tip where we ask for one.
import { el } from "./kit.js";

const DELAY = 380;

export function initTips() {
  if (document.querySelector(".oc-tip")) return;
  const tip = el("div.oc-tip", { role: "tooltip", "aria-hidden": "true" });
  document.body.append(tip);
  let timer = 0, target = null;
  const hide = () => {
    clearTimeout(timer);
    target = null;
    tip.classList.remove("show");
  };
  const show = () => {
    if (!target?.isConnected) return;
    tip.textContent = target.dataset.tip;
    tip.classList.add("show");
    const r = target.getBoundingClientRect(), t = tip.getBoundingClientRect();
    let top = r.bottom + 8;
    if (top + t.height > innerHeight - 6) top = r.top - t.height - 8;
    const left = Math.max(6, Math.min(r.left + r.width / 2 - t.width / 2, innerWidth - t.width - 6));
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest?.("[data-tip]");
    if (t === target) return;
    hide();
    if (!t) return;
    target = t;
    timer = setTimeout(show, DELAY);
  });
  document.addEventListener("pointerdown", hide, true);
  document.addEventListener("keydown", hide, true);
  window.addEventListener("blur", hide);
}
