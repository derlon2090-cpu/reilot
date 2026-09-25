-- Passwordless document sharing with revocable view/edit links.
CREATE TABLE IF NOT EXISTS storage_document_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL UNIQUE REFERENCES storage_documents(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  token_encrypted jsonb NOT NULL,
  permission text NOT NULL CHECK (permission IN ('view','edit')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count bigint NOT NULL DEFAULT 0 CHECK (access_count >= 0)
);
CREATE INDEX IF NOT EXISTS storage_document_shares_tenant_idx ON storage_document_shares(tenant_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS storage_document_shares_active_idx ON storage_document_shares(token_hash) WHERE revoked_at IS NULL;
DROP TRIGGER IF EXISTS renvix_tenant_storage_usage_trigger ON storage_document_shares;
CREATE TRIGGER renvix_tenant_storage_usage_trigger
AFTER INSERT OR UPDATE OR DELETE ON storage_document_shares
FOR EACH ROW EXECUTE FUNCTION renvix_track_tenant_storage_usage();
COMMENT ON COLUMN storage_document_shares.token_hash IS 'SHA-256 of the unguessable public bearer token; the raw token is encrypted for its owner.';
