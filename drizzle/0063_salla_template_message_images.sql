CREATE TABLE IF NOT EXISTS tenant_salla_template_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  image_url text NOT NULL,
  image_data bytea,
  image_content_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_key),
  CHECK (length(template_key) BETWEEN 1 AND 120),
  CHECK (image_content_type IS NULL OR image_content_type IN ('image/png', 'image/jpeg', 'image/webp')),
  CHECK ((image_data IS NULL AND image_content_type IS NULL) OR (image_data IS NOT NULL AND image_content_type IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS tenant_salla_template_images_tenant_idx
  ON tenant_salla_template_images(tenant_id, updated_at DESC);

COMMENT ON TABLE tenant_salla_template_images IS
  'Public message images saved independently for each tenant Salla template; never reuses or overwrites the store logo.';
