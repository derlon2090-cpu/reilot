ALTER TABLE platform_plans
  ADD COLUMN IF NOT EXISTS storage_limit_mb integer NOT NULL DEFAULT 100;

UPDATE platform_plans
SET storage_limit_mb = CASE slug
  WHEN 'trial' THEN 100
  WHEN 'starter' THEN 500
  WHEN 'pro' THEN 2048
  WHEN 'business' THEN 10240
  ELSE GREATEST(storage_limit_mb, 100)
END;

CREATE TABLE IF NOT EXISTS commerce_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'salla',
  status text NOT NULL DEFAULT 'disconnected',
  merchant_id text,
  store_name text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  auto_sync boolean NOT NULL DEFAULT false,
  default_duration_days integer NOT NULL DEFAULT 30,
  last_sync_at timestamptz,
  last_webhook_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_integrations_provider_check CHECK (provider = 'salla'),
  CONSTRAINT commerce_integrations_status_check CHECK (status IN ('connected', 'disconnected', 'error')),
  CONSTRAINT commerce_integrations_duration_check CHECK (default_duration_days BETWEEN 1 AND 3650),
  UNIQUE (tenant_id, provider)
);

CREATE UNIQUE INDEX IF NOT EXISTS commerce_integrations_salla_merchant_unique
  ON commerce_integrations(provider, merchant_id)
  WHERE merchant_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS commerce_order_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES commerce_integrations(id) ON DELETE CASCADE,
  external_order_id text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  payload_hash text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, external_order_id)
);

CREATE INDEX IF NOT EXISTS commerce_order_mappings_tenant_idx
  ON commerce_order_mappings(tenant_id, synced_at DESC);

