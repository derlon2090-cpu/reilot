ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'chat';
ALTER TABLE ai_token_usage_ledger ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'chat';
ALTER TABLE ai_token_usage_ledger ADD COLUMN IF NOT EXISTS ai_run_id uuid REFERENCES ai_runs(id) ON DELETE SET NULL;
ALTER TABLE ai_provider_usage_ledger ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'chat';

CREATE TABLE IF NOT EXISTS ai_email_template_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  ai_run_id uuid REFERENCES ai_runs(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES ai_token_reservations(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('generate','edit')),
  task_type text NOT NULL CHECK (task_type IN ('email_template_code_generation','email_template_code_edit')),
  prompt_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  sanitized_html text,
  used_variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  charged_tokens bigint NOT NULL DEFAULT 0 CHECK (charged_tokens >= 0),
  remaining_tokens bigint CHECK (remaining_tokens IS NULL OR remaining_tokens >= 0),
  next_refill_at timestamptz,
  error_code text,
  error_message text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,user_id,idempotency_key)
);

CREATE INDEX IF NOT EXISTS ai_runs_task_type_created_idx
  ON ai_runs(tenant_id,task_type,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_token_usage_task_type_created_idx
  ON ai_token_usage_ledger(tenant_id,task_type,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_provider_usage_task_type_created_idx
  ON ai_provider_usage_ledger(tenant_id,task_type,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_email_template_generations_expiry_idx
  ON ai_email_template_generations(expires_at);

COMMENT ON TABLE ai_email_template_generations IS
  'Short-lived idempotency records for renewal-email AI generation. Prompts are represented by SHA-256 only.';
COMMENT ON COLUMN ai_runs.task_type IS
  'Logical product task, separate from provider, model, and billing modality.';
