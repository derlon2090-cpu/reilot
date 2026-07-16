CREATE TABLE IF NOT EXISTS order_link_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  store_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  default_template_style text NOT NULL DEFAULT 'classic',
  default_theme_color text NOT NULL DEFAULT '#2563EB',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_link_profiles_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS order_info_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  style text NOT NULL DEFAULT 'classic',
  theme_color text NOT NULL DEFAULT '#2563EB',
  store_name text NOT NULL,
  header_text text,
  footer_text text,
  additional_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  visible_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_info_templates_style_check CHECK (style IN ('classic', 'modern', 'professional', 'minimal', 'premium', 'colorful'))
);

CREATE TABLE IF NOT EXISTS order_info_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id uuid REFERENCES order_info_templates(id) ON DELETE SET NULL,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  order_number text NOT NULL,
  public_token text NOT NULL UNIQUE,
  public_url text NOT NULL,
  send_method text NOT NULL DEFAULT 'copy',
  status text NOT NULL DEFAULT 'active',
  opened_count integer NOT NULL DEFAULT 0,
  last_opened_at timestamptz,
  sent_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_info_links_status_check CHECK (status IN ('active', 'expired', 'disabled', 'archived')),
  CONSTRAINT order_info_links_send_method_check CHECK (send_method IN ('copy', 'whatsapp', 'email'))
);

CREATE TABLE IF NOT EXISTS order_link_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_info_link_id uuid NOT NULL REFERENCES order_info_links(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_link_events_type_check CHECK (event_type IN (
    'created', 'copied', 'sent_whatsapp', 'sent_email', 'opened',
    'order_checked', 'expired', 'disabled', 'archived'
  ))
);

CREATE INDEX IF NOT EXISTS idx_order_link_profiles_tenant
  ON order_link_profiles(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_link_profiles_slug_lower
  ON order_link_profiles(lower(slug));
CREATE INDEX IF NOT EXISTS idx_order_info_templates_tenant_active
  ON order_info_templates(tenant_id, is_active, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_info_templates_default
  ON order_info_templates(tenant_id) WHERE is_default = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_order_info_links_tenant_created
  ON order_info_links(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_info_links_public_lookup
  ON order_info_links(order_number, public_token, status);
CREATE INDEX IF NOT EXISTS idx_order_info_links_subscription
  ON order_info_links(subscription_id);
CREATE INDEX IF NOT EXISTS idx_order_link_events_link_created
  ON order_link_events(order_info_link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_link_events_tenant_type
  ON order_link_events(tenant_id, event_type, created_at DESC);
