ALTER TABLE tenant_salla_templates
  ADD COLUMN IF NOT EXISTS whatsapp_content text,
  ADD COLUMN IF NOT EXISTS email_text_content text,
  ADD COLUMN IF NOT EXISTS email_html_content text,
  ADD COLUMN IF NOT EXISTS email_image_url text,
  ADD COLUMN IF NOT EXISTS email_image_alt text,
  ADD COLUMN IF NOT EXISTS review_delay_minutes integer NOT NULL DEFAULT 1440;

UPDATE tenant_salla_templates
   SET whatsapp_content = COALESCE(whatsapp_content, message_body),
       email_text_content = COALESCE(email_text_content, message_body),
       email_html_content = COALESCE(email_html_content, message_body)
 WHERE whatsapp_content IS NULL
    OR email_text_content IS NULL
    OR email_html_content IS NULL;

ALTER TABLE tenant_salla_templates DROP CONSTRAINT IF EXISTS tenant_salla_templates_trigger_type_check;
ALTER TABLE tenant_salla_templates ADD CONSTRAINT tenant_salla_templates_trigger_type_check
  CHECK (trigger_type IN ('abandoned_cart', 'order_status', 'invoice_event', 'event'));

ALTER TABLE tenant_salla_templates DROP CONSTRAINT IF EXISTS tenant_salla_templates_review_delay_check;
ALTER TABLE tenant_salla_templates ADD CONSTRAINT tenant_salla_templates_review_delay_check
  CHECK (review_delay_minutes BETWEEN 5 AND 43200);

CREATE TABLE IF NOT EXISTS salla_template_entity_state (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  external_entity_id text NOT NULL,
  latest_event_at timestamptz NOT NULL,
  latest_event_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, template_key, external_entity_id)
);

CREATE INDEX IF NOT EXISTS salla_template_entity_state_tenant_idx
  ON salla_template_entity_state(tenant_id, updated_at DESC);

COMMENT ON TABLE salla_template_entity_state IS
  'Per-tenant event watermark used to reject stale Salla status transitions without deleting delivery history.';
