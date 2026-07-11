ALTER TABLE login_attempts
  ADD COLUMN IF NOT EXISTS email_hash text;

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_hash_created_at
  ON login_attempts(email_hash, created_at);

-- Invalidate every token issued before the authentication boundary was fixed.
DELETE FROM sessions;
