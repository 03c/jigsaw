import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("root responds with redirect toward authentication (no Keycloak required)", async ({
    request,
  }) => {
    const response = await request.get("/", { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    const location = response.headers().location ?? "";
    expect(location).toContain("/auth/login");
  });
});
