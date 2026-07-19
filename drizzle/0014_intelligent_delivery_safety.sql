ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT true;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

ALTER TABLE external_orders ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE external_orders ALTER COLUMN customer_email DROP NOT NULL;
ALTER TABLE external_orders ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE external_orders ADD COLUMN IF NOT EXISTS detected_plan_name text;
ALTER TABLE external_orders ADD COLUMN IF NOT EXISTS detected_duration_days integer;
ALTER TABLE external_orders ADD COLUMN IF NOT EXISTS detection_confidence numeric(5,2);

CREATE TABLE IF NOT EXISTS salla_product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES app_connections(id) ON DELETE CASCADE,
  external_product_id text,
  product_name text NOT NULL,
  product_sku text,
  plan_name text NOT NULL,
  duration_days integer NOT NULL CHECK (duration_days BETWEEN 1 AND 3650),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS salla_product_mappings_external_unique
  ON salla_product_mappings(tenant_id, connection_id, external_product_id)
  WHERE external_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS salla_product_mappings_lookup_idx
  ON salla_product_mappings(tenant_id, connection_id, is_active);

ALTER TABLE salla_connection_settings ADD COLUMN IF NOT EXISTS link_creation_mode text NOT NULL DEFAULT 'automatic';
ALTER TABLE salla_connection_settings ADD COLUMN IF NOT EXISTS auto_detect_product_duration boolean NOT NULL DEFAULT true;
ALTER TABLE salla_connection_settings DROP CONSTRAINT IF EXISTS salla_settings_link_creation_mode_check;
ALTER TABLE salla_connection_settings ADD CONSTRAINT salla_settings_link_creation_mode_check
  CHECK (link_creation_mode IN ('manual', 'automatic'));

ALTER TABLE order_info_links ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE order_info_links ADD COLUMN IF NOT EXISTS external_order_id text;
CREATE UNIQUE INDEX IF NOT EXISTS order_info_links_salla_source_unique
  ON order_info_links(tenant_id, source, external_order_id, subscription_id)
  WHERE external_order_id IS NOT NULL;

ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS health_score integer NOT NULL DEFAULT 0;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS connection_state text;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS last_successful_send_at timestamptz;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS last_failed_send_at timestamptz;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS last_send_at timestamptz;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS sending_paused_until timestamptz;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS sending_pause_reason text;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS auto_sending_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS risk_hold_at timestamptz;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS risk_hold_reason text;
ALTER TABLE whatsapp_channels DROP CONSTRAINT IF EXISTS whatsapp_channels_status_check;
ALTER TABLE whatsapp_channels ADD CONSTRAINT whatsapp_channels_status_check CHECK (status IN (
  'not_connected', 'pending_qr', 'pending_pairing', 'connecting', 'connected',
  'disconnected', 'expired', 'error', 'risk_hold'
));

CREATE TABLE IF NOT EXISTS whatsapp_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  whatsapp_channel_id uuid NOT NULL REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
  connection_state text NOT NULL,
  health_score integer NOT NULL DEFAULT 0,
  risk_score integer NOT NULL DEFAULT 0,
  latency_ms integer,
  error_message text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_health_checks_channel_idx
  ON whatsapp_health_checks(whatsapp_channel_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS sending_schedule_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  allowed_start time NOT NULL DEFAULT '10:00',
  allowed_end time NOT NULL DEFAULT '20:30',
  quiet_start time NOT NULL DEFAULT '21:00',
  quiet_end time NOT NULL DEFAULT '09:00',
  auto_whatsapp_delay_seconds integer NOT NULL DEFAULT 300,
  manual_whatsapp_delay_seconds integer NOT NULL DEFAULT 120,
  jitter_min_seconds integer NOT NULL DEFAULT 20,
  jitter_max_seconds integer NOT NULL DEFAULT 90,
  medium_risk_delay_seconds integer NOT NULL DEFAULT 600,
  high_risk_delay_seconds integer NOT NULL DEFAULT 1800,
  friday_enabled boolean NOT NULL DEFAULT false,
  warmup_enabled boolean NOT NULL DEFAULT true,
  auto_pause_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS channel_type text NOT NULL DEFAULT 'whatsapp';
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'renewal_reminder';
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS destination text;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS email_to text;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS message_body text;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS reference_type text;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS reference_id text;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS dedupe_hash text;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS safety_status text NOT NULL DEFAULT 'pending';
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS safety_reason text;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS delay_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS delay_reason text;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE message_queue DROP CONSTRAINT IF EXISTS message_queue_channel_type_check;
ALTER TABLE message_queue ADD CONSTRAINT message_queue_channel_type_check CHECK (channel_type IN ('whatsapp', 'email', 'sms'));
ALTER TABLE message_queue DROP CONSTRAINT IF EXISTS message_queue_message_type_check;
ALTER TABLE message_queue ADD CONSTRAINT message_queue_message_type_check CHECK (message_type IN (
  'renewal_reminder', 'order_info_link', 'manual_order_link', 'test_message', 'system_notification'
));
CREATE INDEX IF NOT EXISTS message_queue_channel_schedule_idx
  ON message_queue(channel_type, status, scheduled_for);
CREATE INDEX IF NOT EXISTS message_queue_dedupe_idx
  ON message_queue(tenant_id, dedupe_hash, created_at DESC) WHERE dedupe_hash IS NOT NULL;

ALTER TABLE whatsapp_risk_events DROP CONSTRAINT IF EXISTS whatsapp_risk_events_event_type_check;
ALTER TABLE whatsapp_risk_events ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'warning';
ALTER TABLE whatsapp_risk_events ADD COLUMN IF NOT EXISTS action_taken text;
ALTER TABLE whatsapp_risk_events ADD COLUMN IF NOT EXISTS message_queue_id uuid REFERENCES message_queue(id) ON DELETE SET NULL;
ALTER TABLE whatsapp_risk_events ADD COLUMN IF NOT EXISTS reason text;

INSERT INTO sending_schedule_settings (tenant_id)
SELECT id FROM tenants ON CONFLICT (tenant_id) DO NOTHING;
