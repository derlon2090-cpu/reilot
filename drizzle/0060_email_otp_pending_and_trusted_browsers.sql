ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS mfa_last_verified_step bigint;

ALTER TABLE auth_email_otp_challenges
  ADD COLUMN IF NOT EXISTS login_attempt_id uuid REFERENCES login_attempts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS auth_pending_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  company_name text,
  password_hash text NOT NULL,
  password_strength text NOT NULL DEFAULT 'medium',
  code_digest text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  resend_count integer NOT NULL DEFAULT 1,
  resend_window_started_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  invalidated_at timestamptz,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_pending_registration_email_idx
  ON auth_pending_registrations(email)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;

CREATE INDEX IF NOT EXISTS auth_pending_registration_expiry_idx
  ON auth_pending_registrations(expires_at)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;

ALTER TABLE auth_trusted_devices
  ADD COLUMN IF NOT EXISTS verified_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoke_reason text,
  ADD COLUMN IF NOT EXISTS created_ip_hash text,
  ADD COLUMN IF NOT EXISTS last_ip_hash text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE auth_trusted_devices
  DROP CONSTRAINT IF EXISTS auth_trusted_devices_token_digest_key;

CREATE UNIQUE INDEX IF NOT EXISTS auth_trusted_devices_user_token_idx
  ON auth_trusted_devices(user_id, token_digest);

UPDATE users
   SET email_verified = true,
       email_verified_at = COALESCE(email_verified_at, created_at)
 WHERE email_verified IS DISTINCT FROM true
    OR email_verified_at IS NULL;

ALTER TABLE auth_mfa_login_challenges
  ADD COLUMN IF NOT EXISTS target_path text NOT NULL DEFAULT '/dashboard',
  ADD COLUMN IF NOT EXISTS login_attempt_id uuid REFERENCES login_attempts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS auth_email_otp_login_attempt_idx
  ON auth_email_otp_challenges(login_attempt_id)
  WHERE login_attempt_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS auth_mfa_login_attempt_idx
  ON auth_mfa_login_challenges(login_attempt_id)
  WHERE login_attempt_id IS NOT NULL;
