import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "~/models/schema";

export function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    "postgres://jigsaw:jigsaw_secret@localhost:5432/jigsaw"
  );
}

const connectionString = getDatabaseUrl();

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
