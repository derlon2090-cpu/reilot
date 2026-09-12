ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check;
ALTER TABLE users ADD CONSTRAINT users_account_status_check
  CHECK (account_status IN ('active','suspended','removed'));

CREATE INDEX IF NOT EXISTS users_account_status_idx
  ON users(account_status, created_at DESC);

COMMENT ON COLUMN users.account_status IS
  'Platform access state controlled by administrators; removed is a recoverable soft deletion.';
