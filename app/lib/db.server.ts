import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "~/models/schema";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://jigsaw:jigsaw_secret@localhost:5432/jigsaw";

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
