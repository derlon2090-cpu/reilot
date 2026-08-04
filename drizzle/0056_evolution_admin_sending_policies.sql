-- Evolution is a platform-admin provider. Its delivery policy is intentionally
-- stored per administrative device and must never be reused by Meta Cloud API.
CREATE TABLE IF NOT EXISTS evolution_sending_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evolution_device_id uuid NOT NULL UNIQUE REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
  instance_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  base_delay_seconds integer NOT NULL DEFAULT 300 CHECK (base_delay_seconds BETWEEN 1 AND 86400),
  jitter_min_seconds integer NOT NULL DEFAULT 270 CHECK (jitter_min_seconds BETWEEN 0 AND 86400),
  jitter_max_seconds integer NOT NULL DEFAULT 330 CHECK (jitter_max_seconds BETWEEN 0 AND 86400),
  hourly_limit integer NOT NULL DEFAULT 20 CHECK (hourly_limit BETWEEN 1 AND 100000),
  daily_limit integer NOT NULL DEFAULT 100 CHECK (daily_limit BETWEEN 1 AND 1000000),
  batch_limit integer NOT NULL DEFAULT 10 CHECK (batch_limit BETWEEN 1 AND 10000),
  cooldown_seconds integer NOT NULL DEFAULT 3600 CHECK (cooldown_seconds BETWEEN 0 AND 604800),
  duplicate_window_seconds integer NOT NULL DEFAULT 86400 CHECK (duplicate_window_seconds BETWEEN 0 AND 2592000),
  stop_on_high_risk boolean NOT NULL DEFAULT true,
  reduce_on_medium_risk boolean NOT NULL DEFAULT true,
  block_new_campaigns_on_high_risk boolean NOT NULL DEFAULT true,
  notify_admin_on_risk boolean NOT NULL DEFAULT true,
  pause_on_disconnect boolean NOT NULL DEFAULT true,
  validate_templates boolean NOT NULL DEFAULT true,
  block_unsafe_links boolean NOT NULL DEFAULT true,
  updated_by_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evolution_policy_jitter_order CHECK (jitter_min_seconds <= jitter_max_seconds),
  CONSTRAINT evolution_policy_limits_order CHECK (hourly_limit <= daily_limit)
);

CREATE INDEX IF NOT EXISTS evolution_sending_policies_instance_idx
  ON evolution_sending_policies(instance_id);

-- Existing Evolution rows were created exclusively for the administrative
-- Evolution adapter. The explicit provider name prevents user Meta queries
-- from accidentally including them.
UPDATE whatsapp_channels
   SET provider = 'evolution_admin', updated_at = now()
 WHERE provider = 'evolution';

INSERT INTO evolution_sending_policies (evolution_device_id, instance_id)
SELECT id, instance_name
  FROM whatsapp_channels
 WHERE provider = 'evolution_admin'
ON CONFLICT (evolution_device_id) DO NOTHING;
