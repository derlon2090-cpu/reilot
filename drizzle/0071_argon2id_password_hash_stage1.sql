ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS password_hash text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'password'
  ) THEN
    EXECUTE 'UPDATE accounts SET password_hash=password WHERE password_hash IS NULL AND password IS NOT NULL';

    CREATE OR REPLACE FUNCTION sync_accounts_password_hash_transition()
    RETURNS trigger LANGUAGE plpgsql AS $function$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        NEW.password_hash := COALESCE(NEW.password_hash, NEW.password);
        NEW.password := COALESCE(NEW.password, NEW.password_hash);
      ELSIF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
        NEW.password := NEW.password_hash;
      ELSIF NEW.password IS DISTINCT FROM OLD.password THEN
        NEW.password_hash := NEW.password;
      END IF;
      RETURN NEW;
    END
    $function$;

    DROP TRIGGER IF EXISTS accounts_password_hash_transition ON accounts;
    CREATE TRIGGER accounts_password_hash_transition
      BEFORE INSERT OR UPDATE OF password,password_hash ON accounts
      FOR EACH ROW EXECUTE FUNCTION sync_accounts_password_hash_transition();
  END IF;
END
$$;

ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_credential_password_hash_required;

ALTER TABLE accounts
  ADD CONSTRAINT accounts_credential_password_hash_required
  CHECK (provider_id <> 'credential' OR password_hash IS NOT NULL) NOT VALID;

COMMENT ON COLUMN accounts.password_hash IS
  'One-way password hash only. New values use Argon2id PHC; legacy hashes are upgraded after successful authentication.';
