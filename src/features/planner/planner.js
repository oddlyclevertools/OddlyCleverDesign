// The Content Planner screen: month and week calendars of planned posts, empty repeating slots to
// fill, undated ideas, the post editor and the upload kit. It never posts anything anywhere.
import { confirmDialog, el, icon, modal, toast } from "../../ui/kit.js";
import { getAllPosts, getSlots, onPlanChanged } from "./db.js";
import {
  DEFAULT_TZ, PLATFORMS, STATUSES, WEEKDAYS, addDays, addMonths, byWhen, dayLabel, localEcho, monthGrid, monthLabel,
  openSlots, parseTags, platformById, startOfWeek, statusById, today, tzShort, weekDays, youtubeTagsLength,
} from "./model.js";
import { addPost, downloadUploadKit, removePost, saveSlots, updatePost } from "./actions.js";

const ui = { view: "month", anchor: null }; // kept between openings
const MONTH_MAX = 3; // entries shown in a month cell before "+N more"

export function renderPlanner(box, app) {
  ui.anchor ||= today();
  let posts = [], slots = [], projects = [];
  box.classList.add("pl-root");

  const label = el("h3.pl-range");
  const viewBtns = ["month", "week"].map((v) => el("button.pl-seg", { type: "button", dataset: { view: v }, on: { click: () => { ui.view = v; draw(); } } },
    icon(v === "month" ? "CalendarDays" : "CalendarRange", 15), v === "month" ? "Month" : "Week"));
  const step = (n) => { ui.anchor = ui.view === "month" ? addMonths(ui.anchor, n) : addDays(ui.anchor, 7 * n); draw(); };
  const head = el("div.pl-head", {},
    el("div.pl-segs", { role: "group", "aria-label": "Calendar view" }, ...viewBtns),
    el("div.pl-nav", {},
      el("button.ibtn", { type: "button", title: "Earlier", "aria-label": "Earlier", on: { click: () => step(-1) } }, icon("ChevronLeft")),
      el("button.btn.small", { type: "button", on: { click: () => { ui.anchor = today(); draw(); } } }, "Today"),
      el("button.ibtn", { type: "button", title: "Later", "aria-label": "Later", on: { click: () => step(1) } }, icon("ChevronRight"))),
    label,
    el("span.pl-gap"),
    el("button.btn", { type: "button", title: "Your repeating posting times", on: { click: () => editSlots() } }, icon("Repeat", 16), "Repeating slots"),
    el("button.btn.primary", { type: "button", on: { click: () => openEditor(app, null, { date: ui.view === "week" && !weekDays(ui.anchor).includes(today()) ? startOfWeek(ui.anchor) : today() }, projects) } }, icon("Plus", 16), "New post"));
  const cal = el("div.pl-cal");
  const side = el("aside.pl-side");
  box.append(head,
    el("p.pl-note", {}, icon("ShieldCheck", 14), "Plan posts and make upload kits here. The planner never posts anything for you: you upload on each site yourself."),
    el("div.pl-body", {}, cal, side));

  async function load() {
    try {
      [posts, slots, projects] = await Promise.all([getAllPosts(), getSlots(), app.store.listProjects().catch(() => [])]);
    } catch (e) {
      cal.replaceChildren(el("p.pl-empty", {}, `The planner couldn't load: ${e.message}`));
      return;
    }
    draw();
  }

  function draw() {
    viewBtns.forEach((b) => b.classList.toggle("on", b.dataset.view === ui.view));
    const days = ui.view === "month" ? monthGrid(ui.anchor) : weekDays(ui.anchor);
    const from = days[0], to = days[days.length - 1];
    label.textContent = ui.view === "month" ? monthLabel(ui.anchor) : `${dayLabel(from, { day: "numeric", month: "short" })} – ${dayLabel(to, { day: "numeric", month: "short", year: "numeric" })}`;
    const now = today();
    const open = openSlots(slots, posts, from, to);
    const byDate = new Map();
    const push = (d, x) => { if (!byDate.has(d)) byDate.set(d, []); byDate.get(d).push(x); };
    for (const p of posts) if (p.date && p.date >= from && p.date <= to) push(p.date, { post: p, at: p.time });
    for (const o of open) push(o.date, { slot: o, at: o.time });
    const month = ui.anchor.slice(0, 7);
    cal.className = `pl-cal pl-${ui.view}`;
    cal.replaceChildren(
      ...[1, 2, 3, 4, 5, 6, 0].map((d) => el("div.pl-wd", {}, WEEKDAYS[d])),
      ...days.map((d) => {
        const list = (byDate.get(d) || []).sort((a, b) => a.at.localeCompare(b.at) || (a.post ? -1 : 1));
        const shown = ui.view === "month" ? list.slice(0, MONTH_MAX) : list;
        const extra = list.length - shown.length;
        const cell = el("div.pl-day", {
          class: [d.slice(0, 7) !== month && ui.view === "month" ? "out" : "", d === now ? "today" : "", d < now ? "past" : ""].filter(Boolean).join(" ") || null,
          dataset: { date: d },
          on: {
            click: (e) => { if (e.target === cell || e.target.classList.contains("pl-day-num")) openEditor(app, null, { date: d }, projects); },
            dragover: (e) => { if ([...e.dataTransfer.types].includes("application/x-oc-post")) { e.preventDefault(); cell.classList.add("drop"); } },
            dragleave: () => cell.classList.remove("drop"),
            drop: async (e) => {
              cell.classList.remove("drop");
              const id = e.dataTransfer.getData("application/x-oc-post");
              if (!id) return;
              e.preventDefault();
              try { await updatePost(app, id, { date: d }); toast(`Moved to ${dayLabel(d)}.`); } catch (err) { toast(err.message, { error: true }); }
            },
          },
        },
        el("div.pl-day-head", {}, el("span.pl-day-num", {}, ui.view === "week" ? dayLabel(d) : String(Number(d.slice(8))))),
        ...shown.map((x) => (x.post ? postChip(x.post) : slotChip(x.slot))),
        extra > 0 ? el("button.pl-more", { type: "button", on: { click: () => { ui.view = "week"; ui.anchor = d; draw(); } } }, `+${extra} more`) : null);
        return cell;
      }));
    reveal();
    drawSide();
  }

  // The days sweep in corner to corner when the month or week changes (not on every edit).
  let shownRange = "";
  function reveal() {
    const key = `${ui.view}|${label.textContent}`;
    if (key === shownRange) return;
    shownRange = key;
    [...cal.children].forEach((c, i) => {
      const k = Math.max(0, i - 7);
      c.style.setProperty("--i", String(i < 7 ? i : Math.floor(k / 7) + (k % 7)));
    });
    void cal.offsetWidth;
    cal.classList.add("pl-reveal");
  }
  const emptyNote = (ic, text) => el("p.pl-empty", {}, icon(ic, 14), el("span", {}, text));

  function postChip(p) {
    const st = statusById(p.status);
    return el("button.pl-chip", {
      type: "button", draggable: "true", style: `--st: ${st.color}`, dataset: { status: p.status, id: p.id },
      title: `${p.title}\n${p.time} ${tzShort(p.tz)} · ${p.platforms.map((x) => platformById(x)?.short).join(", ")} · ${st.label}`,
      on: {
        click: (e) => { e.stopPropagation(); openEditor(app, p, null, projects); },
        dragstart: (e) => { e.dataTransfer.setData("application/x-oc-post", p.id); e.dataTransfer.effectAllowed = "move"; },
      },
    }, el("span.pl-chip-top", {}, el("span.pl-time", {}, p.date ? p.time : "No date"), ...p.platforms.slice(0, 4).map((x) => el("i.pl-dot", { style: { background: platformById(x)?.color }, title: platformById(x)?.name })),
      el("span.pl-st", {}, icon(st.icon, 11))),
    el("span.pl-chip-title", {}, p.title),
    ui.view === "week" && p.description ? el("span.pl-chip-desc", {}, p.description.slice(0, 90)) : null);
  }

  function slotChip(o) {
    return el("button.pl-slot", {
      type: "button", title: `Empty slot: ${o.label} at ${o.time} ${tzShort(o.tz)}. Click to plan a post here.`,
      on: { click: (e) => { e.stopPropagation(); openEditor(app, null, { date: o.date, time: o.time, tz: o.tz, platforms: o.platforms, slotId: o.slotId, title: "" }, projects); } },
    }, icon("Plus", 12), el("span", {}, `${o.time} ${o.label}`));
  }

  function drawSide() {
    const ideas = posts.filter((p) => !p.date).sort(byWhen);
    const now = today();
    const next = posts.filter((p) => p.date && p.date >= now && p.status !== "posted").sort(byWhen).slice(0, 5);
    side.replaceChildren(
      el("div.pl-side-sec", {}, el("h4.sec-title", {}, "Ideas without a date"),
        ideas.length ? el("div.pl-ideas", {}, ...ideas.map(postChip)) : emptyNote("Lightbulb", "Ideas you save without a date wait here."),
        el("button.btn.small.pl-add-idea", { type: "button", on: { click: () => openEditor(app, null, { date: "" }, projects) } }, icon("Lightbulb", 14), "Add an idea")),
      el("div.pl-side-sec", {}, el("h4.sec-title", {}, "Coming up"),
        next.length ? el("ol.pl-next", {}, ...next.map((p) => el("li", {}, el("button", { type: "button", on: { click: () => openEditor(app, p, null, projects) } },
          el("b", {}, dayLabel(p.date)), ` ${p.time} · `, p.title)))) : emptyNote("CalendarPlus", "Nothing planned yet. Click a day to plan a post.")),
      el("div.pl-side-sec", {}, el("h4.sec-title", {}, "Status"),
        el("div.pl-legend", {}, ...STATUSES.map((s) => el("span", {}, el("i.pl-dot", { style: { background: s.color } }), s.label)))),
    );
  }

  function editSlots() { slotsDialog(app, slots); }

  const off = onPlanChanged(load);
  load();
  return () => off();
}

