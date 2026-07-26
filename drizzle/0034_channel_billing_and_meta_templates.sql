-- Separate Renvix email quotas from usage-based Meta WhatsApp billing.
ALTER TABLE platform_plans
  ALTER COLUMN whatsapp_message_limit SET DEFAULT -1;

UPDATE platform_plans
SET monthly_price_sar = CASE slug
      WHEN 'starter' THEN 199
      WHEN 'business' THEN 499
      WHEN 'pro' THEN 999
      ELSE monthly_price_sar
    END,
    message_limit = CASE slug
      WHEN 'free' THEN 50
      WHEN 'trial' THEN 50
      WHEN 'starter' THEN 500
      WHEN 'business' THEN 2000
      WHEN 'pro' THEN 10000
      ELSE message_limit
    END,
    monthly_message_limit = CASE slug
      WHEN 'free' THEN 50
      WHEN 'trial' THEN 50
      WHEN 'starter' THEN 500
      WHEN 'business' THEN 2000
      WHEN 'pro' THEN 10000
      ELSE monthly_message_limit
    END,
    email_message_limit = CASE slug
      WHEN 'free' THEN 50
      WHEN 'trial' THEN 50
      WHEN 'starter' THEN 500
      WHEN 'business' THEN 2000
      WHEN 'pro' THEN 10000
      ELSE COALESCE(email_message_limit, monthly_message_limit)
    END,
    whatsapp_message_limit = -1,
    customers_limit = CASE slug
      WHEN 'free' THEN 1
      WHEN 'trial' THEN 1
      WHEN 'starter' THEN 20
      WHEN 'business' THEN 100
      WHEN 'pro' THEN 250
      ELSE customers_limit
    END,
    whatsapp_channels_limit = CASE slug
      WHEN 'free' THEN 1
      WHEN 'trial' THEN 1
      WHEN 'starter' THEN 1
      WHEN 'business' THEN 2
      WHEN 'pro' THEN 10
      ELSE whatsapp_channels_limit
    END,
    storage_limit_mb = CASE slug
      WHEN 'free' THEN 100
      WHEN 'trial' THEN 100
      WHEN 'starter' THEN 1024
      WHEN 'business' THEN 10240
      WHEN 'pro' THEN 51200
      ELSE storage_limit_mb
    END,
    features = CASE slug
      WHEN 'free' THEN '["50 رسالة بريد إلكتروني","عميل واحد","قناة واتساب رسمية واحدة","رسائل واتساب حسب الاستخدام","100 MB تخزين"]'::jsonb
      WHEN 'trial' THEN '["50 رسالة بريد إلكتروني","عميل واحد","قناة واتساب رسمية واحدة","رسائل واتساب حسب الاستخدام","100 MB تخزين"]'::jsonb
      WHEN 'starter' THEN '["500 رسالة بريد إلكتروني","20 عميلًا","جهاز واتساب رسمي واحد","رسائل واتساب حسب الاستخدام","1 GB تخزين","تقارير أساسية"]'::jsonb
      WHEN 'business' THEN '["2,000 رسالة بريد إلكتروني","100 عميل","جهازا واتساب رسميان","رسائل واتساب حسب الاستخدام","10 GB تخزين","حملات وأتمتة"]'::jsonb
      WHEN 'pro' THEN '["10,000 رسالة بريد إلكتروني","250 عميلًا","قنوات واتساب متعددة","رسائل واتساب حسب الاستخدام","50 GB تخزين","تقارير متقدمة"]'::jsonb
      ELSE features
    END,
    updated_at = now()
WHERE slug IN ('free','trial','starter','business','pro');

ALTER TABLE message_usage_periods
  ADD COLUMN IF NOT EXISTS whatsapp_message_limit integer NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS email_message_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sms_message_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_reserved integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_reserved integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sms_reserved integer NOT NULL DEFAULT 0;

UPDATE message_usage_periods period
SET whatsapp_message_limit = -1,
    email_message_limit = COALESCE(plan.email_message_limit, plan.monthly_message_limit, period.message_limit),
    sms_message_limit = COALESCE(plan.sms_message_limit, 0)
FROM platform_plans plan
WHERE plan.id = period.plan_id;

UPDATE message_usage_periods period
SET whatsapp_reserved = COALESCE(queue.whatsapp_reserved, 0),
    email_reserved = COALESCE(queue.email_reserved, 0),
    sms_reserved = COALESCE(queue.sms_reserved, 0),
    reserved_messages = COALESCE(queue.whatsapp_reserved, 0)
      + COALESCE(queue.email_reserved, 0)
      + COALESCE(queue.sms_reserved, 0)
FROM (
  SELECT quota_period_id,
         count(*) FILTER (WHERE channel_type = 'whatsapp')::integer AS whatsapp_reserved,
         count(*) FILTER (WHERE channel_type = 'email')::integer AS email_reserved,
         count(*) FILTER (WHERE channel_type = 'sms')::integer AS sms_reserved
  FROM message_queue
  WHERE quota_status = 'reserved' AND quota_period_id IS NOT NULL
  GROUP BY quota_period_id
) queue
WHERE period.id = queue.quota_period_id;

