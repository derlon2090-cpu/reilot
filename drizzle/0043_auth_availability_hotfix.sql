-- Email OTP was introduced as enabled-by-default, which made existing accounts
-- depend on mail/pepper configuration immediately. Keep it opt-in and preserve
-- only accounts that have already completed an OTP challenge successfully.
ALTER TABLE users
  ALTER COLUMN email_otp_enabled SET DEFAULT false;

UPDATE users AS u
   SET email_otp_enabled = false,
       updated_at = now()
 WHERE u.email_otp_enabled = true
   AND NOT EXISTS (
     SELECT 1
       FROM auth_email_otp_challenges AS challenge
      WHERE challenge.user_id = u.id
        AND challenge.consumed_at IS NOT NULL
   );
