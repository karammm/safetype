import { expect, test, type CDPSession, type Page } from "@playwright/test";

/*
 * Memory-leak tests. After destroy(), nothing in SafeType may keep fields, messages or listeners alive.
 * They use the Chrome DevTools Protocol (forced garbage collection, listener inspection), so they run in
 * Chromium only. The cleanup code they cover is the same in every browser.
 */

declare const SafeType: typeof import("../src/index");

test.skip(({ browserName }) => browserName !== "chromium", "needs the Chrome DevTools Protocol");

async function collectGarbage(cdp: CDPSession) {
  for (let i = 0; i < 3; i++) await cdp.send("HeapProfiler.collectGarbage");
}

async function listenerCount(page: Page, cdp: CDPSession, expression: string): Promise<number> {
  const { result } = await cdp.send("Runtime.evaluate", { expression });
  const { listeners } = await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId!, depth: -1 });
  return listeners.length;
}

test("destroyed instances and removed fields are garbage-collected", async ({ page }) => {
  // The fixture also runs a page-wide instance that observes new fields: it must release removed ones too.
  await page.goto("/e2e/fixture.html");
  const cdp = await page.context().newCDPSession(page);

  await page.evaluate(() => {
    const w = window as unknown as { refs: WeakRef<object>[]; control: object };
    w.refs = [];
    // Control: kept reachable on purpose, so the test proves that collection is really observed.
    w.control = document.createElement("input");
    w.refs.push(new WeakRef(w.control));
    for (let round = 0; round < 40; round++) {
      const box = document.createElement("form");
      box.innerHTML =
        "<input><textarea></textarea><div contenteditable='true'></div>".repeat(5) + "<button>Send</button>";
      document.body.append(box);
      const instance = SafeType.createSafeType({ root: box, mode: round % 2 ? "warn" : "block" });
      instance.start();
      for (const field of box.querySelectorAll<HTMLElement>("input, textarea, [contenteditable]")) {
        // A warning or block message is created next to every field.
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = "you are an idiot";
        else field.textContent = "you are an idiot";
        field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
        field.dispatchEvent(new FocusEvent("blur"));
        w.refs.push(new WeakRef(field));
      }
      w.refs.push(new WeakRef(instance), new WeakRef(box));
      instance.destroy();
      box.remove();
    }
  });
  // Give deferred work (timers, microtasks, mutation records) a chance to run before collecting.
  await page.waitForTimeout(300);
  await collectGarbage(cdp);

  const alive = await page.evaluate(() => (window as unknown as { refs: WeakRef<object>[] }).refs.filter((r) => r.deref()).length);
  expect(alive).toBe(1); // only the control
});

test("stop() and destroy() remove every listener they added", async ({ page }) => {
  await page.goto("/e2e/blank.html");
  const cdp = await page.context().newCDPSession(page);
  await page.evaluate(() => {
    const box = document.createElement("form");
    box.id = "leak-box";
    box.innerHTML = "<input id='leak-input'><textarea></textarea><div contenteditable='true'></div>";
    document.body.append(box);
  });

  const count = async () => ({
    document: await listenerCount(page, cdp, "document"),
    window: await listenerCount(page, cdp, "window"),
    input: await listenerCount(page, cdp, "document.getElementById('leak-input')"),
    form: await listenerCount(page, cdp, "document.getElementById('leak-box')"),
  });

  const before = await count();
  await page.evaluate(() => {
    const instance = SafeType.createSafeType({ root: document.getElementById("leak-box")! });
    (window as unknown as { leak: unknown }).leak = instance;
    for (let i = 0; i < 25; i++) {
      instance.start();
      instance.stop();
    }
    instance.start();
  });
  const attached = await count();
  expect(attached.input).toBeGreaterThan(before.input);

  await page.evaluate(() => (window as unknown as { leak: { destroy(): void } }).leak.destroy());
  expect(await count()).toEqual(before);
});
