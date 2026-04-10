import { describe, expect, it } from "vitest";
import { createRequestHandler } from "react-router";

describe("GET /health", () => {
  it("returns JSON ok from the production server build", async () => {
    // Production bundle from `npm run build` (gitignored); suppress missing types for CI/local.
    const build = (await import(
      // @ts-expect-error -- build/server is generated; not checked into git
      "../../build/server/index.js"
    )) as import("react-router").ServerBuild;
    const handler = createRequestHandler(build, "production");
    const res = await handler(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("jigsaw");
  });
});
