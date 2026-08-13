ALTER TABLE ai_token_usage_ledger
  ADD COLUMN IF NOT EXISTS routing_mode text NOT NULL DEFAULT 'flash'
    CHECK (routing_mode IN ('flash','flash_thinking','pro'));

CREATE INDEX IF NOT EXISTS ai_token_usage_ledger_router_mix_idx
  ON ai_token_usage_ledger(tenant_id,created_at DESC,routing_mode);

COMMENT ON COLUMN ai_token_usage_ledger.routing_mode IS
  'Internal router mix only. Never expose model tier or provider cost in customer token balances.';
