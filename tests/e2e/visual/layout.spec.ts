import { test, expect } from "@playwright/test";

/**
 * Visual regression boilerplate: deterministic markup without relying on
 * external OIDC/Keycloak during the shot. Replace with real routes once
 * test credentials and stable test data are available.
 */
test.describe("visual baseline", () => {
  test("placeholder panel chrome", async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: system-ui, sans-serif; margin: 2rem; background: #f8fafc; }
            .card { background: white; border-radius: 0.5rem; padding: 1rem; max-width: 20rem;
                    border-left: 4px solid #3b82f6; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05); }
            h1 { font-size: 0.875rem; color: #6b7280; margin: 0; }
            .value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }
          </style>
        </head>
        <body>
          <div class="card" data-testid="visual-stat">
            <h1>Visual regression</h1>
            <div class="value">Jigsaw</div>
          </div>
        </body>
      </html>
    `);

    await expect(page.getByTestId("visual-stat")).toHaveScreenshot(
      "placeholder-stat.png",
      {
        maxDiffPixels: 50,
      },
    );
  });
});
