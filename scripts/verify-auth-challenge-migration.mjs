import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
const parsedUrl = new URL(databaseUrl);
if (!new Set(["127.0.0.1", "localhost"]).has(parsedUrl.hostname)) {
  throw new Error("This verifier only runs against an isolated local PostgreSQL instance.");
}

const migrationDirectory = path.resolve("drizzle");
const migrations = (await fs.readdir(migrationDirectory))
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();
assert.equal(migrations.at(-1), "0061_auth_challenge_purpose_repair.sql");

const runId = `${Date.now()}_${process.pid}`;
const schemas = {
  fresh: `auth_challenge_fresh_${runId}`,
  legacy: `auth_challenge_legacy_${runId}`
};

async function connect(schemaName) {
  const client = new Client({ connectionString: databaseUrl, ssl: false });
  await client.connect();
  await client.query(`CREATE SCHEMA ${schemaName}`);
  await client.query(`SET search_path TO ${schemaName}, public`);
  return client;
}

async function applyMigrations(client, files) {
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const name of files) {
    const sql = await fs.readFile(path.join(migrationDirectory, name), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [name]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      error.message = `${name}: ${error.message}`;
      throw error;
    }
  }
}

async function purposeConstraint(client) {
  const result = await client.query(
    `SELECT pg_get_constraintdef(c.oid) AS definition
       FROM pg_constraint c
       JOIN pg_class t ON t.oid=c.conrelid
       JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname=current_schema()
        AND t.relname='auth_email_otp_challenges'
        AND c.contype='c'
        AND pg_get_constraintdef(c.oid) ILIKE '%purpose%'`
  );
  return result.rows.map((row) => row.definition).join("\n");
}

async function seedChallenge(client, suffix, purpose = "login") {
  const tenant = await client.query(
    "INSERT INTO tenants(name,slug) VALUES ($1,$2) RETURNING id",
    [`Auth ${suffix}`, `auth-${suffix}-${runId}`]
  );
  const user = await client.query(
    "INSERT INTO users(tenant_id,name,email,role) VALUES ($1,$2,$3,'owner') RETURNING id",
    [tenant.rows[0].id, `User ${suffix}`, `${suffix}-${runId}@example.test`]
  );
  const challenge = await client.query(
    `INSERT INTO auth_email_otp_challenges(user_id,tenant_id,purpose,code_digest,expires_at)
     VALUES ($1,$2,$3,'digest',now() + interval '5 minutes') RETURNING id`,
    [user.rows[0].id, tenant.rows[0].id, purpose]
  );
  return { tenantId: tenant.rows[0].id, userId: user.rows[0].id, challengeId: challenge.rows[0].id };
}

async function verifyFresh() {
  const client = await connect(schemas.fresh);
  try {
    await applyMigrations(client, migrations);
    const definition = await purposeConstraint(client);
    assert.match(definition, /admin_login/);
    await seedChallenge(client, "fresh-admin", "admin_login");
    return { migrationCount: migrations.length, adminLoginAccepted: true };
  } finally {
    await client.end();
  }
}

async function verifyLegacyRepair() {
  const client = await connect(schemas.legacy);
  try {
    await applyMigrations(client, migrations.slice(0, -1));
    const seeded = await seedChallenge(client, "legacy", "login");
    await client.query("ALTER TABLE auth_email_otp_challenges DROP CONSTRAINT IF EXISTS auth_email_otp_challenges_purpose_check");
    await client.query("ALTER TABLE auth_email_otp_challenges ADD CONSTRAINT auth_email_otp_challenges_purpose_check CHECK (purpose IN ('login','sensitive_action'))");
    await assert.rejects(
      () => seedChallenge(client, "legacy-before", "admin_login"),
      (error) => error?.code === "23514"
    );
    await applyMigrations(client, migrations.slice(-1));
    const preserved = await client.query("SELECT purpose FROM auth_email_otp_challenges WHERE id=$1", [seeded.challengeId]);
    assert.equal(preserved.rows[0]?.purpose, "login");
    assert.match(await purposeConstraint(client), /admin_login/);
    await seedChallenge(client, "legacy-after", "admin_login");
    return { existingChallengePreserved: true, oldConstraintRepaired: true, adminLoginAccepted: true };
  } finally {
    await client.end();
  }
}

async function cleanup() {
  const client = new Client({ connectionString: databaseUrl, ssl: false });
  await client.connect();
  try {
    for (const schema of Object.values(schemas)) {
      assert.match(schema, /^auth_challenge_(fresh|legacy)_\d+_\d+$/);
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }
  } finally {
    await client.end();
  }
}

let report;
try {
  report = { fresh: await verifyFresh(), legacy: await verifyLegacyRepair() };
} finally {
  await cleanup();
}
console.log(JSON.stringify({ ...report, temporarySchemasRemoved: true }, null, 2));
