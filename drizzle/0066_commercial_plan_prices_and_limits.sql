-- Keep every commercial surface and every enforced quota on the same catalog values.
UPDATE platform_plans
SET monthly_price_sar = CASE slug
      WHEN 'starter' THEN 30
      WHEN 'professional' THEN 79
      WHEN 'business' THEN 189
      WHEN 'enterprise' THEN 0
      ELSE monthly_price_sar END,
    yearly_price_sar = CASE slug
      WHEN 'starter' THEN 300
      WHEN 'professional' THEN 790
      WHEN 'business' THEN 1890
      WHEN 'enterprise' THEN 0
      ELSE yearly_price_sar END,
    message_limit = CASE slug
      WHEN 'starter' THEN 500
      WHEN 'professional' THEN 2500
      WHEN 'business' THEN -1
      WHEN 'enterprise' THEN -1
      ELSE message_limit END,
    monthly_message_limit = CASE slug
      WHEN 'starter' THEN 500
      WHEN 'professional' THEN 2500
      WHEN 'business' THEN -1
      WHEN 'enterprise' THEN -1
      ELSE monthly_message_limit END,
    email_message_limit = CASE slug
      WHEN 'starter' THEN 500
      WHEN 'professional' THEN 2500
      WHEN 'business' THEN -1
      WHEN 'enterprise' THEN -1
      ELSE email_message_limit END,
    whatsapp_message_limit = -1,
    whatsapp_channels_limit = CASE slug
      WHEN 'starter' THEN 1
      WHEN 'professional' THEN 4
      WHEN 'business' THEN -1
      WHEN 'enterprise' THEN -1
      ELSE whatsapp_channels_limit END,
    customers_limit = CASE slug
      WHEN 'starter' THEN 150
      WHEN 'professional' THEN 1000
      WHEN 'business' THEN 5000
      WHEN 'enterprise' THEN -1
      ELSE customers_limit END,
    users_limit = CASE slug
      WHEN 'starter' THEN 2
      WHEN 'professional' THEN 5
      WHEN 'business' THEN -1
      WHEN 'enterprise' THEN -1
      ELSE users_limit END,
    storage_limit_mb = CASE slug
      WHEN 'starter' THEN 100
      WHEN 'professional' THEN 1024
      WHEN 'business' THEN 5120
      WHEN 'enterprise' THEN -1
      ELSE storage_limit_mb END,
    order_links_limit = CASE slug
      WHEN 'starter' THEN 100
      WHEN 'professional' THEN 1000
      WHEN 'business' THEN -1
      WHEN 'enterprise' THEN -1
      ELSE order_links_limit END,
    campaigns_enabled = slug <> 'starter',
    automation_enabled = slug <> 'starter',
    custom_api_enabled = true,
    salla_enabled = true,
    popular = slug = 'professional',
    contact_sales = slug = 'enterprise',
    custom_pricing = slug = 'enterprise',
    display_order = CASE slug
      WHEN 'starter' THEN 1
      WHEN 'professional' THEN 2
      WHEN 'business' THEN 3
      WHEN 'enterprise' THEN 4
      ELSE display_order END,
    updated_at = now()
WHERE slug IN ('starter','professional','business','enterprise');

-- Enterprise was introduced after the entitlement table. Seed its complete feature
-- set from Business first, then normalize every enforced commercial capacity below.
INSERT INTO billing_plan_entitlements
  (plan_id,feature_key,enabled,limit_value,limit_unit,overage_allowed,overage_price,metadata_json)
SELECT enterprise.id,source.feature_key,source.enabled,source.limit_value,source.limit_unit,
       source.overage_allowed,source.overage_price,source.metadata_json
  FROM platform_plans enterprise
  JOIN platform_plans business ON business.slug='business'
  JOIN billing_plan_entitlements source ON source.plan_id=business.id
 WHERE enterprise.slug='enterprise'
ON CONFLICT (plan_id,feature_key) DO UPDATE SET
  enabled=EXCLUDED.enabled,
  limit_value=EXCLUDED.limit_value,
  limit_unit=EXCLUDED.limit_unit,
  overage_allowed=EXCLUDED.overage_allowed,
  overage_price=EXCLUDED.overage_price,
  metadata_json=EXCLUDED.metadata_json,
  updated_at=now();

WITH commercial_limits(slug,feature_key,enabled,limit_value,limit_unit) AS (
  VALUES
    ('starter','database_storage_bytes',true,104857600::bigint,'byte'),
    ('starter','renewal_customers',true,150::bigint,'customer'),
    ('starter','email_messages_monthly',true,500::bigint,'message/month'),
    ('starter','official_whatsapp_devices',true,1::bigint,'device'),
    ('starter','invoice_links_monthly',true,100::bigint,'link/month'),
    ('starter','team_members',true,2::bigint,'member'),
    ('starter','campaigns',false,0::bigint,'boolean'),
    ('starter','automation',false,0::bigint,'boolean'),

    ('professional','database_storage_bytes',true,1073741824::bigint,'byte'),
    ('professional','renewal_customers',true,1000::bigint,'customer'),
    ('professional','email_messages_monthly',true,2500::bigint,'message/month'),
    ('professional','official_whatsapp_devices',true,4::bigint,'device'),
    ('professional','invoice_links_monthly',true,1000::bigint,'link/month'),
    ('professional','team_members',true,5::bigint,'member'),
    ('professional','campaigns',true,1::bigint,'boolean'),
    ('professional','automation',true,1::bigint,'boolean'),

    ('business','database_storage_bytes',true,5368709120::bigint,'byte'),
    ('business','renewal_customers',true,5000::bigint,'customer'),
    ('business','email_messages_monthly',true,-1::bigint,'message/month'),
    ('business','official_whatsapp_devices',true,-1::bigint,'device'),
    ('business','invoice_links_monthly',true,-1::bigint,'link/month'),
    ('business','team_members',true,-1::bigint,'member'),
    ('business','campaigns',true,1::bigint,'boolean'),
    ('business','automation',true,1::bigint,'boolean'),

    ('enterprise','database_storage_bytes',true,-1::bigint,'byte'),
    ('enterprise','renewal_customers',true,-1::bigint,'customer'),
    ('enterprise','email_messages_monthly',true,-1::bigint,'message/month'),
    ('enterprise','official_whatsapp_devices',true,-1::bigint,'device'),
    ('enterprise','invoice_links_monthly',true,-1::bigint,'link/month'),
    ('enterprise','team_members',true,-1::bigint,'member'),
    ('enterprise','campaigns',true,1::bigint,'boolean'),
    ('enterprise','automation',true,1::bigint,'boolean')
)
INSERT INTO billing_plan_entitlements
  (plan_id,feature_key,enabled,limit_value,limit_unit)
SELECT plan.id,limits.feature_key,limits.enabled,limits.limit_value,limits.limit_unit
  FROM commercial_limits limits
  JOIN platform_plans plan ON plan.slug=limits.slug
ON CONFLICT (plan_id,feature_key) DO UPDATE SET
  enabled=EXCLUDED.enabled,
  limit_value=EXCLUDED.limit_value,
  limit_unit=EXCLUDED.limit_unit,
  updated_at=now();
