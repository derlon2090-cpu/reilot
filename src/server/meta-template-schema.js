import fs from "node:fs/promises";
import path from "node:path";
import { getPool } from "./db.js";
import { runMigrationPlan } from "../../scripts/lib/migration-runner.mjs";

const META_TEMPLATE_MIGRATION_NAME = "0096_meta_template_status_expansion.sql";
let schemaReadyPromise;

async function applyMetaTemplateMigration() {
  const sql = await fs.readFile(path.join(process.cwd(), "drizzle", META_TEMPLATE_MIGRATION_NAME), "utf8");
  const client = await getPool().connect();
  try {
    return await runMigrationPlan(client, {
      migrations: [{ name: META_TEMPLATE_MIGRATION_NAME, sql }],
      lockTimeoutMs: Number(process.env.MIGRATION_LOCK_TIMEOUT_MS || 45_000)
    });
  } finally {
    client.release();
  }
}

export function ensureMetaTemplateSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = applyMetaTemplateMigration().catch((error) => {
      schemaReadyPromise = undefined;
      throw error;
    });
  }
  return schemaReadyPromise;
}
