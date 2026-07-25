ALTER TABLE admin_outbound_messages
  DROP CONSTRAINT IF EXISTS admin_outbound_messages_template_key_fkey;
ALTER TABLE admin_outbound_messages
  ADD CONSTRAINT admin_outbound_messages_template_key_fkey
  FOREIGN KEY (template_key) REFERENCES admin_message_templates(template_key)
  ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM admin_message_templates WHERE template_key = 'admin_account_created_email'
  ) AND NOT EXISTS (
    SELECT 1 FROM admin_message_templates WHERE template_key = 'admin_account_created'
  ) THEN
    UPDATE admin_message_templates
       SET template_key = 'admin_account_created', updated_at = now()
     WHERE template_key = 'admin_account_created_email';
  ELSIF EXISTS (
    SELECT 1 FROM admin_message_templates WHERE template_key = 'admin_account_created_email'
  ) THEN
    UPDATE admin_outbound_messages
       SET template_key = 'admin_account_created'
     WHERE template_key = 'admin_account_created_email';
    DELETE FROM admin_message_templates WHERE template_key = 'admin_account_created_email';
  END IF;
END $$;

ALTER TABLE app_connections
  ADD COLUMN IF NOT EXISTS readiness_status text NOT NULL DEFAULT 'oauth_completed',
  ADD COLUMN IF NOT EXISTS webhooks_registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS initial_sync_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz;

ALTER TABLE account_provisioning_jobs
  ADD COLUMN IF NOT EXISTS customer_phone_e164 text,
  ADD COLUMN IF NOT EXISTS previous_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS new_expires_at timestamptz;

ALTER TABLE app_connections DROP CONSTRAINT IF EXISTS app_connections_readiness_status_check;
ALTER TABLE app_connections ADD CONSTRAINT app_connections_readiness_status_check CHECK (
  readiness_status IN (
    'oauth_completed','token_saved','webhooks_pending','initial_sync_pending',
    'ready','partially_ready','failed'
  )
);

CREATE TABLE IF NOT EXISTS admin_message_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('resend','evolution')),
  provider_event_id text NOT NULL,
  provider_message_id text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS admin_message_provider_events_message_idx
  ON admin_message_provider_events(provider, provider_message_id);

UPDATE admin_message_templates
   SET channel = 'email',
       subject = 'تم إنشاء حسابك في Renvix',
       allowed_variables = '["customer_name","customer_email","temporary_password","plan_name","subscription_expiry","login_url","support_url"]'::jsonb,
       required_variables = '["customer_name","customer_email","temporary_password","plan_name","login_url"]'::jsonb,
       updated_at = now()
 WHERE template_key = 'admin_account_created';

UPDATE admin_message_templates
   SET channel = 'evolution_whatsapp',
       allowed_variables = '["customer_name","plan_name","store_name","old_expiry","new_expiry","login_url","support_url"]'::jsonb,
       required_variables = '["customer_name","plan_name","old_expiry","new_expiry"]'::jsonb,
       updated_at = now()
 WHERE template_key = 'admin_subscription_renewed';

UPDATE admin_message_templates
   SET channel = 'evolution_whatsapp',
       allowed_variables = '["customer_name","disconnected_phone","disconnect_reason","disconnected_at","reconnect_url","support_url"]'::jsonb,
       required_variables = '["customer_name","disconnected_phone","disconnect_reason","disconnected_at","support_url"]'::jsonb,
       updated_at = now()
 WHERE template_key = 'admin_number_disconnected';

UPDATE admin_message_templates
   SET channel = 'email',
       subject = 'تم ربط متجرك على سلة بنجاح',
       allowed_variables = '["customer_name","store_name","store_domain","connected_at","dashboard_url","integration_settings_url","support_url"]'::jsonb,
       required_variables = '["customer_name","store_name","connected_at","dashboard_url"]'::jsonb,
       updated_at = now()
 WHERE template_key = 'admin_salla_installed';
