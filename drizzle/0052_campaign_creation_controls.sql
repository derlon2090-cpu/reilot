ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS whatsapp_channel_id uuid REFERENCES whatsapp_channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meta_template_id uuid REFERENCES meta_message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  ADD COLUMN IF NOT EXISTS send_window_end time NOT NULL DEFAULT '23:59',
  ADD COLUMN IF NOT EXISTS allowed_days smallint[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::smallint[],
  ADD COLUMN IF NOT EXISTS min_delay_seconds integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS max_delay_seconds integer NOT NULL DEFAULT 120;

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_delay_range_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_delay_range_check
  CHECK (min_delay_seconds >= 20 AND max_delay_seconds >= min_delay_seconds AND max_delay_seconds <= 7200);

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_allowed_days_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_allowed_days_check
  CHECK (cardinality(allowed_days) BETWEEN 1 AND 7 AND allowed_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]);

CREATE INDEX IF NOT EXISTS idx_campaigns_due_enabled
  ON campaigns (status, scheduled_for) WHERE is_enabled = true AND status = 'scheduled';
