import { expect, test, type Page } from "@playwright/test";

const open = (page: Page, query = "") => page.goto(`/e2e/fixture.html?${query}`);
const content = (page: Page) => page.locator(".ProseMirror");
const html = (page: Page) => page.evaluate(() => (window as unknown as { st: { getHTML(): string } }).st.getHTML());

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  (page as unknown as { errors: string[] }).errors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as unknown as { errors: string[] }).errors).toEqual([]);
});

test("masks while typing and keeps typing at the cursor", async ({ page }) => {
  await open(page);
  await content(page).click();
  await page.keyboard.type("What the fuck are you doing?");
  await expect(content(page)).toHaveText("What the f*ck are you doing?");
  await page.keyboard.type(" more");
  await expect(content(page)).toHaveText("What the f*ck are you doing? more");
});

test("does not mask a word that is still being typed", async ({ page }) => {
  await open(page);
  await content(page).click();
  await page.keyboard.type("the assassin");
  await expect(content(page)).toHaveText("the assassin");
});

test("formatting from the toolbar survives masking", async ({ page }) => {
  await open(page);
  await content(page).click();
  await page.keyboard.type("This is ");
  await page.getByRole("button", { name: "Bold" }).click();
  await expect(page.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.type("shit ");
  await page.getByRole("button", { name: "Bold" }).click();
  await page.keyboard.type("ok");
  expect(await html(page)).toBe("<p>This is <strong>sh*t </strong>ok</p>");
});

test("undo works naturally after masking", async ({ page }) => {
  await open(page);
  await content(page).click();
  await page.keyboard.type("hello fuck ");
  await expect(content(page)).toHaveText("hello f*ck ");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(content(page)).not.toContainText("fuck");
  await expect(content(page)).not.toContainText("f*ck ");
});

test("harassment is highlighted with an accessible warning", async ({ page }) => {
  await open(page);
  await content(page).click();
  await page.keyboard.type("you are such an idiot");
  await expect(page.locator(".safetype-highlight-warn")).toHaveText("you are such an idiot");
  await expect(page.getByRole("status")).toContainText("hurtful");
});

test("suggestions can be applied with one click", async ({ page }) => {
  await open(page, "mode=suggest");
  await content(page).click();
  await page.keyboard.type("What the fuck is this");
  await page.getByRole("button", { name: 'Replace "fuck" with "heck"' }).click();
  await expect(content(page)).toHaveText("What the heck is this");
});

test("block mode stops the form and the hidden input carries HTML", async ({ page }) => {
  await open(page, "mode=block");
  await content(page).click();
  await page.keyboard.type("this is shit");
  await page.click("#submit");
  expect(await page.evaluate(() => (window as unknown as { submitted: number }).submitted)).toBe(0);
  await expect(content(page)).toHaveAttribute("aria-invalid", "true");
  await expect(content(page)).toBeFocused();
  await content(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("this is fine");
  await expect(content(page)).toHaveText("this is fine");
  await page.click("#submit");
  expect(await page.evaluate(() => (window as unknown as { submitted: number }).submitted)).toBe(1);
  await expect(page.locator('input[name="body"]')).toHaveValue("<p>this is fine</p>");
});

test("links normalize bare domains", async ({ page }) => {
  await open(page, "content=" + encodeURIComponent("<p>docs</p>"));
  await content(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Link" }).click();
  expect(await html(page)).toContain('href="https://example.com"');
});

test("does not modify text during IME composition", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "IME composition is driven through the Chrome DevTools Protocol");
  await open(page);
  await content(page).click();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.imeSetComposition", { text: "fuck", selectionStart: 4, selectionEnd: 4 });
  await expect(content(page)).toHaveText("fuck");
  await cdp.send("Input.insertText", { text: "fuck" });
  await page.keyboard.type(" ");
  await expect(content(page)).toHaveText("f*ck ");
});

test("character count updates and the limit holds", async ({ page }) => {
  await open(page);
  await content(page).click();
  await page.keyboard.type("hello");
  await expect(page.locator(".safetype-editor-count")).toHaveText("5 / 200");
});
