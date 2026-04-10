import { expect, test } from "@playwright/test";

/**
 * Full-stack check: Keycloak login form after /auth/login redirect.
 * Runs in e2e-docker-tests workflow only (requires docker-compose.ci.yml).
 */
test.describe("Keycloak (Docker stack)", () => {
  test("redirect reaches Keycloak login", async ({ page }) => {
    await page.goto("/auth/login", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("textbox", { name: /username/i })).toBeVisible({
      timeout: 120_000,
    });
  });
});
