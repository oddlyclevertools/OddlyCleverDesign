// The video template pack (v0.2): YouTube thumbnails, Shorts covers, end screen, channel banner,
// Twitch offline banner and podcast cover. Same shape as thumbnails.js:
// { id, name, size, tags, category?, fonts, build(app) }. The drawing kit is tv-kit.js.
import thumbsA from "./tv-thumbs-a.js";
import thumbsB from "./tv-thumbs-b.js";
import vertical from "./tv-vertical.js";
import wide from "./tv-wide.js";

export default [...thumbsA, ...thumbsB, ...vertical, ...wide];
