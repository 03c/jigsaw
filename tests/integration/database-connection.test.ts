import { describe, expect, it } from "vitest";
import postgres from "postgres";

describe("PostgreSQL (integration)", () => {
  it("accepts connections when DATABASE_URL is reachable", async (ctx) => {
    const url = process.env.DATABASE_URL;
    if (!url) {
      ctx.skip();
      return;
    }

    const sql = postgres(url, { max: 1, connect_timeout: 3 });
    try {
      const rows = await sql<{ x: number }[]>`select 1::int as x`;
      expect(rows[0]?.x).toBe(1);
    } catch {
      if (!process.env.CI) {
        ctx.skip();
        return;
      }
      throw new Error(
        "DATABASE_URL is set but PostgreSQL is unreachable (required in CI)",
      );
    } finally {
      await sql.end({ timeout: 5 }).catch(() => undefined);
    }
  });
});
