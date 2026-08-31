import { auditAdmin, requireAdminPermission } from "../../../../src/server/admin-auth.js";
import { query } from "../../../../src/server/db.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAdminPermission(request, "inspector", "read");
  if (!auth.ok) return auth.response;
  const incidentId = new URL(request.url).searchParams.get("incident");
  const [schedule, latestRun, incidentCounts, honeypotStats, countries, asns, paths, events, incidents, findings, alerts, mitigations, timeline] = await Promise.all([
    query("SELECT interval_hours AS \"intervalHours\",last_run_at AS \"lastRunAt\",next_run_at AS \"nextRunAt\" FROM inspector_schedule WHERE schedule_key='deep-periodic-scan'"),
    query("SELECT id,status,started_at AS \"startedAt\",completed_at AS \"completedAt\",duration_ms AS \"durationMs\",summary,next_run_at AS \"nextRunAt\" FROM inspector_runs ORDER BY started_at DESC LIMIT 1"),
    query(`SELECT count(*) FILTER(WHERE status IN ('Open','Investigating','Mitigated'))::int AS open,
                  count(*) FILTER(WHERE status IN ('Open','Investigating','Mitigated') AND severity='CRITICAL')::int AS critical,
                  count(*) FILTER(WHERE status IN ('Open','Investigating','Mitigated') AND severity='HIGH')::int AS high
             FROM security_incidents`),
    query(`SELECT count(*) FILTER(WHERE event_type='ADMIN_HONEYPOT_ACCESS' AND last_seen>now()-interval '24 hours')::int AS "attempts24h",
                  count(*) FILTER(WHERE event_type='ADMIN_HONEYPOT_ACCESS' AND last_seen>now()-interval '7 days')::int AS "attempts7d",
                  count(DISTINCT source_key) FILTER(WHERE event_type='ADMIN_HONEYPOT_ACCESS' AND last_seen>now()-interval '7 days')::int AS "uniqueIps",
                  count(*) FILTER(WHERE event_type='ADMIN_HONEYPOT_ACCESS' AND severity IN ('HIGH','CRITICAL') AND last_seen>now()-interval '7 days')::int AS "highRisk"
             FROM security_source_events`),
    query(`SELECT COALESCE(country,'غير معروف') AS label,count(*)::int AS count FROM security_source_events
            WHERE event_type='ADMIN_HONEYPOT_ACCESS' AND last_seen>now()-interval '7 days' GROUP BY country ORDER BY count DESC LIMIT 5`),
    query(`SELECT COALESCE(asn,'غير معروف') AS label,count(*)::int AS count FROM security_source_events
            WHERE event_type='ADMIN_HONEYPOT_ACCESS' AND last_seen>now()-interval '7 days' GROUP BY asn ORDER BY count DESC LIMIT 5`),
    query(`SELECT COALESCE(requested_path,'/') AS label,count(*)::int AS count FROM security_source_events
            WHERE event_type='ADMIN_HONEYPOT_ACCESS' AND last_seen>now()-interval '7 days' GROUP BY requested_path ORDER BY count DESC LIMIT 8`),
    query(`SELECT se.event_id AS id,se.last_seen AS time,se.severity,se.risk_score AS "riskScore",se.source_ip AS ip,
                  concat_ws('، ',se.country,se.city_approx) AS location,se.device_class AS device,se.browser,se.os,
                  se.requested_path AS path,se.method,se.incident_id AS "incidentId",si.incident_number AS "incidentNumber"
             FROM security_source_events se LEFT JOIN security_incidents si ON si.id=se.incident_id
            WHERE se.event_type='ADMIN_HONEYPOT_ACCESS' ORDER BY se.last_seen DESC LIMIT 50`),
    query(`SELECT id,incident_number AS "incidentNumber",title,category,severity,risk_score AS "riskScore",status,
                  occurrence_count AS "occurrenceCount",affected_service AS "affectedService",first_seen AS "firstSeen",
                  last_seen AS "lastSeen",recommended_action AS "recommendedAction"
             FROM security_incidents ORDER BY CASE severity WHEN 'CRITICAL' THEN 5 WHEN 'HIGH' THEN 4 WHEN 'MEDIUM' THEN 3 ELSE 1 END DESC,last_seen DESC LIMIT 50`),
    query(`SELECT id,incident_id AS "incidentId",check_id AS "checkId",category,title,severity,risk_score AS "riskScore",
                  affected_service AS "affectedService",evidence,detected_at AS "detectedAt",last_seen AS "lastSeen",
                  occurrence_count AS "occurrenceCount",recommended_action AS "recommendedAction"
             FROM security_findings ORDER BY last_seen DESC LIMIT 50`),
    query(`SELECT id,incident_id AS "incidentId",channel,severity,status,attempts,created_at AS "createdAt",sent_at AS "sentAt"
             FROM security_alert_deliveries ORDER BY created_at DESC LIMIT 30`),
    query(`SELECT sm.id,sm.incident_id AS "incidentId",sm.mitigation_type AS "type",sm.status,sm.reason,
                  sm.starts_at AS "startsAt",sm.expires_at AS "expiresAt",si.incident_number AS "incidentNumber"
             FROM security_mitigations sm JOIN security_incidents si ON si.id=sm.incident_id ORDER BY sm.created_at DESC LIMIT 30`),
    incidentId
      ? query(`SELECT id,event_type AS "eventType",actor_type AS "actorType",detail,previous_hash AS "previousHash",
                       event_hash AS "eventHash",occurred_at AS "occurredAt" FROM incident_events
                 WHERE incident_id=$1 ORDER BY occurred_at,id`, [incidentId])
      : Promise.resolve({ rows: [] })
  ]);
  const incidentSummary = incidentCounts.rows[0] || { open: 0, critical: 0, high: 0 };
  await auditAdmin(request, { admin: auth.admin, action: "inspector.read", resource: "security_center" });
  return Response.json({
    ok: true, schedule: schedule.rows[0] || null, latestRun: latestRun.rows[0] || null,
    incidentCounts: incidentSummary, honeypot: { ...honeypotStats.rows[0], countries: countries.rows, asns: asns.rows, paths: paths.rows },
    events: events.rows, incidents: incidents.rows, findings: findings.rows, alerts: alerts.rows,
    mitigations: mitigations.rows, timeline: timeline.rows,
    permissions: {
      canRun: ["super_admin", "security_admin"].includes(auth.admin.adminRole),
      canManageIncidents: ["super_admin", "security_admin"].includes(auth.admin.adminRole),
      canApproveRemediation: auth.admin.adminRole === "super_admin"
    },
    assurance: Number(incidentSummary.critical || 0) > 0
      ? "توجد حوادث حرجة مفتوحة وتحتاج مراجعة فورية"
      : "لا توجد حوادث حرجة مفتوحة معروفة"
  }, { headers: { "cache-control": "no-store" } });
}
