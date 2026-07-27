ALTER TABLE platform_plans
  ADD COLUMN IF NOT EXISTS order_links_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaigns_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS automation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_api_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS salla_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_pricing boolean NOT NULL DEFAULT false;

UPDATE platform_plans
SET name = CASE slug
      WHEN 'free' THEN 'المجانية' WHEN 'trial' THEN 'المجانية'
      WHEN 'starter' THEN 'الأساسية' WHEN 'business' THEN 'الاحترافية'
      WHEN 'pro' THEN 'الأعمال' ELSE name END,
    monthly_price_sar = CASE slug WHEN 'free' THEN 0 WHEN 'trial' THEN 0 WHEN 'starter' THEN 25 WHEN 'business' THEN 79 WHEN 'pro' THEN 0 ELSE monthly_price_sar END,
    yearly_price_sar = CASE slug WHEN 'free' THEN 0 WHEN 'trial' THEN 0 WHEN 'starter' THEN 250 WHEN 'business' THEN 790 WHEN 'pro' THEN 0 ELSE yearly_price_sar END,
    message_limit = CASE slug WHEN 'free' THEN 50 WHEN 'trial' THEN 50 WHEN 'starter' THEN 500 WHEN 'business' THEN 2500 WHEN 'pro' THEN -1 ELSE message_limit END,
    monthly_message_limit = CASE slug WHEN 'free' THEN 50 WHEN 'trial' THEN 50 WHEN 'starter' THEN 500 WHEN 'business' THEN 2500 WHEN 'pro' THEN -1 ELSE monthly_message_limit END,
    email_message_limit = CASE slug WHEN 'free' THEN 50 WHEN 'trial' THEN 50 WHEN 'starter' THEN 500 WHEN 'business' THEN 2500 WHEN 'pro' THEN -1 ELSE email_message_limit END,
    whatsapp_message_limit = -1,
    whatsapp_channels_limit = CASE slug WHEN 'free' THEN 0 WHEN 'trial' THEN 0 WHEN 'starter' THEN 1 WHEN 'business' THEN 4 WHEN 'pro' THEN 20 ELSE whatsapp_channels_limit END,
    customers_limit = CASE slug WHEN 'free' THEN 1 WHEN 'trial' THEN 1 WHEN 'starter' THEN 20 WHEN 'business' THEN 250 WHEN 'pro' THEN -1 ELSE customers_limit END,
    users_limit = CASE slug WHEN 'free' THEN 1 WHEN 'trial' THEN 1 WHEN 'starter' THEN 2 WHEN 'business' THEN 5 WHEN 'pro' THEN 25 ELSE users_limit END,
    storage_limit_mb = CASE slug WHEN 'free' THEN 1 WHEN 'trial' THEN 1 WHEN 'starter' THEN 100 WHEN 'business' THEN 1024 WHEN 'pro' THEN 5120 ELSE storage_limit_mb END,
    order_links_limit = CASE slug WHEN 'free' THEN 0 WHEN 'trial' THEN 0 WHEN 'starter' THEN 100 WHEN 'business' THEN 1000 WHEN 'pro' THEN -1 ELSE order_links_limit END,
    campaigns_enabled = slug IN ('business','pro'),
    automation_enabled = slug IN ('business','pro'),
    custom_api_enabled = slug IN ('free','trial','starter','business','pro'),
    salla_enabled = slug IN ('starter','business','pro'),
    custom_pricing = slug = 'pro',
    features = CASE slug
      WHEN 'free' THEN '["1 MB تخزين قاعدة البيانات","50 رسالة بريد شهريًا فقط","ربط API متاح","قسم الحملات مغلق","لا يوجد واتساب رسمي","لا تشمل إرسال معلومات الطلب"]'::jsonb
      WHEN 'trial' THEN '["1 MB تخزين قاعدة البيانات","50 رسالة بريد شهريًا فقط","ربط API متاح","قسم الحملات مغلق","لا يوجد واتساب رسمي","لا تشمل إرسال معلومات الطلب"]'::jsonb
      WHEN 'starter' THEN '["100 MB تخزين قاعدة البيانات","500 رسالة بريد شهريًا","ربط API متاح","جهاز واتساب رسمي واحد","السلات المتروكة","حالات الطلب","100 رابط خاص للفاتورة أو تم التنفيذ","إرسال معلومات الطلب"]'::jsonb
      WHEN 'business' THEN '["1 GB تخزين قاعدة البيانات","2,500 رسالة بريد شهريًا","ربط API متاح","حتى 4 أجهزة / أرقام واتساب رسمية","الحملات والأتمتة","إعادة استهداف العملاء","السلات المتروكة وحالات الطلب","1,000 رابط خاص","تقارير وتحليلات متقدمة","دعم فني مخصص"]'::jsonb
      WHEN 'pro' THEN '["5 GB تخزين قاعدة البيانات","رسائل بريد حسب الاستخدام","ربط API و Webhooks مخصص","أجهزة / أرقام واتساب متعددة","الحملات والأتمتة","إعادة استهداف العملاء","إرسال معلومات الطلب","إعدادات مخصصة وصلاحيات فريق"]'::jsonb
      ELSE features END,
    updated_at = now()
WHERE slug IN ('free','trial','starter','business','pro');

UPDATE platform_plans SET is_active = false, updated_at = now() WHERE slug = 'trial';

UPDATE message_usage_periods period
SET message_limit = plan.email_message_limit,
    email_message_limit = plan.email_message_limit,
    whatsapp_message_limit = -1,
    updated_at = now()
FROM platform_plans plan
WHERE plan.id = period.plan_id AND plan.slug IN ('free','trial','starter','business','pro');
