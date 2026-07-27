ALTER TABLE salla_public_pages
  ADD COLUMN IF NOT EXISTS token_ciphertext text;

ALTER TABLE salla_public_pages
  ALTER COLUMN token_ciphertext SET NOT NULL;

CREATE INDEX IF NOT EXISTS salla_public_pages_lookup_idx
  ON salla_public_pages(public_id, token_hash, status);
