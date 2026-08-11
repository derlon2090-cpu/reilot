ALTER TABLE platform_plans
  ADD COLUMN IF NOT EXISTS description_ar text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS popular boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_sales boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 100;

ALTER TABLE platform_subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Preserve plan ids and entitlements while adopting the final commercial slugs.
UPDATE platform_plans SET slug='business_legacy',updated_at=now() WHERE slug='pro';
UPDATE platform_plans SET slug='professional',updated_at=now() WHERE slug='business';
UPDATE platform_plans SET slug='business',updated_at=now() WHERE slug='business_legacy';

UPDATE platform_plans SET
  name='Starter',
  description_ar='للبدء وإدارة الاشتراكات الأساسية',
  popular=false,contact_sales=false,custom_pricing=false,display_order=1,updated_at=now()
WHERE slug='starter';

UPDATE platform_plans SET
  name='Professional',
  description_ar='للأعمال التي تحتاج الحملات والأتمتة وإمكانات أعلى',
  popular=true,contact_sales=false,custom_pricing=false,display_order=2,updated_at=now()
WHERE slug='professional';

UPDATE platform_plans SET
  name='Business',
  description_ar='للأعمال المتنامية والفرق والاستخدام الأكبر',
  popular=false,contact_sales=false,custom_pricing=false,display_order=3,updated_at=now()
WHERE slug='business';

INSERT INTO platform_plans (
  name,slug,monthly_price_sar,yearly_price_sar,message_limit,monthly_message_limit,
  whatsapp_message_limit,email_message_limit,sms_message_limit,whatsapp_channels_limit,
  customers_limit,users_limit,storage_limit_mb,order_links_limit,campaigns_enabled,
  automation_enabled,custom_api_enabled,salla_enabled,custom_pricing,description_ar,
  popular,contact_sales,display_order,features,is_active
)
SELECT 'Enterprise','enterprise',0,0,-1,-1,-1,-1,COALESCE(sms_message_limit,0),-1,
       -1,-1,-1,-1,true,true,true,true,true,
       'حلول مخصصة للشركات والاحتياجات الكبيرة',false,true,4,'[]'::jsonb,true
  FROM platform_plans WHERE slug='business' LIMIT 1
ON CONFLICT (slug) DO UPDATE SET
  name=EXCLUDED.name,description_ar=EXCLUDED.description_ar,custom_pricing=true,
  contact_sales=true,popular=false,display_order=4,is_active=true,updated_at=now();

-- Trial is an account state and never a public/commercial plan card.
UPDATE platform_plans SET is_active=false,display_order=999,updated_at=now() WHERE slug='trial';

UPDATE platform_subscriptions ps
SET plan_id=trial.id,
    status='trial',
    trial_started_at=COALESCE(ps.trial_started_at,ps.created_at),
    trial_ends_at=COALESCE(ps.trial_ends_at,ps.created_at + interval '7 days'),
    current_period_start=COALESCE(ps.trial_started_at,ps.created_at),
    current_period_end=COALESCE(ps.trial_ends_at,ps.created_at + interval '7 days'),
    updated_at=now()
FROM platform_plans current_plan,platform_plans trial
WHERE ps.plan_id=current_plan.id AND current_plan.slug='free' AND trial.slug='trial';

UPDATE platform_subscriptions
SET status='expired',updated_at=now()
WHERE status='trial' AND COALESCE(trial_ends_at,current_period_end) <= now();

-- Keep the referenced legacy row only as an inactive internal record so historical
-- provisioning/audit foreign keys remain valid. It is no longer named or exposed as Free.
UPDATE platform_plans
SET name='Legacy disabled',slug='retired_free',is_active=false,display_order=1000,updated_at=now()
WHERE slug='free';
