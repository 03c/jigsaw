import { expect, test } from "@playwright/test";

test.describe("public routes", () => {
  test("GET / redirects to login for anonymous users", async ({ request }) => {
    const res = await request.get("/", { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    const loc = res.headers()["location"] || "";
    expect(loc).toContain("/auth/login");
  });
});
