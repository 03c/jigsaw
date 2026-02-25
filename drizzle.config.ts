import type { Config } from "drizzle-kit";

export default {
  schema: "./app/models/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgres://jigsaw:jigsaw_secret@localhost:5432/jigsaw",
  },
} satisfies Config;
