ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_otp_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS auth_email_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purpose text NOT NULL DEFAULT 'login',
  code_digest text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  resend_count integer NOT NULL DEFAULT 1,
  resend_window_started_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  invalidated_at timestamptz,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (purpose IN ('login', 'admin_login', 'sensitive_action'))
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_email_otp_one_pending_idx
  ON auth_email_otp_challenges(user_id, purpose)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;
CREATE INDEX IF NOT EXISTS auth_email_otp_expiry_idx
  ON auth_email_otp_challenges(expires_at)
  WHERE consumed_at IS NULL AND invalidated_at IS NULL;

CREATE TABLE IF NOT EXISTS auth_trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_digest text NOT NULL UNIQUE,
  label text,
  user_agent_hash text,
  ip_hash text,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_trusted_devices_user_idx
  ON auth_trusted_devices(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS custom_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  environment text NOT NULL DEFAULT 'live',
  direction text NOT NULL DEFAULT 'bidirectional',
  status text NOT NULL DEFAULT 'DRAFT',
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (environment IN ('live', 'test')),
  CHECK (direction IN ('inbound', 'outbound', 'bidirectional')),
  CHECK (status IN ('DRAFT', 'PARTIALLY_CONFIGURED', 'ACTIVE', 'PAUSED', 'ERROR', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS custom_integrations_tenant_idx
  ON custom_integrations(tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS custom_integration_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES custom_integrations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_digest text NOT NULL UNIQUE,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_api_keys_lookup_idx
  ON custom_integration_api_keys(key_prefix)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS custom_integration_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES custom_integrations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url text NOT NULL,
  description text,
  event_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  signing_secret_encrypted text NOT NULL,
  status text NOT NULL DEFAULT 'enabled',
  last_tested_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('enabled', 'disabled', 'error')),
  UNIQUE (integration_id, url)
);

CREATE TABLE IF NOT EXISTS custom_integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES custom_integrations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  direction text NOT NULL,
  event_type text NOT NULL,
  external_event_id text,
  resource_type text,
  resource_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CHECK (direction IN ('inbound', 'outbound')),
  CHECK (status IN ('received', 'queued', 'processed', 'failed', 'ignored'))
);

CREATE UNIQUE INDEX IF NOT EXISTS custom_events_external_dedupe_idx
  ON custom_integration_events(integration_id, external_event_id)
  WHERE external_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS custom_events_tenant_idx
  ON custom_integration_events(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS custom_integration_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES custom_integration_webhook_endpoints(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES custom_integrations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id uuid REFERENCES custom_integration_events(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 7,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  response_status integer,
  response_body_safe text,
  error_code text,
  idempotency_key text NOT NULL UNIQUE,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS custom_webhook_delivery_due_idx
  ON custom_integration_webhook_deliveries(status, next_attempt_at)
  WHERE status IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS custom_api_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES custom_integrations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  route_key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_body jsonb,
  locked_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  UNIQUE (integration_id, route_key, idempotency_key)
);

CREATE TABLE IF NOT EXISTS custom_api_rate_limit_hits (
  id bigserial PRIMARY KEY,
  identifier_hash text NOT NULL,
  route_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_api_rate_limit_lookup_idx
  ON custom_api_rate_limit_hits(identifier_hash, route_key, created_at DESC);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_external_idx
  ON customers(tenant_id, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_tenant_external_idx
  ON subscriptions(tenant_id, external_id)
  WHERE external_id IS NOT NULL;
