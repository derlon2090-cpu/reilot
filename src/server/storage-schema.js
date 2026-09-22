import fs from "node:fs/promises";
import path from "node:path";
import { getPool } from "./db.js";
import { runMigrationPlan } from "../../scripts/lib/migration-runner.mjs";

const STORAGE_MIGRATION_NAMES = ["0094_storage_center_insights.sql", "0095_storage_document_locks.sql", "0096_storage_folder_locks.sql"];
let schemaReadyPromise;

async function applyStorageMigration() {
  const migrations = await Promise.all(STORAGE_MIGRATION_NAMES.map(async (name) => ({ name, sql: await fs.readFile(path.join(process.cwd(), "drizzle", name), "utf8") })));
  const client = await getPool().connect();
  try {
    return await runMigrationPlan(client, {
      migrations,
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
