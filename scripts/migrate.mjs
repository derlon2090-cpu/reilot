import process from "node:process";
import pg from "pg";
import { loadMigrationFiles, runMigrationPlan } from "./lib/migration-runner.mjs";
import { databaseConnectionOptions } from "../src/server/db.js";

async function main() {
  const { Client } = pg;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is missing");

  const migrations = await loadMigrationFiles();
  const client = new Client({
    ...databaseConnectionOptions()
  });
  await client.connect();
  try {
    const result = await runMigrationPlan(client, {
      migrations,
      lockTimeoutMs: Number(process.env.MIGRATION_LOCK_TIMEOUT_MS || 60_000)
    });
    console.log(`Migration plan verified (${result.applied} applied, ${result.skipped} already present).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
