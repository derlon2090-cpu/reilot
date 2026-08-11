CREATE INDEX IF NOT EXISTS platform_subscriptions_renewal_due_idx
  ON platform_subscriptions(status,current_period_end)
  WHERE status='active';

INSERT INTO admin_message_templates
  (template_key,name,description,channel,subject,body,allowed_variables,required_variables,
   is_system_template,is_active)
VALUES (
  'admin_subscription_renewal_reminder',
  'تذكير التجديد',
  'يرسل تلقائيًا قبل 3 أيام من انتهاء اشتراك Renvix النشط، مرة واحدة لكل دورة اشتراك.',
  'email',
  'تذكير: يتبقى {{days_remaining}} أيام على انتهاء اشتراكك',
  E'مرحبًا {{customer_name}}،\n\nنود تذكيرك بأن اشتراك {{plan_name}} الخاص بمتجر {{store_name}} سينتهي بتاريخ {{expiry_date}}، ويتبقى {{days_remaining}} أيام فقط.\n\nجدّد اشتراكك الآن لضمان استمرار الأتمتة والتنبيهات والخدمات دون انقطاع:\n{{renewal_url}}\n\nللمساعدة: {{support_url}}',
  '["customer_name","plan_name","store_name","expiry_date","days_remaining","renewal_url","support_url"]'::jsonb,
  '["customer_name","plan_name","expiry_date","days_remaining","renewal_url"]'::jsonb,
  true,
  true
)
ON CONFLICT (template_key) DO NOTHING;
