import { expect, test } from "@playwright/test";

/*
 * Memory-leak test: destroyed editors (with their Tiptap view, toolbar, decorations and messages) must be
 * garbage-collected. Uses the Chrome DevTools Protocol to force collection, so it runs in Chromium only.
 */

declare const SafeTypeEditor: typeof import("../src/index");

test.skip(({ browserName }) => browserName !== "chromium", "needs the Chrome DevTools Protocol");

test("destroyed editors are garbage-collected", async ({ page }) => {
  await page.goto("/e2e/fixture.html");
  const cdp = await page.context().newCDPSession(page);

  await page.evaluate(() => {
    const w = window as unknown as { refs: WeakRef<object>[]; control: object };
    w.refs = [];
    w.control = document.createElement("div");
    w.refs.push(new WeakRef(w.control));
    for (let round = 0; round < 30; round++) {
      const element = document.createElement("div");
      document.body.append(element);
      const editor = SafeTypeEditor.createSafeTypeEditor({
        element,
        mode: round % 2 ? "warn" : "mask",
        content: "<p>What the fuck, you are an idiot. <strong>bold</strong></p>",
        maxLength: 500,
      });
      editor.focus();
      w.refs.push(new WeakRef(editor), new WeakRef(element), new WeakRef(element.querySelector(".ProseMirror")!));
      editor.destroy();
      element.remove();
    }
  });
  await page.waitForTimeout(300);
  for (let i = 0; i < 3; i++) await cdp.send("HeapProfiler.collectGarbage");

  const alive = await page.evaluate(() => (window as unknown as { refs: WeakRef<object>[] }).refs.filter((r) => r.deref()).length);
  expect(alive).toBe(1); // only the control
});
