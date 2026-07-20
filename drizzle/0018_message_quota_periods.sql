ALTER TABLE platform_plans
  ADD COLUMN IF NOT EXISTS monthly_message_limit integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS whatsapp_message_limit integer,
  ADD COLUMN IF NOT EXISTS email_message_limit integer,
  ADD COLUMN IF NOT EXISTS sms_message_limit integer;

UPDATE platform_plans
SET monthly_message_limit = CASE slug
  WHEN 'free' THEN 50
  WHEN 'trial' THEN 50
  WHEN 'starter' THEN 500
  WHEN 'pro' THEN 2000
  WHEN 'business' THEN 10000
  ELSE COALESCE(NULLIF(message_limit, 0), monthly_message_limit, 50)
END,
message_limit = CASE slug
  WHEN 'free' THEN 50
  WHEN 'trial' THEN 50
  WHEN 'starter' THEN 500
  WHEN 'pro' THEN 2000
  WHEN 'business' THEN 10000
  ELSE COALESCE(NULLIF(message_limit, 0), monthly_message_limit, 50)
END,
updated_at = now();

INSERT INTO platform_plans (
  name, slug, monthly_price_sar, yearly_price_sar, message_limit,
  monthly_message_limit, whatsapp_channels_limit, customers_limit,
  users_limit, storage_limit_mb, features, is_active
) VALUES (
  'Free', 'free', 0, 0, 50, 50, 1, 20, 1, 100,
  '["50 رسالة لكل دورة", "جهاز واتساب واحد", "20 عميلًا"]'::jsonb, true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  message_limit = EXCLUDED.message_limit,
  monthly_message_limit = EXCLUDED.monthly_message_limit,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = now();

CREATE TABLE IF NOT EXISTS message_usage_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform_subscription_id uuid REFERENCES platform_subscriptions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES platform_plans(id) ON DELETE SET NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  message_limit integer NOT NULL DEFAULT 0,
  used_messages integer NOT NULL DEFAULT 0 CHECK (used_messages >= 0),
  reserved_messages integer NOT NULL DEFAULT 0 CHECK (reserved_messages >= 0),
  whatsapp_used integer NOT NULL DEFAULT 0 CHECK (whatsapp_used >= 0),
  email_used integer NOT NULL DEFAULT 0 CHECK (email_used >= 0),
  sms_used integer NOT NULL DEFAULT 0 CHECK (sms_used >= 0),
  last_consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_usage_periods_valid_range CHECK (period_end > period_start),
  UNIQUE (tenant_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS message_usage_periods_tenant_period_idx
  ON message_usage_periods(tenant_id, period_start DESC, period_end DESC);

CREATE INDEX IF NOT EXISTS message_usage_periods_subscription_idx
  ON message_usage_periods(platform_subscription_id);

ALTER TABLE message_queue
  ADD COLUMN IF NOT EXISTS is_billable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quota_status text NOT NULL DEFAULT 'not_reserved',
  ADD COLUMN IF NOT EXISTS quota_period_id uuid REFERENCES message_usage_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quota_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS quota_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS quota_reserved_at timestamptz,
  ADD COLUMN IF NOT EXISTS quota_consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS quota_released_at timestamptz;

ALTER TABLE message_queue DROP CONSTRAINT IF EXISTS message_queue_quota_status_check;
ALTER TABLE message_queue ADD CONSTRAINT message_queue_quota_status_check
  CHECK (quota_status IN ('not_reserved', 'reserved', 'consumed', 'released', 'not_billable'));

CREATE INDEX IF NOT EXISTS message_queue_quota_period_idx
  ON message_queue(quota_period_id, quota_status);

INSERT INTO platform_subscriptions (
  tenant_id, plan_id, status, billing_cycle, current_period_start, current_period_end
)
SELECT t.id, free_plan.id, 'active', 'monthly', now(), now() + interval '1 month'
FROM tenants t
CROSS JOIN LATERAL (
  SELECT id FROM platform_plans WHERE slug = 'free' LIMIT 1
) free_plan
WHERE NOT EXISTS (
  SELECT 1 FROM platform_subscriptions ps
  WHERE ps.tenant_id = t.id AND ps.status IN ('active', 'trial', 'past_due')
);

INSERT INTO message_usage_periods (
  tenant_id, platform_subscription_id, plan_id, period_start, period_end,
  message_limit, used_messages
)
SELECT ps.tenant_id, ps.id, ps.plan_id, ps.current_period_start, ps.current_period_end,
       pp.monthly_message_limit,
       COALESCE((
         SELECT mu.used_messages FROM message_usage mu
         WHERE mu.tenant_id = ps.tenant_id
           AND mu.month = EXTRACT(MONTH FROM current_date)::integer
           AND mu.year = EXTRACT(YEAR FROM current_date)::integer
         LIMIT 1
       ), 0)
FROM platform_subscriptions ps
JOIN platform_plans pp ON pp.id = ps.plan_id
WHERE ps.status IN ('active', 'trial', 'past_due')
  AND ps.current_period_end > ps.current_period_start
ON CONFLICT (tenant_id, period_start, period_end) DO UPDATE SET
  platform_subscription_id = EXCLUDED.platform_subscription_id,
  plan_id = EXCLUDED.plan_id,
  message_limit = EXCLUDED.message_limit,
  updated_at = now();