// ---- the post editor ------------------------------------------------------------------------

/** Open the editor for a post (or a new one from `preset`). */
export function openEditor(app, post, preset, projects = []) {
  const draft = post ? { ...post, tags: [...post.tags], platforms: [...post.platforms], designs: { ...post.designs } }
    : { title: "", description: "", tags: [], platforms: ["youtube"], date: today(), time: "17:00", tz: DEFAULT_TZ, status: "idea", designId: "", designs: {}, slotId: "", notes: "", ...preset };
  let busy = false;

  const counter = (n, max) => el("span.pl-count", { class: max && n > max ? "over" : null }, max ? `${n}/${max}` : String(n));
  const titleCount = el("span");
  const title = el("input.pl-in", { type: "text", value: draft.title, placeholder: "What's the video called?", maxLength: 200, "aria-label": "Title",
    on: { input: () => { draft.title = title.value; titleCount.replaceChildren(counter(title.value.length, 100)); } } });
  titleCount.replaceChildren(counter(draft.title.length, 100));
  const date = el("input.pl-in", { type: "date", value: draft.date, "aria-label": "Date", on: { input: () => { draft.date = date.value; echo(); } } });
  const time = el("input.pl-in", { type: "time", value: draft.time, "aria-label": "Time", on: { input: () => { draft.time = time.value || "17:00"; echo(); } } });
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzSel = el("select.sel.pl-in", { "aria-label": "Time zone", on: { change: () => { draft.tz = tzSel.value; echo(); } } },
    ...[...new Set([draft.tz, DEFAULT_TZ, localTz, "UTC"])].map((z) => el("option", { value: z, selected: z === draft.tz }, tzShort(z))));
  const echoBox = el("span.pl-echo");
  const echo = () => { echoBox.textContent = draft.date && draft.time ? localEcho(draft.date, draft.time, draft.tz) : ""; };
  echo();

  const statusRow = el("div.pl-status-row", { role: "radiogroup", "aria-label": "Status" });
  const drawStatus = () => statusRow.replaceChildren(...STATUSES.map((s) => el("button.pl-status", {
    type: "button", role: "radio", "aria-checked": String(draft.status === s.id), class: draft.status === s.id ? "on" : null, style: `--st: ${s.color}`,
    on: { click: () => { draft.status = s.id; drawStatus(); } },
  }, icon(s.icon, 14), s.label)));
  drawStatus();

  const platRow = el("div.pl-plats", { role: "group", "aria-label": "Platforms" });
  const perDesign = el("div.pl-per");
  const drawPlats = () => {
    platRow.replaceChildren(...PLATFORMS.map((p) => el("button.pl-plat", {
      type: "button", "aria-pressed": String(draft.platforms.includes(p.id)), class: draft.platforms.includes(p.id) ? "on" : null, style: `--pc: ${p.color}`,
      title: `${p.name}: cover ${p.thumb.w} × ${p.thumb.h}`,
      on: { click: () => {
        draft.platforms = draft.platforms.includes(p.id) ? draft.platforms.filter((x) => x !== p.id) : [...draft.platforms, p.id];
        drawPlats();
      } },
    }, icon(p.icon, 14), p.short)));
    perDesign.replaceChildren(...draft.platforms.map((id) => {
      const p = platformById(id);
      return el("label.pl-per-row", {}, el("span", {}, `${p.short} (${p.thumb.w}×${p.thumb.h})`),
        designSelect(draft.designs[id] || "", (v) => { draft.designs = { ...draft.designs }; if (v) draft.designs[id] = v; else delete draft.designs[id]; }, "Same as main design"));
    }));
  };

  function designSelect(value, onChange, none = "No design yet") {
    return el("select.sel.pl-in", { on: { change: (e) => onChange(e.target.value) } },
      el("option", { value: "" }, none),
      ...projects.map((r) => el("option", { value: r.id, selected: r.id === value }, `${r.name || "Untitled design"} (${r.width}×${r.height})`)));
  }
  const thumb = el("div.pl-thumb");
  const drawThumb = () => {
    const r = projects.find((x) => x.id === draft.designId);
    thumb.replaceChildren(r?.thumb ? el("img", { src: r.thumb, alt: r.name || "Design" }) : el("span", {}, icon("Image", 22)));
  };
  drawThumb();
  const mainDesign = designSelect(draft.designId, (v) => { draft.designId = v; drawThumb(); });

  const desc = el("textarea.pl-in.pl-desc", { rows: 6, placeholder: "Description. Stock credits from the design are added to the kit automatically.", "aria-label": "Description",
    on: { input: () => { draft.description = desc.value; descCount.replaceChildren(counter(desc.value.length, 5000)); } } }, draft.description);
  const descCount = el("span", {}, counter(draft.description.length, 5000));
  const tags = el("input.pl-in", { type: "text", value: draft.tags.join(", "), placeholder: "money, history, business", "aria-label": "Tags, separated by commas",
    on: { input: () => { draft.tags = parseTags(tags.value); tagCount.replaceChildren(counter(youtubeTagsLength(draft.tags), 500)); } } });
  const tagCount = el("span", {}, counter(youtubeTagsLength(draft.tags), 500));
  const notes = el("textarea.pl-in", { rows: 2, placeholder: "Notes for yourself (not in the kit)", "aria-label": "Notes", on: { input: () => { draft.notes = notes.value; } } }, draft.notes || "");
  const progress = el("div.pl-progress", { role: "status", "aria-live": "polite" });

  const field = (lab, ...kids) => el("div.pl-field", {}, el("div.pl-label", {}, lab), ...kids);
  let saved = post;
  const save = async (quiet = false) => {
    const fields = { title: draft.title, description: draft.description, tags: draft.tags, platforms: draft.platforms, date: draft.date, time: draft.time,
      tz: draft.tz, status: draft.status, designId: draft.designId, designs: draft.designs, slotId: draft.slotId, notes: draft.notes };
    if (!fields.platforms.length) throw new Error("Pick at least one platform.");
    saved = saved ? await updatePost(app, saved.id, fields) : await addPost(app, fields);
    if (!quiet) toast("Post saved.");
    return saved;
  };
  const guard = (fn) => async () => {
    if (busy) return;
    busy = true;
    try { await fn(); } catch (e) { toast(e.message, { error: true }); } finally { busy = false; progress.textContent = ""; }
  };

  const m = modal(post ? "Edit post" : "Plan a post", (close) => {
    const kitBtn = el("button.btn", { type: "button", title: "Pictures at each platform's size, title, description, tags and a checklist, in one zip",
      on: { click: guard(async () => {
        const p = await save(true);
        const res = await downloadUploadKit(app, p.id, { onProgress: (f, msg) => { progress.textContent = msg; } });
        toast(`Upload kit saved: ${res.filename}${res.aiPictures.length ? ". It reminds you to label the AI pictures." : ""}`, { ms: 5000 });
        res.notes.forEach((n) => toast(n, { ms: 5000 }));
      }) } }, icon("Package", 16), "Download upload kit");
    const openBtn = el("button.btn.small", { type: "button", title: "Open the linked design", on: { click: guard(async () => {
      if (!draft.designId) { toast("Pick a design first.", { error: true }); return; }
      await save(true);
      close();
      closePlanner();
      location.hash = `#/d/${draft.designId}`;
    }) } }, icon("FolderOpen", 14), "Open");
    const newBtn = el("button.btn.small", { type: "button", title: "Start a new design for this post and link it", on: { click: guard(async () => {
      const first = platformById(draft.platforms[0] || "youtube");
      const p = await save(true);
      close();
      closePlanner();
      await app.newDesign({ size: { w: first.thumb.w, h: first.thumb.h }, name: draft.title || "Planned post" });
      if (app.project?.id) await updatePost(app, p.id, { designId: app.project.id });
      toast("New design linked to the post.");
    }) } }, icon("Plus", 14), "New design");
    return el("div.pl-editor", {},
      field(el("span", {}, "Title ", titleCount), title),
      el("div.pl-row", {}, field("Date", date), field("Time", time), field("Time zone", tzSel)),
      echoBox,
      field("Status", statusRow),
      field("Platforms", platRow),
      el("div.pl-design", {}, thumb, el("div.pl-design-main", {}, field("Design for the thumbnail", mainDesign), el("div.pl-design-btns", {}, openBtn, newBtn))),
      el("details.pl-details", {}, el("summary", {}, "A different design per platform (for example a vertical cover)"), perDesign),
      field(el("span", {}, "Description ", descCount), desc),
      field(el("span", {}, "Tags ", tagCount), tags),
      field("Notes", notes),
      progress,
      el("div.pl-foot", {},
        post ? el("button.btn.pl-del", { type: "button", on: { click: guard(async () => {
          const ok = await confirmDialog("Delete this post?", `“${post.title}” goes from the planner. Its design stays in your designs.`, "Delete");
          if (!ok) return;
          await removePost(app, post.id);
          toast("Post deleted.");
          close();
        }) } }, icon("Trash2", 15), "Delete") : null,
        el("span.pl-gap"), kitBtn,
        el("button.btn.primary", { type: "button", on: { click: guard(async () => { await save(); close(); }) } }, icon("Check", 16), "Save")),
    );
  }, { wide: true });
  drawPlats();
  requestAnimationFrame(() => title.focus());
  return m;
}

