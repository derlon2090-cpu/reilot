ALTER TABLE admin_message_templates
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE salla_public_pages
  DROP CONSTRAINT IF EXISTS salla_public_pages_page_type_check;

ALTER TABLE salla_public_pages
  ADD CONSTRAINT salla_public_pages_page_type_check
  CHECK (page_type IN ('order', 'invoice', 'digital'));

COMMENT ON COLUMN admin_message_templates.settings IS
  'Safe presentation defaults for platform-managed Salla templates (CTA and secure-link page options).';
