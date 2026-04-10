import { expect, test } from "@playwright/test";

const maintenanceCopy =
  "Authentication is temporarily unavailable. Keycloak may still be starting. Please try again in 30 seconds.";

/**
 * Visual regression: plain-text 503 from the auth login loader when OIDC setup fails.
 * In CI the stack sets ALLOW_E2E_503_HOOK so we can request the same response via a
 * query param without depending on Keycloak being down (avoids flaky redirects).
 */
test.describe("visual: auth login surface", () => {
  test("503 maintenance page snapshot", async ({ page }) => {
    let response = await page.goto("/auth/login?e2e_503=1", {
      waitUntil: "domcontentloaded",
    });
    if (response?.status() !== 503) {
      response = await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    }
    test.skip(response?.status() !== 503, "503 page not shown (Keycloak reachable); skip snapshot");

    await expect(page.getByText(maintenanceCopy)).toBeVisible();

    await expect(page).toHaveScreenshot("auth-login-unavailable.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
