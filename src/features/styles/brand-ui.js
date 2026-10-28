// The brand kit section at the top of the Styles panel: your colours, fonts, logos and
// uploaded fonts, all kept in this browser (free, where other editors charge for it).
import { el, icon, iconButton, toast, confirmDialog } from "../../ui/kit.js";
import { prepareImageFile } from "../elements/images.js";
import { openFontPicker } from "../text/fontpicker.js";
import { getKit, saveKit } from "./brand-db.js";
import { kitPalette, startOddlyKit, addLogo } from "./brand.js";
import { paletteJob, pairingJob } from "./apply.js";
import { userFonts, uploadFonts, removeFont, chooseFontFiles, onUserFontsChanged } from "./user-fonts.js";

export function renderBrand(box, app, applier, { onPalette }) {
  let kit = null;
  let alive = true;

  const save = async (next) => {
    try {
      kit = await saveKit(next);
      paint();
    } catch (e) {
      toast(`Couldn't save the brand kit: ${e.message}`, { error: true });
    }
  };

  const paint = () => {
    if (!alive) return;
    if (!kit) {
      box.replaceChildren(el("div.st-loading", {}, "Loading your brand kit…"));
      return;
    }
    const empty = !kit.colors.length && !kit.head && !kit.logos.length;
    box.replaceChildren(
      el("div.st-sec-head", {}, el("h4.sec-title", {}, "Your brand kit"), el("span.st-free", { title: "Free, and stays in this browser" }, "Free")),
      empty ? starter() : kitBody(),
      fontsBlock(),
    );
  };

  const starter = () => el("div.st-starter", {},
    el("p", {}, "Keep your colours, fonts and logos here, then restyle any design in one click."),
    el("button.btn.primary.st-wide", {
      type: "button", on: { click: async () => {
        try {
          kit = await startOddlyKit();
          paint();
          toast("Oddly Clever kit ready. Click Apply to use it.");
        } catch (e) {
          toast(`Couldn't make the kit: ${e.message}`, { error: true });
        }
      } },
    }, icon("Sparkles", 16), "Start with the Oddly Clever kit"),
    el("button.btn.st-wide", { type: "button", on: { click: () => addColor() } }, icon("Plus", 16), "Build my own"));

  const addColor = () => {
    const input = el("input", { type: "color", value: "#ff2e7e" });
    input.addEventListener("change", () => save({ ...kit, colors: [...kit.colors.filter((c) => c !== input.value), input.value] }));
    input.click();
  };

  const kitBody = () => {
    const pal = kitPalette(kit.colors);
    const colors = el("div.st-kit-colors", {},
      kit.colors.map((c, i) => el("span.st-kit-sw", { style: { background: c }, title: i === 0 ? `${c} (page colour)` : c },
        el("button.st-x", {
          type: "button", title: `Remove ${c}`, "aria-label": `Remove colour ${c}`,
          on: { click: () => save({ ...kit, colors: kit.colors.filter((x) => x !== c) }) },
        }, icon("X", 11)))),
      kit.colors.length < 16 ? el("button.st-kit-add", { type: "button", title: "Add a colour", "aria-label": "Add a colour", on: { click: addColor } }, icon("Plus", 15)) : null);

    const applyColors = el("button.btn.small", {
      type: "button", disabled: !pal, title: "Recolour the design with your colours (the first one becomes the page)",
      on: {
        click: () => onPalette(pal),
        mouseenter: () => pal && applier.hover("brand-colors", paletteJob(app, pal)),
        mouseleave: () => applier.leave(),
      },
    }, icon("Palette", 15), "Apply colours");

    const fontBtn = (role, label) => {
      const f = kit[role];
      const b = el("button.st-kit-font", {
        type: "button", title: `Choose the ${label.toLowerCase()} font`, style: f ? { fontFamily: `"${f.family}"` } : null,
        on: { click: () => openFontPicker(b, f?.family, (family) => save({ ...kit, [role]: { family, weight: role === "head" ? 900 : 400 } })) },
      }, el("small", {}, label), el("span", {}, f?.family || "Choose…"));
      return b;
    };
    const pair = kit.head || kit.body ? { head: kit.head || kit.body, body: kit.body || kit.head } : null;
    const applyFonts = el("button.btn.small", {
      type: "button", disabled: !pair, title: "Use your fonts: big text gets the heading font, small text the body font",
      on: {
        click: () => applier.apply(pairingJob(app, pair), "Brand fonts"),
        mouseenter: () => pair && applier.hover("brand-fonts", pairingJob(app, pair)),
        mouseleave: () => applier.leave(),
      },
    }, icon("Type", 15), "Apply fonts");

    const logos = el("div.st-logos", {},
      kit.logos.map((l) => el("div.st-logo", {},
        el("button.st-logo-img", {
          type: "button", title: `Add ${l.name} to the page`, "aria-label": `Add ${l.name} to the page`,
          on: { click: async () => { try { await addLogo(app, l); } catch (e) { toast(`Couldn't add the logo: ${e.message}`, { error: true }); } } },
        }, el("img", { src: l.src, alt: "" })),
        el("button.st-x", {
          type: "button", title: `Remove ${l.name}`, "aria-label": `Remove logo ${l.name}`,
          on: { click: () => save({ ...kit, logos: kit.logos.filter((x) => x.id !== l.id) }) },
        }, icon("X", 11)))),
      kit.logos.length < 12 ? el("button.st-logo-add", { type: "button", title: "Upload a logo", "aria-label": "Upload a logo", on: { click: uploadLogo } },
        icon("ImageUp", 18), el("small", {}, "Logo")) : null);

    return el("div.st-kit", {},
      el("div.st-kit-row", {}, el("b", {}, "Colours"), el("span.grow"), applyColors),
      kit.colors.length ? colors : el("p.st-hint", {}, "Add your colours. The first one becomes the page colour."),
      !kit.colors.length ? el("button.btn.small", { type: "button", on: { click: addColor } }, icon("Plus", 15), "Add a colour") : null,
      el("div.st-kit-row", {}, el("b", {}, "Fonts"), el("span.grow"), applyFonts),
      el("div.st-kit-fonts", {}, fontBtn("head", "Heading"), fontBtn("body", "Body")),
      el("div.st-kit-row", {}, el("b", {}, "Logos"), el("small.st-faint", {}, "Click one to add it")),
      logos,
      el("button.st-link", {
        type: "button", on: { click: async () => {
          if (await confirmDialog("Clear the brand kit?", "Your colours, fonts and logos will be removed from the kit. Your designs don't change.", "Clear kit")) {
            save({ id: "kit", colors: [], head: null, body: null, logos: [] });
          }
        } },
      }, "Clear the kit"));
  };

  const uploadLogo = () => {
    const input = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/svg+xml" });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const p = await prepareImageFile(file);
        await save({ ...kit, logos: [...kit.logos, { id: `lg${Date.now().toString(36)}`, name: file.name.replace(/\.\w+$/, ""), src: p.src }] });
      } catch (e) {
        toast(e.message, { error: true });
      }
    });
    input.click();
  };

  const fontsBlock = () => {
    const list = userFonts();
    return el("div.st-ufonts", {},
      el("div.st-kit-row", {}, el("b", {}, "Your fonts"), el("span.grow"),
        el("button.btn.small", { type: "button", title: "Upload .ttf, .otf, .woff or .woff2 fonts", on: { click: async () => uploadFonts(await chooseFontFiles()) } },
          icon("Upload", 15), "Upload a font")),
      list.length ? el("div.st-ufont-list", {}, list.map((f) => el("div.st-ufont", { title: f.fileName },
        el("span", { style: { fontFamily: `"${f.family}"` } }, f.family),
        iconButton("Trash2", `Remove ${f.family}`, async () => {
          if (!(await confirmDialog("Remove this font?", `Designs that use "${f.family}" will show a fallback font.`, "Remove"))) return;
          try { await removeFont(f.id); } catch (e) { toast(e.message, { error: true }); }
        }))))
        : el("p.st-hint", {}, "Your own fonts show up in the font list under \"Your fonts\"."));
  };

  paint();
  getKit().then((k) => { kit = k; paint(); }).catch((e) => {
    kit = { id: "kit", colors: [], head: null, body: null, logos: [] };
    paint();
    toast(`Couldn't open the brand kit: ${e.message}`, { error: true });
  });
  const off = onUserFontsChanged(paint);
  return () => { alive = false; off(); };
}
