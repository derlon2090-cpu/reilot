ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check CHECK (role IN (
  'super_admin', 'operations_admin', 'support_admin', 'billing_admin',
  'security_auditor', 'read_only', 'admin', 'security_admin', 'viewer'
));

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_status_check;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_status_check
  CHECK (status IN ('active', 'suspended', 'disabled', 'locked', 'pending'));

CREATE TABLE IF NOT EXISTS admin_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  channel text NOT NULL CHECK (channel IN ('email', 'evolution_whatsapp')),
  subject text,
  body text NOT NULL,
  allowed_variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system_template boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  updated_by_admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_message_templates_variables_array CHECK (
    jsonb_typeof(allowed_variables) = 'array' AND jsonb_typeof(required_variables) = 'array'
  )
);

CREATE TABLE IF NOT EXISTS admin_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','skipped')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_outbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL REFERENCES admin_message_templates(template_key),
  event_type text NOT NULL,
  event_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('evolution','resend')),
  channel text NOT NULL CHECK (channel IN ('evolution_whatsapp','email')),
  messaging_scope text NOT NULL DEFAULT 'platform_admin' CHECK (messaging_scope = 'platform_admin'),
  billing_scope text NOT NULL DEFAULT 'platform_admin' CHECK (billing_scope = 'platform_admin'),
  credit_status text NOT NULL DEFAULT 'not_applicable' CHECK (credit_status = 'not_applicable'),
  recipient_hash text NOT NULL,
  recipient_encrypted text,
  rendered_subject text,
  rendered_body text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','accepted','sent','delivered','read','failed','skipped')),
  provider_message_id text,
  idempotency_key text NOT NULL UNIQUE,
  is_test_message boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  queued_at timestamptz,
  accepted_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_message_safe text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_messaging_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('evolution','resend')),
  messaging_scope text NOT NULL DEFAULT 'platform_admin' CHECK (messaging_scope = 'platform_admin'),
  display_name text NOT NULL,
  external_channel_id text,
  phone_masked text,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected','connecting','disconnected','error','disabled')),
  provider_version text,
  last_webhook_at timestamptz,
  last_message_at timestamptz,
  last_health_check_at timestamptz,
  last_error_safe text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_channel_id)
);

CREATE TABLE IF NOT EXISTS platform_integration_health (
  provider text PRIMARY KEY,
  status text NOT NULL DEFAULT 'not_configured' CHECK (status IN ('healthy','degraded','error','disabled','not_configured')),
  response_time_ms integer,
  last_checked_at timestamptz,
  last_webhook_at timestamptz,
  error_count integer NOT NULL DEFAULT 0,
  last_error_safe text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_daily_metrics (
  metric_date date PRIMARY KEY,
  stores_count integer NOT NULL DEFAULT 0,
  active_users_count integer NOT NULL DEFAULT 0,
  active_subscriptions_count integer NOT NULL DEFAULT 0,
  messages_accepted integer NOT NULL DEFAULT 0,
  messages_delivered integer NOT NULL DEFAULT 0,
  messages_failed integer NOT NULL DEFAULT 0,
  revenue_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_outbound_messages_status_idx
  ON admin_outbound_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_outbound_messages_event_idx
  ON admin_outbound_messages(event_type, event_id);
CREATE INDEX IF NOT EXISTS admin_event_outbox_pending_idx
  ON admin_event_outbox(status, available_at) WHERE status IN ('pending','failed');

INSERT INTO admin_message_templates
  (template_key,name,description,channel,subject,body,allowed_variables,required_variables)
VALUES
  ('admin_account_created_email','إرسال الحساب للعميل','يرسل بعد إنشاء الحساب ومساحة العمل والاشتراك بنجاح.','email','تم إنشاء حسابك في Renvix',
   E'مرحبًا {{customer_name}}،\n\nتم إنشاء حسابك في Renvix بنجاح.\nالبريد: {{customer_email}}\nكلمة المرور المؤقتة: {{temporary_password}}\nالباقة: {{plan_name}}\nتاريخ الانتهاء: {{subscription_expiry}}\n\nتسجيل الدخول: {{login_url}}\nالدعم: {{support_url}}',
   '["customer_name","customer_email","temporary_password","login_url","plan_name","subscription_expiry","support_url"]'::jsonb,
   '["customer_name","customer_email","temporary_password","login_url","plan_name","subscription_expiry"]'::jsonb),
  ('admin_subscription_renewed','تم التجديد','يرسل فقط بعد تسجيل عملية التجديد وتحديث الاشتراك داخل معاملة ناجحة.','evolution_whatsapp',NULL,
   E'مرحبًا {{customer_name}} 👋\n\nتم تجديد اشتراكك في {{plan_name}} بنجاح 🎉\n\nتاريخ الانتهاء السابق: {{old_expiry}}\nتاريخ الانتهاء الجديد: {{new_expiry}}\n\nإدارة الاشتراك: {{login_url}}',
   '["customer_name","plan_name","store_name","old_expiry","new_expiry","login_url","support_url"]'::jsonb,
   '["customer_name","plan_name","old_expiry","new_expiry"]'::jsonb),
  ('admin_number_disconnected','تم فصل رقمك من الخدمة','يرسل بعد تأكيد الفصل الدائم إلى وسيلة اتصال صالحة.','evolution_whatsapp',NULL,
   E'مرحبًا {{customer_name}}،\n\nتم فصل الرقم {{disconnected_phone}} من خدمة Renvix.\nالسبب: {{disconnect_reason}}\nتاريخ الفصل: {{disconnected_at}}\n\nإعادة الربط: {{reconnect_url}}\nالدعم: {{support_url}}',
   '["customer_name","disconnected_phone","disconnect_reason","disconnected_at","reconnect_url","support_url"]'::jsonb,
   '["customer_name","disconnected_phone","disconnect_reason","disconnected_at","support_url"]'::jsonb),
  ('admin_salla_installed','تم تثبيت سلة','يرسل بعد اكتمال OAuth والتوكن وWebhooks والمزامنة الأولية.','email','تم ربط متجرك على سلة بنجاح',
   E'مرحبًا {{customer_name}}،\n\nتم ربط متجر {{store_name}} بمنصة Renvix بنجاح ✅\nتاريخ الربط: {{connected_at}}\n\nلوحة التحكم: {{dashboard_url}}\nإعدادات سلة: {{integration_settings_url}}\nالدعم: {{support_url}}',
   '["customer_name","store_name","store_domain","connected_at","dashboard_url","integration_settings_url","support_url"]'::jsonb,
   '["customer_name","store_name","connected_at","dashboard_url"]'::jsonb)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  channel = EXCLUDED.channel,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  allowed_variables = EXCLUDED.allowed_variables,
  required_variables = EXCLUDED.required_variables,
  updated_at = now();
