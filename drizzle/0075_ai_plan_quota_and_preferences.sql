ALTER TABLE platform_plans
  ADD COLUMN IF NOT EXISTS ai_monthly_token_limit bigint NOT NULL DEFAULT 20000;

UPDATE platform_plans
SET ai_monthly_token_limit = CASE slug
  WHEN 'trial' THEN 20000
  WHEN 'retired_free' THEN 20000
  WHEN 'starter' THEN 150000
  WHEN 'professional' THEN 750000
  WHEN 'business' THEN 2000000
  WHEN 'enterprise' THEN -1
  ELSE COALESCE(NULLIF(ai_monthly_token_limit, 0), 20000)
END,
updated_at = now();

CREATE TABLE IF NOT EXISTS ai_user_preferences (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'unset' CHECK (language IN ('unset','ar','en')),
  response_style text NOT NULL DEFAULT 'balanced' CHECK (response_style IN ('concise','balanced','detailed')),
  account_context_enabled boolean NOT NULL DEFAULT true,
  quick_actions_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,user_id)
);

CREATE INDEX IF NOT EXISTS ai_usage_daily_tenant_date_idx
  ON ai_usage_daily (tenant_id,usage_date DESC);
