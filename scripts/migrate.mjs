import process from "node:process";
import pg from "pg";
import { loadMigrationFiles, runMigrationPlan } from "./lib/migration-runner.mjs";

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is missing");

const migrations = await loadMigrationFiles();
const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
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
