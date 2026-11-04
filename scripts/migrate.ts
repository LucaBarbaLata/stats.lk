import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL as string, { max: 1 });
  await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  await sql.end();
  console.log("Migrations applied");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
