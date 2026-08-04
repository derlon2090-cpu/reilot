ALTER TABLE salla_public_pages
  ALTER COLUMN token_ciphertext DROP NOT NULL;

-- Existing links continue to resolve from token_hash. Removing recoverable raw
-- tokens means they can no longer be reissued; the application rotates a new
-- 256-bit token the next time the page link is requested.
UPDATE salla_public_pages
   SET token_ciphertext = NULL,
       updated_at = now()
 WHERE token_ciphertext IS NOT NULL;
