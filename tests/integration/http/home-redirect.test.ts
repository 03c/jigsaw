import express from "express";
import { createRequestHandler } from "@react-router/express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Requires `npm run build` so `build/server/index.js` exists.
 */
describe("HTTP: unauthenticated /", () => {
  let server: ReturnType<express.Application["listen"]>;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = "development";
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || "postgres://jigsaw:jigsaw_secret@127.0.0.1:5432/jigsaw";

    // Built by `npm run build` — no bundled typings for this JS artifact.
    // @ts-expect-error TS7016 — implicit any on generated server bundle
    const build = await import("../../../build/server/index.js");
    const app = express();
    app.disable("x-powered-by");
    app.use(
      createRequestHandler({
        build,
        mode: process.env.NODE_ENV,
      })
    );

    await new Promise<void>((resolve, reject) => {
      try {
        server = app.listen(0, "127.0.0.1", () => resolve());
      } catch (e) {
        reject(e);
      }
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("redirects to the login route", async () => {
    const res = await fetch(`${baseUrl}/`, { redirect: "manual" });
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") || "";
    expect(loc).toContain("/auth/login");
  });
});
