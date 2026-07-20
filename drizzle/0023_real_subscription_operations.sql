CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  duration_value integer NOT NULL CHECK (duration_value > 0),
  duration_unit text NOT NULL CHECK (duration_unit IN ('day', 'month', 'year')),
  expired_renewal_policy text NOT NULL DEFAULT 'from_payment_date'
    CHECK (expired_renewal_policy IN ('from_payment_date', 'continue_from_old_expiry')),
  default_reminder_days jsonb NOT NULL DEFAULT '[7,1,0]'::jsonb,
  salla_product_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS product_plan_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES app_connections(id) ON DELETE CASCADE,
  salla_product_id text NOT NULL,
  salla_product_sku text,
  salla_variant_id text,
  internal_plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  duration_value integer NOT NULL CHECK (duration_value > 0),
  duration_unit text NOT NULL CHECK (duration_unit IN ('day', 'month', 'year')),
  start_trigger text NOT NULL DEFAULT 'payment_completed'
    CHECK (start_trigger IN ('payment_completed', 'order_completed', 'manual_activation', 'specific_order_status')),
  specific_order_status text,
  renewal_mode text NOT NULL DEFAULT 'manual_purchase' CHECK (renewal_mode = 'manual_purchase'),
  quantity_behavior text NOT NULL DEFAULT 'multiply_duration'
    CHECK (quantity_behavior IN ('multiply_duration', 'create_multiple_subscriptions')),
  is_subscription_product boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_plan_mappings_identity_unique
  ON product_plan_mappings(tenant_id, salla_product_id, COALESCE(salla_variant_id, ''));
CREATE INDEX IF NOT EXISTS product_plan_mappings_lookup_idx
  ON product_plan_mappings(tenant_id, salla_variant_id, salla_product_id, salla_product_sku) WHERE is_active;

CREATE TABLE IF NOT EXISTS salla_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES app_connections(id) ON DELETE CASCADE,
  salla_product_id text NOT NULL,
  salla_variant_id text,
  sku text,
  name text NOT NULL,
  price numeric(12,2),
  currency text,
  status text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,salla_product_id,salla_variant_id)
);
CREATE INDEX IF NOT EXISTS salla_products_tenant_idx ON salla_products(tenant_id,synced_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS salla_products_identity_unique
  ON salla_products(tenant_id,salla_product_id,COALESCE(salla_variant_id,''));

CREATE TABLE IF NOT EXISTS subscription_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  legacy_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  salla_customer_id text,
  full_name text NOT NULL,
  phone_e164 text,
  phone_country_code text,
  email text,
  email_normalized text,
  phone_verified_by_source boolean NOT NULL DEFAULT false,
  email_eligible boolean NOT NULL DEFAULT false,
  whatsapp_eligible boolean NOT NULL DEFAULT false,
  customer_match_status text NOT NULL DEFAULT 'matched'
    CHECK (customer_match_status IN ('matched', 'needs_review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_customers_salla_unique
  ON subscription_customers(tenant_id, salla_customer_id) WHERE salla_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscription_customers_email_idx ON subscription_customers(tenant_id, email_normalized);
CREATE INDEX IF NOT EXISTS subscription_customers_phone_idx ON subscription_customers(tenant_id, phone_e164);

CREATE TABLE IF NOT EXISTS order_customer_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  salla_order_id text NOT NULL,
  salla_customer_id text,
  customer_name text,
  customer_email text,
  customer_phone text,
  source_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, salla_order_id)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_event_id text NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES app_connections(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processing', 'completed', 'failed', 'ignored')),
  attempts integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, external_event_id)
);
CREATE INDEX IF NOT EXISTS webhook_events_worker_idx
  ON webhook_events(processing_status, created_at) WHERE processing_status IN ('received', 'failed');

CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES subscription_customers(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  legacy_subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  salla_order_id text NOT NULL,
  salla_order_item_id text NOT NULL,
  salla_product_id text NOT NULL,
  salla_variant_id text,
  order_number text NOT NULL,
  service_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending_activation', 'active', 'expired', 'renewed', 'paused', 'cancelled', 'needs_review')),
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  renewal_mode text NOT NULL DEFAULT 'manual_purchase' CHECK (renewal_mode = 'manual_purchase'),
  reminder_mode text NOT NULL DEFAULT 'automatic' CHECK (reminder_mode IN ('manual', 'automatic')),
  reminder_days jsonb NOT NULL DEFAULT '[7,1,0]'::jsonb,
  preferred_channel text CHECK (preferred_channel IN ('whatsapp', 'email')),
  fallback_channel text CHECK (fallback_channel IN ('whatsapp', 'email')),
  notification_status text NOT NULL DEFAULT 'ready',
  source text NOT NULL DEFAULT 'salla' CHECK (source IN ('salla', 'manual', 'import')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SAR',
  last_renewed_at timestamptz,
  next_reminder_at timestamptz,
  last_reminder_sent_at timestamptz,
  last_reminder_channel text,
  last_reminder_message_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, salla_order_item_id)
);
CREATE INDEX IF NOT EXISTS customer_subscriptions_filters_idx
  ON customer_subscriptions(tenant_id, status, expires_at, plan_id, preferred_channel);
CREATE INDEX IF NOT EXISTS customer_subscriptions_customer_plan_idx
  ON customer_subscriptions(tenant_id, customer_id, plan_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS subscription_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_order_id text,
  source_order_item_id text,
  previous_expires_at timestamptz,
  new_expires_at timestamptz NOT NULL,
  duration_value integer NOT NULL,
  duration_unit text NOT NULL CHECK (duration_unit IN ('day', 'month', 'year')),
  amount numeric(12,2),
  currency text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_renewals_source_item_unique
  ON subscription_renewals(tenant_id, source_order_item_id) WHERE source_order_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS renewal_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_template_id uuid REFERENCES notification_templates(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  name text NOT NULL,
  subject text,
  body text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS renewal_message_templates_one_default
  ON renewal_message_templates(tenant_id, channel) WHERE is_default = true;

CREATE TABLE IF NOT EXISTS subscription_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  original_expires_at timestamptz NOT NULL,
  scheduled_for timestamptz NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  fallback_channel text CHECK (fallback_channel IN ('whatsapp', 'email')),
  template_id uuid REFERENCES renewal_message_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'queued', 'processing', 'sent', 'delivered', 'failed', 'cancelled', 'skipped', 'paused')),
  queue_job_id uuid,
  sent_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_reminders_due_idx
  ON subscription_reminders(status, scheduled_for) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS unmapped_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES app_connections(id) ON DELETE SET NULL,
  salla_order_id text NOT NULL,
  salla_order_item_id text NOT NULL,
  order_number text,
  salla_product_id text,
  salla_variant_id text,
  sku text,
  product_name text,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'needs_mapping' CHECK (status IN ('needs_mapping', 'mapped', 'ignored')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, salla_order_item_id)
);

