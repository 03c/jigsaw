import { expect, test } from "@playwright/test";

/**
 * Visual regression boilerplate: captures the panel’s Keycloak-unavailable page when
 * `/auth/login` returns 503 (common in CI before IdP is ready). When Keycloak responds,
 * the browser leaves the app origin — skip the snapshot to avoid flaky external UIs.
 */
test.describe("visual: auth login surface", () => {
  test("503 maintenance page snapshot", async ({ page }) => {
    const response = await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    test.skip(response?.status() !== 503, "Keycloak is up; skipping 503-only snapshot");

    await expect(
      page.getByText(/Authentication is temporarily unavailable/i),
    ).toBeVisible();

    await expect(page).toHaveScreenshot("auth-login-unavailable.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
