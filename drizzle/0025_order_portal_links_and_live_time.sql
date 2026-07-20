ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Riyadh';

ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS template_key text;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS template_group text;
ALTER TABLE order_info_templates ADD COLUMN IF NOT EXISTS template_key text NOT NULL DEFAULT 'order_information_salla';
ALTER TABLE order_info_templates ADD COLUMN IF NOT EXISTS template_group text NOT NULL DEFAULT 'order_information';

UPDATE notification_templates SET template_key=CASE lower(channel)
  WHEN 'whatsapp' THEN 'renewal_whatsapp' WHEN 'email' THEN 'renewal_email' ELSE template_key END,
  template_group=CASE WHEN lower(channel) IN ('whatsapp','email') AND trigger_type='before_expiry' THEN 'renewal' ELSE template_group END
WHERE trigger_type='before_expiry';

CREATE TEMP TABLE renewal_template_singletons ON COMMIT DROP AS
SELECT id AS duplicate_id,keeper_id FROM (
  SELECT id,first_value(id) OVER (PARTITION BY tenant_id,template_key ORDER BY updated_at DESC,created_at DESC,id DESC) AS keeper_id,
    row_number() OVER (PARTITION BY tenant_id,template_key ORDER BY updated_at DESC,created_at DESC,id DESC) AS duplicate_rank
  FROM notification_templates WHERE template_key IN ('renewal_whatsapp','renewal_email')
) ranked WHERE duplicate_rank>1;
UPDATE automation_rules rule SET template_id=singletons.keeper_id
FROM renewal_template_singletons singletons WHERE rule.template_id=singletons.duplicate_id;
UPDATE message_queue queue SET template_id=singletons.keeper_id
FROM renewal_template_singletons singletons WHERE queue.template_id=singletons.duplicate_id;
UPDATE renewal_message_templates template SET source_template_id=singletons.keeper_id
FROM renewal_template_singletons singletons WHERE template.source_template_id=singletons.duplicate_id;
DELETE FROM notification_templates template USING renewal_template_singletons singletons
WHERE template.id=singletons.duplicate_id;
CREATE UNIQUE INDEX IF NOT EXISTS notification_templates_tenant_key_unique
  ON notification_templates(tenant_id,template_key);

ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS duration_value integer;
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS duration_unit text;
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS activated_at timestamptz;
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS activation_source text;
ALTER TABLE customer_subscriptions ADD COLUMN IF NOT EXISTS renewed_at timestamptz;

