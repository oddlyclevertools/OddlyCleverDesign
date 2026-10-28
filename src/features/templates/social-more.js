// More templates (v0.2, templates-social builder): social posts, a slide deck and print pieces.
// Same shape as thumbnails.js: { id, name, size, tags, fonts, category?, build(app) }.
import social from "./ts-social.js";
import web from "./ts-web.js";
import slides from "./ts-slides.js";
import print from "./ts-print.js";
import print2 from "./ts-print2.js";

export default [...social, ...web, ...slides, ...print, ...print2];
