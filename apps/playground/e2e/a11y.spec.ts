import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/*
 * Accessibility audit of the playground with axe-core (WCAG 2.2 A and AA rules), in every state a visitor can
 * reach: empty, a warning message, a block message, masked editor content, and dark mode.
 */

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#rich .ProseMirror")).toBeVisible();
});

test("initial page", async ({ page }) => {
  await audit(page);
});

test("with a warning message", async ({ page }) => {
  await page.locator("#textarea").pressSequentially("you are such an idiot ");
  await expect(page.locator(".safetype-message[data-level='warn']")).toBeVisible();
  await audit(page);
});

test("in block mode with a block message", async ({ page }) => {
  await page.getByRole("button", { name: "Block" }).click();
  await page.locator("#input").pressSequentially("this is shit ");
  await expect(page.locator(".safetype-message[data-level='block']")).toBeVisible();
  await audit(page);
});

test("with masked editor content and every language", async ({ page }) => {
  await page.getByRole("button", { name: "Other languages" }).click();
  await page.locator("#rich .ProseMirror").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" what the fuck ");
  await expect(page.locator("#rich .ProseMirror")).toContainText("f*ck");
  await audit(page);
});

test("dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.locator("#textarea").pressSequentially("you are such an idiot ");
  await expect(page.locator(".safetype-message")).toBeVisible();
  await audit(page);
});

test("everything is reachable by keyboard", async ({ page, browserName }) => {
  // Safari only tabs to buttons and links with Option+Tab (unless "Keyboard navigation" is turned on).
  const key = browserName === "webkit" ? "Alt+Tab" : "Tab";
  const reached = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press(key);
    reached.add(await page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim() || ""));
  }
  for (const target of ["input", "textarea", "Mask", "Block", "Other languages"]) expect([...reached]).toContain(target);
});
