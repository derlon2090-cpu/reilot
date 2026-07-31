ALTER TABLE support_tickets
  ALTER COLUMN tenant_id DROP NOT NULL,
  ALTER COLUMN created_by_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS requester_name TEXT;

ALTER TABLE support_ticket_messages
  ALTER COLUMN tenant_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS email_delivery_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS email_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS email_last_error TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

ALTER TABLE support_ticket_status_history
  ALTER COLUMN tenant_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'support_message_email_delivery_status_check'
  ) THEN
    ALTER TABLE support_ticket_messages
      ADD CONSTRAINT support_message_email_delivery_status_check
      CHECK (email_delivery_status IN ('not_required', 'pending', 'sent', 'failed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS support_tickets_public_email_rate_idx
  ON support_tickets (LOWER(requester_email), created_at DESC)
  WHERE source = 'public_support';

CREATE INDEX IF NOT EXISTS support_messages_email_delivery_idx
  ON support_ticket_messages (email_delivery_status, created_at)
  WHERE sender_type = 'ADMIN' AND is_internal_note = FALSE;
