import fs from "node:fs/promises";
import path from "node:path";
import { getPool } from "./db.js";
import { runMigrationPlan } from "../../scripts/lib/migration-runner.mjs";

const STORAGE_FOLDER_SHARE_MIGRATION_NAME = "0100_storage_folder_shares.sql";
let schemaReadyPromise;

async function applyStorageFolderShareMigration() {
  const sql = await fs.readFile(path.join(process.cwd(), "drizzle", STORAGE_FOLDER_SHARE_MIGRATION_NAME), "utf8");
  const client = await getPool().connect();
  try {
    return await runMigrationPlan(client, {
      migrations: [{ name: STORAGE_FOLDER_SHARE_MIGRATION_NAME, sql }],
      lockTimeoutMs: Number(process.env.MIGRATION_LOCK_TIMEOUT_MS || 45_000)
    });
  } finally {
    client.release();
  }
}

export function ensureStorageFolderShareSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = applyStorageFolderShareMigration().catch((error) => {
      schemaReadyPromise = undefined;
      throw error;
    });
  }
  return schemaReadyPromise;
}
