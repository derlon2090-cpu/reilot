CREATE TABLE IF NOT EXISTS ai_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES ai_messages(id) ON DELETE SET NULL,
  object_key text NOT NULL UNIQUE,
  object_etag text,
  content_sha256 text,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  purpose text NOT NULL CHECK (purpose IN ('image','audio','document')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','uploading','ready','processing','processed','failed','expired','deleted')),
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending','queued','processing','completed','failed','not_required')),
  duration_ms integer,
  transcript text,
  transcript_language text,
  transcript_confidence numeric(5,4),
  transcript_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  vision_result jsonb,
  analysis_provider text,
  analysis_model text,
  failure_code text,
  retry_count integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_attachments_tenant_created_idx ON ai_attachments(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_attachments_tenant_status_idx ON ai_attachments(tenant_id,status);
CREATE INDEX IF NOT EXISTS ai_attachments_conversation_idx ON ai_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS ai_attachments_message_idx ON ai_attachments(message_id);
CREATE INDEX IF NOT EXISTS ai_attachments_status_created_idx ON ai_attachments(status,created_at);
CREATE INDEX IF NOT EXISTS ai_attachments_tenant_content_hash_idx ON ai_attachments(tenant_id,content_sha256,purpose) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_attachment_metrics_daily (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  metric_name text NOT NULL,
  event_count bigint NOT NULL DEFAULT 0,
  metric_value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id,metric_date,metric_name)
);
CREATE INDEX IF NOT EXISTS ai_attachment_metrics_date_idx ON ai_attachment_metrics_daily(metric_date DESC,metric_name);

ALTER TABLE ai_user_preferences ADD COLUMN IF NOT EXISTS image_analysis_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE ai_user_preferences ADD COLUMN IF NOT EXISTS audio_transcription_enabled boolean NOT NULL DEFAULT true;

COMMENT ON TABLE ai_attachments IS 'Private R2 object ledger. PostgreSQL stores metadata only; binary payloads stay in R2.';
