CREATE TABLE IF NOT EXISTS storage_folder_locks (
  folder_id uuid PRIMARY KEY REFERENCES storage_folders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS storage_folder_locks_tenant_idx ON storage_folder_locks(tenant_id);

CREATE TABLE IF NOT EXISTS storage_folder_unlock_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES storage_folders(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS storage_folder_unlock_attempts_recent_idx
  ON storage_folder_unlock_attempts(tenant_id,user_id,folder_id,attempted_at DESC);