DO $$ BEGIN
  ALTER TABLE customer_subscriptions ADD CONSTRAINT customer_subscriptions_duration_unit_check
    CHECK (duration_unit IS NULL OR duration_unit IN ('day','month','year'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

WITH subscription_mapping AS (
  SELECT cs.id,ppm.duration_value,ppm.duration_unit,ppm.start_trigger
  FROM customer_subscriptions cs
  JOIN LATERAL (
    SELECT mapping.duration_value,mapping.duration_unit,mapping.start_trigger
    FROM product_plan_mappings mapping
    WHERE mapping.tenant_id=cs.tenant_id
      AND ((cs.salla_variant_id IS NOT NULL AND mapping.salla_variant_id=cs.salla_variant_id)
        OR (mapping.salla_variant_id IS NULL AND mapping.salla_product_id=cs.salla_product_id))
    ORDER BY CASE WHEN cs.salla_variant_id IS NOT NULL AND mapping.salla_variant_id=cs.salla_variant_id THEN 1 ELSE 2 END
    LIMIT 1
  ) ppm ON true
)
UPDATE customer_subscriptions cs SET
  duration_value = COALESCE(cs.duration_value, ppm.duration_value),
  duration_unit = COALESCE(cs.duration_unit, ppm.duration_unit),
  activated_at = COALESCE(cs.activated_at, cs.starts_at),
  activation_source = COALESCE(cs.activation_source, ppm.start_trigger),
  renewed_at = COALESCE(cs.renewed_at, cs.last_renewed_at)
FROM subscription_mapping ppm
WHERE cs.id=ppm.id AND (cs.duration_value IS NULL OR cs.duration_unit IS NULL OR cs.activated_at IS NULL);

ALTER TABLE order_info_links DROP CONSTRAINT IF EXISTS order_info_links_template_link_id_fkey;
ALTER TABLE order_info_links ADD CONSTRAINT order_info_links_template_link_id_fkey
  FOREIGN KEY (template_link_id) REFERENCES order_template_links(id) ON DELETE SET NULL;

CREATE TEMP TABLE order_template_singletons ON COMMIT DROP AS
SELECT id AS duplicate_id,keeper_id FROM (
  SELECT id,first_value(id) OVER (PARTITION BY tenant_id ORDER BY updated_at DESC,created_at DESC,id DESC) AS keeper_id,
    row_number() OVER (PARTITION BY tenant_id ORDER BY updated_at DESC,created_at DESC,id DESC) AS duplicate_rank
  FROM order_info_templates
) ranked WHERE duplicate_rank>1;

UPDATE order_info_links link SET template_link_id=NULL,template_id=singletons.keeper_id,updated_at=now()
FROM order_template_singletons singletons WHERE link.template_id=singletons.duplicate_id;
DELETE FROM order_info_templates template USING order_template_singletons singletons
WHERE template.id=singletons.duplicate_id;

CREATE TEMP TABLE order_link_singletons ON COMMIT DROP AS
SELECT id AS duplicate_id,keeper_id FROM (
  SELECT id,first_value(id) OVER (PARTITION BY tenant_id,subscription_id ORDER BY updated_at DESC,created_at DESC,id DESC) AS keeper_id,
    row_number() OVER (PARTITION BY tenant_id,subscription_id ORDER BY updated_at DESC,created_at DESC,id DESC) AS duplicate_rank
  FROM order_info_links
) ranked WHERE duplicate_rank>1;
UPDATE order_link_events event SET order_info_link_id=singletons.keeper_id
FROM order_link_singletons singletons WHERE event.order_info_link_id=singletons.duplicate_id;
DELETE FROM order_info_links link USING order_link_singletons singletons
WHERE link.id=singletons.duplicate_id;

-- Generic template URLs are retired; every order now receives its own portal credential.
UPDATE order_template_links SET status='archived',updated_at=now() WHERE status='active';

CREATE UNIQUE INDEX IF NOT EXISTS order_info_templates_tenant_singleton
  ON order_info_templates(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS order_info_links_tenant_subscription_unique
  ON order_info_links(tenant_id,subscription_id);

CREATE TABLE IF NOT EXISTS order_portal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_info_link_id uuid NOT NULL REFERENCES order_info_links(id) ON DELETE CASCADE,
  public_id text NOT NULL UNIQUE,
  secret_hash text NOT NULL,
  secret_ciphertext text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  expires_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS order_portal_one_active_link_per_order
  ON order_portal_links(tenant_id,order_info_link_id)
  WHERE revoked_at IS NULL AND status='active';
CREATE INDEX IF NOT EXISTS order_portal_public_lookup
  ON order_portal_links(public_id,secret_hash,status);

INSERT INTO notification_templates
  (tenant_id,template_key,template_group,name,channel,trigger_type,title,body,variables,is_system_default,is_active)
SELECT tenant.id,'renewal_whatsapp','renewal','قالب تجديد الاشتراك — واتساب','whatsapp','before_expiry',NULL,
  E'مرحبًا {{customer_name}}،\n\nنذكّرك بأن اشتراكك في {{service_name}} سينتهي بتاريخ {{expiry_date}}.\n\nيمكنك مراجعة خيارات التجديد من الرابط التالي:\n{{renewal_url}}',
  '["customer_name","service_name","expiry_date","days_remaining","renewal_url","store_name","order_number"]'::jsonb,true,true
FROM tenants tenant ON CONFLICT (tenant_id,template_key) DO NOTHING;
INSERT INTO notification_templates
  (tenant_id,template_key,template_group,name,channel,trigger_type,title,body,variables,is_system_default,is_active)
SELECT tenant.id,'renewal_email','renewal','قالب تجديد الاشتراك — البريد الإلكتروني','email','before_expiry',
  'تذكير بتجديد اشتراكك في {{service_name}}',
  E'مرحبًا {{customer_name}}،\n\nنذكّرك بأن اشتراكك في {{service_name}} سينتهي بتاريخ {{expiry_date}}.\n\nيمكنك مراجعة خيارات التجديد من خلال الزر التالي.',
  '["customer_name","service_name","expiry_date","days_remaining","renewal_url","store_name","order_number"]'::jsonb,true,true
FROM tenants tenant ON CONFLICT (tenant_id,template_key) DO NOTHING;
INSERT INTO order_info_templates
  (tenant_id,template_key,template_group,name,style,theme_color,store_name,header_text,footer_text,
   additional_notes,visible_fields,is_default,is_active)
SELECT tenant.id,'order_information_salla','order_information','قالب معلومات الطلب — سلة','classic','#2563EB',tenant.name,
  'معلومات طلبك أصبحت جاهزة','Renvix','[]'::jsonb,'{}'::jsonb,true,true
FROM tenants tenant ON CONFLICT (tenant_id) DO NOTHING;
