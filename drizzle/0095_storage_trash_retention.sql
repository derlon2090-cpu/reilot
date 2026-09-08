-- Storage trash is recoverable for 15 days. These partial indexes keep the
-- daily retention job and per-tenant trash view fast as deleted content grows.

CREATE INDEX IF NOT EXISTS storage_folders_deleted_retention_idx
  ON storage_folders(deleted_at,tenant_id) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS storage_documents_deleted_retention_idx
  ON storage_documents(deleted_at,tenant_id) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS storage_assets_deleted_retention_idx
  ON storage_assets(deleted_at,tenant_id) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN storage_documents.deleted_at IS
  'Soft-delete timestamp; storage cleanup permanently removes the document after 15 days.';
