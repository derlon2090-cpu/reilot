ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS reminder_channel text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS reminder_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reminder_days_before integer NOT NULL DEFAULT 7;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_reminder_channel_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_reminder_channel_check
      CHECK (reminder_channel IN ('whatsapp', 'email'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_reminder_mode_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_reminder_mode_check
      CHECK (reminder_mode IN ('manual', 'automatic'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_reminder_days_before_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_reminder_days_before_check
      CHECK (reminder_days_before BETWEEN 0 AND 90);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS subscriptions_automatic_reminder_due_idx
  ON subscriptions (end_date, reminder_days_before)
  WHERE reminder_mode = 'automatic' AND status IN ('active', 'expiring_soon');