// ---- repeating slots --------------------------------------------------------------------------

function slotsDialog(app, current) {
  let list = current.map((s) => ({ ...s, weekdays: [...s.weekdays], platforms: [...s.platforms] }));
  const rows = el("div.pl-slots");
  const draw = () => rows.replaceChildren(...list.map((s, i) => {
    const set = (k, v) => { list = list.map((x, j) => (j === i ? { ...x, [k]: v } : x)); draw(); };
    return el("div.pl-slot-row", {},
      el("div.pl-slot-top", {},
        el("input.pl-in.pl-slot-name", { type: "text", value: s.label, maxLength: 40, "aria-label": "Slot name", on: { change: (e) => set("label", e.target.value) } }),
        el("input.pl-in", { type: "time", value: s.time, "aria-label": "Time", on: { change: (e) => set("time", e.target.value) } }),
        el("span.pl-tz", {}, tzShort(s.tz)),
        el("label.pl-on", {}, el("input", { type: "checkbox", checked: s.active !== false, on: { change: (e) => set("active", e.target.checked) } }), "On"),
        el("button.ibtn", { type: "button", title: "Remove slot", "aria-label": `Remove ${s.label}`, on: { click: async () => {
          if (await confirmDialog("Remove this slot?", "Posts already planned stay. Only the repeating empty slots go.", "Remove")) { list = list.filter((_, j) => j !== i); draw(); }
        } } }, icon("Trash2", 15))),
      el("div.pl-days", { role: "group", "aria-label": "Days" }, ...[1, 2, 3, 4, 5, 6, 0].map((d) => el("button.pl-daybtn", {
        type: "button", "aria-pressed": String(s.weekdays.includes(d)), class: s.weekdays.includes(d) ? "on" : null,
        on: { click: () => set("weekdays", s.weekdays.includes(d) ? s.weekdays.filter((x) => x !== d) : [...s.weekdays, d]) },
      }, WEEKDAYS[d]))),
      el("div.pl-plats.small", {}, ...PLATFORMS.map((p) => el("button.pl-plat", {
        type: "button", "aria-pressed": String(s.platforms.includes(p.id)), class: s.platforms.includes(p.id) ? "on" : null, style: `--pc: ${p.color}`,
        on: { click: () => set("platforms", s.platforms.includes(p.id) ? s.platforms.filter((x) => x !== p.id) : [...s.platforms, p.id]) },
      }, p.short))));
  }));
  draw();
  modal("Repeating slots", (close) => el("div.pl-slots-box", {},
    el("p.pl-note", {}, "Slots are your regular posting times. Each one shows as an empty spot on the calendar until a post fills it. Times are London time unless you change the zone of a post."),
    rows,
    el("button.btn.small", { type: "button", on: { click: () => { list = [...list, { id: `slot-${Date.now().toString(36)}`, label: "New slot", weekdays: [1], time: "17:00", tz: DEFAULT_TZ, platforms: ["youtube"], active: true }]; draw(); } } },
      icon("Plus", 14), "Add a slot"),
    el("div.pl-foot", {}, el("span.pl-gap"),
      el("button.btn", { type: "button", on: { click: () => close() } }, "Cancel"),
      el("button.btn.primary", { type: "button", on: { click: async () => {
        try { await saveSlots(app, list); toast("Slots saved."); close(); } catch (e) { toast(e.message, { error: true }); }
      } } }, icon("Check", 16), "Save slots")),
  ), { wide: true });
}

