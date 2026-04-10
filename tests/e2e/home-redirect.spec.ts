import { expect, test } from "@playwright/test";

test.describe("home redirect", () => {
  test("unauthenticated visit redirects to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
