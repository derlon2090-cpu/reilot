INSERT INTO platform_plans (
  name,
  slug,
  monthly_price_sar,
  yearly_price_sar,
  message_limit,
  whatsapp_channels_limit,
  customers_limit,
  users_limit,
  features,
  is_active
) VALUES
(
  'Trial',
  'trial',
  0,
  0,
  50,
  1,
  20,
  1,
  '["تجربة لمدة 7 أيام", "قناة واتساب واحدة", "50 رسالة", "20 عميل"]'::jsonb,
  true
),
(
  'Starter',
  'starter',
  199,
  1990,
  500,
  1,
  300,
  2,
  '["قناة واتساب واحدة", "500 رسالة شهريًا", "حتى 300 عميل", "تنبيهات التجديد الأساسية", "صفحة تتبع العميل", "قوالب رسائل جاهزة", "دعم عبر البريد"]'::jsonb,
  true
),
(
  'Pro',
  'pro',
  299,
  2990,
  3000,
  1,
  1500,
  5,
  '["قناة واتساب واحدة", "3000 رسالة شهريًا", "حتى 1500 عميل", "تنبيهات تلقائية متقدمة", "مركز ضمان", "قوالب رسائل مخصصة", "تقارير وتحليلات", "اقتراحات رسائل بالذكاء الاصطناعي", "دعم أولوية"]'::jsonb,
  true
),
(
  'Business',
  'business',
  499,
  4990,
  10000,
  2,
  5000,
  15,
  '["قناتان واتساب", "10000 رسالة شهريًا", "حتى 5000 عميل", "فريق وصلاحيات", "تقارير متقدمة", "API لاحقًا", "مركز ضمان متقدم", "دعم أولوية"]'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  monthly_price_sar = EXCLUDED.monthly_price_sar,
  yearly_price_sar = EXCLUDED.yearly_price_sar,
  message_limit = EXCLUDED.message_limit,
  whatsapp_channels_limit = EXCLUDED.whatsapp_channels_limit,
  customers_limit = EXCLUDED.customers_limit,
  users_limit = EXCLUDED.users_limit,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  updated_at = now();
