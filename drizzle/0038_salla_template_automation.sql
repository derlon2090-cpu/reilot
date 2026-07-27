CREATE TABLE IF NOT EXISTS tenant_salla_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  salla_integration_id uuid NOT NULL REFERENCES app_connections(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  trigger_type text NOT NULL,
  salla_event_name text,
  mapped_status_id text,
  mapped_status_slug text,
  mapped_status_name text,
  delivery_channel text,
  whatsapp_template_id uuid REFERENCES meta_message_templates(id) ON DELETE SET NULL,
  email_subject text,
  message_body text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  last_sent_at timestamptz,
  last_failure_at timestamptz,
  last_failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_key),
  CHECK (trigger_type IN ('abandoned_cart', 'order_status', 'invoice_event')),
  CHECK (delivery_channel IS NULL OR delivery_channel IN ('whatsapp', 'email'))
);

CREATE TABLE IF NOT EXISTS salla_order_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  salla_integration_id uuid NOT NULL REFERENCES app_connections(id) ON DELETE CASCADE,
  external_status_id text NOT NULL,
  status_slug text,
  status_name text NOT NULL,
  is_custom boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salla_integration_id, external_status_id)
);

CREATE TABLE IF NOT EXISTS abandoned_cart_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES tenant_salla_templates(id) ON DELETE CASCADE,
  external_cart_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  converted_order_id text,
  next_message_index integer NOT NULL DEFAULT 1,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_cart_id),
  CHECK (status IN ('active', 'cancelled', 'converted', 'completed', 'expired'))
);

CREATE TABLE IF NOT EXISTS salla_public_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES tenant_salla_templates(id) ON DELETE CASCADE,
  page_type text NOT NULL,
  external_entity_id text NOT NULL,
  public_id text NOT NULL UNIQUE,
  token_hash text NOT NULL,
  payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, page_type, external_entity_id),
  CHECK (page_type IN ('order', 'invoice')),
  CHECK (status IN ('active', 'invalidated', 'expired'))
);

CREATE TABLE IF NOT EXISTS salla_template_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id uuid REFERENCES tenant_salla_templates(id) ON DELETE SET NULL,
  template_key text NOT NULL,
  external_event_id text,
  external_order_id text,
  external_cart_id text,
  external_invoice_id text,
  external_return_id text,
  channel text NOT NULL,
  recipient_hash text NOT NULL,
  public_page_type text,
  public_page_id uuid REFERENCES salla_public_pages(id) ON DELETE SET NULL,
  message_queue_id uuid REFERENCES message_queue(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  idempotency_key text NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  queued_at timestamptz,
  accepted_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_message_safe text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (channel IN ('whatsapp', 'email')),
  CHECK (status IN ('queued', 'processing', 'accepted', 'sent', 'delivered', 'read', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS tenant_salla_templates_integration_idx
  ON tenant_salla_templates(salla_integration_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS salla_order_statuses_tenant_idx
  ON salla_order_statuses(tenant_id, status_slug);
CREATE INDEX IF NOT EXISTS abandoned_cart_sequences_active_idx
  ON abandoned_cart_sequences(tenant_id, status, next_message_index);
CREATE INDEX IF NOT EXISTS salla_template_deliveries_tenant_idx
  ON salla_template_deliveries(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS salla_template_deliveries_entity_idx
  ON salla_template_deliveries(tenant_id, external_order_id, external_cart_id, external_invoice_id);

ALTER TABLE message_queue DROP CONSTRAINT IF EXISTS message_queue_message_type_check;
ALTER TABLE message_queue ADD CONSTRAINT message_queue_message_type_check CHECK (message_type IN (
  'renewal_reminder', 'order_info_link', 'manual_order_link', 'test_message',
  'system_notification', 'interactive_message', 'campaign', 'subscription_manual_reminder',
  'salla_template', 'salla_template_test'
));
