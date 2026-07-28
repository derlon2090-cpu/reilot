CREATE TABLE IF NOT EXISTS billing_plan_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES platform_plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  limit_value bigint,
  limit_unit text,
  overage_allowed boolean NOT NULL DEFAULT false,
  overage_price numeric(14,4),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, feature_key)
);

CREATE INDEX IF NOT EXISTS billing_plan_entitlements_feature_idx
  ON billing_plan_entitlements(feature_key, plan_id);

CREATE TABLE IF NOT EXISTS billing_usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES platform_subscriptions(id) ON DELETE SET NULL,
  feature_key text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  used_value bigint NOT NULL DEFAULT 0 CHECK (used_value >= 0),
  reserved_value bigint NOT NULL DEFAULT 0 CHECK (reserved_value >= 0),
  limit_value bigint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, feature_key, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS billing_usage_counters_tenant_period_idx
  ON billing_usage_counters(tenant_id, period_end DESC, feature_key);

ALTER TABLE custom_integration_api_keys
  ADD COLUMN IF NOT EXISTS public_key_id text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS last_used_ip_hash text,
  ADD COLUMN IF NOT EXISTS request_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rotates_key_id uuid REFERENCES custom_integration_api_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grace_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE custom_integration_api_keys key
SET public_key_id = COALESCE(key.public_key_id, replace(key.id::text, '-', '')),
    environment = integration.environment,
    status = CASE
      WHEN key.revoked_at IS NOT NULL THEN 'REVOKED'
      WHEN key.expires_at IS NOT NULL AND key.expires_at <= now() THEN 'EXPIRED'
      ELSE 'ACTIVE'
    END
FROM custom_integrations integration
WHERE integration.id = key.integration_id;

CREATE UNIQUE INDEX IF NOT EXISTS custom_integration_api_keys_public_id_idx
  ON custom_integration_api_keys(public_key_id)
  WHERE public_key_id IS NOT NULL;

ALTER TABLE custom_integration_webhook_endpoints
  ADD COLUMN IF NOT EXISTS secret_key_version integer NOT NULL DEFAULT 1;

WITH plan_features(slug, feature_key, enabled, limit_value, limit_unit) AS (
  VALUES
    ('free','api_access',true,1000,'request/month'),
    ('free','api_requests_monthly',true,1000,'request/month'),
    ('free','api_write_requests_monthly',true,100,'request/month'),
    ('free','custom_webhooks',false,0,'endpoint'),
    ('free','webhook_endpoints',false,0,'endpoint'),
    ('free','webhook_deliveries_monthly',false,0,'delivery/month'),
    ('free','database_storage_bytes',true,0,'byte'),
    ('free','renewal_customers',true,20,'customer'),
    ('free','email_messages_monthly',true,50,'message/month'),
    ('free','official_whatsapp_devices',false,0,'device'),
    ('free','invoice_links_monthly',false,0,'link/month'),
    ('free','order_information_send',false,0,'boolean'),
    ('free','campaigns',false,0,'boolean'),
    ('free','automation',false,0,'boolean'),
    ('free','customer_retargeting',false,0,'boolean'),
    ('free','abandoned_carts',false,0,'boolean'),
    ('free','order_status',false,0,'boolean'),
    ('free','advanced_reports',false,0,'boolean'),
    ('free','team_members',true,1,'member'),

    ('starter','api_access',true,10000,'request/month'),
    ('starter','api_requests_monthly',true,10000,'request/month'),
    ('starter','api_write_requests_monthly',true,2000,'request/month'),
    ('starter','custom_webhooks',false,0,'endpoint'),
    ('starter','webhook_endpoints',false,0,'endpoint'),
    ('starter','webhook_deliveries_monthly',false,0,'delivery/month'),
    ('starter','database_storage_bytes',true,104857600,'byte'),
    ('starter','renewal_customers',true,150,'customer'),
    ('starter','email_messages_monthly',true,500,'message/month'),
    ('starter','official_whatsapp_devices',true,1,'device'),
    ('starter','invoice_links_monthly',true,100,'link/month'),
    ('starter','order_information_send',true,1,'boolean'),
    ('starter','campaigns',false,0,'boolean'),
    ('starter','automation',false,0,'boolean'),
    ('starter','customer_retargeting',false,0,'boolean'),
    ('starter','abandoned_carts',true,1,'boolean'),
    ('starter','order_status',true,1,'boolean'),
    ('starter','advanced_reports',false,0,'boolean'),
    ('starter','team_members',true,2,'member'),

    ('business','api_access',true,100000,'request/month'),
    ('business','api_requests_monthly',true,100000,'request/month'),
    ('business','api_write_requests_monthly',true,25000,'request/month'),
    ('business','custom_webhooks',true,5,'endpoint'),
    ('business','webhook_endpoints',true,5,'endpoint'),
    ('business','webhook_deliveries_monthly',true,100000,'delivery/month'),
    ('business','database_storage_bytes',true,1073741824,'byte'),
    ('business','renewal_customers',true,1000,'customer'),
    ('business','email_messages_monthly',true,2500,'message/month'),
    ('business','official_whatsapp_devices',true,4,'device'),
    ('business','invoice_links_monthly',true,1000,'link/month'),
    ('business','order_information_send',true,1,'boolean'),
    ('business','campaigns',true,1,'boolean'),
    ('business','automation',true,1,'boolean'),
    ('business','customer_retargeting',true,1,'boolean'),
    ('business','abandoned_carts',true,1,'boolean'),
    ('business','order_status',true,1,'boolean'),
    ('business','advanced_reports',true,1,'boolean'),
    ('business','team_members',true,5,'member'),

    ('pro','api_access',true,-1,'request/month'),
    ('pro','api_requests_monthly',true,-1,'request/month'),
    ('pro','api_write_requests_monthly',true,-1,'request/month'),
    ('pro','custom_webhooks',true,-1,'endpoint'),
    ('pro','webhook_endpoints',true,-1,'endpoint'),
    ('pro','webhook_deliveries_monthly',true,-1,'delivery/month'),
    ('pro','database_storage_bytes',true,5368709120,'byte'),
    ('pro','renewal_customers',true,5000,'customer'),
    ('pro','email_messages_monthly',true,-1,'message/month'),
    ('pro','official_whatsapp_devices',true,-1,'device'),
    ('pro','invoice_links_monthly',true,-1,'link/month'),
    ('pro','order_information_send',true,1,'boolean'),
    ('pro','campaigns',true,1,'boolean'),
    ('pro','automation',true,1,'boolean'),
    ('pro','customer_retargeting',true,1,'boolean'),
    ('pro','abandoned_carts',true,1,'boolean'),
    ('pro','order_status',true,1,'boolean'),
    ('pro','advanced_reports',true,1,'boolean'),
    ('pro','team_members',true,-1,'member')
)
INSERT INTO billing_plan_entitlements
  (plan_id, feature_key, enabled, limit_value, limit_unit)
