CREATE TABLE IF NOT EXISTS password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'notification';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'resend';
ALTER TABLE email_logs ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE email_logs ALTER COLUMN body DROP NOT NULL;
ALTER TABLE email_logs ALTER COLUMN subject DROP NOT NULL;

ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS warmup_started_at timestamptz;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS warmup_day integer NOT NULL DEFAULT 1;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS hourly_sent integer NOT NULL DEFAULT 0;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS daily_sent integer NOT NULL DEFAULT 0;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS failure_rate numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS last_disconnect_at timestamptz;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewed_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewed_at timestamptz;

ALTER TABLE unsubscribe_list ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE unsubscribe_list ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
ALTER TABLE unsubscribe_list ADD COLUMN IF NOT EXISTS keyword text;
ALTER TABLE unsubscribe_list ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS message_quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  score text NOT NULL,
  risk integer NOT NULL,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_email_created ON password_reset_codes(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type_status ON email_logs(type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_quality_tenant ON message_quality_checks(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_tenant_order ON subscriptions(tenant_id, order_number);
