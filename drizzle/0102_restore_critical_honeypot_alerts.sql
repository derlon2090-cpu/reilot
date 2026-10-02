-- HIGH/CRITICAL honeypot incidents now page operators immediately. Revive
-- deliveries suppressed by the former digest-only policy. The runtime worker
-- also reconciles incidents that never received a delivery row, including
-- recipients supplied through SECURITY_ALERT_RECIPIENTS.
INSERT INTO security_alert_deliveries
  (incident_id,channel,recipient,severity,dedupe_key)
SELECT incident.id,
       'email',
       lower(trim(recipient.email)),
       incident.severity,
       incident.id::text || ':email:' || encode(digest(lower(trim(recipient.email)), 'sha256'), 'hex') || ':' || incident.severity
FROM security_incidents AS incident
CROSS JOIN LATERAL (
  SELECT DISTINCT users.email
  FROM admin_users
  JOIN users ON users.id=admin_users.user_id
  WHERE admin_users.status='active'
    AND admin_users.role IN ('super_admin','security_admin')
    AND users.email IS NOT NULL
    AND trim(users.email)<>''
) AS recipient
WHERE incident.incident_type='ADMIN_HONEYPOT_ACCESS'
  AND incident.severity IN ('HIGH','CRITICAL')
  AND incident.status IN ('Open','Investigating','Mitigated')
  AND incident.last_seen>now()-interval '7 days'
ON CONFLICT (dedupe_key) DO UPDATE
  SET status='pending', attempts=0, available_at=now(), failure_code=NULL
WHERE security_alert_deliveries.status='skipped';

UPDATE security_alert_deliveries AS delivery
SET status='pending', attempts=0, available_at=now(), failure_code=NULL
FROM security_incidents AS incident
WHERE delivery.incident_id=incident.id
  AND incident.incident_type='ADMIN_HONEYPOT_ACCESS'
  AND incident.severity IN ('HIGH','CRITICAL')
  AND incident.status IN ('Open','Investigating','Mitigated')
  AND incident.last_seen>now()-interval '7 days'
  AND delivery.status='skipped';
