import { describe, expect, it, beforeEach } from "vitest";

describe("home loader", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    process.env.SESSION_SECRET = "test-session-secret-for-integration";
  });

  it("redirects unauthenticated users to login", async () => {
    const { loader } = await import("../../../app/routes/home");
    const response = await loader({
      request: new Request("http://localhost/"),
    });

    expect(response).toBeInstanceOf(Response);
    const res = response as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/auth/login");
  });
});
