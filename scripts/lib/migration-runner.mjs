import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const MIGRATION_LOCK_KEY = "renvix:schema-migrations:v1";

function checksum(sql) {
  return crypto.createHash("sha256").update(String(sql).replace(/\r\n/g, "\n")).digest("hex");
}

export function validateMigrationPlan(migrations) {
  if (!Array.isArray(migrations)) throw new Error("Migration plan must be an array");
  const names = new Set();
  let previous = "";
  return migrations.map((migration) => {
    const name = String(migration?.name || "");
    const sql = String(migration?.sql || "");
    if (!/^\d+.*\.sql$/.test(name) || !sql.trim()) throw new Error(`Invalid migration ${name || "<unnamed>"}`);
    if (names.has(name)) throw new Error(`Duplicate migration ${name}`);
    if (previous && name < previous) throw new Error("Migration plan is not sorted");
    names.add(name);
    previous = name;
    return { name, sql, checksum: checksum(sql) };
  });
}

export async function loadMigrationFiles(directory = path.resolve("drizzle")) {
  const files = (await fs.readdir(directory)).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
  const migrations = await Promise.all(files.map(async (name) => ({ name, sql: await fs.readFile(path.join(directory, name), "utf8") })));
  return validateMigrationPlan(migrations);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function acquireMigrationLock(client, {
  lockKey = MIGRATION_LOCK_KEY,
  lockTimeoutMs = 60_000,
  pollIntervalMs = 250,
  now = Date.now,
  sleep = wait
} = {}) {
  const timeout = Math.max(1_000, Math.min(10 * 60_000, Number(lockTimeoutMs) || 60_000));
  const startedAt = now();
  do {
    const result = await client.query("SELECT pg_try_advisory_lock(hashtext($1)) AS locked", [lockKey]);
    if (result.rows[0]?.locked === true) return true;
    await sleep(Math.max(25, Number(pollIntervalMs) || 250));
  } while (now() - startedAt < timeout);
  const error = new Error(`Timed out waiting for the migration lock after ${timeout}ms`);
  error.code = "MIGRATION_LOCK_TIMEOUT";
  throw error;
}

export async function releaseMigrationLock(client, lockKey = MIGRATION_LOCK_KEY) {
  const result = await client.query("SELECT pg_advisory_unlock(hashtext($1)) AS unlocked", [lockKey]);
  if (result.rows[0]?.unlocked !== true) {
    const error = new Error("The migration advisory lock was not held by this session");
    error.code = "MIGRATION_LOCK_RELEASE_FAILED";
    throw error;
  }
}

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query("ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text");
}

async function verifyMigrationLedger(client, plan) {
  const ledger = await client.query("SELECT name,checksum FROM schema_migrations ORDER BY name");
  const applied = new Map(ledger.rows.map((row) => [row.name, row.checksum]));
  const missing = plan.filter((migration) => !applied.has(migration.name)).map((migration) => migration.name);
  const mismatched = plan.filter((migration) => applied.get(migration.name) !== migration.checksum).map((migration) => migration.name);
  if (missing.length || mismatched.length) {
    const error = new Error(`Migration verification failed (missing=${missing.join(",")}; checksum=${mismatched.join(",")})`);
    error.code = "MIGRATION_VERIFICATION_FAILED";
    throw error;
  }
}

export async function runMigrationPlan(client, {
  migrations,
  lockKey = MIGRATION_LOCK_KEY,
  lockTimeoutMs = 60_000,
  pollIntervalMs = 250,
  now = Date.now,
  sleep = wait,
  logger = console
} = {}) {
  const plan = validateMigrationPlan(migrations || []);
  await acquireMigrationLock(client, { lockKey, lockTimeoutMs, pollIntervalMs, now, sleep });
  let primaryError = null;
  let appliedCount = 0;
  let skippedCount = 0;
  try {
    await ensureLedger(client);
    const ledger = await client.query("SELECT name,checksum FROM schema_migrations ORDER BY name");
    const applied = new Map(ledger.rows.map((row) => [row.name, row.checksum]));
    for (const migration of plan) {
      if (applied.has(migration.name)) {
        const recordedChecksum = applied.get(migration.name);
        if (recordedChecksum && recordedChecksum !== migration.checksum) {
          const error = new Error(`Applied migration checksum changed: ${migration.name}`);
          error.code = "MIGRATION_CHECKSUM_MISMATCH";
          throw error;
        }
        if (!recordedChecksum) {
          await client.query("UPDATE schema_migrations SET checksum=$2 WHERE name=$1 AND checksum IS NULL", [migration.name, migration.checksum]);
        }
        skippedCount += 1;
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (name,checksum) VALUES ($1,$2)", [migration.name, migration.checksum]);
        await client.query("COMMIT");
        appliedCount += 1;
        logger.log(`Applied migration ${migration.name}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    await verifyMigrationLedger(client, plan);
    return { applied: appliedCount, skipped: skippedCount, verified: true };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await releaseMigrationLock(client, lockKey);
    } catch (releaseError) {
      if (!primaryError) throw releaseError;
      logger.error("Migration lock release failed after migration error", { code: releaseError.code || "MIGRATION_LOCK_RELEASE_FAILED" });
    }
  }
}
