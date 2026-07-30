ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;
