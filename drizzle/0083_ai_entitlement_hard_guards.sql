ALTER TABLE ai_entitlement_periods
  ADD CONSTRAINT ai_entitlement_periods_policy_shape_check CHECK (
    weekly_token_limit * max_cycles <= period_token_cap
    AND (
      (plan_slug IN ('starter','professional','business','enterprise') AND max_cycles = 4)
      OR (plan_slug IN ('trial','retired_free') AND max_cycles = 1)
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS ai_entitlement_periods_free_once_per_tenant_idx
  ON ai_entitlement_periods(tenant_id)
  WHERE plan_slug IN ('trial','retired_free');

COMMENT ON INDEX ai_entitlement_periods_free_once_per_tenant_idx IS
  'A tenant can receive the 100K Free/trial AI entitlement only once, even if subscription records are replaced.';
