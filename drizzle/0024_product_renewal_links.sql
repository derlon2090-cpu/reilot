ALTER TABLE product_plan_mappings
  ADD COLUMN IF NOT EXISTS renewal_link_mode text NOT NULL DEFAULT 'manual';

DO $$ BEGIN
  ALTER TABLE product_plan_mappings ADD CONSTRAINT product_plan_mappings_renewal_link_mode_check
    CHECK (renewal_link_mode IN ('automatic','manual'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE salla_products ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE salla_products ADD COLUMN IF NOT EXISTS customer_url text;
ALTER TABLE salla_products ADD COLUMN IF NOT EXISTS source_updated_at timestamptz;
ALTER TABLE salla_products ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS product_renewal_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_mapping_id uuid NOT NULL REFERENCES product_plan_mappings(id) ON DELETE CASCADE,
  label text NOT NULL,
  customer_note text,
  link_mode text NOT NULL,
  manual_url text,
  target_salla_product_id text,
  target_salla_variant_id text,
  target_salla_sku text,
  resolved_url text,
  resolved_url_source text,
  last_synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'pending',
  sync_error_code text,
  duration_value integer NOT NULL,
  duration_unit text NOT NULL,
  show_in_portal boolean NOT NULL DEFAULT true,
  show_in_whatsapp boolean NOT NULL DEFAULT false,
  show_in_email boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_renewal_options_link_mode_check CHECK (link_mode IN ('automatic','manual')),
  CONSTRAINT product_renewal_options_duration_check CHECK (duration_value > 0 AND duration_unit IN ('day','month','year')),
  CONSTRAINT product_renewal_options_source_check CHECK (
    (link_mode='manual' AND manual_url IS NOT NULL) OR
    (link_mode='automatic' AND (target_salla_product_id IS NOT NULL OR target_salla_variant_id IS NOT NULL))
  )
);
CREATE INDEX IF NOT EXISTS product_renewal_options_mapping_idx
  ON product_renewal_options(tenant_id,product_mapping_id,sort_order) WHERE is_active;
CREATE INDEX IF NOT EXISTS product_renewal_options_target_idx
  ON product_renewal_options(tenant_id,target_salla_variant_id,target_salla_product_id,target_salla_sku)
  WHERE link_mode='automatic';

CREATE TABLE IF NOT EXISTS renewal_redirect_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
  renewal_option_id uuid NOT NULL REFERENCES product_renewal_options(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  click_count integer NOT NULL DEFAULT 0,
  first_clicked_at timestamptz,
  last_clicked_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT renewal_redirect_links_status_check CHECK (status IN ('active','revoked','expired'))
);
CREATE INDEX IF NOT EXISTS renewal_redirect_links_subscription_idx
  ON renewal_redirect_links(tenant_id,subscription_id,renewal_option_id,status);
