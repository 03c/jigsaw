import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "~/lib/db.server";

/**
 * Requires PostgreSQL and applied schema (e.g. `npm run db:push`).
 * Skips when DATABASE_URL is unset in environments that omit the DB.
 */
describe("database schema", () => {
  it.skipIf(!process.env.DATABASE_URL)(
    "can run a simple query when DATABASE_URL is set",
    async () => {
      const rows = await db.execute(sql`select 1 as ok`);
      expect(rows).toBeDefined();
    },
  );
});
