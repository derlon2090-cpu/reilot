-- Persist the Meta customer-service window and allow interactive messages in the queue.
CREATE TABLE IF NOT EXISTS whatsapp_conversation_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
  recipient_e164 text NOT NULL,
  last_inbound_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel_id, recipient_e164)
);

CREATE INDEX IF NOT EXISTS whatsapp_conversation_windows_expiry_idx
  ON whatsapp_conversation_windows(tenant_id, expires_at DESC);

ALTER TABLE message_queue DROP CONSTRAINT IF EXISTS message_queue_message_type_check;
ALTER TABLE message_queue ADD CONSTRAINT message_queue_message_type_check CHECK (message_type IN (
  'renewal_reminder', 'order_info_link', 'manual_order_link', 'test_message',
  'system_notification', 'interactive_message'
));
