import pg from "pg";

const migration = "0062_platform_admin_auth_challenges.sql";
const passwordMigration = "0071_argon2id_password_hash_stage1.sql";
const requiredColumns = new Set([
  "auth_email_otp_challenges.login_attempt_id",
  "auth_mfa_login_challenges.login_attempt_id",
  "auth_mfa_login_challenges.target_path",
  "users.email_verified_at",
  "users.mfa_last_verified_step"
]);

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to verify the authentication schema");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
});
await client.connect();
try {
  const result = await client.query(
    `SELECT
       EXISTS (SELECT 1 FROM schema_migrations WHERE name = $1) AS migration_applied,
       EXISTS (SELECT 1 FROM schema_migrations WHERE name = $2) AS password_migration_applied,
       EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='accounts' AND column_name='password_hash'
       ) AS password_hash_column_ready,
       to_regclass('public.auth_pending_registrations') IS NOT NULL AS pending_registration_table,
       EXISTS (
         SELECT 1
           FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND t.relname = 'auth_email_otp_challenges'
            AND c.contype = 'c'
            AND pg_get_constraintdef(c.oid) ILIKE '%purpose%'
            AND pg_get_constraintdef(c.oid) ILIKE '%admin_login%'
       ) AS purpose_constraint_ready,
       NOT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema='public'
            AND table_name IN ('auth_email_otp_challenges','auth_mfa_login_challenges','auth_trusted_devices')
            AND column_name='tenant_id' AND is_nullable <> 'YES'
       ) AND (
         SELECT count(*) = 3 FROM information_schema.columns
          WHERE table_schema='public'
            AND table_name IN ('auth_email_otp_challenges','auth_mfa_login_challenges','auth_trusted_devices')
            AND column_name='tenant_id'
       ) AS platform_admin_challenges_ready,
       COALESCE(array_agg(table_name || '.' || column_name)
         FILTER (WHERE table_name IS NOT NULL), ARRAY[]::text[]) AS available_columns
     FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'users' AND column_name IN ('email_verified_at', 'mfa_last_verified_step'))
        OR (table_name = 'auth_email_otp_challenges' AND column_name = 'login_attempt_id')
        OR (table_name = 'auth_mfa_login_challenges' AND column_name IN ('target_path', 'login_attempt_id'))
      )`,
    [migration, passwordMigration]
  );
  const row = result.rows[0] || {};
  const available = new Set(row.available_columns || []);
  const missingColumns = [...requiredColumns].filter((column) => !available.has(column));
  if (row.migration_applied !== true || row.password_migration_applied !== true || row.password_hash_column_ready !== true || row.pending_registration_table !== true || row.purpose_constraint_ready !== true || row.platform_admin_challenges_ready !== true || missingColumns.length) {
    console.error("Authentication schema is not ready", {
      migrationApplied: row.migration_applied === true,
      passwordMigrationApplied: row.password_migration_applied === true,
      passwordHashColumnReady: row.password_hash_column_ready === true,
      pendingRegistrationTable: row.pending_registration_table === true,
      purposeConstraintReady: row.purpose_constraint_ready === true,
      platformAdminChallengesReady: row.platform_admin_challenges_ready === true,
      missingColumns
    });
    process.exitCode = 1;
  } else {
    console.log(`Authentication schema ready (${migration}; ${passwordMigration})`);
  }
} finally {
  await client.end();
}
