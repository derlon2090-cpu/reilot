CREATE UNIQUE INDEX IF NOT EXISTS accounts_google_subject_unique
  ON accounts (account_id)
  WHERE provider_id = 'google';

CREATE UNIQUE INDEX IF NOT EXISTS accounts_google_user_unique
  ON accounts (user_id)
  WHERE provider_id = 'google';

CREATE TABLE IF NOT EXISTS auth_provider_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL,
  ip_hash text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_provider_attempts_window_idx
  ON auth_provider_attempts (provider_id, ip_hash, created_at DESC);
