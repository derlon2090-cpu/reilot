ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_phone_e164 text;

ALTER TABLE auth_pending_registrations
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS commerce_platform text;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS commerce_platform text;

ALTER TABLE auth_pending_registrations
  DROP CONSTRAINT IF EXISTS auth_pending_registrations_commerce_platform_check;

ALTER TABLE auth_pending_registrations
  ADD CONSTRAINT auth_pending_registrations_commerce_platform_check
  CHECK (commerce_platform IS NULL OR commerce_platform IN ('zid','salla','shopify','wordpress'));

ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS stores_commerce_platform_check;

ALTER TABLE stores
  ADD CONSTRAINT stores_commerce_platform_check
  CHECK (commerce_platform IS NULL OR commerce_platform IN ('zid','salla','shopify','wordpress'));

CREATE UNIQUE INDEX IF NOT EXISTS users_account_phone_e164_unique_idx
  ON users(account_phone_e164)
  WHERE account_phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS auth_pending_registration_phone_unique_idx
  ON auth_pending_registrations(phone_e164)
  WHERE phone_e164 IS NOT NULL AND consumed_at IS NULL AND invalidated_at IS NULL;

CREATE INDEX IF NOT EXISTS stores_commerce_platform_idx
  ON stores(commerce_platform)
  WHERE commerce_platform IS NOT NULL;

COMMENT ON COLUMN users.account_phone_e164 IS 'Immutable normalized mobile identity captured during account registration.';
COMMENT ON COLUMN stores.commerce_platform IS 'Merchant platform selected during workspace registration.';
