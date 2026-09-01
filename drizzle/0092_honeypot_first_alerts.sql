-- A first honeypot visit is intentionally LOW, but it still produces one
-- immediate, deduplicated security notification. Escalations create a new
-- delivery while repeated attempts at the same severity remain grouped.
ALTER TABLE security_alert_deliveries
  DROP CONSTRAINT IF EXISTS security_alert_deliveries_severity_check;

ALTER TABLE security_alert_deliveries
  ADD CONSTRAINT security_alert_deliveries_severity_check
  CHECK (severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL'));
