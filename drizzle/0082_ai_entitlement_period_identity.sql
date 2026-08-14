ALTER TABLE ai_entitlement_periods
  DROP CONSTRAINT IF EXISTS ai_entitlement_periods_subscription_id_period_start_period_end_key;

ALTER TABLE ai_entitlement_periods
  ADD CONSTRAINT ai_entitlement_periods_subscription_period_unique UNIQUE(subscription_id,period_start);

COMMENT ON CONSTRAINT ai_entitlement_periods_subscription_period_unique ON ai_entitlement_periods IS
  'Changing an end timestamp does not accidentally mint another AI entitlement period.';
