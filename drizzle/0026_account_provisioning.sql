ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_initialized_at timestamptz;

CREATE TABLE IF NOT EXISTS provisioning_product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salla_store_id text NOT NULL,
  salla_product_id text NOT NULL,
  salla_variant_id text,
  salla_sku text,
  internal_plan_id uuid NOT NULL REFERENCES platform_plans(id),
  duration_value integer NOT NULL DEFAULT 1,
  duration_unit text NOT NULL DEFAULT 'month',
  quantity_behavior text NOT NULL DEFAULT 'multiply_duration',
  account_creation_enabled boolean NOT NULL DEFAULT true,
  activation_trigger text NOT NULL DEFAULT 'payment_completed',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salla_store_id, salla_product_id, salla_variant_id),
  CHECK (activation_trigger IN ('payment_completed','order_fulfilled','specific_status','manual_approval'))
  ,CHECK (duration_value > 0)
  ,CHECK (duration_unit IN ('day','month','year'))
  ,CHECK (quantity_behavior IN ('multiply_duration','create_multiple_subscriptions'))
);

CREATE TABLE IF NOT EXISTS provisioning_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'salla',
  salla_store_id text NOT NULL,
  external_order_id text NOT NULL,
  event_type text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  attempts integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS account_provisioning_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_order_id text NOT NULL,
  external_order_item_id text NOT NULL,
  customer_email text,
  customer_name text,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  mapping_id uuid REFERENCES provisioning_product_mappings(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES platform_plans(id) ON DELETE SET NULL,
  duration_value integer NOT NULL DEFAULT 1,
  duration_unit text NOT NULL DEFAULT 'month',
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  account_created_at timestamptz,
  tenant_created_at timestamptz,
  subscription_activated_at timestamptz,
  credentials_email_status text NOT NULL DEFAULT 'pending',
  credentials_email_id text,
  credentials_email_sent_at timestamptz,
  must_change_password boolean NOT NULL DEFAULT true,
  attempts integer NOT NULL DEFAULT 0,
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_order_id, external_order_item_id)
);

ALTER TABLE provisioning_product_mappings
  ADD COLUMN IF NOT EXISTS duration_value integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duration_unit text NOT NULL DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS quantity_behavior text NOT NULL DEFAULT 'multiply_duration';

ALTER TABLE account_provisioning_jobs
  ADD COLUMN IF NOT EXISTS mapping_id uuid REFERENCES provisioning_product_mappings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duration_value integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duration_unit text NOT NULL DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES platform_plans(id),
  source text NOT NULL DEFAULT 'salla',
  external_order_id text NOT NULL,
  external_order_item_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_order_id, external_order_item_id)
);

CREATE INDEX IF NOT EXISTS account_provisioning_jobs_status_idx
  ON account_provisioning_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS provisioning_events_status_idx
  ON provisioning_webhook_events(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS provisioning_product_mapping_variant_key
  ON provisioning_product_mappings(salla_store_id, salla_product_id, COALESCE(salla_variant_id, ''));
