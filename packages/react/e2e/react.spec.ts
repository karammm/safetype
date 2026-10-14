import { expect, test, type Page } from "@playwright/test";

const open = (page: Page, mode = "mask") => page.goto(`/e2e/fixture.html?mode=${mode}`);
const read = <T>(page: Page, key: string): Promise<T> =>
  page.evaluate((k) => (window as unknown as Record<string, unknown>)[k], key) as Promise<T>;

// Regression: results must reach React after the browser event, or controlled inputs lose keystrokes.
// Only reproducible with real browser events (simulated events have no gap between listeners).
test("controlled input: masks while typing and React state follows", async ({ page }) => {
  await open(page);
  const input = page.getByLabel("controlled");
  await input.pressSequentially("What the fuck are you doing?");
  await expect(input).toHaveValue("What the f*ck are you doing?");
  await expect(page.getByTestId("state")).toHaveText("What the f*ck are you doing?");
});

test("controlled input: caret stays put and further typing lands correctly", async ({ page }) => {
  await open(page);
  const input = page.getByLabel("controlled");
  await input.pressSequentially("hello world");
  await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 0));
  await page.keyboard.type("fuck ");
  await expect(input).toHaveValue("f*ck hello world");
  await page.keyboard.type("X");
  await expect(input).toHaveValue("f*ck Xhello world");
  await expect(page.getByTestId("state")).toHaveText("f*ck Xhello world");
});

test("controlled textarea keeps state in sync across lines", async ({ page }) => {
  await open(page);
  const textarea = page.getByLabel("body");
  await textarea.pressSequentially("first shit");
  await page.keyboard.press("Enter");
  await page.keyboard.type("second line");
  await expect(textarea).toHaveValue("first sh*t\nsecond line");
  await expect(page.getByTestId("body-state")).toHaveText("first sh*t second line".replace(" second", "\nsecond"));
});

test("shows an accessible warning for harassment", async ({ page }) => {
  await open(page);
  await page.getByLabel("controlled").pressSequentially("you are an idiot ");
  await expect(page.getByRole("status").first()).toContainText("hurtful");
});

test("block mode stops React's onSubmit until the text is fixed", async ({ page }) => {
  await open(page, "block");
  const input = page.getByLabel("controlled");
  await input.pressSequentially("this is shit");
  await page.getByText("Send").click();
  expect(await read<number>(page, "submitted")).toBe(0);
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.fill("");
  await input.pressSequentially("this is fine");
  await page.getByText("Send").click();
  expect(await read<number>(page, "submitted")).toBe(1);
});

test("no render loop: renders stay proportional to keystrokes", async ({ page }) => {
  await open(page);
  const before = await read<number>(page, "renders");
  await page.getByLabel("controlled").pressSequentially("fuck shit ");
  const renders = (await read<number>(page, "renders")) - before;
  // StrictMode renders twice per update; allow headroom for masking-triggered updates.
  expect(renders).toBeLessThan(10 * 2 * 3);
});

test("<SafeTypeEditor>: real typing, bold formatting and controlled state", async ({ page }) => {
  await open(page);
  const editor = page.getByRole("textbox", { name: "rich" });
  await editor.click();
  await page.keyboard.type("This is ");
  await page.getByRole("button", { name: "Bold" }).click();
  await page.keyboard.type("shit ok");
  await expect(page.getByTestId("html-state")).toHaveText("<p>This is <strong>sh*t ok</strong></p>");
});
