-- Platform administrators intentionally have users.tenant_id = NULL because
-- they are global operators, not members of a customer tenant. Authentication
-- challenges are scoped by user_id and therefore must support those accounts.
-- Dropping NOT NULL is non-destructive and preserves all existing challenges.
ALTER TABLE auth_email_otp_challenges
  ALTER COLUMN tenant_id DROP NOT NULL;

ALTER TABLE auth_mfa_login_challenges
  ALTER COLUMN tenant_id DROP NOT NULL;

ALTER TABLE auth_trusted_devices
  ALTER COLUMN tenant_id DROP NOT NULL;

