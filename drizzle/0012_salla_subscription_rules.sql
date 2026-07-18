ALTER TABLE commerce_integrations
  ADD COLUMN IF NOT EXISTS subscription_rules jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'commerce_integrations_subscription_rules_array'
  ) THEN
    ALTER TABLE commerce_integrations
      ADD CONSTRAINT commerce_integrations_subscription_rules_array
      CHECK (jsonb_typeof(subscription_rules) = 'array');
  END IF;
END $$;

