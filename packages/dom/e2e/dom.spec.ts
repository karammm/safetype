import { expect, test, type Page } from "@playwright/test";

const open = (page: Page, mode = "mask") => page.goto(`/e2e/fixture.html?mode=${mode}`);
const caret = (page: Page, id: string) =>
  page.$eval(`#${id}`, (el) => [(el as HTMLInputElement).selectionStart, (el as HTMLInputElement).selectionEnd]);

test("masks profanity while typing real keystrokes", async ({ page }) => {
  await open(page);
  await page.locator("#input").pressSequentially("What the fuck are you doing?");
  await expect(page.locator("#input")).toHaveValue("What the f*ck are you doing?");
});

test("does not mask a word that is still being typed", async ({ page }) => {
  await open(page);
  const input = page.locator("#input");
  await input.pressSequentially("the assassin");
  await expect(input).toHaveValue("the assassin");
});

test("keeps the caret in place when masking before it", async ({ page }) => {
  await open(page);
  const textarea = page.locator("#textarea");
  await textarea.pressSequentially("hello world");
  // Place the caret at the start (the Home key does not do this in macOS WebKit).
  await textarea.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
  await page.keyboard.type("fuck ");
  await expect(textarea).toHaveValue("f*ck hello world");
  expect(await caret(page, "textarea")).toEqual([5, 5]);
  await page.keyboard.type("X");
  await expect(textarea).toHaveValue("f*ck Xhello world");
});

test("masks a pending word on blur", async ({ page }) => {
  await open(page);
  await page.locator("#input").pressSequentially("oh shit");
  await expect(page.locator("#input")).toHaveValue("oh shit");
  await page.locator("#textarea").focus();
  await expect(page.locator("#input")).toHaveValue("oh sh*t");
});

test("masks pasted text immediately", async ({ page, browserName }) => {
  await open(page);
  await page.locator("#scratch").fill("what the fuck");
  await page.locator("#scratch").selectText();
  await page.keyboard.press("ControlOrMeta+c");
  await page.locator("#input").focus();
  await page.keyboard.press("ControlOrMeta+v");
  const value = await page.locator("#input").inputValue();
  test.skip(value === "", `${browserName} headless did not expose the clipboard`);
  expect(value).toBe("what the f*ck");
});

test("undo is not hijacked and masking resumes on blur", async ({ page }) => {
  await open(page);
  const input = page.locator("#input");
  await input.pressSequentially("fuck ");
  await expect(input).toHaveValue("f*ck ");
  await page.keyboard.press("ControlOrMeta+z");
  const afterUndo = await input.inputValue();
  // The undo reverted something, and SafeType did not immediately re-mask it.
  expect(afterUndo).not.toBe("f*ck ");
  await page.locator("#textarea").focus();
  const afterBlur = await input.inputValue();
  expect(afterBlur).not.toContain("fuck");
});

test("masks inside contenteditable without losing formatting", async ({ page }) => {
  await open(page);
  const editor = page.locator("#editor");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" what the fuck now");
  await expect(editor).toHaveText("Hello world what the f*ck now");
  await expect(editor.locator("b")).toHaveText(/^world/);
});

test("never touches password fields", async ({ page }) => {
  await open(page);
  await page.locator("#password").pressSequentially("fuck you ");
  await expect(page.locator("#password")).toHaveValue("fuck you ");
});

test("attaches to fields added after start", async ({ page }) => {
  await open(page);
  await page.click("#add");
  await page.locator("#added").pressSequentially("this shit works");
  await expect(page.locator("#added")).toHaveValue("this sh*t works");
});

test("warns about harassment with an accessible message", async ({ page }) => {
  await open(page);
  await page.locator("#input").pressSequentially("you are an idiot ");
  const message = page.locator(".safetype-message");
  await expect(message).toBeVisible();
  await expect(message).toHaveAttribute("role", "status");
  const describedBy = await page.locator("#input").getAttribute("aria-describedby");
  expect(describedBy).toBe(await message.getAttribute("id"));
  await expect(page.locator("#input")).toHaveValue("you are an idiot ");
});

test("blocks form submission in block mode", async ({ page }) => {
  await open(page, "block");
  await page.locator("#textarea").pressSequentially("this is shit");
  await page.click("#submit");
  expect(await page.evaluate(() => (window as unknown as { submitted: number }).submitted)).toBe(0);
  await expect(page.locator("#textarea")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#textarea")).toBeFocused();
  expect(await page.evaluate(() => (window as unknown as { events: unknown[] }).events)).toContainEqual(["blocked", "textarea"]);

  await page.locator("#textarea").fill("this is fine");
  await page.click("#submit");
  expect(await page.evaluate(() => (window as unknown as { submitted: number }).submitted)).toBe(1);
});

test("does not modify text during IME composition", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "IME composition is driven through the Chrome DevTools Protocol");
  await open(page);
  await page.locator("#input").focus();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.imeSetComposition", { text: "fuck", selectionStart: 4, selectionEnd: 4 });
  await expect(page.locator("#input")).toHaveValue("fuck");
  await cdp.send("Input.insertText", { text: "fuck" });
  await page.keyboard.type(" ");
  await expect(page.locator("#input")).toHaveValue("f*ck ");
});

test("stop() detaches and start() resumes", async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as { st: { stop(): void } }).st.stop());
  await page.locator("#input").pressSequentially("shit ");
  await expect(page.locator("#input")).toHaveValue("shit ");
  await page.evaluate(() => (window as unknown as { st: { start(): void } }).st.start());
  await page.locator("#input").pressSequentially("shit ");
  await expect(page.locator("#input")).toHaveValue("sh*t sh*t ");
});
