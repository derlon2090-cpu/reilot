-- Renvix Security Operations Center. All tables are additive and contain no
-- customer payloads or credentials.
CREATE SEQUENCE IF NOT EXISTS security_incident_number_seq START 1;

CREATE TABLE IF NOT EXISTS inspector_schedule (
  schedule_key text PRIMARY KEY,
  interval_hours integer NOT NULL DEFAULT 10 CHECK (interval_hours BETWEEN 1 AND 168),
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO inspector_schedule (schedule_key, interval_hours, next_run_at)
VALUES ('deep-periodic-scan', 10, now())
ON CONFLICT (schedule_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS inspector_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type text NOT NULL CHECK (trigger_type IN ('scheduled','manual')),
  triggered_by_admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','timed_out')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  previous_run_at timestamptz,
  next_run_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inspector_runs_single_active_idx
  ON inspector_runs ((status)) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS inspector_runs_started_idx ON inspector_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS inspector_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES inspector_runs(id) ON DELETE CASCADE,
  check_id text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('passed','warning','failed','timed_out','skipped')),
  severity text NOT NULL CHECK (severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  affected_service text,
  duration_ms integer NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, check_id)
);

CREATE TABLE IF NOT EXISTS security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number text NOT NULL UNIQUE DEFAULT (
    'INC-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('security_incident_number_seq')::text, 6, '0')
  ),
  incident_type text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Investigating','Mitigated','Resolved','False Positive')),
  source_key text,
  affected_service text,
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  recommended_action text,
  remediation_status text NOT NULL DEFAULT 'not_started',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_incidents_status_idx ON security_incidents(status, severity, last_seen DESC);
CREATE INDEX IF NOT EXISTS security_incidents_source_idx ON security_incidents(source_key, last_seen DESC);

CREATE TABLE IF NOT EXISTS security_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES inspector_runs(id) ON DELETE SET NULL,
  incident_id uuid REFERENCES security_incidents(id) ON DELETE SET NULL,
  check_id text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  affected_service text,
  source_key text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended_action text,
  remediation_status text NOT NULL DEFAULT 'not_started',
  detected_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  dedupe_key text NOT NULL,
  UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS security_findings_detected_idx ON security_findings(detected_at DESC);
CREATE INDEX IF NOT EXISTS security_findings_incident_idx ON security_findings(incident_id, last_seen DESC);

CREATE TABLE IF NOT EXISTS security_source_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source_key text NOT NULL,
  source_ip text,
  country text,
  region text,
  city_approx text,
  asn text,
  organization text,
  browser text,
  browser_version text,
  os text,
  device_class text,
  user_agent text,
  requested_path text,
  method text,
  query_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  referrer text,
  cf_ray_id text,
  request_id text,
  risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  severity text NOT NULL CHECK (severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  incident_id uuid REFERENCES security_incidents(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_source_events_source_idx ON security_source_events(source_key, last_seen DESC);
CREATE INDEX IF NOT EXISTS security_source_events_type_idx ON security_source_events(event_type, last_seen DESC);
CREATE INDEX IF NOT EXISTS security_source_events_expiry_idx ON security_source_events(expires_at);

CREATE TABLE IF NOT EXISTS incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system','admin','worker')),
  actor_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text,
  event_hash text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incident_events_incident_idx ON incident_events(incident_id, occurred_at);

CREATE TABLE IF NOT EXISTS security_event_ledger (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text,
  event_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_event_ledger_aggregate_idx
  ON security_event_ledger(aggregate_type, aggregate_id, created_at);

CREATE OR REPLACE FUNCTION prevent_security_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'security_event_ledger is append-only';
END;
$$;

DROP TRIGGER IF EXISTS security_event_ledger_no_update ON security_event_ledger;
CREATE TRIGGER security_event_ledger_no_update
  BEFORE UPDATE OR DELETE ON security_event_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_security_ledger_mutation();

DROP TRIGGER IF EXISTS security_event_ledger_no_truncate ON security_event_ledger;
CREATE TRIGGER security_event_ledger_no_truncate
  BEFORE TRUNCATE ON security_event_ledger
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_security_ledger_mutation();

DROP TRIGGER IF EXISTS incident_events_no_update ON incident_events;
CREATE TRIGGER incident_events_no_update
  BEFORE UPDATE OR DELETE ON incident_events
  FOR EACH ROW EXECUTE FUNCTION prevent_security_ledger_mutation();

DROP TRIGGER IF EXISTS incident_events_no_truncate ON incident_events;
CREATE TRIGGER incident_events_no_truncate
  BEFORE TRUNCATE ON incident_events
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_security_ledger_mutation();

CREATE TABLE IF NOT EXISTS remediation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  impact_level text NOT NULL CHECK (impact_level IN ('safe','approval_required','prohibited')),
  status text NOT NULL CHECK (status IN ('pending','approved','running','succeeded','failed','rejected','expired')),
  requested_by_admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  approved_by_admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  reason text,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_mitigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  mitigation_type text NOT NULL CHECK (mitigation_type IN ('watchlist','challenge','temporary_block','rate_limit')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_by_admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS security_mitigations_active_idx
  ON security_mitigations(source_key, expires_at DESC) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS security_alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES security_incidents(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','secondary_webhook')),
  recipient text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('HIGH','CRITICAL')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','skipped')),
  dedupe_key text NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_alert_deliveries_pending_idx
  ON security_alert_deliveries(status, available_at) WHERE status IN ('pending','failed');

-- Prevent ordinary application roles from weakening the append-only guarantee.
REVOKE UPDATE, DELETE, TRUNCATE ON security_event_ledger FROM PUBLIC;