// ---- full-screen host -------------------------------------------------------------------------

let screen = null;
/** Open the planner over the whole app. */
export function openPlanner(app) {
  if (screen) return screen;
  const box = el("div.pl-inner");
  const esc = (e) => { if (e.key === "Escape" && !document.querySelector(".modal-back, .popover")) closePlanner(); };
  const node = el("div.pl-screen", { role: "dialog", "aria-modal": "true", "aria-label": "Content planner" },
    el("div.pl-bar", {}, el("div.pl-brand", {}, icon("CalendarDays", 18), el("b", {}, "Content planner")),
      el("button.ibtn.pl-close", { type: "button", title: "Close planner (Esc)", "aria-label": "Close planner", on: { click: () => closePlanner() } }, icon("X"))),
    box);
  document.body.append(node);
  requestAnimationFrame(() => node.classList.add("show"));
  // The editor's shortcuts (Delete, Ctrl+Z...) only run in the "editor" view: pause them while open.
  const prevView = app.view;
  app.view = "planner";
  const cleanup = renderPlanner(box, app);
  document.addEventListener("keydown", esc);
  screen = { node, close: () => {
    document.removeEventListener("keydown", esc);
    cleanup?.();
    node.remove();
    screen = null;
    if (app.view === "planner") app.view = prevView;
  } };
  return screen;
}
export function closePlanner() { screen?.close(); }
export const plannerOpen = () => Boolean(screen);
