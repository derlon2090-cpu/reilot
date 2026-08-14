ALTER TABLE platform_plans
  ADD COLUMN IF NOT EXISTS ai_weekly_token_limit bigint NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS ai_period_token_cap bigint NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS ai_max_cycles smallint NOT NULL DEFAULT 1;

UPDATE platform_plans SET
  ai_weekly_token_limit = CASE slug
    WHEN 'starter' THEN 1000000 WHEN 'professional' THEN 3000000
    WHEN 'business' THEN 5000000 WHEN 'enterprise' THEN 5000000 ELSE 100000 END,
  ai_period_token_cap = CASE slug
    WHEN 'starter' THEN 4000000 WHEN 'professional' THEN 12000000
    WHEN 'business' THEN 20000000 WHEN 'enterprise' THEN 20000000 ELSE 100000 END,
  ai_max_cycles = CASE WHEN slug IN ('starter','professional','business','enterprise') THEN 4 ELSE 1 END,
  ai_monthly_token_limit = CASE slug
    WHEN 'starter' THEN 4000000 WHEN 'professional' THEN 12000000
    WHEN 'business' THEN 20000000 WHEN 'enterprise' THEN 20000000 ELSE 100000 END,
  updated_at = now();

ALTER TABLE platform_plans DROP CONSTRAINT IF EXISTS platform_plans_ai_max_cycles_check;
ALTER TABLE platform_plans ADD CONSTRAINT platform_plans_ai_max_cycles_check CHECK (ai_max_cycles BETWEEN 1 AND 4);

CREATE TABLE IF NOT EXISTS ai_entitlement_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES platform_subscriptions(id) ON DELETE CASCADE,
  plan_slug text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  weekly_token_limit bigint NOT NULL CHECK (weekly_token_limit > 0),
  period_token_cap bigint NOT NULL CHECK (period_token_cap > 0),
  max_cycles smallint NOT NULL CHECK (max_cycles BETWEEN 1 AND 4),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id,period_start,period_end),
  CHECK (period_end > period_start)
);

CREATE TABLE IF NOT EXISTS ai_entitlement_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_period_id uuid NOT NULL REFERENCES ai_entitlement_periods(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cycle_number smallint NOT NULL CHECK (cycle_number BETWEEN 1 AND 4),
  cycle_start timestamptz NOT NULL,
  cycle_end timestamptz NOT NULL,
  access_ends_at timestamptz NOT NULL,
  allowance_tokens bigint NOT NULL CHECK (allowance_tokens > 0),
  used_tokens bigint NOT NULL DEFAULT 0 CHECK (used_tokens >= 0),
  reserved_tokens bigint NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','closed','expired')),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entitlement_period_id,cycle_number),
  CHECK (cycle_end > cycle_start),
  CHECK (access_ends_at > cycle_start),
  CHECK (used_tokens + reserved_tokens <= allowance_tokens)
);

CREATE TABLE IF NOT EXISTS ai_token_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
  cycle_id uuid NOT NULL REFERENCES ai_entitlement_cycles(id) ON DELETE CASCADE,
  requested_tokens bigint NOT NULL CHECK (requested_tokens > 0),
  actual_tokens bigint CHECK (actual_tokens IS NULL OR actual_tokens >= 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','settled','released','expired')),
  provider_request_id text,
  expires_at timestamptz NOT NULL,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,provider_request_id)
);

CREATE TABLE IF NOT EXISTS ai_token_usage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES ai_entitlement_cycles(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES ai_token_reservations(id) ON DELETE SET NULL,
  provider_request_id text NOT NULL,
  model text NOT NULL,
  input_tokens bigint NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens bigint NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cache_hit_tokens bigint NOT NULL DEFAULT 0 CHECK (cache_hit_tokens >= 0),
  cache_miss_tokens bigint NOT NULL DEFAULT 0 CHECK (cache_miss_tokens >= 0),
  actual_tokens bigint NOT NULL CHECK (actual_tokens >= 0),
  estimated_cost_micros bigint NOT NULL DEFAULT 0 CHECK (estimated_cost_micros >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,provider_request_id)
);

CREATE TABLE IF NOT EXISTS ai_cost_usage_daily (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  model text NOT NULL,
  request_count bigint NOT NULL DEFAULT 0,
  actual_tokens bigint NOT NULL DEFAULT 0,
  cache_hit_tokens bigint NOT NULL DEFAULT 0,
  cache_miss_tokens bigint NOT NULL DEFAULT 0,
  estimated_cost_micros bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(tenant_id,usage_date,model)
);

CREATE INDEX IF NOT EXISTS ai_entitlement_periods_tenant_status_idx ON ai_entitlement_periods(tenant_id,status,period_end DESC);
CREATE INDEX IF NOT EXISTS ai_entitlement_cycles_active_idx ON ai_entitlement_cycles(tenant_id,cycle_start,access_ends_at,status);
CREATE INDEX IF NOT EXISTS ai_token_reservations_active_idx ON ai_token_reservations(tenant_id,status,expires_at);
CREATE INDEX IF NOT EXISTS ai_token_usage_ledger_cycle_idx ON ai_token_usage_ledger(cycle_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_cost_usage_daily_tenant_date_idx ON ai_cost_usage_daily(tenant_id,usage_date DESC);

COMMENT ON TABLE ai_entitlement_periods IS 'AI product entitlements are independent from payment-provider implementation details.';
COMMENT ON TABLE ai_entitlement_cycles IS 'Refill-to-cap ledger. Paid subscription periods can never contain cycle number 5.';
