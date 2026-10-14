import { expect, test, type Page } from "@playwright/test";

const open = (page: Page, mode = "mask") => page.goto(`/e2e/fixture.html?mode=${mode}`);

test("directive + v-model: masks while typing and the model follows", async ({ page }) => {
  await open(page);
  const input = page.getByLabel("directive");
  await input.pressSequentially("What the fuck are you doing?");
  await expect(input).toHaveValue("What the f*ck are you doing?");
  await expect(page.getByTestId("state")).toHaveText("What the f*ck are you doing?");
});

test("directive: caret stays put when masking before it", async ({ page }) => {
  await open(page);
  const input = page.getByLabel("directive");
  await input.pressSequentially("hello world");
  await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 0));
  await page.keyboard.type("fuck ");
  await page.keyboard.type("X");
  await expect(input).toHaveValue("f*ck Xhello world");
  await expect(page.getByTestId("state")).toHaveText("f*ck Xhello world");
});

test("component + v-model keeps state in sync across lines", async ({ page }) => {
  await open(page);
  const textarea = page.getByLabel("component");
  await textarea.pressSequentially("first shit");
  await page.keyboard.press("Enter");
  await page.keyboard.type("second");
  await expect(textarea).toHaveValue("first sh*t\nsecond");
  expect(await page.getByTestId("body-state").evaluate((el) => el.textContent)).toBe("first sh*t\nsecond");
});

test("v-if removal of a field showing a message does not break the page", async ({ page }) => {
  await open(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByLabel("toggle").pressSequentially("you are an idiot ");
  await expect(page.locator("div.safetype-message")).toBeVisible();
  await page.getByText("toggle", { exact: true }).click();
  await expect(page.getByText("hidden")).toBeVisible();
  await expect(page.locator("div.safetype-message")).toHaveCount(0);
  await page.getByText("toggle", { exact: true }).click();
  await expect(page.getByLabel("toggle")).toBeVisible();
  expect(errors).toEqual([]);
});

test("block mode stops @submit until the text is fixed", async ({ page }) => {
  await open(page, "block");
  const input = page.getByLabel("directive");
  await input.pressSequentially("this is shit");
  await page.getByText("Send").click();
  expect(await page.evaluate(() => (window as unknown as { submitted: number }).submitted)).toBe(0);
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.fill("this is fine");
  await page.getByText("Send").click();
  expect(await page.evaluate(() => (window as unknown as { submitted: number }).submitted)).toBe(1);
});

test("<SafeTypeEditor>: real typing, bold formatting and v-model", async ({ page }) => {
  await open(page);
  const editor = page.getByRole("textbox", { name: "rich" });
  await editor.click();
  await page.keyboard.type("This is ");
  await page.getByRole("button", { name: "Bold" }).click();
  await page.keyboard.type("shit ok");
  await expect(page.getByTestId("html-state")).toHaveText("<p>This is <strong>sh*t ok</strong></p>");
});
