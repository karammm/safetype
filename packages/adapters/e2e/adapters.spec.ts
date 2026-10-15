import { expect, test, type Page } from "@playwright/test";

const EDITORS = ["quill", "lexical", "codemirror", "monaco", "prosemirror"] as const;
type Name = (typeof EDITORS)[number];

// Browsers type a trailing space in editable content as a non-breaking space; compare as plain spaces.
const textOf = (page: Page, name: Name) =>
  page.evaluate((n) => (window as unknown as { textOf: (n: string) => string }).textOf(n).replace(/\u00a0/g, " "), name);

async function focus(page: Page, name: Name) {
  if (name === "monaco") await page.locator("#monaco .view-lines").click();
  else await page.getByLabel(name, { exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  (page as unknown as { errors: string[] }).errors = errors;
  await page.goto("/e2e/fixture.html");
});
test.afterEach(async ({ page }) => {
  expect((page as unknown as { errors: string[] }).errors).toEqual([]);
});

for (const name of EDITORS) {
  test.describe(name, () => {
    test("masks while typing and keeps typing at the cursor", async ({ page }) => {
      await focus(page, name);
      await page.keyboard.type("What the fuck are you doing?");
      await expect.poll(() => textOf(page, name)).toBe("What the f*ck are you doing?");
      await page.keyboard.type(" ok");
      await expect.poll(() => textOf(page, name)).toBe("What the f*ck are you doing? ok");
    });

    test("does not mask a word that is still being typed", async ({ page }) => {
      await focus(page, name);
      await page.keyboard.type("the assassin");
      await expect.poll(() => textOf(page, name)).toBe("the assassin");
    });

    test("undo is not re-masked", async ({ page }) => {
      await focus(page, name);
      await page.keyboard.type("hello fuck ");
      await expect.poll(() => textOf(page, name)).toBe("hello f*ck ");
      // Editors detect the platform differently: Monaco reads the user agent (Playwright's "Desktop Chrome"
      // reports Windows even on a Mac), the others read navigator.platform. Send the key each one expects.
      const macUserAgent = await page.evaluate(() => /Mac/.test(navigator.userAgent));
      await page.keyboard.press(name === "monaco" ? (macUserAgent ? "Meta+z" : "Control+z") : "ControlOrMeta+z");
      // The undo restores the original word (or removes the typing); SafeType must not mask it again.
      await expect.poll(() => textOf(page, name)).not.toContain("f*ck");
      await page.waitForTimeout(200);
      expect(await textOf(page, name)).not.toContain("f*ck");
    });

    test("shows an accessible warning for harassment", async ({ page }) => {
      await focus(page, name);
      await page.keyboard.type("you are such an idiot");
      await expect(page.locator(`[data-level="warn"].safetype-message`)).toHaveCount(1);
    });
  });
}

test("quill and lexical keep bold formatting while masking", async ({ page }) => {
  for (const name of ["quill", "lexical"] as const) {
    await focus(page, name);
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type("shit ");
    await expect.poll(() => textOf(page, name)).toBe("sh*t ");
  }
  await expect(page.locator("#quill strong")).toContainText("sh*t");
  await expect(page.locator("#lexical strong")).toContainText("sh*t");
});

test("codemirror and monaco highlight harassment inline", async ({ page }) => {
  for (const name of ["codemirror", "monaco"] as const) {
    await focus(page, name);
    await page.keyboard.type("you are an idiot");
  }
  await expect(page.locator("#codemirror .safetype-highlight-warn")).toHaveText("you are an idiot");
  await expect(page.locator("#monaco .safetype-highlight-warn").first()).toBeVisible();
});
