// The Test & Compare pack dialog: choose what changes, preview B/C live, save them as new
// designs, then download all of them as JPGs under 2 MB.
import { el, icon, modal, toast } from "../../ui/kit.js";
import { LETTERS, buildVariant, exportPack, headlineOf, makeVariants, openAndWait } from "./variants.js";

const PACK_KEY = "oc-studio-pack";
const PREVIEW_DELAY = 220;

export function loadPack() {
  try {
    const p = JSON.parse(localStorage.getItem(PACK_KEY) || "null");
    return Array.isArray(p) ? p : null;
  } catch { return null; }
}
function savePack(pack) {
  try { localStorage.setItem(PACK_KEY, JSON.stringify(pack.map(({ id, name, letter }) => ({ id, name, letter })))); } catch { /* memory only */ }
}

const CHANGES = [
  { id: "colours", icon: "Palette", title: "Colours", text: "Turn the colour wheel: same layout, new colours." },
  { id: "headline", icon: "Type", title: "Headline", text: "Try different words in your biggest text." },
  { id: "hero", icon: "FlipHorizontal2", title: "Hero position", text: "Swap sides. Version C also makes the hero bigger." },
];

/** Run the pack export with a toast per step. */
export async function runExport(app, pack) {
  try {
    const res = await exportPack(app, pack, (i, n, name) => toast(`Downloading ${i + 1} of ${n}: ${name}`, { ms: 1800 }));
    const big = res.filter((r) => r.bytes > 2_000_000).length;
    toast(big ? `${big} file${big > 1 ? "s are" : " is"} still over 2 MB. Try simpler backgrounds.` : `Downloaded ${res.length} JPGs, each under 2 MB. Upload them in YouTube Studio > Test & Compare.`, { ms: 6000, error: Boolean(big) });
  } catch (e) {
    toast(`Couldn't export the pack: ${e.message}`, { error: true });
  }
}

export function openPackDialog(app, onMade) {
  const ed = app.editor;
  const head = headlineOf(ed.objects());
  const headText = head ? head.text.replace(/\s+/g, " ").trim() : "";
  const opts = { count: 3, colours: true, headline: false, hero: false, headlines: { B: headText, C: headText } };
  const base = ed.toJSON();
  const currentThumb = ed.thumbnail(360);

  return modal("Make a Test & Compare pack", (close) => {
    const previews = el("div.sd-pack-previews");
    const headInputs = el("div.sd-pack-heads");
    const countSeg = el("div.sd-seg");
    const changeCards = el("div.sd-pack-changes");
    const go = el("button.btn.primary", { type: "button" }, icon("Copy", 16), "Make the pack");
    let timer = null, seq = 0;

    const pv = (letter, src, busy) => el("figure.sd-pack-pv", { class: busy ? "busy" : null },
      el("img", { src, alt: `Version ${letter}` }), el("figcaption", {}, letter === "A" ? "A · your design" : `Version ${letter}`));

    const letters = () => LETTERS.slice(0, opts.count - 1);
    const choice = (letter) => ({
      letter, colours: opts.colours, hero: opts.hero, headline: opts.headline ? opts.headlines[letter] : null,
    });
    const nothing = () => !opts.colours && !opts.hero && !(opts.headline && letters().some((l) => opts.headlines[l]?.trim()));

    function refreshPreviews() {
      clearTimeout(timer);
      const my = ++seq;
      previews.replaceChildren(pv("A", currentThumb), ...letters().map((l) => pv(l, currentThumb, true)));
      go.disabled = nothing();
      if (nothing()) return;
      timer = setTimeout(async () => {
        const out = [];
        for (const l of letters()) {
          try { out.push(pv(l, (await buildVariant(base, choice(l))).thumb)); } catch { out.push(pv(l, currentThumb)); }
        }
        if (my === seq) previews.replaceChildren(pv("A", currentThumb), ...out);
      }, PREVIEW_DELAY);
    }

    function renderControls() {
      countSeg.replaceChildren(...[2, 3].map((n) => el("button.sd-seg-btn", {
        type: "button", class: opts.count === n ? "on" : null,
        on: { click: () => { opts.count = n; renderControls(); refreshPreviews(); } },
      }, n === 2 ? "A + B" : "A + B + C")));
      changeCards.replaceChildren(...CHANGES.map((c) => el("button.sd-pack-change", {
        type: "button", class: opts[c.id] ? "on" : null, "aria-pressed": String(Boolean(opts[c.id])),
        on: { click: () => { opts[c.id] = !opts[c.id]; renderControls(); refreshPreviews(); } },
      }, el("span.sd-pack-ic", {}, icon(c.icon, 18)), el("b", {}, c.title), el("small", {}, c.text),
      el("span.sd-pack-tick", {}, icon("Check", 14)))));
      headInputs.replaceChildren(...(opts.headline && head ? letters().map((l) => el("label.sd-feed-field", {},
        el("span", {}, `Headline ${l}`),
        el("input", { type: "text", value: opts.headlines[l], maxLength: 120,
          on: { input: (e) => { opts.headlines[l] = e.target.value; refreshPreviews(); } } }))) : []));
      if (opts.headline && !head) headInputs.replaceChildren(el("p.sd-muted", {}, "Your design has no text yet, so there's no headline to change."));
    }

    go.onclick = async () => {
      go.disabled = true;
      go.replaceChildren(icon("Loader", 16), "Making…");
      try {
        const pack = await makeVariants(app, {
          count: opts.count, colours: opts.colours, hero: opts.hero,
          headlines: opts.headline ? Object.fromEntries(letters().map((l) => [l, opts.headlines[l]])) : {},
        });
        savePack(pack);
        onMade?.(pack);
        close();
        showMade(app, pack);
      } catch (e) {
        toast(e.message, { error: true });
        go.disabled = false;
        go.replaceChildren(icon("Copy", 16), "Make the pack");
      }
    };

    renderControls();
    refreshPreviews();
    return el("div.sd-pack", {},
      el("p.sd-muted", {}, "YouTube can test up to 3 thumbnails and keep the winner. Make the extra versions here; your design stays as it is."),
      el("h4.sd-h", {}, "How many?"), countSeg,
      el("h4.sd-h", {}, "What changes?"), changeCards, headInputs,
      el("h4.sd-h", {}, "Preview"), previews,
      el("div.row.end", {}, el("button.btn", { type: "button", on: { click: close } }, "Cancel"), go));
  }, { wide: true });
}

/** After making a pack: list the versions with Open buttons and the Export button. */
export function showMade(app, pack) {
  modal("Your pack is ready", (close) => el("div.sd-pack", {},
    el("p.sd-muted", {}, "Each version is its own design now, saved in this browser. Open one to fine-tune it."),
    el("div.sd-pack-list", {}, pack.map((v) => el("div.sd-pack-item", {},
      v.thumb ? el("img", { src: v.thumb, alt: "" }) : el("span.sd-pack-letter", {}, v.letter),
      el("div.grow", {}, el("b", {}, v.name), el("small.sd-muted", {}, v.letter === "A" ? "Your original" : "New copy")),
      el("button.btn.small", { type: "button", on: { click: async () => { close(); await openAndWait(app, v.id).catch((e) => toast(e.message, { error: true })); } } }, "Open")))),
    el("div.row.end", {},
      el("button.btn", { type: "button", on: { click: close } }, "Done"),
      el("button.btn.primary", { type: "button", on: { click: () => { close(); runExport(app, pack); } } }, icon("Download", 16), "Download all as JPG"))));
}
