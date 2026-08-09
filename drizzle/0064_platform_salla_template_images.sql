CREATE TABLE IF NOT EXISTS platform_salla_template_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  image_url text NOT NULL,
  image_data bytea,
  image_content_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(template_key) BETWEEN 1 AND 120),
  CHECK (image_content_type IS NULL OR image_content_type IN ('image/png', 'image/jpeg', 'image/webp')),
  CHECK ((image_data IS NULL AND image_content_type IS NULL) OR (image_data IS NOT NULL AND image_content_type IS NOT NULL))
);

COMMENT ON TABLE platform_salla_template_images IS
  'Public WhatsApp message images saved independently for each platform Salla template default.';
