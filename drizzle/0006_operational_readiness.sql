ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS last_qr_generated_at timestamptz;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS last_pairing_code_generated_at timestamptz;

ALTER TABLE whatsapp_channels DROP CONSTRAINT IF EXISTS whatsapp_channels_status_check;
ALTER TABLE whatsapp_channels ADD CONSTRAINT whatsapp_channels_status_check CHECK (status IN (
  'not_connected', 'pending_qr', 'pending_pairing', 'connecting', 'connected', 'disconnected', 'expired', 'error'
));

ALTER TABLE customers ADD COLUMN IF NOT EXISTS reminders_paused boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS operational_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('qr', 'pairing_code', 'whatsapp_send', 'resend', 'cron', 'safe_mode', 'webhook', 'readiness')),
  source text NOT NULL,
  source_id text,
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  message text NOT NULL,
  suggested_solution text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_issues_tenant_created
  ON operational_issues(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_issues_tenant_status
  ON operational_issues(tenant_id, status);
