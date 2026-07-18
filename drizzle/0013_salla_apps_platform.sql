CREATE TABLE IF NOT EXISTS app_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_store_id text,
  provider_store_name text,
  provider_store_domain text,
  status text NOT NULL DEFAULT 'disconnected',
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_connections_provider_check CHECK (provider = 'salla'),
  CONSTRAINT app_connections_status_check CHECK (status IN ('connected', 'disconnected', 'expired', 'error')),
  UNIQUE (tenant_id, provider)
);

CREATE UNIQUE INDEX IF NOT EXISTS app_connections_provider_store_unique
  ON app_connections(provider, provider_store_id) WHERE provider_store_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS salla_connection_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES app_connections(id) ON DELETE CASCADE,
  auto_sync_customers boolean NOT NULL DEFAULT true,
  auto_sync_orders boolean NOT NULL DEFAULT true,
  auto_create_subscriptions boolean NOT NULL DEFAULT true,
  auto_create_order_links boolean NOT NULL DEFAULT true,
  default_template_id uuid REFERENCES order_info_templates(id) ON DELETE SET NULL,
  default_template_style text NOT NULL DEFAULT 'classic',
  default_theme_color text NOT NULL DEFAULT '#22C55E',
  store_display_name text,
  order_link_slug text,
  sync_paid_orders_only boolean NOT NULL DEFAULT true,
  sync_completed_orders_only boolean NOT NULL DEFAULT false,
  map_order_to_subscription boolean NOT NULL DEFAULT true,
  default_subscription_duration_days integer NOT NULL DEFAULT 30,
  subscription_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  sync_order_status boolean NOT NULL DEFAULT true,
  notify_customer_after_link_created boolean NOT NULL DEFAULT false,
  send_method text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salla_settings_style_check CHECK (default_template_style IN ('classic', 'modern', 'professional', 'minimal', 'premium', 'colorful')),
  CONSTRAINT salla_settings_color_check CHECK (default_theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT salla_settings_duration_check CHECK (default_subscription_duration_days BETWEEN 1 AND 3650),
  CONSTRAINT salla_settings_send_method_check CHECK (send_method IN ('manual', 'whatsapp', 'email', 'copy_only')),
  CONSTRAINT salla_settings_rules_array_check CHECK (jsonb_typeof(subscription_rules) = 'array'),
  UNIQUE (tenant_id, connection_id)
);

CREATE TABLE IF NOT EXISTS app_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES app_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  event_type text,
  external_id text,
  status text NOT NULL,
  message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_sync_logs_provider_check CHECK (provider = 'salla'),
  CONSTRAINT app_sync_logs_status_check CHECK (status IN ('success', 'failed', 'skipped'))
);

CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  state text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_states_provider_check CHECK (provider = 'salla')
);

CREATE TABLE IF NOT EXISTS external_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES app_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  external_order_id text NOT NULL,
  order_number text,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  status text,
  payment_status text,
  total_amount numeric(12,2),
  currency text DEFAULT 'SAR',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_orders_provider_check CHECK (provider = 'salla'),
  UNIQUE (tenant_id, provider, external_order_id)
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS external_provider text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS external_customer_id text;
CREATE UNIQUE INDEX IF NOT EXISTS customers_external_provider_unique
  ON customers(tenant_id, external_provider, external_customer_id)
  WHERE external_provider IS NOT NULL AND external_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS app_connections_tenant_status_idx ON app_connections(tenant_id, status);
CREATE INDEX IF NOT EXISTS salla_connection_settings_tenant_idx ON salla_connection_settings(tenant_id);
CREATE INDEX IF NOT EXISTS app_sync_logs_tenant_created_idx ON app_sync_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS oauth_states_expiry_idx ON oauth_states(provider, expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS external_orders_tenant_created_idx ON external_orders(tenant_id, created_at DESC);

INSERT INTO app_connections (
  tenant_id, provider, provider_store_id, provider_store_name, status,
  access_token_encrypted, refresh_token_encrypted, token_expires_at, last_sync_at, last_error
)
SELECT tenant_id, provider, merchant_id, store_name,
       CASE WHEN status = 'error' THEN 'error' ELSE status END,
       access_token_encrypted, refresh_token_encrypted, token_expires_at, last_sync_at, last_error
  FROM commerce_integrations
ON CONFLICT (tenant_id, provider) DO NOTHING;

INSERT INTO salla_connection_settings (
  tenant_id, connection_id, auto_sync_customers, auto_sync_orders,
  auto_create_subscriptions, default_subscription_duration_days, subscription_rules
)
SELECT ci.tenant_id, ac.id, ci.auto_sync, ci.auto_sync, ci.auto_sync,
       ci.default_duration_days, ci.subscription_rules
  FROM commerce_integrations ci
  JOIN app_connections ac ON ac.tenant_id = ci.tenant_id AND ac.provider = ci.provider
ON CONFLICT (tenant_id, connection_id) DO NOTHING;
