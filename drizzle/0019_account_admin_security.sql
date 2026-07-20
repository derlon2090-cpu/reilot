ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS mfa_pending_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS mfa_recovery_hashes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS interface_density text NOT NULL DEFAULT 'comfortable';

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  renewal_billing_notifications boolean NOT NULL DEFAULT true,
  security_notifications boolean NOT NULL DEFAULT true,
  product_updates boolean NOT NULL DEFAULT true,
  message_failure_notifications boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS last_login_ip text;

ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_status_check;

ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_status_check
  CHECK (status IN ('active', 'disabled', 'locked', 'pending'));

ALTER TABLE admin_audit_logs
  ADD COLUMN IF NOT EXISTS actor_email text,
  ADD COLUMN IF NOT EXISTS ip_address text;

CREATE INDEX IF NOT EXISTS user_notification_preferences_user_idx
  ON user_notification_preferences(user_id);

