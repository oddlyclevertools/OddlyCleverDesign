// Design size presets (px). Thumbnails first: that's the tool's first focus.
export const SIZES = [
  { id: "yt-thumb", group: "Video", name: "YouTube thumbnail", w: 1280, h: 720 },
  { id: "shorts", group: "Video", name: "Shorts / Reels / TikTok", w: 1080, h: 1920 },
  { id: "yt-banner", group: "Video", name: "YouTube channel banner", w: 2560, h: 1440 },
  { id: "yt-end", group: "Video", name: "YouTube end screen", w: 1920, h: 1080 },
  { id: "video-hd", group: "Video", name: "Video (1080p)", w: 1920, h: 1080 },
  { id: "twitch-panel", group: "Video", name: "Twitch panel", w: 320, h: 160 },
  { id: "twitch-offline", group: "Video", name: "Twitch offline banner", w: 1920, h: 1080 },
  { id: "podcast", group: "Video", name: "Podcast cover", w: 3000, h: 3000 },
  { id: "ig-post", group: "Social", name: "Instagram post (square)", w: 1080, h: 1080 },
  { id: "ig-portrait", group: "Social", name: "Instagram post (portrait)", w: 1080, h: 1350 },
  { id: "ig-story", group: "Social", name: "Instagram / Facebook story", w: 1080, h: 1920 },
  { id: "fb-post", group: "Social", name: "Facebook post", w: 1200, h: 630 },
  { id: "fb-cover", group: "Social", name: "Facebook cover", w: 1640, h: 624 },
  { id: "x-post", group: "Social", name: "X post", w: 1600, h: 900 },
  { id: "x-header", group: "Social", name: "X header", w: 1500, h: 500 },
  { id: "li-post", group: "Social", name: "LinkedIn post", w: 1200, h: 1200 },
  { id: "li-banner", group: "Social", name: "LinkedIn banner", w: 1584, h: 396 },
  { id: "pin", group: "Social", name: "Pinterest pin", w: 1000, h: 1500 },
  { id: "tiktok-cover", group: "Social", name: "TikTok profile photo", w: 400, h: 400 },
  { id: "ig-carousel", group: "Social", name: "Instagram carousel slide", w: 1080, h: 1350 },
  { id: "fb-event", group: "Social", name: "Facebook event cover", w: 1920, h: 1005 },
  { id: "discord-banner", group: "Social", name: "Discord server banner", w: 960, h: 540 },
  { id: "email-header", group: "Social", name: "Email header", w: 600, h: 200 },
  { id: "blog-banner", group: "Social", name: "Blog banner", w: 1200, h: 628 },
  { id: "presentation", group: "Print & slides", name: "Presentation (16:9)", w: 1920, h: 1080 },
  { id: "a4", group: "Print & slides", name: "A4 poster (portrait)", w: 2480, h: 3508 },
  { id: "poster", group: "Print & slides", name: "Poster 18×24 in", w: 1800, h: 2400 },
  { id: "flyer", group: "Print & slides", name: "Flyer (US letter)", w: 2550, h: 3300 },
  { id: "logo", group: "Print & slides", name: "Logo", w: 500, h: 500 },
  { id: "business-card", group: "Print & slides", name: "Business card", w: 1050, h: 600 },
  { id: "invitation", group: "Print & slides", name: "Invitation (5×7 in)", w: 1500, h: 2100 },
  { id: "certificate", group: "Print & slides", name: "Certificate (landscape)", w: 3300, h: 2550 },
  { id: "menu", group: "Print & slides", name: "Menu (A4)", w: 2480, h: 3508 },
  { id: "infographic", group: "Print & slides", name: "Infographic", w: 800, h: 2000 },
  { id: "desktop-wallpaper", group: "Print & slides", name: "Desktop wallpaper", w: 1920, h: 1080 },
  { id: "phone-wallpaper", group: "Print & slides", name: "Phone wallpaper", w: 1080, h: 2340 },
];

export const MAX_SIDE = 8000; // bigger pages make the browser canvas run out of memory

/** A size by preset id, or a validated custom size. */
export function resolveSize(idOrSize) {
  if (typeof idOrSize === "string") {
    const s = SIZES.find((x) => x.id === idOrSize);
    if (!s) throw new Error(`Unknown size preset ${idOrSize}`);
    return { w: s.w, h: s.h, preset: s.id };
  }
  const w = Math.round(Number(idOrSize?.w)), h = Math.round(Number(idOrSize?.h));
  if (!(w >= 16 && h >= 16 && w <= MAX_SIDE && h <= MAX_SIDE)) {
    throw new Error(`Sizes must be between 16 and ${MAX_SIDE} px.`);
  }
  return { w, h, preset: null };
}
