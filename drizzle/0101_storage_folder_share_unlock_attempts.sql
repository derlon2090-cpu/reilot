-- Brute-force protection for password-protected documents opened through folder shares.
CREATE TABLE IF NOT EXISTS storage_folder_share_unlock_attempts (
  id bigserial PRIMARY KEY,
  share_id uuid NOT NULL REFERENCES storage_folder_shares(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES storage_documents(id) ON DELETE CASCADE,
  visitor_hash text NOT NULL CHECK (visitor_hash ~ '^[0-9a-f]{64}$'),
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS storage_folder_share_unlock_attempts_lookup_idx
  ON storage_folder_share_unlock_attempts(share_id,document_id,visitor_hash,attempted_at DESC);
CREATE INDEX IF NOT EXISTS storage_folder_share_unlock_attempts_expiry_idx
  ON storage_folder_share_unlock_attempts(attempted_at);
COMMENT ON TABLE storage_folder_share_unlock_attempts IS 'Short-lived failed password attempts for protected documents reached through a public folder share.';
