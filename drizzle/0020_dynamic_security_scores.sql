ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_strength text,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_password_strength_check;

ALTER TABLE users
  ADD CONSTRAINT users_password_strength_check
  CHECK (password_strength IS NULL OR password_strength IN ('weak', 'fair', 'strong', 'very_strong'));

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS admin_users_expiry_idx
  ON admin_users(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS security_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES whatsapp_channels(id) ON DELETE SET NULL,
  account_score integer NOT NULL DEFAULT 0 CHECK (account_score BETWEEN 0 AND 100),
  channel_score integer CHECK (channel_score IS NULL OR channel_score BETWEEN 0 AND 100),
  overall_score integer NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  account_status text NOT NULL,
  channel_status text NOT NULL,
  overall_status text NOT NULL,
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_score_snapshots_tenant_calculated_idx
  ON security_score_snapshots(tenant_id, calculated_at DESC);

CREATE INDEX IF NOT EXISTS security_score_snapshots_user_calculated_idx
  ON security_score_snapshots(user_id, calculated_at DESC);
