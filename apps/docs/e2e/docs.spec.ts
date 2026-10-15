import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Accessibility (axe-core, WCAG 2.2 A/AA) and basic health of every documentation page, in light and dark mode. */

const PAGES = [
  "", "guide/getting-started", "guide/concepts", "guide/api", "guide/languages", "guide/rules", "guide/server",
  "guide/accessibility", "guide/performance", "guide/security", "guide/faq", "guide/support",
  "packages/core", "packages/dom", "packages/react", "packages/vue", "packages/angular", "packages/editor",
  "packages/adapters", "packages/ai", "packages/dictionaries", "packages/python",
];

for (const scheme of ["light", "dark"] as const) {
  for (const path of PAGES) {
    test(`${scheme}: /${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.emulateMedia({ colorScheme: scheme });
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();

      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test("no page scrolls sideways on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  for (const path of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
