// The main journey a thumbnail maker takes, through the real UI.
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => { throw e; });
  await page.goto("/");
  await page.waitForFunction(() => window.__app);
});

const objs = (page) => page.evaluate(() => window.__app.editor.objects().length);

test("make, edit, undo, export and reopen a YouTube thumbnail", async ({ page }) => {
  // Home: start from the YouTube thumbnail size card.
  await page.locator("button.tp-size", { hasText: "YouTube thumbnail" }).click();
  await page.waitForFunction(() => window.__app.view === "editor");
  expect(await page.evaluate(() => [window.__app.editor.width, window.__app.editor.height])).toEqual([1280, 720]);

  // Text panel: add a heading; the text toolbar appears.
  await page.locator('.rail-btn[title="Text"]').click();
  await page.locator(".panel-inner button", { hasText: /add a heading/i }).click();
  await expect.poll(() => objs(page)).toBe(1);
  await expect(page.locator(".ctx-toolbar")).not.toHaveClass(/empty/);

  // Elements panel: add the first shape.
  await page.locator('.rail-btn[title="Elements"]').click();
  await page.locator('.panel-inner button[aria-label^="Add "]').first().click();
  await expect.poll(() => objs(page)).toBe(2);

  // Undo and redo, from the keyboard.
  await page.locator(".canvas-host").click({ position: { x: 20, y: 20 } });
  await page.keyboard.press("Control+z");
  await expect.poll(() => objs(page)).toBe(1);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => objs(page)).toBe(2);

  // Download a PNG and check it's exactly the page size.
  await page.locator("button", { hasText: "Download" }).first().click();
  await page.locator("button.fl-type", { hasText: "PNG" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("button.fl-go").click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const path = await download.path();
  const fs = await import("node:fs");
  const png = fs.readFileSync(path);
  expect(png.readUInt32BE(16)).toBe(1280); // IHDR width
  expect(png.readUInt32BE(20)).toBe(720); // IHDR height

  // Rename, go home, and reopen from "Your designs".
  await page.locator("#doc-name").fill("E2E thumbnail");
  await page.locator("#doc-name").press("Enter");
  await page.evaluate(() => window.__app.save());
  await page.locator(".topbar a.brand").click();
  await page.waitForFunction(() => window.__app.view === "home");
  await page.locator("text=E2E thumbnail").first().click();
  await page.waitForFunction(() => window.__app.view === "editor");
  await expect.poll(() => objs(page)).toBe(2);
});

test("every template builds offscreen with objects", async ({ page }) => {
  const built = await page.evaluate(async () => {
    const { TEMPLATES } = await import("/src/features/templates/registry.js");
    const { collect } = await import("/src/features/templates/engine.js");
    const out = [];
    for (const t of TEMPLATES) {
      const r = await collect(t);
      out.push({ id: t.id, n: r.objects.length, w: r.width, h: r.height });
    }
    return out;
  });
  expect(built.length).toBeGreaterThanOrEqual(12);
  for (const t of built) expect(t.n, t.id).toBeGreaterThan(2);
});
