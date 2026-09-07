import fs from "node:fs/promises";
import path from "node:path";
import { getPool } from "./db.js";
import { runMigrationPlan } from "../../scripts/lib/migration-runner.mjs";

const STORAGE_MIGRATION_NAME = "0094_storage_center_insights.sql";
let schemaReadyPromise;

async function applyStorageMigration() {
  const sql = await fs.readFile(path.join(process.cwd(), "drizzle", STORAGE_MIGRATION_NAME), "utf8");
  const client = await getPool().connect();
  try {
    return await runMigrationPlan(client, {
      migrations: [{ name: STORAGE_MIGRATION_NAME, sql }],
      lockTimeoutMs: Number(process.env.MIGRATION_LOCK_TIMEOUT_MS || 45_000)
    });
  } finally {
    client.release();
  }
}

export function ensureStorageCenterSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = applyStorageMigration().catch((error) => {
      schemaReadyPromise = undefined;
      throw error;
    });
  }
  return schemaReadyPromise;
}
