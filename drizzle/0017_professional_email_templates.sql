ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS store_name text;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS theme_color text NOT NULL DEFAULT '#0EA5A8';
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS content_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS button_label text;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS footer_text text;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS template_version integer NOT NULL DEFAULT 1;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS is_system_default boolean NOT NULL DEFAULT false;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS template_snapshot jsonb;

CREATE INDEX IF NOT EXISTS notification_templates_tenant_channel_trigger_idx
  ON notification_templates(tenant_id, channel, trigger_type, updated_at DESC);
