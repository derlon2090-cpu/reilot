ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS reminder_delivery_mode text NOT NULL DEFAULT 'single';

ALTER TABLE customer_subscriptions
  DROP CONSTRAINT IF EXISTS customer_subscriptions_reminder_delivery_mode_check;

ALTER TABLE customer_subscriptions
  ADD CONSTRAINT customer_subscriptions_reminder_delivery_mode_check
  CHECK (reminder_delivery_mode IN ('single', 'both'));
