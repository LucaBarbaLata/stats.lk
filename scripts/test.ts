import { spawnSync } from "node:child_process";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Runs the tests against a database of their own on the same server, because
// they wipe it between tests. Credentials are fake: nothing in a test may
// reach Spotify, Last.fm or Deezer (see tests/helpers.ts).
const TEST_DATABASE = "statslk_test";

async function main() {
  const real = new URL(process.env.DATABASE_URL as string);
  const test = new URL(real);
  test.pathname = `/${TEST_DATABASE}`;
  test.searchParams.set("client_min_messages", "warning");

  const server = postgres(real.href, { max: 1 });
  const [exists] = await server`select 1 from pg_database where datname = ${TEST_DATABASE}`;
  if (!exists) await server.unsafe(`create database ${TEST_DATABASE}`);
  await server.end();

  const database = postgres(test.href, { max: 1 });
  await migrate(drizzle(database), { migrationsFolder: "drizzle" });
  await database.end();

  // One file at a time: they share the database
  const { status } = spawnSync(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1", "tests/*.test.ts"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: test.href,
      SPOTIFY_CLIENT_ID: "test",
      SPOTIFY_CLIENT_SECRET: "test",
      TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
      LASTFM_API_KEY: "test",
      APP_TIMEZONE: "Europe/Bucharest",
    },
  });
  process.exit(status ?? 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
