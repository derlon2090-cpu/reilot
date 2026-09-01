-- In-admin security notifications and centrally enforced containment targets.
-- Target values are never stored raw in security_blocks.
CREATE TABLE IF NOT EXISTS security_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
  grouping_key text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  reason text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('MEDIUM','HIGH','CRITICAL')),
  action_label text NOT NULL DEFAULT 'احتواء التهديد',
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_notifications_recent_idx
  ON security_notifications(last_seen DESC, severity);

CREATE TABLE IF NOT EXISTS security_notification_reads (
  notification_id uuid NOT NULL REFERENCES security_notifications(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, admin_user_id)
);

CREATE INDEX IF NOT EXISTS security_notification_reads_admin_idx
  ON security_notification_reads(admin_user_id, read_at DESC);

CREATE TABLE IF NOT EXISTS security_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id text NOT NULL UNIQUE DEFAULT ('SEC-' || upper(encode(gen_random_bytes(4), 'hex'))),
  target_type text NOT NULL CHECK (target_type IN ('account','device','ip','session')),
  target_hash text NOT NULL,
  target_label text,
  reason text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('MEDIUM','HIGH','CRITICAL')),
  blocked_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  incident_id uuid NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  revoke_reason text,
  edge_provider text,
  edge_rule_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS security_blocks_target_idx
  ON security_blocks(target_type, target_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS security_blocks_active_idx
  ON security_blocks(created_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS security_blocks_incident_idx
  ON security_blocks(incident_id, created_at DESC);

ALTER TABLE security_source_events
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trusted_device_id uuid REFERENCES auth_trusted_devices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS security_source_events_user_idx
  ON security_source_events(user_id, last_seen DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS security_source_events_session_idx
  ON security_source_events(session_id, last_seen DESC) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS security_source_events_device_idx
  ON security_source_events(trusted_device_id, last_seen DESC) WHERE trusted_device_id IS NOT NULL;
