import { test, expect } from "@playwright/test";

test("login page visual snapshot", async ({ page }) => {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  // OIDC may error if Keycloak is down — still capture layout shell / error text
  await expect(page.locator("body")).toBeVisible();
  await expect(page).toHaveScreenshot("auth-login.png", {
    fullPage: true,
    maxDiffPixels: 500,
  });
});
