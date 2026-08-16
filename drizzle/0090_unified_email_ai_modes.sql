ALTER TABLE ai_email_template_generations
  ADD COLUMN IF NOT EXISTS result_json jsonb;

ALTER TABLE ai_email_template_generations
  DROP CONSTRAINT IF EXISTS ai_email_template_generations_mode_check;
ALTER TABLE ai_email_template_generations
  ADD CONSTRAINT ai_email_template_generations_mode_check
  CHECK (mode IN ('generate','edit','replace','improve','fix','suggest'));

ALTER TABLE ai_email_template_generations
  DROP CONSTRAINT IF EXISTS ai_email_template_generations_task_type_check;
ALTER TABLE ai_email_template_generations
  ADD CONSTRAINT ai_email_template_generations_task_type_check
  CHECK (task_type IN (
    'email_template_code_generate','email_template_code_generation','email_template_code_edit','email_template_code_replace',
    'email_template_code_improve','email_template_code_fix','email_template_suggestions'
  ));

COMMENT ON COLUMN ai_email_template_generations.result_json IS
  'Validated result used for idempotent replay; raw prompts and provider secrets are never stored.';
