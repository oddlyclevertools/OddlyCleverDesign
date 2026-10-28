// Data safety and privacy: switching designs keeps edits, failed loads change nothing,
// and designs can't make the browser fetch anything from outside.
import { expect, test } from "@playwright/test";

test("designs keep edits, roll back failed loads and never fetch outside URLs", async ({ page }) => {
  const remote = [];
  page.on("request", (r) => { if (!/localhost:\d+|^data:|^blob:/.test(r.url())) remote.push(r.url()); });
  page.on("pageerror", (e) => { throw e; });
  await page.goto("/");
  await page.waitForFunction(() => window.__app);
  const r = await page.evaluate(async () => {
    const app = window.__app, ed = app.editor;
    const out = {};
    await app.newDesign({ size: "yt-thumb", name: "A" });
    const idA = app.project.id;
    const Rect = ed.page.constructor;
    ed.add(new Rect({ left: 50, top: 50, width: 100, height: 100, fill: "#f00" }));
    await app.newDesign({ size: "yt-thumb", name: "B" });
    out.aObjects = (await app.store.getProject(idA)).doc.canvas.objects.length;

    const before = [ed.width, ed.height, ed.objects().length];
    const real = ed.canvas.loadFromJSON.bind(ed.canvas);
    ed.canvas.loadFromJSON = async () => { throw new Error("boom"); };
    await ed.loadJSON({ app: "oddlyclever-design", format: 1, width: 500, height: 500, canvas: { objects: [] } }).catch(() => {});
    ed.canvas.loadFromJSON = real;
    out.same = JSON.stringify([ed.width, ed.height, ed.objects().length]) === JSON.stringify(before);

    out.dropped = await ed.loadJSON({ app: "oddlyclever-design", format: 1, width: 640, height: 360, canvas: {
      objects: [{ type: "Rect", width: 10, height: 10 }, { type: "NotAThing" },
        { type: "Image", src: "http://127.0.0.1:9/track.png" }],
      backgroundImage: { type: "Image", src: "http://127.0.0.1:9/bg.png" },
    } });
    const { insertSerialized } = await import("/src/features/arrange/ops.js");
    out.pasted = (await insertSerialized(app, [{ type: "Image", src: "http://127.0.0.1:9/p.png" }, { type: "Rect", width: 5, height: 5 }])).length;
    return out;
  });
  await page.waitForTimeout(300);
  expect(r).toEqual({ aObjects: 2, same: true, dropped: 2, pasted: 1 });
  expect(remote).toEqual([]);
});
