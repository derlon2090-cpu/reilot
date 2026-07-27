-- Email OTP is part of the required login flow. Re-enable it after the
-- availability hotfix and invalidate previously trusted browsers once so the
-- new challenge is exercised on the next successful password login.
ALTER TABLE users
  ALTER COLUMN email_otp_enabled SET DEFAULT true;

UPDATE users
   SET email_otp_enabled = true,
       updated_at = now()
 WHERE email_otp_enabled = false;

UPDATE auth_trusted_devices
   SET revoked_at = COALESCE(revoked_at, now())
 WHERE revoked_at IS NULL;
