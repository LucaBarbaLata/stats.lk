import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// postgres() connects lazily, so a missing DATABASE_URL only fails on the
// first query, not during `next build`.
const globalForDb = globalThis as unknown as { sql?: postgres.Sql };
const client = globalForDb.sql ?? postgres(process.env.DATABASE_URL as string, { max: 10 });
// Reuse one pool across hot reloads in development
if (process.env.NODE_ENV !== "production") globalForDb.sql = client;

export const db = drizzle(client, { schema });
// The raw driver, for what Drizzle doesn't cover (streaming with cursors)
export { client, schema };
