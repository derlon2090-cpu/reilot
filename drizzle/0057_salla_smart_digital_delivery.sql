-- Restore independently saved legacy channel bodies only when 0054 left its
-- message_body fallback untouched. Never overwrite content edited after 0054.
UPDATE tenant_salla_templates
   SET whatsapp_content = CASE
         WHEN (whatsapp_content IS NULL OR whatsapp_content = message_body)
           THEN COALESCE(NULLIF(settings #>> '{channelContents,whatsapp,body}', ''), whatsapp_content, message_body)
         ELSE whatsapp_content
       END,
       email_text_content = CASE
         WHEN (email_text_content IS NULL OR email_text_content = message_body)
           THEN COALESCE(NULLIF(settings #>> '{channelContents,email,body}', ''), email_text_content, message_body)
         ELSE email_text_content
       END,
       email_html_content = CASE
         WHEN (email_html_content IS NULL OR email_html_content = message_body)
           THEN COALESCE(NULLIF(settings #>> '{channelContents,email,body}', ''), email_html_content, message_body)
         ELSE email_html_content
       END;

CREATE TABLE IF NOT EXISTS salla_delivery_source_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  salla_integration_id uuid NOT NULL REFERENCES app_connections(id) ON DELETE CASCADE,
  store_id text NOT NULL,
  source_type text NOT NULL DEFAULT 'item_custom_field',
  source_field_key text NOT NULL DEFAULT 'renvix_delivery_content',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, store_id),
  CHECK (source_type IN ('order_custom_field','item_custom_field','item_option','digital_product_field','fulfillment_field')),
  CHECK (length(source_field_key) BETWEEN 1 AND 160)
);

CREATE TABLE IF NOT EXISTS salla_order_transition_state (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  store_id text NOT NULL,
  external_order_id text NOT NULL,
  current_status_id text,
  current_status_slug text,
  completed_at timestamptz,
  latest_event_at timestamptz NOT NULL,
  latest_event_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, store_id, external_order_id)
);

CREATE TABLE IF NOT EXISTS salla_digital_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  store_id text NOT NULL,
  external_order_id text NOT NULL,
  external_order_item_id text NOT NULL,
  product_id text,
  sku text,
  product_name text NOT NULL,
  show_duration boolean NOT NULL DEFAULT false,
  duration_type text,
  duration_days integer,
  lifetime boolean NOT NULL DEFAULT false,
  duration_source text NOT NULL DEFAULT 'unknown',
  duration_matched_text_hash text,
  duration_confidence numeric(4,3),
  duration_status text NOT NULL DEFAULT 'unknown',
  parser_version text,
  model_version text,
  starts_at timestamptz NOT NULL,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  period_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, store_id, external_order_id, external_order_item_id),
  CHECK (duration_days IS NULL OR duration_days BETWEEN 1 AND 36500),
  CHECK (duration_type IS NULL OR duration_type IN ('fixed','lifetime','unknown')),
  CHECK (duration_confidence IS NULL OR duration_confidence BETWEEN 0 AND 1),
  CHECK (duration_source IN ('manual_override','delivery_content','item_options','item_title_snapshot','product_title','product_description','unknown')),
  CHECK (duration_status IN ('resolved','ambiguous','unknown','active','expired','revoked','lifetime')),
  CHECK (status IN ('active','expired','revoked'))
);

ALTER TABLE salla_public_pages
  ADD COLUMN IF NOT EXISTS store_id text,
  ADD COLUMN IF NOT EXISTS secure_payload_ciphertext text,
  ADD COLUMN IF NOT EXISTS max_views integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoke_reason text;

ALTER TABLE salla_public_pages DROP CONSTRAINT IF EXISTS salla_public_pages_view_limit_check;
ALTER TABLE salla_public_pages ADD CONSTRAINT salla_public_pages_view_limit_check
  CHECK (max_views BETWEEN 1 AND 10000 AND view_count >= 0);

ALTER TABLE salla_template_deliveries
  ADD COLUMN IF NOT EXISTS external_order_item_id text,
  ADD COLUMN IF NOT EXISTS completed_transition_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS salla_template_delivery_item_transition_uidx
  ON salla_template_deliveries (
    tenant_id,template_key,external_order_id,COALESCE(external_order_item_id,''),channel,completed_transition_at
  )
  WHERE completed_transition_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS salla_delivery_entitlements_lookup_idx
  ON salla_digital_entitlements(tenant_id,store_id,external_order_id,status);

COMMENT ON TABLE salla_delivery_source_configs IS
  'Single explicitly trusted Salla order field used for customer-facing digital delivery content.';
COMMENT ON COLUMN salla_public_pages.secure_payload_ciphertext IS
  'AES-GCM encrypted customer delivery payload. Sensitive values must not be stored in payload_snapshot.';
