CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES whatsapp_channels(id) ON DELETE SET NULL,
  category text NOT NULL,
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'low', 'warning', 'error', 'critical')),
  risk_weight integer NOT NULL DEFAULT 0 CHECK (risk_weight BETWEEN 0 AND 100),
  half_life_hours integer CHECK (half_life_hours IS NULL OR half_life_hours > 0),
  ip_hash text,
  country_code text,
  user_agent_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_tenant_occurred_idx
  ON security_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_events_active_risk_idx
  ON security_events(tenant_id, severity, occurred_at DESC) WHERE resolved_at IS NULL;

ALTER TABLE security_score_snapshots
  ALTER COLUMN account_score DROP NOT NULL,
  ALTER COLUMN overall_score DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS platform_score integer CHECK (platform_score IS NULL OR platform_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS account_protection_score integer CHECK (account_protection_score IS NULL OR account_protection_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS account_risk_score integer CHECK (account_risk_score IS NULL OR account_risk_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS session_score integer CHECK (session_score IS NULL OR session_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS whatsapp_health_score integer CHECK (whatsapp_health_score IS NULL OR whatsapp_health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS whatsapp_risk_score integer CHECK (whatsapp_risk_score IS NULL OR whatsapp_risk_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS sending_safety_score integer CHECK (sending_safety_score IS NULL OR sending_safety_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS coverage integer NOT NULL DEFAULT 0 CHECK (coverage BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS whatsapp_channel_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  window_ended_at timestamptz NOT NULL,
  attempted_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  unique_recipients integer NOT NULL DEFAULT 0,
  new_recipient_count integer NOT NULL DEFAULT 0,
  opt_out_count integer NOT NULL DEFAULT 0,
  reconnect_count integer NOT NULL DEFAULT 0,
  webhook_failure_count integer NOT NULL DEFAULT 0,
  average_queue_delay_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (window_ended_at >= window_started_at)
);

CREATE INDEX IF NOT EXISTS whatsapp_channel_metrics_window_idx
  ON whatsapp_channel_metrics(channel_id, window_ended_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_safety_state (
  channel_id uuid PRIMARY KEY REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal', 'watch', 'restricted', 'paused', 'critical_hold')),
  risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  next_allowed_at timestamptz,
  hourly_limit integer,
  daily_limit integer,
  sent_this_hour integer NOT NULL DEFAULT 0,
  sent_today integer NOT NULL DEFAULT 0,
  hold_reason text,
  hold_started_at timestamptz,
  last_health_check_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