SELECT plan.id, feature.feature_key, feature.enabled, feature.limit_value, feature.limit_unit
FROM plan_features feature
JOIN platform_plans plan ON plan.slug = feature.slug
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  limit_value = EXCLUDED.limit_value,
  limit_unit = EXCLUDED.limit_unit,
  updated_at = now();

UPDATE platform_plans
SET customers_limit = CASE slug
      WHEN 'free' THEN 20 WHEN 'starter' THEN 150
      WHEN 'business' THEN 1000 WHEN 'pro' THEN 5000 ELSE customers_limit END,
    users_limit = CASE slug
      WHEN 'free' THEN 1 WHEN 'starter' THEN 2
      WHEN 'business' THEN 5 WHEN 'pro' THEN -1 ELSE users_limit END,
    storage_limit_mb = CASE slug
      WHEN 'free' THEN 0 WHEN 'starter' THEN 100
      WHEN 'business' THEN 1024 WHEN 'pro' THEN 5120 ELSE storage_limit_mb END,
    whatsapp_channels_limit = CASE slug
      WHEN 'free' THEN 0 WHEN 'starter' THEN 1
      WHEN 'business' THEN 4 WHEN 'pro' THEN -1 ELSE whatsapp_channels_limit END,
    updated_at = now()
WHERE slug IN ('free','starter','business','pro');

-- Trial inherits the free-plan protections and limits when it exists.
INSERT INTO billing_plan_entitlements
  (plan_id, feature_key, enabled, limit_value, limit_unit, overage_allowed, overage_price, metadata_json)
SELECT trial.id, source.feature_key, source.enabled, source.limit_value, source.limit_unit,
       source.overage_allowed, source.overage_price, source.metadata_json
  FROM platform_plans trial
  JOIN platform_plans free_plan ON free_plan.slug='free'
  JOIN billing_plan_entitlements source ON source.plan_id=free_plan.id
 WHERE trial.slug='trial'
ON CONFLICT (plan_id, feature_key) DO UPDATE SET
  enabled=EXCLUDED.enabled,
  limit_value=EXCLUDED.limit_value,
  limit_unit=EXCLUDED.limit_unit,
  updated_at=now();

-- Client localization supplies the Arabic labels; keep persisted names portable.
UPDATE platform_plans
   SET name=CASE slug
     WHEN 'free' THEN 'Free'
     WHEN 'starter' THEN 'Starter'
     WHEN 'business' THEN 'Professional'
     WHEN 'pro' THEN 'Business'
     ELSE name END,
       updated_at=now()
 WHERE slug IN ('free','starter','business','pro');
