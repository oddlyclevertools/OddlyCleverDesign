// Feed preview: your thumbnail at real size among other videos, in mocked YouTube layouts
// (home grid, phone feed, search, up next, Shorts shelf and a full-screen Short), dark or
// light, with a squint (blur) test. The title field counts characters and warns when the feed
// would cut the title after two lines. The mock's colours imitate the platform on purpose; the
// controls around it use the app's tokens.
import { el, icon, iconButton } from "../../ui/kit.js";
import { FAKE_VIDEOS, placeholderThumb } from "./thumbs.js";
import { TITLE_MAX, worstFit } from "./title.js";

const META_KEY = "oc-studio-feed-meta";
const VIEWS = [
  { id: "home", label: "Home", icon: "LayoutGrid", size: "360 × 202" },
  { id: "mobile", label: "Phone", icon: "Smartphone", size: "390 × 219" },
  { id: "search", label: "Search", icon: "Search", size: "360 × 202" },
  { id: "sidebar", label: "Up next", icon: "ListVideo", size: "168 × 94" },
  { id: "shorts", label: "Shorts", icon: "GalleryVerticalEnd", size: "210 × 374" },
];
const CHIPS = ["All", "Gaming", "Music", "Money", "History", "Cooking", "Live", "New to you"];

/** The title, channel and length typed into the feed preview for a design (or the defaults). */
export function readMeta(projectId, fallbackTitle) {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch { all = {}; }
  const m = all[projectId] || {};
  return { title: m.title || fallbackTitle, channel: m.channel || "Your channel", time: m.time || "10:24" };
}
function writeMeta(projectId, meta) {
  try {
    const all = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    localStorage.setItem(META_KEY, JSON.stringify({ ...all, [projectId]: meta }));
  } catch { /* storage blocked: the fields still work for this preview */ }
}

const avatar = (letter, hue, size) => el("span.sd-yt-avatar", {
  style: { width: `${size}px`, height: `${size}px`, background: `hsl(${hue} 70% 55%)`, fontSize: `${Math.round(size * 0.45)}px` },
}, letter);

/**
 * @param {object} app
 * @param {{ focusTitle?: boolean }} opts focusTitle: put the cursor in the title field (Check my design's fix)
 */
