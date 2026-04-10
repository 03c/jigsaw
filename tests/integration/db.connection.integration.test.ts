import { execSync } from "node:child_process";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Verifies PostgreSQL connectivity and schema push against a real database.
 * Requires Docker (same as local dev integration tests).
 */
describe("PostgreSQL integration", () => {
  let container: StartedPostgreSqlContainer | undefined;
  let connectionUri: string;

  beforeAll(async () => {
    const pg = await new PostgreSqlContainer("postgres:17-alpine").start();
    container = pg;
    connectionUri = pg.getConnectionUri();
    process.env.DATABASE_URL = connectionUri;
    execSync("npx drizzle-kit push", {
      cwd: process.cwd(),
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: connectionUri },
    });
  }, 180_000);

  afterAll(async () => {
    if (container) await container.stop();
  }, 60_000);

  it("accepts connections and can query the database", async () => {
    const sql = postgres(connectionUri);
    const result = await sql`SELECT 1 as one`;
    expect(result[0]?.one).toBe(1);
    await sql.end();
  });
});
