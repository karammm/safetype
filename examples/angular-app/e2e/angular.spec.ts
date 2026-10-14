import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  (page as unknown as { errors: string[] }).errors = errors;
  await page.goto("/");
});

test.afterEach(async ({ page }) => {
  expect((page as unknown as { errors: string[] }).errors).toEqual([]);
});

test("ngModel field masks while typing", async ({ page }) => {
  const name = page.getByLabel("Name");
  await name.pressSequentially("What the fuck now");
  await expect(name).toHaveValue("What the f*ck now");
});

test("reactive FormControl follows the masked text and the caret stays put", async ({ page }) => {
  const body = page.getByLabel("Comment");
  await body.pressSequentially("hello world");
  await body.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
  await page.keyboard.type("shit ");
  await page.keyboard.type("X");
  await expect(body).toHaveValue("sh*t Xhello world");
  await expect(page.getByTestId("body-state")).toHaveText("sh*t Xhello world");
  await expect(page.getByTestId("validity")).toHaveText("valid");
});

test("harassment is blocked: validator invalid, submit prevented, message shown", async ({ page }) => {
  const body = page.getByLabel("Comment");
  await body.pressSequentially("you are a worthless idiot");
  await expect(page.getByTestId("validity")).toHaveText("invalid");
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.locator("li")).toHaveCount(1);
  await expect(body).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".safetype-message").first()).toContainText("can't be sent");
  await body.fill("");
  await body.pressSequentially("great post, thanks");
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.locator("li")).toHaveCount(2);
});

test("the pipe masks stored content when displaying it", async ({ page }) => {
  await expect(page.locator("li").first()).toContainText("says sh*t and is masked");
});

test("@if removal of a field showing a message works", async ({ page }) => {
  await page.getByLabel("extra").pressSequentially("shit ");
  await expect(page.locator(".safetype-message")).toBeVisible();
  await page.getByText("Toggle extra field").click();
  await expect(page.getByLabel("extra")).toHaveCount(0);
  await expect(page.locator(".safetype-message")).toHaveCount(0);
  await page.getByText("Toggle extra field").click();
  await expect(page.getByLabel("extra")).toBeVisible();
});
