-- Repair databases that applied 0040 before `admin_login` was added to the
-- auth_email_otp_challenges purpose constraint. Rewriting an applied migration
-- does not alter an existing PostgreSQL constraint, so this must be a new,
-- forward-only migration.
DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = current_schema()
       AND t.relname = 'auth_email_otp_challenges'
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%purpose%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.auth_email_otp_challenges DROP CONSTRAINT %I',
      current_schema(),
      constraint_row.conname
    );
  END LOOP;
END $$;

ALTER TABLE auth_email_otp_challenges
  ADD CONSTRAINT auth_email_otp_challenges_purpose_check
  CHECK (purpose IN ('login', 'admin_login', 'sensitive_action'));
