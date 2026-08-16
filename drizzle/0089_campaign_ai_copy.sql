CREATE TABLE IF NOT EXISTS ai_campaign_copy_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  ai_run_id uuid REFERENCES ai_runs(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES ai_token_reservations(id) ON DELETE SET NULL,
  mode text NOT NULL CHECK (mode IN ('generate','regenerate')),
  channel text NOT NULL CHECK (channel IN ('email','whatsapp')),
  task_type text NOT NULL CHECK (task_type IN ('campaign_copy_generate','campaign_copy_regenerate')),
  prompt_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  result_json jsonb,
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

CREATE INDEX IF NOT EXISTS ai_campaign_copy_generations_expiry_idx ON ai_campaign_copy_generations(expires_at);

COMMENT ON TABLE ai_campaign_copy_generations IS
  'Short-lived idempotency and settlement metadata for campaign-copy AI. Raw prompts are never persisted.';
