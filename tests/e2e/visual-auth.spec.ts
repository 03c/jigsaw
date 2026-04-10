import { expect, test } from "@playwright/test";

/**
 * Visual regression against a static HTML shell (no Docker/Keycloak required).
 * Baselines live under tests/e2e/visual-auth.spec.ts-snapshots/
 * Update locally: npx playwright test tests/e2e/visual-auth.spec.ts --update-snapshots
 */
test.describe("visual (static)", () => {
  test("sample panel status badge markup", async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Jigsaw visual sample</title></head>
        <body style="margin: 24px; font-family: system-ui, sans-serif;">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Running
          </span>
        </body>
      </html>
    `);
    await expect(page.locator("body")).toHaveScreenshot("status-badge-sample.png");
  });
});
