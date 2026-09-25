CREATE TABLE IF NOT EXISTS tenant_campaign_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  image_data bytea,
  image_content_type text,
  original_name text NOT NULL,
  size_bytes bigint NOT NULL,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (image_content_type IS NULL OR image_content_type IN ('image/png', 'image/jpeg', 'image/webp')),
  CHECK ((image_data IS NULL AND image_content_type IS NULL) OR (image_data IS NOT NULL AND image_content_type IS NOT NULL)),
  CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  CHECK (length(original_name) BETWEEN 1 AND 180)
);

CREATE INDEX IF NOT EXISTS tenant_campaign_assets_tenant_created_idx
  ON tenant_campaign_assets(tenant_id, created_at DESC);

COMMENT ON TABLE tenant_campaign_assets IS
  'Tenant-owned campaign card and email hero images, with a database fallback when managed Blob storage is unavailable.';
