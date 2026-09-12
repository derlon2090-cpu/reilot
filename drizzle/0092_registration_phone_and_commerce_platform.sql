ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_phone_e164 text;

ALTER TABLE auth_pending_registrations
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS commerce_platform text;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS commerce_platform text;

-- Preserve legacy phone values while claiming any safely normalizable, unique
-- Saudi mobile identity for the account-level uniqueness rule.
WITH normalized AS (
  SELECT id,
    CASE
      WHEN regexp_replace(phone, '[^0-9+]', '', 'g') ~ '^\+[1-9][0-9]{7,14}$'
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
UPDATE users u
SET account_phone_e164 = n.e164
FROM normalized n
JOIN unique_normalized un ON un.e164 = n.e164
WHERE u.id = n.id;

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
