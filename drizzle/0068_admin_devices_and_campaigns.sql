ALTER TABLE platform_messaging_channels
  DROP CONSTRAINT IF EXISTS platform_messaging_channels_provider_check;

UPDATE platform_messaging_channels
   SET provider='evolution_admin',updated_at=now()
 WHERE provider='evolution' AND messaging_scope='platform_admin';

ALTER TABLE platform_messaging_channels
  ADD CONSTRAINT platform_messaging_channels_provider_check
  CHECK (provider IN ('evolution_admin','resend'));

CREATE INDEX IF NOT EXISTS platform_admin_channels_status_idx
  ON platform_messaging_channels(provider,status,updated_at DESC)
  WHERE messaging_scope='platform_admin';

CREATE TABLE IF NOT EXISTS admin_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('evolution_whatsapp','email')),
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','partial','failed','cancelled')),
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES admin_campaigns(id) ON DELETE CASCADE,
  recipient_hash text NOT NULL,
  recipient_encrypted text NOT NULL,
  recipient_masked text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  provider_message_id text,
  failure_code text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id,recipient_hash)
);

CREATE INDEX IF NOT EXISTS admin_campaigns_created_idx
  ON admin_campaigns(created_at DESC);

CREATE INDEX IF NOT EXISTS admin_campaign_recipients_pending_idx
  ON admin_campaign_recipients(status,available_at)
  WHERE status IN ('pending','failed');
