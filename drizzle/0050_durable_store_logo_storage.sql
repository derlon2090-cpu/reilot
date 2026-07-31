ALTER TABLE order_link_profiles
  ADD COLUMN IF NOT EXISTS logo_data bytea,
  ADD COLUMN IF NOT EXISTS logo_content_type text,
  ADD COLUMN IF NOT EXISTS logo_updated_at timestamptz;

COMMENT ON COLUMN order_link_profiles.logo_data IS
  'Durable database fallback for tenant store branding when managed blob storage is unavailable.';

COMMENT ON COLUMN order_link_profiles.logo_content_type IS
  'Validated MIME type for the database-backed store logo.';
