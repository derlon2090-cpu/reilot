CREATE TABLE IF NOT EXISTS quota_conversion_versions (
  version text PRIMARY KEY,
  reference_cost_per_quota_unit_usd numeric(24,12) NOT NULL CHECK (reference_cost_per_quota_unit_usd > 0),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

INSERT INTO quota_conversion_versions(version,reference_cost_per_quota_unit_usd,effective_from,status)
VALUES('2026-08-v1',0.000001000000,'2026-08-01T00:00:00Z','active')
ON CONFLICT(version) DO NOTHING;

ALTER TABLE ai_entitlement_periods
  ADD COLUMN IF NOT EXISTS quota_conversion_version text;

UPDATE ai_entitlement_periods SET quota_conversion_version='2026-08-v1'
WHERE quota_conversion_version IS NULL;

ALTER TABLE ai_entitlement_periods ALTER COLUMN quota_conversion_version SET DEFAULT '2026-08-v1';
ALTER TABLE ai_entitlement_periods ALTER COLUMN quota_conversion_version SET NOT NULL;
ALTER TABLE ai_entitlement_periods DROP CONSTRAINT IF EXISTS ai_entitlement_periods_quota_conversion_version_fkey;
ALTER TABLE ai_entitlement_periods ADD CONSTRAINT ai_entitlement_periods_quota_conversion_version_fkey
  FOREIGN KEY(quota_conversion_version) REFERENCES quota_conversion_versions(version);

CREATE TABLE IF NOT EXISTS ai_provider_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('deepseek','gemini','deepgram')),
  model text NOT NULL,
  usage_type text NOT NULL,
  native_unit text NOT NULL,
  variant text NOT NULL DEFAULT 'standard',
  price_per_unit_usd numeric(24,12) NOT NULL CHECK (price_per_unit_usd >= 0),
  pricing_version text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,model,usage_type,variant,pricing_version),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- Provider prices live in the versioned registry, never in request-path code.
-- Gemini 3.6 Flash promotional standard pricing through 2026-12-31,
-- followed by the published standard pricing effective 2027-01-01.
INSERT INTO ai_provider_pricing(provider,model,usage_type,native_unit,variant,price_per_unit_usd,pricing_version,valid_from,valid_until,metadata)
VALUES
 ('gemini','gemini-3.6-flash','input_token','token','standard',0.000000750000,'google-2026-h2','2026-08-01T00:00:00Z','2027-01-01T00:00:00Z','{"source":"Google Gemini published pricing"}'),
 ('gemini','gemini-3.6-flash','cached_input_token','token','standard',0.000000075000,'google-2026-h2','2026-08-01T00:00:00Z','2027-01-01T00:00:00Z','{"source":"Google Gemini published context caching price"}'),
 ('gemini','gemini-3.6-flash','output_token','token','standard',0.000003750000,'google-2026-h2','2026-08-01T00:00:00Z','2027-01-01T00:00:00Z','{"source":"Google Gemini published pricing"}'),
 ('gemini','gemini-3.6-flash','thought_token','token','standard',0.000003750000,'google-2026-h2','2026-08-01T00:00:00Z','2027-01-01T00:00:00Z','{"source":"Google Gemini published pricing","billed_as":"output"}'),
 ('gemini','gemini-3.6-flash','input_token','token','standard',0.000001500000,'google-2027-v1','2027-01-01T00:00:00Z',NULL,'{"source":"Google Gemini published pricing"}'),
 ('gemini','gemini-3.6-flash','cached_input_token','token','standard',0.000000150000,'google-2027-v1','2027-01-01T00:00:00Z',NULL,'{"source":"Google Gemini published context caching price"}'),
 ('gemini','gemini-3.6-flash','output_token','token','standard',0.000007500000,'google-2027-v1','2027-01-01T00:00:00Z',NULL,'{"source":"Google Gemini published pricing"}'),
 ('gemini','gemini-3.6-flash','thought_token','token','standard',0.000007500000,'google-2027-v1','2027-01-01T00:00:00Z',NULL,'{"source":"Google Gemini published pricing","billed_as":"output"}'),
 -- Deepgram MIP opt-out rates are stored per billed second. Keyterm is a separate paid add-on.
 ('deepgram','nova-3','audio_second','second','mip_opt_out',0.000128333333,'deepgram-2026-08','2026-08-01T00:00:00Z',NULL,'{"source":"Deepgram PAYG prerecorded/streaming pricing","price_per_minute_usd":0.0077,"bill_per_channel":true}'),
 ('deepgram','nova-3','keyterm_audio_second','second','mip_opt_out',0.000021666667,'deepgram-2026-08','2026-08-01T00:00:00Z',NULL,'{"source":"Deepgram keyterm add-on pricing","price_per_minute_usd":0.0013,"bill_per_channel":true}')
