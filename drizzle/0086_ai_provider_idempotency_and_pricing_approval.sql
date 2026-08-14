-- A provider request id identifies one HTTP response. A logical idempotency key
-- identifies the billable Renvix operation across retries, even when the
-- provider returns a different request id on a later attempt.
ALTER TABLE ai_provider_usage_ledger ADD COLUMN IF NOT EXISTS idempotency_key text;
UPDATE ai_provider_usage_ledger
   SET idempotency_key='provider-request:' || provider_request_id
 WHERE idempotency_key IS NULL;
ALTER TABLE ai_provider_usage_ledger ALTER COLUMN idempotency_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_usage_logical_operation_unique
  ON ai_provider_usage_ledger(tenant_id,provider,idempotency_key);

-- Reprocessing is a new billable operation only when the user explicitly asks
-- for it. Technical retries keep the same generation and therefore the same
-- logical idempotency key.
ALTER TABLE ai_attachments ADD COLUMN IF NOT EXISTS processing_generation integer NOT NULL DEFAULT 1
  CHECK (processing_generation > 0);

-- Future prices never become active because the calendar advanced. They must
-- be explicitly approved in the registry first.
ALTER TABLE ai_provider_pricing ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft';
ALTER TABLE ai_provider_pricing ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE ai_provider_pricing ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE ai_provider_pricing DROP CONSTRAINT IF EXISTS ai_provider_pricing_approval_status_check;
ALTER TABLE ai_provider_pricing ADD CONSTRAINT ai_provider_pricing_approval_status_check
  CHECK (approval_status IN ('draft','approved','retired'));

UPDATE ai_provider_pricing
   SET approval_status='approved',approved_at=COALESCE(approved_at,now()),approved_by=COALESCE(approved_by,'migration:0086')
 WHERE pricing_version IN ('google-2026-h2','deepgram-2026-08');

UPDATE ai_provider_pricing
   SET approval_status='draft',approved_at=NULL,approved_by=NULL
 WHERE pricing_version='google-2027-v1';

CREATE INDEX IF NOT EXISTS ai_provider_pricing_approval_window_idx
  ON ai_provider_pricing(provider,model,variant,approval_status,valid_from,valid_until);

COMMENT ON COLUMN ai_provider_usage_ledger.idempotency_key IS
  'Stable logical Renvix operation key. Provider request ids may change across technical retries.';
COMMENT ON COLUMN ai_provider_pricing.approval_status IS
  'Only approved snapshots may be selected for billing. Draft future snapshots never activate automatically.';
