-- Revocable public links for complete storage folder trees.
CREATE TABLE IF NOT EXISTS storage_folder_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL UNIQUE REFERENCES storage_folders(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS storage_folder_shares_tenant_idx ON storage_folder_shares(tenant_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS storage_folder_shares_active_idx ON storage_folder_shares(token_hash) WHERE revoked_at IS NULL;
DROP TRIGGER IF EXISTS renvix_tenant_storage_usage_trigger ON storage_folder_shares;
CREATE TRIGGER renvix_tenant_storage_usage_trigger
AFTER INSERT OR UPDATE OR DELETE ON storage_folder_shares
FOR EACH ROW EXECUTE FUNCTION renvix_track_tenant_storage_usage();
COMMENT ON TABLE storage_folder_shares IS 'One revocable bearer link for a folder and its currently shareable document subtree.';