ALTER TABLE message_queue
  ADD COLUMN IF NOT EXISTS customer_subscription_id uuid REFERENCES customer_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reminder_id uuid REFERENCES subscription_reminders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'uncharged',
  ADD COLUMN IF NOT EXISTS fallback_channel text,
  ADD COLUMN IF NOT EXISTS fallback_destination text,
  ADD COLUMN IF NOT EXISTS fallback_subject text,
  ADD COLUMN IF NOT EXISTS fallback_message_body text,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_code text;
ALTER TABLE message_queue DROP CONSTRAINT IF EXISTS message_queue_billing_status_check;
ALTER TABLE message_queue ADD CONSTRAINT message_queue_billing_status_check
  CHECK (billing_status IN ('uncharged', 'charged', 'not_billable'));

ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS customer_subscription_id uuid REFERENCES customer_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reminder_id uuid REFERENCES subscription_reminders(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS balance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id uuid REFERENCES message_queue(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('debit', 'credit')),
  amount integer NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS renewal_tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  destination_url text NOT NULL,
  expires_at timestamptz NOT NULL,
  opened_at timestamptz,
  clicked_at timestamptz,
  renewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salla_sync_cursors (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES app_connections(id) ON DELETE CASCADE,
  resource text NOT NULL DEFAULT 'orders',
  last_completed_page integer NOT NULL DEFAULT 0,
  import_status text NOT NULL DEFAULT 'idle',
  send_notifications boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO subscription_plans (tenant_id, name, duration_value, duration_unit)
SELECT DISTINCT s.tenant_id, s.plan_name,
       GREATEST(1, (s.end_date - s.start_date)::integer), 'day'
FROM subscriptions s
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO subscription_customers
  (id, tenant_id, legacy_customer_id, full_name, phone_e164, email, email_normalized,
   email_eligible, whatsapp_eligible)
SELECT c.id, c.tenant_id, c.id, c.name,
       CASE WHEN COALESCE(c.whatsapp_number, c.phone) ~ '^\+[1-9][0-9]{7,14}$' THEN COALESCE(c.whatsapp_number, c.phone) END,
       c.email, lower(trim(c.email)),
       COALESCE(c.email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$', false),
       COALESCE(COALESCE(c.whatsapp_number, c.phone) ~ '^\+[1-9][0-9]{7,14}$', false)
FROM customers c
ON CONFLICT (id) DO NOTHING;

INSERT INTO customer_subscriptions
  (id, tenant_id, customer_id, plan_id, legacy_subscription_id,
   salla_order_id, salla_order_item_id, salla_product_id, order_number, service_name,
   status, starts_at, expires_at, reminder_mode, reminder_days, preferred_channel, source, amount)
SELECT s.id, s.tenant_id, s.customer_id, p.id, s.id,
       'legacy:' || s.id::text, 'legacy:' || s.id::text, 'legacy', s.order_number, s.service_name,
       CASE s.status WHEN 'expiring_soon' THEN 'active' ELSE s.status END,
       s.start_date::timestamptz, s.end_date::timestamptz,
       s.reminder_mode, jsonb_build_array(s.reminder_days_before), s.reminder_channel, CASE WHEN s.order_number LIKE 'RP-%' THEN 'manual' ELSE 'import' END, s.price
FROM subscriptions s
JOIN subscription_plans p ON p.tenant_id = s.tenant_id AND p.name = s.plan_name
ON CONFLICT (id) DO NOTHING;

INSERT INTO renewal_message_templates
  (tenant_id, source_template_id, channel, name, subject, body, is_default, is_active)
SELECT DISTINCT ON (nt.tenant_id, nt.channel)
       nt.tenant_id, nt.id, nt.channel, nt.name, nt.title, nt.body, true, nt.is_active
FROM notification_templates nt
WHERE nt.tenant_id IS NOT NULL AND nt.channel IN ('whatsapp', 'email')
ORDER BY nt.tenant_id, nt.channel, nt.updated_at DESC, nt.created_at DESC
ON CONFLICT DO NOTHING;
