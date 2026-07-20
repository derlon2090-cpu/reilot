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

-- One-time, least-privilege support account requested for handoff. Only the
-- scrypt hash is stored, and the server rejects it automatically after 24h.
WITH temporary_user AS (
  INSERT INTO users
    (tenant_id, name, email, email_verified, role, password_strength, password_changed_at)
  VALUES
    (NULL, 'مدير مؤقت', 'temporary.admin@renvix.app', true, 'admin', 'very_strong', now())
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    email_verified = true,
    password_strength = EXCLUDED.password_strength,
    password_changed_at = now(),
    updated_at = now()
  RETURNING id
)
INSERT INTO accounts (user_id, account_id, provider_id, password)
SELECT id, 'temporary.admin@renvix.app', 'credential',
       'scrypt$befa13a153c6360ae16a13480fb22e58$c8f7925888095d591b44726a842965fcc3d3cedb8e11a311e89a456912a9036c1a9430ee2957466364142220bc40e0370ba0fba485a6721f8c3d4434dc9d2f8d'
  FROM temporary_user
 WHERE NOT EXISTS (
   SELECT 1 FROM accounts a
    WHERE a.user_id = temporary_user.id AND a.provider_id = 'credential'
 );

INSERT INTO admin_users (user_id, role, status, mfa_enabled, expires_at)
SELECT id, 'viewer', 'active', false, now() + interval '24 hours'
  FROM users WHERE email = 'temporary.admin@renvix.app'
ON CONFLICT (user_id) DO UPDATE SET
  role = 'viewer', status = 'active', mfa_enabled = false,
  expires_at = now() + interval '24 hours', updated_at = now();
