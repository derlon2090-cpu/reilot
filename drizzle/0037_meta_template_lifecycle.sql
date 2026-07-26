ALTER TABLE meta_message_templates
  ADD COLUMN IF NOT EXISTS waba_id text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'LOCAL_DRAFT',
  ADD COLUMN IF NOT EXISTS raw_meta_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE meta_message_templates template
SET waba_id = channel.waba_id,
    display_name = COALESCE(template.display_name, template.template_name)
FROM whatsapp_channels channel
WHERE channel.id = template.meta_integration_id
  AND channel.tenant_id = template.tenant_id
  AND (template.waba_id IS NULL OR template.display_name IS NULL);

ALTER TABLE meta_message_templates
  DROP CONSTRAINT IF EXISTS meta_message_templates_local_status_check,
  DROP CONSTRAINT IF EXISTS meta_message_templates_tenant_id_template_name_language_key,
  DROP CONSTRAINT IF EXISTS meta_message_templates_source_check;

ALTER TABLE meta_message_templates
  ADD CONSTRAINT meta_message_templates_local_status_check CHECK (local_status IN (
    'draft','submitting','pending','approved','rejected','paused','disabled',
    'pending_deletion','deleted','unknown','error'
  )),
  ADD CONSTRAINT meta_message_templates_source_check CHECK (source IN ('LOCAL_DRAFT','META'));

CREATE UNIQUE INDEX IF NOT EXISTS meta_message_templates_waba_meta_unique
  ON meta_message_templates(waba_id, meta_template_id)
  WHERE waba_id IS NOT NULL AND meta_template_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS meta_message_templates_waba_name_language_unique
  ON meta_message_templates(waba_id, template_name, language)
  WHERE waba_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS meta_message_templates_integration_sync_idx
  ON meta_message_templates(meta_integration_id, last_synced_at DESC)
  WHERE deleted_at IS NULL;
