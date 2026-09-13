import { getPool } from "./db.js";

const AUTH_SCHEMA_LOCK = "renvix:auth-schema-repair:v1";
const REGISTRATION_MIGRATION = "0092_registration_phone_and_commerce_platform.sql";
const ACCOUNT_LIFECYCLE_MIGRATION = "0097_user_account_lifecycle.sql";
let repairPromise;

const REPAIR_SQL = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_phone_e164 text;
ALTER TABLE auth_pending_registrations
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS commerce_platform text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS commerce_platform text;

WITH normalized AS (
  SELECT id,
    CASE
      WHEN regexp_replace(phone, '[^0-9+]', '', 'g') ~ '^\\+[1-9][0-9]{7,14}$'
        THEN regexp_replace(phone, '[^0-9+]', '', 'g')
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^9665[0-9]{8}$'
        THEN '+' || regexp_replace(phone, '[^0-9]', '', 'g')
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^05[0-9]{8}$'
        THEN '+966' || substring(regexp_replace(phone, '[^0-9]', '', 'g') from 2)
      WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^5[0-9]{8}$'
        THEN '+966' || regexp_replace(phone, '[^0-9]', '', 'g')
      ELSE NULL
    END AS e164
  FROM users
  WHERE account_phone_e164 IS NULL AND phone IS NOT NULL
), unique_normalized AS (
  SELECT e164 FROM normalized WHERE e164 IS NOT NULL GROUP BY e164 HAVING count(*) = 1
)
UPDATE users u SET account_phone_e164 = n.e164
  FROM normalized n JOIN unique_normalized un ON un.e164 = n.e164
 WHERE u.id = n.id;

ALTER TABLE auth_pending_registrations DROP CONSTRAINT IF EXISTS auth_pending_registrations_commerce_platform_check;
ALTER TABLE auth_pending_registrations ADD CONSTRAINT auth_pending_registrations_commerce_platform_check
  CHECK (commerce_platform IS NULL OR commerce_platform IN ('zid','salla','shopify','wordpress'));
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_commerce_platform_check;
ALTER TABLE stores ADD CONSTRAINT stores_commerce_platform_check
  CHECK (commerce_platform IS NULL OR commerce_platform IN ('zid','salla','shopify','wordpress'));
CREATE UNIQUE INDEX IF NOT EXISTS users_account_phone_e164_unique_idx
  ON users(account_phone_e164) WHERE account_phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS auth_pending_registration_phone_unique_idx
  ON auth_pending_registrations(phone_e164)
  WHERE phone_e164 IS NOT NULL AND consumed_at IS NULL AND invalidated_at IS NULL;
CREATE INDEX IF NOT EXISTS stores_commerce_platform_idx
  ON stores(commerce_platform) WHERE commerce_platform IS NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check;
ALTER TABLE users ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('active','suspended','removed'));
CREATE INDEX IF NOT EXISTS users_account_status_idx ON users(account_status, created_at DESC);
`;

async function schemaNeedsRepair(client) {
  const result = await client.query(`
    SELECT count(*)::int AS present
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (table_name, column_name) IN (
         ('users', 'account_phone_e164'),
         ('users', 'account_status'),
         ('auth_pending_registrations', 'phone_e164'),
         ('auth_pending_registrations', 'commerce_platform'),
         ('stores', 'commerce_platform')
       )
  `);
  return Number(result.rows[0]?.present || 0) !== 5;
}

export async function ensureAuthSchemaReady() {
  if (repairPromise) return repairPromise;
  repairPromise = (async () => {
    const client = await getPool().connect();
    let locked = false;
    try {
      await client.query("SELECT pg_advisory_lock(hashtext($1))", [AUTH_SCHEMA_LOCK]);
      locked = true;
      if (!(await schemaNeedsRepair(client))) return { repaired: false };
      await client.query("BEGIN");
      try {
        await client.query(REPAIR_SQL);
        await client.query(
          `INSERT INTO schema_migrations (name) VALUES ($1),($2)
           ON CONFLICT (name) DO NOTHING`,
          [REGISTRATION_MIGRATION, ACCOUNT_LIFECYCLE_MIGRATION]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      return { repaired: true };
    } finally {
      if (locked) await client.query("SELECT pg_advisory_unlock(hashtext($1))", [AUTH_SCHEMA_LOCK]).catch(() => null);
      client.release();
    }
  })().catch((error) => {
    repairPromise = undefined;
    throw error;
  });
  return repairPromise;
}