ON CONFLICT(provider,model,usage_type,variant,pricing_version) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES ai_messages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  total_quota_units bigint NOT NULL DEFAULT 0 CHECK (total_quota_units >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS ai_provider_usage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES platform_subscriptions(id) ON DELETE SET NULL,
  entitlement_cycle_id uuid NOT NULL REFERENCES ai_entitlement_cycles(id) ON DELETE RESTRICT,
  ai_run_id uuid REFERENCES ai_runs(id) ON DELETE SET NULL,
  attachment_id uuid REFERENCES ai_attachments(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES ai_token_reservations(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('deepseek','gemini','deepgram')),
  model text NOT NULL,
  modality text NOT NULL CHECK (modality IN ('text','vision','audio','audio_fallback')),
  native_usage_type text NOT NULL,
  native_usage_amount numeric(24,6) NOT NULL DEFAULT 0 CHECK (native_usage_amount >= 0),
  input_tokens bigint CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens bigint CHECK (output_tokens IS NULL OR output_tokens >= 0),
  thought_tokens bigint CHECK (thought_tokens IS NULL OR thought_tokens >= 0),
  cached_tokens bigint CHECK (cached_tokens IS NULL OR cached_tokens >= 0),
  total_tokens bigint CHECK (total_tokens IS NULL OR total_tokens >= 0),
  audio_duration_seconds numeric(16,3) CHECK (audio_duration_seconds IS NULL OR audio_duration_seconds >= 0),
  audio_channels smallint CHECK (audio_channels IS NULL OR audio_channels > 0),
  image_count smallint CHECK (image_count IS NULL OR image_count > 0),
  actual_cost_usd numeric(24,12),
  quota_conversion_version text NOT NULL REFERENCES quota_conversion_versions(version),
  quota_units_charged bigint NOT NULL DEFAULT 0 CHECK (quota_units_charged >= 0),
  provider_request_id text NOT NULL,
  pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_usage_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('estimated','confirmed','unconfirmed','failed')),
  language text,
  fallback_used boolean NOT NULL DEFAULT false,
  processing_latency_ms integer CHECK (processing_latency_ms IS NULL OR processing_latency_ms >= 0),
  confidence numeric(5,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,provider_request_id)
);

CREATE INDEX IF NOT EXISTS ai_provider_usage_tenant_created_idx ON ai_provider_usage_ledger(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_provider_usage_run_idx ON ai_provider_usage_ledger(ai_run_id);
CREATE INDEX IF NOT EXISTS ai_provider_usage_attachment_idx ON ai_provider_usage_ledger(attachment_id);

ALTER TABLE ai_attachments ADD COLUMN IF NOT EXISTS derived_object_keys text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE ai_attachments ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;
ALTER TABLE ai_attachments ADD COLUMN IF NOT EXISTS deletion_completed_at timestamptz;
ALTER TABLE ai_attachments ADD COLUMN IF NOT EXISTS ai_run_id uuid REFERENCES ai_runs(id) ON DELETE SET NULL;
ALTER TABLE ai_attachments DROP CONSTRAINT IF EXISTS ai_attachments_status_check;
ALTER TABLE ai_attachments ADD CONSTRAINT ai_attachments_status_check
  CHECK (status IN ('pending','uploading','ready','processing','processed','failed','expired','deleting','deleted'));

CREATE TABLE IF NOT EXISTS attachment_deletion_tombstones (
  attachment_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  freed_bytes bigint NOT NULL DEFAULT 0 CHECK (freed_bytes >= 0),
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  categories text[] NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
  total_items integer NOT NULL DEFAULT 0 CHECK (total_items >= 0),
  processed_items integer NOT NULL DEFAULT 0 CHECK (processed_items >= 0),
  failed_items integer NOT NULL DEFAULT 0 CHECK (failed_items >= 0),
  estimated_bytes bigint NOT NULL DEFAULT 0 CHECK (estimated_bytes >= 0),
  freed_bytes bigint NOT NULL DEFAULT 0 CHECK (freed_bytes >= 0),
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS storage_cleanup_job_items (
  job_id uuid NOT NULL REFERENCES storage_cleanup_jobs(id) ON DELETE CASCADE,
  attachment_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  failure_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(job_id,attachment_id)
);

COMMENT ON TABLE ai_provider_usage_ledger IS 'Provider-native usage, versioned price snapshot, and Renvix quota conversion. Never stores media, transcripts, filenames, or vision content.';
COMMENT ON TABLE attachment_deletion_tombstones IS 'Content-free tombstones make attachment hard deletion idempotent without retaining user media metadata.';
