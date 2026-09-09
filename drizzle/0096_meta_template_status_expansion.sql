ALTER TABLE meta_message_templates
  ADD COLUMN IF NOT EXISTS last_meta_event jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE meta_message_templates
  DROP CONSTRAINT IF EXISTS meta_message_templates_local_status_check;

ALTER TABLE meta_message_templates
  ADD CONSTRAINT meta_message_templates_local_status_check CHECK (local_status IN (
    'draft','submitting','pending','approved','rejected','flagged','in_appeal',
    'paused','disabled','pending_deletion','deleted','unknown','error','sync_error'
  ));

COMMENT ON COLUMN meta_message_templates.last_meta_event IS
  'Most recent verified Meta webhook event retained separately from synchronization payloads.';