ALTER TABLE message_usage_periods
  DROP CONSTRAINT IF EXISTS message_usage_periods_whatsapp_reserved_check,
  DROP CONSTRAINT IF EXISTS message_usage_periods_email_reserved_check,
  DROP CONSTRAINT IF EXISTS message_usage_periods_sms_reserved_check;
ALTER TABLE message_usage_periods
  ADD CONSTRAINT message_usage_periods_whatsapp_reserved_check CHECK (whatsapp_reserved >= 0),
  ADD CONSTRAINT message_usage_periods_email_reserved_check CHECK (email_reserved >= 0),
  ADD CONSTRAINT message_usage_periods_sms_reserved_check CHECK (sms_reserved >= 0);

CREATE TABLE IF NOT EXISTS whatsapp_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'SAR',
  available_balance numeric(14,4) NOT NULL DEFAULT 0,
  reserved_balance numeric(14,4) NOT NULL DEFAULT 0,
  total_charged numeric(14,4) NOT NULL DEFAULT 0,
  total_spent numeric(14,4) NOT NULL DEFAULT 0,
  low_balance_threshold numeric(14,4) NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_wallet_non_negative CHECK (
    available_balance >= 0 AND reserved_balance >= 0
    AND total_charged >= 0 AND total_spent >= 0
  )
);

CREATE TABLE IF NOT EXISTS whatsapp_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES whatsapp_wallets(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'top_up','reservation','reservation_release','message_charge',
    'refund','admin_adjustment','payment_reversal'
  )),
  amount numeric(14,4) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'SAR',
  balance_before numeric(14,4) NOT NULL,
  balance_after numeric(14,4) NOT NULL,
  reference_type text,
  reference_id text,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','reversed')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_wallet_transactions_tenant_created_idx
  ON whatsapp_wallet_transactions(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES message_queue(id) ON DELETE CASCADE,
  meta_message_id text,
  usage_source text NOT NULL CHECK (usage_source IN (
    'renewal_reminder','order_information','campaign','manual_message',
    'interactive_message','automation','test_message','other'
  )),
  message_kind text NOT NULL,
  template_category text CHECK (template_category IN ('marketing','utility','authentication')),
  recipient_country_code text,
  status text NOT NULL CHECK (status IN (
    'queued','processing','accepted','sent','delivered','read','failed'
  )),
  estimated_cost numeric(14,6),
  final_cost numeric(14,6),
  currency text NOT NULL DEFAULT 'SAR',
  wallet_transaction_id uuid REFERENCES whatsapp_wallet_transactions(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, message_id)
);
CREATE INDEX IF NOT EXISTS whatsapp_usage_records_tenant_created_idx
  ON whatsapp_usage_records(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_usage_records_meta_message_unique
  ON whatsapp_usage_records(tenant_id, meta_message_id) WHERE meta_message_id IS NOT NULL;

ALTER TABLE whatsapp_channels
  ADD COLUMN IF NOT EXISTS waba_id text,
  ADD COLUMN IF NOT EXISTS phone_number_id text,
  ADD COLUMN IF NOT EXISTS business_account_id text;

CREATE TABLE IF NOT EXISTS meta_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meta_integration_id uuid NOT NULL REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
  meta_template_id text,
  template_name text NOT NULL,
  language text NOT NULL,
  requested_category text NOT NULL CHECK (requested_category IN ('MARKETING','UTILITY','AUTHENTICATION')),
  approved_category text CHECK (approved_category IN ('MARKETING','UTILITY','AUTHENTICATION')),
  components jsonb NOT NULL,
  local_status text NOT NULL DEFAULT 'draft' CHECK (local_status IN (
    'draft','submitting','pending','approved','rejected','paused','disabled','error'
  )),
  meta_status text,
  rejection_reason text,
  quality_rating text,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_name, language)
);
CREATE INDEX IF NOT EXISTS meta_message_templates_tenant_status_idx
  ON meta_message_templates(tenant_id, local_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_interactive_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
  name text NOT NULL,
  interactive_type text NOT NULL CHECK (interactive_type IN ('list','reply_buttons','url_button')),
  definition jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS whatsapp_interactive_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  interactive_message_id uuid NOT NULL REFERENCES whatsapp_interactive_messages(id) ON DELETE CASCADE,
  meta_message_id text,
  sender_e164 text NOT NULL,
  option_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_interactive_replies_tenant_received_idx
  ON whatsapp_interactive_replies(tenant_id, received_at DESC);

UPDATE notification_templates
SET name = 'الرسائل التفاعلية',
    template_group = 'whatsapp_interactive',
    updated_at = now()
WHERE template_key = 'whatsapp_menu' OR name = 'قائمة واتساب';
