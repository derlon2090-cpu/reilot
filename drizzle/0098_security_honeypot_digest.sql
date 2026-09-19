-- Retain historical decoy incidents, but stop retrying their noisy notifications.
UPDATE security_alert_deliveries AS delivery SET status='skipped'
FROM security_incidents AS incident
WHERE delivery.incident_id=incident.id
  AND incident.incident_type='ADMIN_HONEYPOT_ACCESS'
  AND delivery.status IN ('pending','failed');

CREATE TABLE IF NOT EXISTS security_daily_digest_deliveries (
  day date NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  PRIMARY KEY (day, recipient)
);
