DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM accounts
     WHERE provider_id = 'credential' AND password_hash IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot finalize password_hash migration: credential accounts without a hash exist';
  END IF;
END
$$;

ALTER TABLE accounts
  VALIDATE CONSTRAINT accounts_credential_password_hash_required;

DROP TRIGGER IF EXISTS accounts_password_hash_transition ON accounts;
DROP FUNCTION IF EXISTS sync_accounts_password_hash_transition();

ALTER TABLE accounts
  DROP COLUMN IF EXISTS password;

COMMENT ON COLUMN accounts.password_hash IS
  'One-way password hash only. New values use Argon2id PHC; bcrypt/scrypt legacy values are upgraded after successful authentication.';
