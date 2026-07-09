CREATE TABLE tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'support', 'viewer')),
  status text NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE message_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  whatsapp_channel_id uuid REFERENCES whatsapp_channels(id) ON DELETE SET NULL,
  template_id uuid REFERENCES notification_templates(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL,
  priority integer NOT NULL DEFAULT 5,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  trigger_key text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE whatsapp_safety_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  safe_mode_enabled boolean NOT NULL DEFAULT true,
  daily_message_limit integer NOT NULL DEFAULT 100,
  hourly_message_limit integer NOT NULL DEFAULT 20,
  min_delay_seconds integer NOT NULL DEFAULT 20,
  max_delay_seconds integer NOT NULL DEFAULT 90,
  quiet_hours_start time NOT NULL DEFAULT '21:00',
  quiet_hours_end time NOT NULL DEFAULT '09:00',
  allow_weekend_sending boolean NOT NULL DEFAULT false,
  duplicate_message_window_hours integer NOT NULL DEFAULT 24,
  max_fail_rate_percent integer NOT NULL DEFAULT 20,
  max_block_risk_score integer NOT NULL DEFAULT 70,
  stop_on_high_failure boolean NOT NULL DEFAULT true,
  stop_on_disconnected boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE unsubscribe_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  reason text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_number)
);

CREATE TABLE whatsapp_risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  whatsapp_channel_id uuid REFERENCES whatsapp_channels(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'high_failure_rate',
    'too_many_messages_hour',
    'duplicate_messages',
    'disconnected_channel',
    'repeated_send_to_same_number',
    'unsubscribe_request',
    'blocked_or_failed_status'
  )),
  risk_score integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT false,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_members_tenant_id ON tenant_members(tenant_id);
CREATE INDEX idx_tenant_members_user_id ON tenant_members(user_id);
CREATE INDEX idx_message_queue_tenant_status ON message_queue(tenant_id, status);
CREATE INDEX idx_message_queue_scheduled_for ON message_queue(scheduled_for);
CREATE INDEX idx_message_queue_subscription_id ON message_queue(subscription_id);
CREATE INDEX idx_whatsapp_safety_settings_tenant_id ON whatsapp_safety_settings(tenant_id);
CREATE INDEX idx_unsubscribe_list_tenant_id ON unsubscribe_list(tenant_id);
CREATE INDEX idx_whatsapp_risk_events_tenant_id ON whatsapp_risk_events(tenant_id);
CREATE INDEX idx_whatsapp_risk_events_channel_id ON whatsapp_risk_events(whatsapp_channel_id);
CREATE INDEX idx_login_attempts_email_created_at ON login_attempts(email, created_at);
