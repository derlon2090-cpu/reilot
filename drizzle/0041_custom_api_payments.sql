CREATE TABLE IF NOT EXISTS custom_external_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES custom_integrations(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL,
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('PENDING','SUCCEEDED','FAILED','REFUNDED')),
  UNIQUE (tenant_id, integration_id, external_id)
);

CREATE INDEX IF NOT EXISTS custom_external_payments_tenant_idx
  ON custom_external_payments(tenant_id, created_at DESC);