export function openFeedPreview(app, { focusTitle = false } = {}) {
  const ed = app.editor;
  const vertical = ed.height > ed.width;
  const scale = Math.min(1, (vertical ? 960 : 1280) / Math.max(ed.width, ed.height));
  const mine = ed.renderPage({ scale }).toDataURL("image/jpeg", 0.92);
  const pid = app.project?.id || "none";
  let meta = readMeta(pid, app.project?.name || "My new video");
  let view = vertical ? "shorts" : "home", theme = "dark", squint = false;
  const others = FAKE_VIDEOS.map((v, i) => ({ ...v, thumb: placeholderThumb(i + 1), vthumb: placeholderThumb(i + 11, true), hue: (i * 47) % 360 }));
  const me = () => ({ ...meta, views: "No views yet", age: "Just now", thumb: mine, vthumb: mine, hue: 330, mine: true });
  const withMine = (n, at) => { const list = others.slice(0, n - 1); list.splice(at, 0, me()); return list; };

  // ---- pieces ---------------------------------------------------------------------------
  const thumb = (v, w, h, { dur = true, vert = false, radius = 12 } = {}) => el("div.sd-yt-thumb", {
    class: v.mine ? "mine" : null, style: { width: `${w}px`, height: `${h}px`, borderRadius: `${radius}px` },
  }, el("img", { src: vert ? v.vthumb : v.thumb, alt: v.mine ? "Your design" : "" }),
  dur ? el("span.sd-yt-dur", {}, v.time) : null);

  const lines = (v, { avatarSize = 36, small = false, channelRow = true } = {}) => el("div.sd-yt-meta", { class: small ? "small" : null },
    avatarSize ? avatar(v.channel[0]?.toUpperCase() || "Y", v.hue, avatarSize) : null,
    el("div.sd-yt-text", {},
      el("div.sd-yt-title", {}, v.title),
      channelRow ? el("div.sd-yt-sub", {}, v.channel) : null,
      el("div.sd-yt-sub", {}, `${v.views} · ${v.age}`)),
    small ? null : el("span.sd-yt-dots", {}, icon("EllipsisVertical", 18)));

  const topBar = () => el("div.sd-yt-top", {}, icon("Menu", 22), el("span.sd-yt-logo", {}, el("i"), "VideoSite"),
    el("div.sd-yt-search", {}, el("span", {}, "Search"), icon("Search", 18)), avatar("Y", 330, 32));
  const chips = () => el("div.sd-yt-chips", {}, CHIPS.map((c, i) => el("span.sd-yt-chip", { class: i === 0 ? "on" : null }, c)));

  // ---- views ----------------------------------------------------------------------------
  const views = {
    home: () => el("div.sd-yt-page", {}, topBar(), chips(),
      el("div.sd-yt-grid", {}, withMine(6, 1).map((v) => el("div.sd-yt-card", {}, thumb(v, 360, 202), lines(v))))),
    mobile: () => el("div.sd-phone", {}, el("div.sd-phone-screen", {},
      el("div.sd-yt-top.m", {}, el("span.sd-yt-logo", {}, el("i"), "VideoSite"), el("span.grow"), icon("Search", 20), avatar("Y", 330, 26)),
      el("div.sd-yt-chips.m", {}, CHIPS.slice(0, 5).map((c, i) => el("span.sd-yt-chip", { class: i === 0 ? "on" : null }, c))),
      withMine(3, 1).map((v) => el("div.sd-yt-mcard", {}, thumb(v, 390, 219, { radius: 0 }), lines(v, { avatarSize: 36 }))))),
    search: () => el("div.sd-yt-page", {}, topBar(),
      el("div.sd-yt-results", {}, withMine(4, 1).map((v) => el("div.sd-yt-row", {}, thumb(v, 360, 202),
        el("div.sd-yt-rtext", {}, el("div.sd-yt-title.big", {}, v.title), el("div.sd-yt-sub", {}, `${v.views} · ${v.age}`),
          el("div.sd-yt-chan", {}, avatar(v.channel[0], v.hue, 24), el("span.sd-yt-sub", {}, v.channel)),
          el("div.sd-yt-sub.desc", {}, "A quick look at what really happened, the numbers behind it and what you can copy today.")))))),
    sidebar: () => el("div.sd-yt-page", {}, topBar(), el("div.sd-yt-watch", {},
      el("div.sd-yt-main", {}, el("div.sd-yt-player", {}, icon("Play", 54)), el("div.sd-yt-title.big", {}, others[6].title),
        el("div.sd-yt-chan", {}, avatar("O", 40, 36), el("div", {}, el("div.sd-yt-title", {}, others[6].channel), el("div.sd-yt-sub", {}, "812K subscribers")))),
      el("div.sd-yt-side", {}, withMine(7, 2).map((v) => el("div.sd-yt-srow", {}, thumb(v, 168, 94, { radius: 8 }),
        lines(v, { avatarSize: 0, small: true })))))),
    shorts: () => el("div.sd-yt-page.sd-yt-shortsview", {}, el("div.sd-yt-shelf", {},
      el("div.sd-yt-shelf-head", {}, icon("GalleryVerticalEnd", 22), "Shorts"),
      el("div.sd-yt-shelf-row", {}, withMine(5, 1).map((v) => el("div.sd-yt-short", {}, thumb(v, 210, 374, { dur: false, vert: true }),
        el("div.sd-yt-title", {}, v.title), el("div.sd-yt-sub", {}, v.views))))),
    el("div.sd-phone.short", {}, el("div.sd-phone-screen.short", {},
      el("img.sd-short-bg", { src: mine, alt: "Your design full screen" }),
      el("div.sd-short-top", {}, icon("Search", 22), icon("EllipsisVertical", 22)),
      el("div.sd-short-side", {}, [["ThumbsUp", "12K"], ["ThumbsDown", "Dislike"], ["MessageSquare", "318"], ["Share2", "Share"], ["Repeat", "Remix"]]
        .map(([n, t]) => el("div", {}, el("span.sd-short-btn", {}, icon(n, 22)), el("small", {}, t)))),
      el("div.sd-short-bottom", {}, el("div.sd-yt-chan", {}, avatar(meta.channel[0] || "Y", 330, 30), el("b", {}, `@${meta.channel.replace(/\s+/g, "").toLowerCase()}`), el("span.sd-short-sub", {}, "Subscribe")),
        el("div", {}, meta.title), el("div.sd-short-sound", {}, icon("Music", 14), "Original sound"))))),
  };

  // ---- shell ----------------------------------------------------------------------------
  const stage = el("div.sd-feed-stage");
  const sizeNote = el("span.sd-feed-note");
  const tabs = el("div.sd-seg", { role: "tablist", "aria-label": "Where to preview" });
  const themeBtn = el("button.btn.small", { type: "button", title: "Switch between dark and light mode" });
  const squintBtn = el("button.btn.small", { type: "button", title: "Blur everything, like squinting, to see what stands out" }, icon("Glasses", 16), "Squint test");
  const field = (label, key, width, extra = null) => el("label.sd-feed-field", {}, el("span.sd-feed-label", {}, label, extra),
    el("input", { type: "text", value: meta[key], style: { width }, maxLength: key === "time" ? 8 : TITLE_MAX, "data-key": key,
      on: { input: (e) => { meta = { ...meta, [key]: e.target.value }; writeMeta(pid, meta); render(); } } }));
  const counter = el("span.sd-title-count", { "aria-live": "polite" });
  const titleWarn = el("p.sd-title-warn", { role: "status" });
  function renderTitleFit() {
    const n = meta.title.length;
    counter.textContent = `${n} / ${TITLE_MAX}`;
    counter.classList.toggle("near", n > TITLE_MAX * 0.7);
    counter.classList.toggle("over", n > TITLE_MAX);
    const fit = worstFit(meta.title);
    titleWarn.hidden = fit.fits;
    if (!fit.fits) {
      titleWarn.replaceChildren(icon("Scissors", 14), el("span", {}, `On ${fit.label} the title stops after two lines, at “${fit.shown}…”. People never see `),
        el("b", {}, `“${fit.hidden}”`), el("span", {}, ". Put the words that matter first, or shorten it."));
    }
  }

  function render() {
    stage.replaceChildren(el("div.sd-yt", { class: theme }, views[view]()));
    stage.classList.toggle("squint", squint);
    for (const b of tabs.children) {
      b.classList.toggle("on", b.dataset.id === view);
      b.setAttribute("aria-selected", b.dataset.id === view);
    }
    const v = VIEWS.find((x) => x.id === view);
    const crop = (view === "shorts") !== vertical
      ? (vertical ? " Your design is tall, so wide spots crop its middle." : " Your design is wide, so Shorts crop its middle.") : "";
    sizeNote.textContent = `Your picture is shown at its real size here: ${v.size} px.${crop}`;
    themeBtn.replaceChildren(icon(theme === "dark" ? "Sun" : "Moon", 16), theme === "dark" ? "Light mode" : "Dark mode");
    squintBtn.classList.toggle("on", squint);
    renderTitleFit();
  }
  for (const v of VIEWS) {
    tabs.append(el("button.sd-seg-btn", { type: "button", role: "tab", dataset: { id: v.id }, on: { click: () => { view = v.id; render(); } } },
      icon(v.icon, 16), v.label));
  }
  themeBtn.onclick = () => { theme = theme === "dark" ? "light" : "dark"; render(); };
  squintBtn.onclick = () => { squint = !squint; render(); };

  const root = el("div.sd-feed", { role: "dialog", "aria-label": "See it on YouTube", tabindex: "-1" },
    el("header.sd-feed-head", {},
      el("div.sd-feed-titles", {}, el("h2", {}, "See it in the feed"), el("p", {}, "Does it stand out next to other videos?")),
      tabs, el("span.grow"), themeBtn, squintBtn, iconButton("X", "Close preview (Esc)", () => close())),
    el("div.sd-feed-bar", {}, field("Video title", "title", "320px", counter), field("Channel", "channel", "160px"), field("Length", "time", "70px"),
      el("span.grow"), sizeNote),
    titleWarn,
    stage);

  const onKey = (e) => {
    e.stopPropagation(); // keep editor shortcuts (Delete, Ctrl+Z…) away while the preview is open
    if (e.key === "Escape") close();
  };
  root.addEventListener("keydown", onKey);
  root.addEventListener("keyup", (e) => e.stopPropagation());
  function close() {
    root.classList.remove("show");
    setTimeout(() => root.remove(), 200);
    app.editor.canvas.requestRenderAll();
  }
  render();
  document.body.append(root);
  requestAnimationFrame(() => {
    root.classList.add("show");
    const input = focusTitle && root.querySelector('input[data-key="title"]');
    if (input) { input.focus(); input.select(); } else root.focus();
  });
  return { close, setView: (id) => { view = id; render(); }, setTheme: (t) => { theme = t; render(); }, setSquint: (s) => { squint = s; render(); } };
}
