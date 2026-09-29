import fs from "node:fs/promises";
import path from "node:path";
import { getPool } from "./db.js";
import { runMigrationPlan, validateMigrationPlan } from "../../scripts/lib/migration-runner.mjs";

const STORAGE_MIGRATION_NAMES = ["0094_storage_center_insights.sql", "0095_storage_document_locks.sql", "0096_storage_folder_locks.sql", "0098_storage_document_lock_recovery.sql"];
let schemaReadyPromise;

export async function storageMigrationLedgerReady(client, migrations) {
  const plan = validateMigrationPlan(migrations);
  let result;
  try {
    result = await client.query("SELECT name,checksum FROM schema_migrations WHERE name = ANY($1::text[])", [plan.map(({ name }) => name)]);
  } catch (error) {
    if (error?.code === "42P01") return false;
    throw error;
  }
  const applied = new Map(result.rows.map(({ name, checksum }) => [name, checksum]));
  for (const migration of plan) {
    if (!applied.has(migration.name) || !applied.get(migration.name)) return false;
    if (applied.get(migration.name) !== migration.checksum) {
      const error = new Error(`Applied migration checksum changed: ${migration.name}`);
      error.code = "MIGRATION_CHECKSUM_MISMATCH";
      throw error;
    }
  }
  return true;
}

async function applyStorageMigration() {
  const migrations = await Promise.all(STORAGE_MIGRATION_NAMES.map(async (name) => ({ name, sql: await fs.readFile(path.join(process.cwd(), "drizzle", name), "utf8") })));
  const client = await getPool().connect();
  try {
    // The app server starts after migrations. Avoid waiting on an unrelated
    // migration's advisory lock when Storage Center is already ready to use.
    if (await storageMigrationLedgerReady(client, migrations)) return { applied: 0, skipped: migrations.length, verified: true };
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
