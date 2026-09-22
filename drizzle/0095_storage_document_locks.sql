CREATE TABLE IF NOT EXISTS storage_document_locks (
  document_id uuid PRIMARY KEY REFERENCES storage_documents(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS storage_document_locks_tenant_idx ON storage_document_locks(tenant_id);

CREATE TABLE IF NOT EXISTS storage_document_unlock_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES storage_documents(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS storage_document_unlock_attempts_recent_idx
  ON storage_document_unlock_attempts(tenant_id,user_id,document_id,attempted_at DESC);
