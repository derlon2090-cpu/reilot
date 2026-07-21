ALTER TABLE notification_templates DROP CONSTRAINT IF EXISTS notification_templates_trigger_type_check;
ALTER TABLE notification_templates ADD CONSTRAINT notification_templates_trigger_type_check
  CHECK (trigger_type IN ('before_expiry','on_expiry','after_expiry','manual','order_information','order_fulfilled'));

INSERT INTO notification_templates
  (tenant_id,template_key,template_group,name,channel,trigger_type,title,body,variables,
   content_json,button_label,footer_text,is_system_default,is_active)
SELECT tenant.id,'whatsapp_menu','whatsapp_menu','قائمة واتساب','whatsapp','manual',NULL,
  E'مرحبًا {{customer_name}}،\n\nاختر الخدمة التي تحتاجها من القائمة التالية.',
  '["customer_name","store_name"]'::jsonb,
  '{"sections":[{"title":"الخدمات","rows":[{"id":"subscriptions","title":"اشتراكاتي","description":"عرض الاشتراكات الحالية"},{"id":"renewal","title":"التجديد","description":"مراجعة خيارات التجديد"},{"id":"support","title":"الدعم","description":"التواصل مع فريق الدعم"}]}]}'::jsonb,
  'عرض القائمة','Renvix',true,true
FROM tenants tenant ON CONFLICT (tenant_id,template_key) DO NOTHING;

INSERT INTO notification_templates
  (tenant_id,template_key,template_group,name,channel,trigger_type,title,body,variables,
   content_json,button_label,footer_text,is_system_default,is_active)
SELECT tenant.id,'email_delivery','order_delivery','قالب قناة إرسال بريد','email','order_information',
  'معلومات طلبك رقم {{order_number}} جاهزة',
  E'مرحبًا {{customer_name}}،\n\nتم تجهيز معلومات طلبك رقم {{order_number}} ويمكنك مراجعة التفاصيل من الزر التالي.',
  '["customer_name","order_number","order_portal_url","store_name"]'::jsonb,
  '{}'::jsonb,'عرض معلومات الطلب','شكرًا لاختيارك {{store_name}}',true,true
FROM tenants tenant ON CONFLICT (tenant_id,template_key) DO NOTHING;

INSERT INTO notification_templates
  (tenant_id,template_key,template_group,name,channel,trigger_type,title,body,variables,
   content_json,button_label,footer_text,is_system_default,is_active)
SELECT tenant.id,'salla_fulfilled','salla_fulfillment','قالب تم التنفيذ — سلة','whatsapp','order_fulfilled',NULL,
  E'مرحبًا {{customer_name}}،\n\nتم تجهيز معلومات طلبك رقم {{order_number}}.\n\nيمكنك مراجعة تفاصيل الطلب من الرابط التالي:',
  '["customer_name","order_number","order_portal_url","store_name"]'::jsonb,
  '{"lockedPortalLink":true}'::jsonb,'عرض معلومات الطلب','Renvix',true,true
FROM tenants tenant ON CONFLICT (tenant_id,template_key) DO NOTHING;
