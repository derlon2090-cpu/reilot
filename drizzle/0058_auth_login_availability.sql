ALTER TABLE users
  ALTER COLUMN email_otp_enabled SET DEFAULT false;

-- Migration 0044 enabled email OTP for every account. Restore availability
-- only for accounts that never completed an OTP flow and have no trusted
-- device evidence. Accounts that used OTP remain protected.
UPDATE users u
   SET email_otp_enabled = false,
       updated_at = now()
 WHERE u.email_otp_enabled = true
   AND NOT EXISTS (
     SELECT 1
       FROM auth_email_otp_challenges c
      WHERE c.user_id = u.id
        AND c.consumed_at IS NOT NULL
   )
   AND NOT EXISTS (
     SELECT 1
       FROM auth_trusted_devices d
      WHERE d.user_id = u.id
        AND d.revoked_at IS NULL
   );
