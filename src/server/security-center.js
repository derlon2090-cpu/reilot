import crypto from "node:crypto";
import { isIP } from "node:net";
import { query, transaction } from "./db.js";
import { sendEmail } from "../lib/email/send-email.js";
import { adminPageUrl } from "./app-url.js";
import { safeErrorMessage, sha256 } from "./security.js";
import { hashBrowserToken, isValidBrowserToken } from "./trusted-browser.js";

export const SECURITY_SEVERITIES = Object.freeze(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const SECURITY_RETENTION_DAYS = 90;
const SECURITY_SEVERITY_RANK = Object.freeze({ INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 });

const REDACTED = "[redacted]";
const SENSITIVE_KEY = /(password|passwd|token|secret|cookie|authorization|otp|api[-_]?key|session)/i;
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const HIGH_IMPACT_ACTIONS = new Set([
  "delete_data", "change_database_schema", "change_admin_permissions", "delete_admin",
  "change_dns", "change_cloudflare_policy", "change_firewall", "rotate_primary_secrets",
  "change_billing", "disable_tenant"
]);
export const REMEDIATION_ALLOWLIST = new Set([
  "retry_job", "move_job_to_retry_queue", "reset_healthy_connection", "restart_worker_safe",
  "invalidate_confirmed_session", "disable_confirmed_leaked_api_key", "pause_burst_campaign",
  "external_provider_circuit_breaker", "retry_idempotent_webhook", "temporary_block",
  "temporary_challenge", "temporary_rate_limit", "add_to_watchlist"
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function cleanText(value, maxLength = 500) {
  return String(value || "")
    .replace(CONTROL_CHARS, "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function redactSecurityValue(value, key = "", depth = 0) {
  if (SENSITIVE_KEY.test(String(key))) return REDACTED;
  if (depth > 5) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => redactSecurityValue(item, "", depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 60).map(([childKey, childValue]) => [
      cleanText(childKey, 80),
      redactSecurityValue(childValue, childKey, depth + 1)
    ]));
  }
  if (typeof value === "string") {
    return cleanText(value, 1000)
      .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, `$1${REDACTED}`)
      .replace(/((?:password|token|secret|otp|authorization)\s*[=:]\s*)[^\s&;,]+/gi, `$1${REDACTED}`);
  }
  return typeof value === "number" || typeof value === "boolean" || value == null ? value : cleanText(value, 200);
}

export function severityForRisk(score) {
  const risk = clamp(score, 0, 100);
  if (risk >= 80) return "CRITICAL";
  if (risk >= 50) return "HIGH";
  if (risk >= 25) return "MEDIUM";
  if (risk >= 10) return "LOW";
  return "INFO";
}

function normalizedPath(value) {
  const path = cleanText(value || "/", 300).split("?")[0] || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function calculateThreatScore({
  requestedPath = "/", method = "GET", attempts = 1, distinctPaths = 1,
  correlatedEventTypes = [], rateLimited = false, cloudflareThreatScore = null
} = {}) {
  const path = normalizedPath(requestedPath).toLowerCase();
  let score = 10;
  if (path === "/.env" || path.startsWith("/.git") || path.includes("secret")) score += 35;
  else if (path.startsWith("/api/admin")) score += 28;
  else if (path.startsWith("/login") || path.includes("admin/login")) score += 18;
  else if (path.startsWith("/config") || path.startsWith("/wp-admin")) score += 16;
  else if (path !== "/") score += 5;

  const types = new Set(correlatedEventTypes.map((item) => String(item).toUpperCase()));
  const authenticationSignal = types.has("ADMIN_LOGIN_FAILED") || types.has("ADMIN_MFA_FAILED");
  if (!authenticationSignal && !["GET", "HEAD"].includes(String(method).toUpperCase())) score += 15;
  if (attempts >= 20) score += 35;
  else if (attempts >= 8) score += 25;
  else if (attempts >= 3) score += 10;
  if (distinctPaths >= 10) score += 20;
  else if (distinctPaths >= 4) score += 10;
  if (types.has("ADMIN_LOGIN_FAILED")) score += 8;
  if (types.has("ADMIN_MFA_FAILED")) score += 15;
  if (types.has("ADMIN_API_ABUSE")) score += 15;
  if (types.has("RATE_LIMIT_EXCEEDED") || rateLimited) score += 15;
  if (Number.isFinite(Number(cloudflareThreatScore))) score += Math.round(clamp(cloudflareThreatScore, 0, 100) * 0.15);
  return clamp(score, 0, 100);
}

export function parseUserAgent(userAgent = "", clientHints = {}) {
  const ua = cleanText(userAgent, 700);
  const browserMatch = ua.match(/(?:Edg|Edge)\/([\d.]+)/) || ua.match(/Chrome\/([\d.]+)/)
    || ua.match(/Firefox\/([\d.]+)/) || ua.match(/Version\/([\d.]+).*Safari\//);
  const browser = /Edg|Edge/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome"
    : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Unknown";
  const os = /Windows NT/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iOS/.test(ua) ? "iOS/iPadOS" : /Mac OS X/.test(ua) ? "macOS"
      : /Linux/.test(ua) ? "Linux" : cleanText(clientHints.platform, 80) || "Unknown";
  const deviceClass = /bot|crawler|spider/i.test(ua) ? "bot" : /iPad|Tablet/i.test(ua) ? "tablet"
    : /Mobile|Android|iPhone/i.test(ua) ? "mobile" : "desktop";
  return { browser, browserVersion: cleanText(browserMatch?.[1], 40), os, deviceClass };
}

export function sourceKeyForIp(ip) {
  const pepper = String(process.env.SECURITY_SOURCE_PEPPER || process.env.SESSION_SECRET || "renvix-security-source");
  return sha256(`${pepper}:${cleanText(ip, 80)}`);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function appendLedger(client, { eventType, aggregateType, aggregateId, payload }) {
  await client.query("SELECT pg_advisory_xact_lock($1)", [7438291]);
  const previous = await client.query("SELECT event_hash FROM security_event_ledger ORDER BY id DESC LIMIT 1");
  const previousHash = previous.rows[0]?.event_hash || null;
  const safePayload = redactSecurityValue(payload || {});
  const eventHash = sha256(`${previousHash || "GENESIS"}:${eventType}:${aggregateType}:${aggregateId}:${stableStringify(safePayload)}`);
  await client.query(
    `INSERT INTO security_event_ledger (event_type,aggregate_type,aggregate_id,payload,previous_hash,event_hash)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
    [eventType, aggregateType, String(aggregateId), JSON.stringify(safePayload), previousHash, eventHash]
  );
  return eventHash;
}

async function appendIncidentEvent(client, incidentId, eventType, detail = {}, actor = {}) {
  const safeDetail = redactSecurityValue(detail);
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [String(incidentId)]);
  const previous = await client.query(
    "SELECT event_hash FROM incident_events WHERE incident_id=$1 ORDER BY occurred_at DESC,id DESC LIMIT 1 FOR UPDATE",
    [incidentId]
  );
  const previousHash = previous.rows[0]?.event_hash || null;
  const eventHash = sha256(`${previousHash || "GENESIS"}:${incidentId}:${eventType}:${stableStringify(safeDetail)}`);
  await client.query(
    `INSERT INTO incident_events (incident_id,event_type,actor_type,actor_id,detail,previous_hash,event_hash)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
    [incidentId, eventType, actor.type || "system", actor.id || null, JSON.stringify(safeDetail), previousHash, eventHash]
  );
  await appendLedger(client, {
    eventType, aggregateType: "security_incident", aggregateId: incidentId,
    payload: { ...safeDetail, incidentEventHash: eventHash }
  });
}

function referrerWithoutQuery(value) {
  try {
    const url = new URL(cleanText(value, 500));
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return "";
  }
}

function normalizeHoneypotInput(input = {}) {
  const userAgent = cleanText(input.user_agent, 700);
  const parsed = parseUserAgent(userAgent, input.client_hints || {});
  const queryKeys = Array.isArray(input.query_keys_without_sensitive_values)
    ? input.query_keys_without_sensitive_values.map((key) => cleanText(key, 80)).filter((key) => key && !SENSITIVE_KEY.test(key)).slice(0, 30)
    : [];
  return {
    eventId: crypto.randomUUID(),
    sourceIp: cleanText(input.source_ip, 80),
    country: cleanText(input.country, 80), region: cleanText(input.region, 100), cityApprox: cleanText(input.city_approx, 100),
    asn: cleanText(input.asn, 80), organization: cleanText(input.isp_org, 180),
    browser: cleanText(input.browser, 80) || parsed.browser,
    browserVersion: cleanText(input.browser_version, 40) || parsed.browserVersion,
    os: cleanText(input.os, 80) || parsed.os,
    deviceClass: cleanText(input.device_class, 40) || parsed.deviceClass,
    userAgent, requestedPath: normalizedPath(input.requested_path),
    method: cleanText(input.method, 12).toUpperCase() || "GET", queryKeys,
    referrer: referrerWithoutQuery(input.referrer), cfRayId: cleanText(input.cf_ray_id, 100),
    requestId: cleanText(input.request_id, 100) || crypto.randomUUID(),
    cloudflareThreatScore: Number.isFinite(Number(input.cloudflare_threat_score)) ? Number(input.cloudflare_threat_score) : null,
    rateLimited: input.rate_limited === true
  };
}

export function incidentAlertDedupeKey(incident, recipient) {
  return `${incident.id}:email:${sha256(cleanText(recipient, 254))}:${incident.severity}`;
}

async function queueIncidentAlerts(client, incident) {
  if (!["HIGH", "CRITICAL"].includes(incident.severity)) return;
  const recipients = await client.query(
    `SELECT DISTINCT u.email FROM admin_users au JOIN users u ON u.id=au.user_id
      WHERE au.status='active' AND au.role IN ('super_admin','security_admin') AND u.email IS NOT NULL`
  );
  const configured = String(process.env.SECURITY_ALERT_RECIPIENTS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const emails = [...new Set([...recipients.rows.map((row) => row.email), ...configured])];
  for (const email of emails) {
    const recipient = cleanText(email, 254);
    await client.query(
      `INSERT INTO security_alert_deliveries (incident_id,channel,recipient,severity,dedupe_key)
       VALUES ($1,'email',$2,$3,$4) ON CONFLICT (dedupe_key) DO NOTHING`,
      [incident.id, recipient, incident.severity, incidentAlertDedupeKey(incident, recipient)]
    );
  }
  if (incident.severity === 'CRITICAL' && process.env.SECURITY_CRITICAL_WEBHOOK_URL) {
    await client.query(
      `INSERT INTO security_alert_deliveries (incident_id,channel,recipient,severity,dedupe_key)
       VALUES ($1,'secondary_webhook','configured','CRITICAL',$2) ON CONFLICT (dedupe_key) DO NOTHING`,
      [incident.id, `${incident.id}:secondary:CRITICAL`]
    );
  }
}

function incidentNotificationReason(incident) {
  if (incident.incident_type === "ADMIN_HONEYPOT_ACCESS") return "محاولة استكشاف لوحة الإدارة";
  if (["ADMIN_LOGIN_FAILED", "ADMIN_MFA_FAILED", "RATE_LIMIT_EXCEEDED"].includes(incident.incident_type)) return "نشاط مصادقة مريب";
  return cleanText(incident.title || "نشاط مريب", 200);
}

async function syncIncidentNotifications(client, incident) {
  if ((SECURITY_SEVERITY_RANK[incident.severity] || 0) < SECURITY_SEVERITY_RANK.MEDIUM) return null;
  const groupingKey = `security-incident:${incident.id}`;
  const existing = await client.query("SELECT id,severity FROM security_notifications WHERE grouping_key=$1 FOR UPDATE", [groupingKey]);
  const previous = existing.rows[0] || null;
  const escalated = previous && (SECURITY_SEVERITY_RANK[incident.severity] || 0) > (SECURITY_SEVERITY_RANK[previous.severity] || 0);
  const reason = incidentNotificationReason(incident);
  const notification = previous
    ? await client.query(
      `UPDATE security_notifications
          SET title=$2,body=$3,reason=$4,
              severity=CASE WHEN CASE $5 WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 ELSE 2 END >
                                  CASE severity WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 ELSE 2 END
                            THEN $5 ELSE severity END,
              occurrence_count=occurrence_count+1,last_seen=now(),updated_at=now()
        WHERE id=$1 RETURNING *`,
      [previous.id, incident.severity === "CRITICAL" ? "إنذار أمني فوري" : "نشاط مريب تم اكتشافه",
        `${reason} — الخطورة: ${incident.severity} — الحادث: ${incident.incident_number}`, reason, incident.severity]
    )
    : await client.query(
      `INSERT INTO security_notifications (incident_id,grouping_key,title,body,reason,severity)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [incident.id, groupingKey, incident.severity === "CRITICAL" ? "إنذار أمني فوري" : "نشاط مريب تم اكتشافه",
        `${reason} — الخطورة: ${incident.severity} — الحادث: ${incident.incident_number}`, reason, incident.severity]
    );
  if (escalated) await client.query("DELETE FROM security_notification_reads WHERE notification_id=$1", [previous.id]);
  await queueIncidentAlerts(client, incident);
  return notification.rows[0] || null;
}

export async function ingestHoneypotEvent(rawInput) {
  if (rawInput?.internal_probe === true) return { ok: true, probe: true, incident: null, riskScore: 0, severity: "INFO" };
  const input = normalizeHoneypotInput(rawInput);
  if (!input.sourceIp) throw Object.assign(new Error("trusted source IP is required"), { code: "INVALID_SOURCE" });
  const sourceKey = sourceKeyForIp(input.sourceIp);
  const outcome = await transaction(async (client) => {
    // Serialize correlation for a source. A row lock cannot protect the
    // first event because there is no incident row to lock yet.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`security-source:${sourceKey}`]);
    const recent = await client.query(
      `SELECT count(*)::int AS attempts,count(DISTINCT requested_path)::int AS "distinctPaths",
              bool_or(requested_path=$2) AS "pathSeen",array_agg(DISTINCT event_type) AS "eventTypes"
         FROM security_source_events WHERE source_key=$1 AND last_seen > now()-interval '15 minutes'`,
      [sourceKey, input.requestedPath]
    );
    const facts = recent.rows[0] || {};
    const attempts = Number(facts.attempts || 0) + 1;
    const distinctPaths = Number(facts.distinctPaths || 0) + (facts.pathSeen ? 0 : 1);
    const eventTypes = [...new Set([...(facts.eventTypes || []), "ADMIN_HONEYPOT_ACCESS"] )];
    const riskScore = calculateThreatScore({
      requestedPath: input.requestedPath, method: input.method, attempts, distinctPaths,
      correlatedEventTypes: eventTypes, rateLimited: input.rateLimited,
      cloudflareThreatScore: input.cloudflareThreatScore
    });
    const severity = severityForRisk(riskScore);
    const safeEvidence = redactSecurityValue({
      requestedPath: input.requestedPath, method: input.method, country: input.country,
      asn: input.asn, deviceClass: input.deviceClass, browser: input.browser, os: input.os,
      attempts, distinctPaths, cfRayId: input.cfRayId
    });
    const existingIncident = await client.query(
      `SELECT * FROM security_incidents WHERE source_key=$1
        AND status IN ('Open','Investigating','Mitigated') AND last_seen>now()-interval '24 hours'
        ORDER BY last_seen DESC LIMIT 1 FOR UPDATE`,
      [sourceKey]
    );
    let incident = existingIncident.rows[0] || null;
    if (incident) {
      const priorRisk = Number(incident.risk_score || 0);
      const nextRisk = Math.max(priorRisk, riskScore);
      const updated = await client.query(
        `UPDATE security_incidents SET risk_score=$2,severity=$3,occurrence_count=occurrence_count+1,
                last_seen=now(),updated_at=now() WHERE id=$1 RETURNING *`,
        [incident.id, nextRisk, severityForRisk(nextRisk)]
      );
      incident = updated.rows[0];
      await appendIncidentEvent(client, incident.id, nextRisk > priorRisk ? "risk_score_changed" : "repeated_attempt", {
        previousRisk: priorRisk, riskScore: nextRisk, path: input.requestedPath, attempts
      }, { type: "worker" });
    } else if (riskScore >= 25) {
      const inserted = await client.query(
        `INSERT INTO security_incidents
          (incident_type,category,title,description,severity,risk_score,source_key,affected_service,recommended_action)
         VALUES ('ADMIN_HONEYPOT_ACCESS','Reconnaissance','محاولة اكتشاف واجهة الإدارة',
                 'رُصد نشاط مترابط على الفخ الأمني ويحتاج مراجعة دون اعتباره اختراقًا مؤكدًا.',
                 $1,$2,$3,'admin-honeypot','راجع التسلسل وطبّق عزلًا مؤقتًا عند الحاجة.') RETURNING *`,
        [severity, riskScore, sourceKey]
      );
      incident = inserted.rows[0];
      await appendIncidentEvent(client, incident.id, "first_detection", { riskScore, ...safeEvidence }, { type: "worker" });
    }
    const event = await client.query(
      `INSERT INTO security_source_events
        (event_id,event_type,source_key,source_ip,country,region,city_approx,asn,organization,browser,browser_version,
         os,device_class,user_agent,requested_path,method,query_keys,referrer,cf_ray_id,request_id,risk_score,severity,incident_id,metadata,expires_at)
       VALUES ($1,'ADMIN_HONEYPOT_ACCESS',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22,$23::jsonb,
               CASE WHEN $22::uuid IS NULL THEN now()+interval '90 days' ELSE now()+interval '365 days' END)
       RETURNING event_id`,
      [input.eventId, sourceKey, input.sourceIp, input.country || null, input.region || null, input.cityApprox || null,
        input.asn || null, input.organization || null, input.browser, input.browserVersion || null, input.os,
        input.deviceClass, input.userAgent, input.requestedPath, input.method, JSON.stringify(input.queryKeys),
        input.referrer || null, input.cfRayId || null, input.requestId, riskScore, severity, incident?.id || null,
        JSON.stringify({ trustedCloudflareContext: true })]
    );
    const finding = await client.query(
      `INSERT INTO security_findings
        (incident_id,check_id,category,title,description,severity,risk_score,affected_service,source_key,evidence,recommended_action,dedupe_key)
       VALUES ($1,'ADMIN_HONEYPOT_ACCESS','Security','نشاط على الفخ الأمني',
               'تم الوصول إلى نطاق الإدارة الوهمي. لا تعني الزيارة المنفردة وقوع اختراق.',
               $2,$3,'admin-honeypot',$4,$5::jsonb,'راقب الترابط مع محاولات الدخول والـMFA.',$6)
       ON CONFLICT (dedupe_key) DO UPDATE SET incident_id=COALESCE(EXCLUDED.incident_id,security_findings.incident_id),
         severity=EXCLUDED.severity,risk_score=GREATEST(security_findings.risk_score,EXCLUDED.risk_score),
         evidence=EXCLUDED.evidence,last_seen=now(),occurrence_count=security_findings.occurrence_count+1
       RETURNING id`,
      [incident?.id || null, severity, riskScore, sourceKey, JSON.stringify(safeEvidence), `honeypot:${sourceKey}`]
    );
    if (incident) await syncIncidentNotifications(client, incident);
    await appendLedger(client, {
      eventType: "ADMIN_HONEYPOT_ACCESS", aggregateType: "security_source_event", aggregateId: event.rows[0].event_id,
      payload: { findingId: finding.rows[0].id, incidentId: incident?.id || null, riskScore, severity, sourceKey }
    });
    const mitigation = await client.query(
      `SELECT mitigation_type,expires_at FROM security_mitigations
        WHERE source_key=$1 AND status='active' AND expires_at>now() ORDER BY expires_at DESC LIMIT 1`,
      [sourceKey]
    );
    return {
      ok: true, eventId: event.rows[0].event_id, incidentId: incident?.id || null,
      riskScore, severity, mitigation: mitigation.rows[0] || null
    };
  });
  await dispatchIncidentAlertsImmediately(outcome);
  return outcome;
}

export async function recordSecuritySignal({
  eventType, sourceIp, requestedPath = "", method = "POST", metadata = {},
  accountId = null, sessionId = null, trustedDeviceId = null
}) {
  try {
    if (!cleanText(sourceIp, 80)) return { ok: false, reason: "source_unavailable" };
    const sourceKey = sourceKeyForIp(sourceIp);
    const normalizedRequestedPath = normalizedPath(requestedPath || "/admin");
    const outcome = await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`security-source:${sourceKey}`]);
      const recent = await client.query(
        `SELECT count(*)::int AS attempts,count(DISTINCT requested_path)::int AS "distinctPaths",
                bool_or(requested_path=$2) AS "pathSeen",array_agg(DISTINCT event_type) AS "eventTypes"
           FROM security_source_events WHERE source_key=$1 AND last_seen>now()-interval '15 minutes'`,
        [sourceKey, normalizedRequestedPath]
      );
      const facts = recent.rows[0] || {};
      const eventTypes = [...new Set([...(facts.eventTypes || []), eventType])];
      const riskScore = calculateThreatScore({
        requestedPath, method, attempts: Number(facts.attempts || 0) + 1,
        distinctPaths: Number(facts.distinctPaths || 0) + (facts.pathSeen ? 0 : 1), correlatedEventTypes: eventTypes,
        rateLimited: eventType === "RATE_LIMIT_EXCEEDED"
      });
      const severity = severityForRisk(riskScore);
      const existing = await client.query(
        `SELECT * FROM security_incidents WHERE source_key=$1 AND status IN ('Open','Investigating','Mitigated')
          AND last_seen>now()-interval '24 hours' ORDER BY last_seen DESC LIMIT 1 FOR UPDATE`,
        [sourceKey]
      );
      let incident = existing.rows[0] || null;
      if (incident) {
        const previousRisk = Number(incident.risk_score || 0);
        const nextRisk = Math.max(previousRisk, riskScore);
        incident = (await client.query(
          `UPDATE security_incidents SET risk_score=$2,severity=$3,occurrence_count=occurrence_count+1,
                  last_seen=now(),updated_at=now() WHERE id=$1 RETURNING *`,
          [incident.id, nextRisk, severityForRisk(nextRisk)]
        )).rows[0];
        await appendIncidentEvent(client, incident.id, "risk_score_changed", { eventType, previousRisk, riskScore: nextRisk });
      } else if (riskScore >= 25) {
        incident = (await client.query(
          `INSERT INTO security_incidents
            (incident_type,category,title,description,severity,risk_score,source_key,affected_service,recommended_action)
           VALUES ($1,'Authentication','نشاط أمني مترابط','رُبطت عدة إشارات من المصدر نفسه ضمن حادث واحد.',
                   $2,$3,$4,'admin-auth','راجع التسلسل والجلسات قبل تطبيق أي إجراء عالي التأثير.') RETURNING *`,
          [eventType, severity, riskScore, sourceKey]
        )).rows[0];
        await appendIncidentEvent(client, incident.id, "first_detection", { eventType, riskScore });
      }
      const eventId = crypto.randomUUID();
      await client.query(
        `INSERT INTO security_source_events
          (event_id,event_type,source_key,source_ip,requested_path,method,risk_score,severity,incident_id,metadata,user_id,session_id,trusted_device_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13)`,
        [eventId, eventType, sourceKey, cleanText(sourceIp, 80), normalizedRequestedPath,
          cleanText(method, 12), riskScore, severity, incident?.id || null, JSON.stringify(redactSecurityValue(metadata)),
          accountId || null, sessionId || null, trustedDeviceId || null]
      );
      if (incident) await syncIncidentNotifications(client, incident);
      await appendLedger(client, { eventType, aggregateType: "security_source_event", aggregateId: eventId, payload: { sourceKey, riskScore, severity } });
      return { ok: true, incidentId: incident?.id || null, riskScore, severity };
    });
    await dispatchIncidentAlertsImmediately(outcome);
    return outcome;
  } catch (error) {
    console.error("security signal recording failed", safeErrorMessage(error));
    return { ok: false, reason: "recording_failed" };
  }
}

export function securityTargetHash(targetType, value) {
  const type = String(targetType || "").toLowerCase();
  if (!["account", "device", "ip", "session"].includes(type) || !String(value || "").trim()) return "";
  const configuredPepper = String(process.env.SECURITY_BLOCK_PEPPER || "");
  if (process.env.NODE_ENV === "production" && configuredPepper.length < 32) return "";
  const pepper = configuredPepper || String(process.env.SECURITY_SOURCE_PEPPER || process.env.SESSION_SECRET || "renvix-security-block-dev");
  return crypto.createHmac("sha256", pepper).update(`${type}:${String(value).trim()}`).digest("hex");
}

export async function activeTemporaryMitigation(sourceIp) {
  const safeIp = cleanText(sourceIp, 80);
  if (!safeIp) return null;
  const response = await query(
    `SELECT mitigation_type AS "type",expires_at AS "expiresAt",
            GREATEST(1,ceil(extract(epoch FROM (expires_at-now()))))::int AS "retryAfterSeconds"
       FROM security_mitigations
      WHERE source_key=$1 AND mitigation_type='temporary_block' AND status='active' AND expires_at>now()
      ORDER BY expires_at DESC LIMIT 1`,
    [sourceKeyForIp(safeIp)]
  );
  return response.rows[0] || null;
}

export async function listSecurityNotifications(adminId, limit = 20) {
  const safeLimit = clamp(limit, 1, 50);
  const result = await query(
    `SELECT n.id,n.incident_id AS "incidentId",n.title,n.body,n.reason,n.severity,
            n.action_label AS "actionLabel",n.occurrence_count AS "occurrenceCount",
            n.first_seen AS "firstSeen",n.last_seen AS "lastSeen",(r.read_at IS NULL) AS unread,
            r.read_at AS "readAt",si.incident_number AS "incidentNumber",si.risk_score AS "riskScore",
            si.status AS "incidentStatus"
       FROM security_notifications n
       JOIN security_incidents si ON si.id=n.incident_id
       LEFT JOIN security_notification_reads r ON r.notification_id=n.id AND r.admin_user_id=$1
      ORDER BY (r.read_at IS NULL) DESC,
               CASE n.severity WHEN 'CRITICAL' THEN 3 WHEN 'HIGH' THEN 2 ELSE 1 END DESC,
               n.last_seen DESC LIMIT $2`,
    [adminId, safeLimit]
  );
  const unread = await query(
    `SELECT count(*)::int AS count FROM security_notifications n
      WHERE NOT EXISTS (SELECT 1 FROM security_notification_reads r WHERE r.notification_id=n.id AND r.admin_user_id=$1)`,
    [adminId]
  );
  return { notifications: result.rows, unreadCount: Number(unread.rows[0]?.count || 0) };
}

export async function markSecurityNotificationRead({ notificationId, adminId, read = true }) {
  if (read) {
    const result = await query(
      `INSERT INTO security_notification_reads (notification_id,admin_user_id)
       SELECT id,$2 FROM security_notifications WHERE id=$1
       ON CONFLICT (notification_id,admin_user_id) DO UPDATE SET read_at=now()
       RETURNING notification_id AS id`,
      [notificationId, adminId]
    );
    return result.rows[0] || null;
  }
  const result = await query(
    "DELETE FROM security_notification_reads WHERE notification_id=$1 AND admin_user_id=$2 RETURNING notification_id AS id",
    [notificationId, adminId]
  );
  return result.rows[0] || null;
}

export async function markAllSecurityNotificationsRead(adminId) {
  const result = await query(
    `INSERT INTO security_notification_reads (notification_id,admin_user_id)
     SELECT id,$1 FROM security_notifications
     ON CONFLICT (notification_id,admin_user_id) DO UPDATE SET read_at=now()`,
    [adminId]
  );
  return { updated: result.rowCount };
}

export async function listSecurityBlocks(limit = 100) {
  const result = await query(
    `SELECT b.id,b.reference_id AS "referenceId",b.target_type AS "targetType",b.target_label AS "targetLabel",
            b.reason,b.severity,b.created_at AS "createdAt",b.expires_at AS "expiresAt",b.revoked_at AS "revokedAt",
            b.revoke_reason AS "revokeReason",b.edge_provider AS "edgeProvider",b.edge_rule_id AS "edgeRuleId",
            CASE WHEN b.revoke_reason='expired' THEN 'expired'
                 WHEN b.revoked_at IS NOT NULL THEN 'revoked'
                 WHEN b.expires_at IS NOT NULL AND b.expires_at<=now() THEN 'expired' ELSE 'active' END AS status,
            si.incident_number AS "incidentNumber",b.incident_id AS "incidentId"
       FROM security_blocks b JOIN security_incidents si ON si.id=b.incident_id
      ORDER BY b.created_at DESC LIMIT $1`,
    [clamp(limit, 1, 250)]
  );
  return result.rows;
}

export async function incidentContainmentContext(incidentId) {
  const result = await query(
    `SELECT si.id,si.incident_number AS "incidentNumber",si.severity,si.risk_score AS "riskScore",
            se.source_ip AS "sourceIp",COALESCE(identity_event.user_id,d.user_id,s.user_id) AS "accountId",
            identity_event.session_id AS "sessionId",identity_event.trusted_device_id AS "deviceId"
       FROM security_incidents si
       LEFT JOIN LATERAL (
         SELECT source_ip,user_id,session_id,trusted_device_id FROM security_source_events
          WHERE incident_id=si.id ORDER BY last_seen DESC LIMIT 1
       ) se ON true
       LEFT JOIN LATERAL (
         SELECT user_id,session_id,trusted_device_id FROM security_source_events
          WHERE incident_id=si.id AND (user_id IS NOT NULL OR session_id IS NOT NULL OR trusted_device_id IS NOT NULL)
          ORDER BY last_seen DESC LIMIT 1
       ) identity_event ON true
       LEFT JOIN auth_trusted_devices d ON d.id=identity_event.trusted_device_id
       LEFT JOIN sessions s ON s.id=identity_event.session_id
      WHERE si.id=$1 LIMIT 1`,
    [incidentId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    availableTargets: {
      account: Boolean(row.accountId), session: Boolean(row.sessionId),
      device: Boolean(row.deviceId), ip: Boolean(row.sourceIp) && ["HIGH", "CRITICAL"].includes(row.severity)
    }
  };
}

export async function findActiveSecurityBlock(targetType, value, client = null) {
  const targetHash = securityTargetHash(targetType, value);
  if (!targetHash) return null;
  const runner = client || { query };
  const result = await runner.query(
    `SELECT id,reference_id AS "referenceId",target_type AS "targetType",expires_at AS "expiresAt"
       FROM security_blocks WHERE target_type=$1 AND target_hash=$2 AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at DESC LIMIT 1`,
    [targetType, targetHash]
  );
  return result.rows[0] || null;
}

export async function evaluateSecurityBlockRequest({ sourceIp = "", sessionHashes = [], deviceToken = "" } = {}) {
  const targets = [];
  if (sourceIp) targets.push(["ip", sourceIp]);
  const safeSessionHashes = Array.isArray(sessionHashes)
    ? sessionHashes.filter((value) => /^[a-f0-9]{64}$/i.test(String(value))).slice(0, 4)
    : [];
  if (safeSessionHashes.length) {
    const sessions = await query(
      "SELECT id,user_id AS \"userId\" FROM sessions WHERE token=ANY($1::text[]) AND expires_at>now()",
      [safeSessionHashes]
    );
    for (const session of sessions.rows) {
      targets.push(["session", session.id], ["account", session.userId]);
    }
  }
  if (deviceToken && isValidBrowserToken(deviceToken)) {
    try {
      const digest = hashBrowserToken(deviceToken);
      const device = await query(
        `SELECT id,user_id AS "userId" FROM auth_trusted_devices
          WHERE token_digest=$1 AND revoked_at IS NULL AND expires_at>now() LIMIT 1`,
        [digest]
      );
      if (device.rows[0]) targets.push(["device", device.rows[0].id], ["account", device.rows[0].userId]);
    } catch {
      // IP and session enforcement remain available if trusted-browser config is unavailable.
    }
  }
  const candidateHashes = [...new Set(targets.map(([type, value]) => securityTargetHash(type, value)).filter(Boolean))];
  if (!candidateHashes.length) return null;
  const result = await query(
    `SELECT id,reference_id AS "referenceId",target_type AS "targetType",expires_at AS "expiresAt"
       FROM security_blocks WHERE target_hash=ANY($1::text[]) AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at>now())
      ORDER BY CASE severity WHEN 'CRITICAL' THEN 3 WHEN 'HIGH' THEN 2 ELSE 1 END DESC,created_at DESC LIMIT 1`,
    [candidateHashes]
  );
  return result.rows[0] || null;
}

function containmentExpiry(duration) {
  const value = String(duration || "");
  if (value === "permanent") return null;
  const minutes = Number(value);
  if (![60, 1440, 10080].includes(minutes)) throw Object.assign(new Error("invalid containment duration"), { code: "INVALID_DURATION" });
  return new Date(Date.now() + minutes * 60_000);
}

async function createCloudflareIpRule({ ip, referenceId, incidentNumber }) {
  if (process.env.CLOUDFLARE_SECURITY_BLOCKS_ENABLED !== "true") return { configured: false };
  const zoneId = String(process.env.CLOUDFLARE_ZONE_ID || "").trim();
  const token = String(process.env.CLOUDFLARE_SECURITY_API_TOKEN || "").trim();
  if (!zoneId || !token || !isIP(ip)) return { configured: false };
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/firewall/access_rules/rules`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ mode: "block", configuration: { target: isIP(ip) === 6 ? "ip6" : "ip", value: ip }, notes: `${referenceId} ${incidentNumber}` }),
    signal: AbortSignal.timeout(5000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success || !payload.result?.id) throw Object.assign(new Error("Cloudflare block creation failed"), { code: "EDGE_BLOCK_FAILED" });
  return { configured: true, ruleId: String(payload.result.id) };
}

async function deleteCloudflareIpRule(ruleId) {
  if (!ruleId) return { configured: false };
  const zoneId = String(process.env.CLOUDFLARE_ZONE_ID || "").trim();
  const token = String(process.env.CLOUDFLARE_SECURITY_API_TOKEN || "").trim();
  if (!zoneId || !token) throw Object.assign(new Error("Cloudflare unblock configuration unavailable"), { code: "EDGE_UNBLOCK_FAILED" });
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/firewall/access_rules/rules/${encodeURIComponent(ruleId)}`, {
    method: "DELETE", headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw Object.assign(new Error("Cloudflare block deletion failed"), { code: "EDGE_UNBLOCK_FAILED" });
  return { configured: true };
}

export async function containSecurityIncident({ incidentId, adminId, duration, scopes = [], reason }) {
  if (process.env.NODE_ENV === "production" && String(process.env.SECURITY_BLOCK_PEPPER || "").length < 32) {
    throw Object.assign(new Error("security block pepper is unavailable"), { code: "SECURITY_BLOCK_CONFIG_REQUIRED" });
  }
  const safeReason = cleanText(reason, 300);
  if (safeReason.length < 5) throw Object.assign(new Error("containment reason is required"), { code: "REASON_REQUIRED" });
  const selectedScopes = [...new Set((Array.isArray(scopes) ? scopes : []).map((value) => String(value).toLowerCase()))]
    .filter((value) => ["account", "session", "device", "ip"].includes(value));
  if (!selectedScopes.length) throw Object.assign(new Error("containment scope is required"), { code: "SCOPE_REQUIRED" });
  const expiresAt = containmentExpiry(duration);
  if (!expiresAt && selectedScopes.includes("ip")) throw Object.assign(new Error("permanent IP blocks are prohibited"), { code: "PERMANENT_IP_PROHIBITED" });

  const outcome = await transaction(async (client) => {
    const incidentResult = await client.query(
      `SELECT si.*,se.source_ip,COALESCE(identity_event.user_id,d.user_id,s.user_id) AS account_id,
              identity_event.session_id,identity_event.trusted_device_id
         FROM security_incidents si
         LEFT JOIN LATERAL (SELECT source_ip,user_id,session_id,trusted_device_id FROM security_source_events
           WHERE incident_id=si.id ORDER BY last_seen DESC LIMIT 1) se ON true
         LEFT JOIN LATERAL (SELECT user_id,session_id,trusted_device_id FROM security_source_events
           WHERE incident_id=si.id AND (user_id IS NOT NULL OR session_id IS NOT NULL OR trusted_device_id IS NOT NULL)
           ORDER BY last_seen DESC LIMIT 1) identity_event ON true
         LEFT JOIN auth_trusted_devices d ON d.id=identity_event.trusted_device_id
         LEFT JOIN sessions s ON s.id=identity_event.session_id
        WHERE si.id=$1 FOR UPDATE OF si`,
      [incidentId]
    );
    const incident = incidentResult.rows[0];
    if (!incident) throw Object.assign(new Error("incident not found"), { code: "NOT_FOUND" });
    const values = { account: incident.account_id, session: incident.session_id, device: incident.trusted_device_id, ip: incident.source_ip };
    if (selectedScopes.includes("ip") && !["HIGH", "CRITICAL"].includes(incident.severity)) {
      throw Object.assign(new Error("IP containment requires high risk"), { code: "IP_SCOPE_NOT_ALLOWED" });
    }
    const unavailable = selectedScopes.filter((scope) => !values[scope]);
    if (unavailable.length) throw Object.assign(new Error("containment target unavailable"), { code: "TARGET_NOT_AVAILABLE", targets: unavailable });

    const blocks = [];
    for (const scope of selectedScopes) {
      const targetValue = values[scope];
      const targetHash = securityTargetHash(scope, targetValue);
      const label = scope === "ip" ? cleanText(targetValue, 80) : `${scope}:${String(targetValue).slice(-8)}`;
      const existing = await client.query(
        `SELECT * FROM security_blocks WHERE target_type=$1 AND target_hash=$2 AND revoked_at IS NULL
          AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [scope, targetHash]
      );
      const block = existing.rows[0]
        ? await client.query(
          `UPDATE security_blocks SET reason=$2,severity=$3,incident_id=$4,blocked_by=$5,
                  expires_at=CASE WHEN expires_at IS NULL OR $6::timestamptz IS NULL THEN NULL ELSE GREATEST(expires_at,$6) END
            WHERE id=$1 RETURNING *`,
          [existing.rows[0].id, safeReason, incident.severity, incident.id, adminId, expiresAt]
        )
        : await client.query(
          `INSERT INTO security_blocks (target_type,target_hash,target_label,reason,severity,blocked_by,expires_at,incident_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [scope, targetHash, label, safeReason, incident.severity, adminId, expiresAt, incident.id]
        );
      blocks.push(block.rows[0]);
    }

    let terminatedSessions = 0;
    if (selectedScopes.includes("account")) {
      const removed = await client.query("DELETE FROM sessions WHERE user_id=$1 RETURNING id", [incident.account_id]);
      terminatedSessions += removed.rowCount;
      await client.query(
        "UPDATE auth_email_otp_challenges SET invalidated_at=now(),updated_at=now() WHERE user_id=$1 AND consumed_at IS NULL AND invalidated_at IS NULL",
        [incident.account_id]
      );
      await client.query(
        "UPDATE auth_mfa_login_challenges SET invalidated_at=now(),updated_at=now() WHERE user_id=$1 AND consumed_at IS NULL AND invalidated_at IS NULL",
        [incident.account_id]
      );
      await client.query(
        "UPDATE auth_trusted_devices SET revoked_at=now(),revoke_reason='security_containment',updated_at=now() WHERE user_id=$1 AND revoked_at IS NULL",
        [incident.account_id]
      );
    }
    if (selectedScopes.includes("device")) {
      const device = await client.query(
        `UPDATE auth_trusted_devices SET revoked_at=now(),revoke_reason='security_containment',updated_at=now()
          WHERE id=$1 RETURNING user_id`,
        [incident.trusted_device_id]
      );
      if (device.rows[0]?.user_id && !selectedScopes.includes("account")) {
        const removed = await client.query("DELETE FROM sessions WHERE user_id=$1 RETURNING id", [device.rows[0].user_id]);
        terminatedSessions += removed.rowCount;
        await client.query(
          "UPDATE auth_email_otp_challenges SET invalidated_at=now(),updated_at=now() WHERE user_id=$1 AND consumed_at IS NULL AND invalidated_at IS NULL",
          [device.rows[0].user_id]
        );
        await client.query(
          "UPDATE auth_mfa_login_challenges SET invalidated_at=now(),updated_at=now() WHERE user_id=$1 AND consumed_at IS NULL AND invalidated_at IS NULL",
          [device.rows[0].user_id]
        );
      }
    }
    if (selectedScopes.includes("session") && !selectedScopes.includes("account")) {
      const removed = await client.query("DELETE FROM sessions WHERE id=$1 RETURNING id", [incident.session_id]);
      terminatedSessions += removed.rowCount;
    }
    await client.query("UPDATE security_incidents SET status='Mitigated',remediation_status='succeeded',updated_at=now() WHERE id=$1", [incident.id]);
    await appendIncidentEvent(client, incident.id, "threat_contained", {
      scopes: selectedScopes, duration: expiresAt ? String(duration) : "permanent",
      references: blocks.map((block) => block.reference_id), terminatedSessions, reason: safeReason
    }, { type: "admin", id: adminId });
    return { incident, blocks, sourceIp: incident.source_ip, terminatedSessions };
  });

  const edge = [];
  for (const block of outcome.blocks.filter((item) => item.target_type === "ip")) {
    try {
      const provisioned = await createCloudflareIpRule({ ip: outcome.sourceIp, referenceId: block.reference_id, incidentNumber: outcome.incident.incident_number });
      if (provisioned.ruleId) {
        await query("UPDATE security_blocks SET edge_provider='cloudflare',edge_rule_id=$2 WHERE id=$1", [block.id, provisioned.ruleId]);
      }
      edge.push({ referenceId: block.reference_id, ...provisioned });
    } catch (error) {
      edge.push({ referenceId: block.reference_id, configured: true, ok: false, reason: String(error?.code || "EDGE_BLOCK_FAILED") });
    }
  }
  return { blocks: outcome.blocks, terminatedSessions: outcome.terminatedSessions, edge };
}

export async function revokeSecurityBlock({ blockId, adminId, reason }) {
  const safeReason = cleanText(reason, 300);
  if (safeReason.length < 5) throw Object.assign(new Error("unblock reason is required"), { code: "REASON_REQUIRED" });
  const found = await query("SELECT * FROM security_blocks WHERE id=$1 AND revoked_at IS NULL", [blockId]);
  const block = found.rows[0];
  if (!block) throw Object.assign(new Error("block not found"), { code: "NOT_FOUND" });
  if (block.edge_provider === "cloudflare" && block.edge_rule_id) await deleteCloudflareIpRule(block.edge_rule_id);
  return transaction(async (client) => {
    const revoked = await client.query(
      `UPDATE security_blocks SET revoked_at=now(),revoked_by=$2,revoke_reason=$3 WHERE id=$1 AND revoked_at IS NULL RETURNING *`,
      [blockId, adminId, safeReason]
    );
    if (!revoked.rows[0]) throw Object.assign(new Error("block not found"), { code: "NOT_FOUND" });
    await appendIncidentEvent(client, block.incident_id, "security_block_revoked", {
      referenceId: block.reference_id, targetType: block.target_type, reason: safeReason
    }, { type: "admin", id: adminId });
    return revoked.rows[0];
  });
}

export function verifySignedIngestion({ rawBody, timestamp, signature, secret = process.env.HONEYPOT_INGESTION_SECRET }) {
  const ts = Number(timestamp);
  if (!secret || String(secret).length < 24 || !Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60_000) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  const supplied = String(signature || "").replace(/^sha256=/, "");
  return supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function alertBodies(incident) {
  const link = adminPageUrl(`/admin/security-center?incident=${encodeURIComponent(incident.id)}`);
  const location = [incident.country, incident.city_approx].filter(Boolean).join("، ") || "غير متاح";
  const text = [
    `حادث أمني ${incident.incident_number}`, `المستوى: ${incident.severity} (${incident.risk_score}/100)`,
    `وقت الاكتشاف: ${new Date(incident.first_seen).toISOString()}`, `الخدمة: ${incident.affected_service || "Renvix"}`,
    `المصدر: ${incident.source_ip || "غير متاح"}`, `الموقع التقريبي: ${location}`,
    `المنطقة: ${incident.region || "غير متاح"}`, `ASN: ${incident.asn || "غير متاح"}`,
    `العميل: ${incident.browser || "Unknown"} / ${incident.os || "Unknown"} / ${incident.device_class || "desktop"}`,
    `آخر مسار: ${incident.requested_path || "/"}`,
    `عدد المحاولات: ${incident.occurrence_count}`, `فتح الحادث: ${link}`
  ].join("\n");
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9"><h2>تنبيه أمني من Renvix</h2>${text.split("\n").map((line) => `<p>${line.replace(/[&<>"']/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))}</p>`).join("")}</div>`;
  return { text, html, link };
}

async function dispatchIncidentAlertsImmediately(outcome) {
  if (!outcome?.incidentId || !["HIGH", "CRITICAL"].includes(outcome.severity)) return;
  try {
    await processSecurityAlerts({ limit: 20, incidentId: outcome.incidentId });
  } catch (error) {
    // The durable alert queue remains available for the scheduled retry worker.
    console.error("immediate security alert dispatch failed", safeErrorMessage(error));
  }
}

export async function processSecurityAlerts({ limit = 20, incidentId = null } = {}) {
  const rows = await transaction(async (client) => {
    const selected = await client.query(
      `SELECT sad.*,si.incident_number,si.title,si.risk_score,si.affected_service,si.first_seen,
              si.occurrence_count,se.source_ip,se.country,se.region,se.city_approx,se.asn,se.browser,se.os,
              se.device_class,se.requested_path
         FROM security_alert_deliveries sad JOIN security_incidents si ON si.id=sad.incident_id
         LEFT JOIN LATERAL (SELECT source_ip,country,region,city_approx,asn,browser,os,device_class,requested_path FROM security_source_events x
           WHERE x.incident_id=si.id ORDER BY x.last_seen DESC LIMIT 1) se ON true
        WHERE sad.status IN ('pending','failed') AND sad.available_at<=now() AND sad.attempts<3
          AND ($2::uuid IS NULL OR sad.incident_id=$2)
        ORDER BY sad.created_at FOR UPDATE OF sad SKIP LOCKED LIMIT $1`,
      [clamp(limit, 1, 50), incidentId || null]
    );
    if (selected.rowCount) await client.query(
      "UPDATE security_alert_deliveries SET status='processing',attempts=attempts+1 WHERE id=ANY($1::uuid[])",
      [selected.rows.map((row) => row.id)]
    );
    return selected.rows;
  });
  let sent = 0;
  let failed = 0;
  for (const item of rows) {
    try {
      const bodies = alertBodies(item);
      if (item.channel === "email") {
        await sendEmail({
          to: item.recipient, subject: `[${item.severity}] ${item.incident_number} — ${item.title}`,
          text: bodies.text, html: bodies.html, tags: [{ name: "purpose", value: "security_alert" }],
          idempotencyKey: item.dedupe_key
        });
      } else {
        const url = new URL(process.env.SECURITY_CRITICAL_WEBHOOK_URL);
        const payload = JSON.stringify({ incident: item.incident_number, severity: item.severity, riskScore: item.risk_score, link: bodies.link });
        const webhookSecret = String(process.env.SECURITY_CRITICAL_WEBHOOK_SECRET || process.env.HONEYPOT_INGESTION_SECRET || "");
        if (webhookSecret.length < 24) throw new Error("secondary webhook signing secret unavailable");
        const signature = crypto.createHmac("sha256", webhookSecret)
          .update(payload).digest("hex");
        const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-renvix-signature": signature }, body: payload, signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error(`secondary alert returned ${response.status}`);
      }
      await query("UPDATE security_alert_deliveries SET status='sent',sent_at=now(),failure_code=NULL WHERE id=$1", [item.id]);
      await transaction((client) => appendIncidentEvent(client, item.incident_id, "alert_sent", { channel: item.channel }));
      sent += 1;
    } catch (error) {
      await query(
        `UPDATE security_alert_deliveries SET status='failed',failure_code=$2,
                available_at=now()+(power(2,attempts)::text||' minutes')::interval WHERE id=$1`,
        [item.id, safeErrorMessage(error)]
      );
      failed += 1;
    }
  }
  return { processed: rows.length, sent, failed };
}

export function remediationPolicy(actionKey) {
  if (HIGH_IMPACT_ACTIONS.has(actionKey)) return { allowed: false, impactLevel: "prohibited", requiresApproval: true };
  if (!REMEDIATION_ALLOWLIST.has(actionKey)) return { allowed: false, impactLevel: "prohibited", requiresApproval: true };
  const requiresApproval = ["temporary_block", "invalidate_confirmed_session", "disable_confirmed_leaked_api_key", "pause_burst_campaign"].includes(actionKey);
  return { allowed: true, impactLevel: requiresApproval ? "approval_required" : "safe", requiresApproval };
}

export async function applyTemporaryMitigation({ incidentId, adminId, minutes, reason }) {
  const duration = [15, 60, 1440].includes(Number(minutes)) ? Number(minutes) : null;
  if (!duration) throw Object.assign(new Error("invalid mitigation duration"), { code: "INVALID_DURATION" });
  const safeReason = cleanText(reason, 300);
  if (safeReason.length < 5) throw Object.assign(new Error("mitigation reason is required"), { code: "REASON_REQUIRED" });
  return transaction(async (client) => {
    const found = await client.query("SELECT * FROM security_incidents WHERE id=$1 FOR UPDATE", [incidentId]);
    const incident = found.rows[0];
    if (!incident?.source_key) throw Object.assign(new Error("incident has no isolatable source"), { code: "SOURCE_NOT_AVAILABLE" });
    const mitigation = await client.query(
      `INSERT INTO security_mitigations
        (incident_id,source_key,mitigation_type,reason,expires_at,created_by_admin_user_id)
       VALUES ($1,$2,'temporary_block',$3,now()+($4::text||' minutes')::interval,$5) RETURNING *`,
      [incident.id, incident.source_key, safeReason, duration, adminId]
    );
    await client.query(
      `INSERT INTO remediation_attempts
        (incident_id,action_key,impact_level,status,requested_by_admin_user_id,approved_by_admin_user_id,reason,started_at,completed_at,expires_at)
       VALUES ($1,'temporary_block','approval_required','succeeded',$2,$2,$3,now(),now(),$4)`,
      [incident.id, adminId, safeReason, mitigation.rows[0].expires_at]
    );
    await client.query("UPDATE security_incidents SET status='Mitigated',remediation_status='succeeded',updated_at=now() WHERE id=$1", [incident.id]);
    await appendIncidentEvent(client, incident.id, "mitigation_applied", {
      type: "temporary_block", durationMinutes: duration, reason: safeReason, expiresAt: mitigation.rows[0].expires_at
    }, { type: "admin", id: adminId });
    return mitigation.rows[0];
  });
}

export async function updateIncidentStatus({ incidentId, status, adminId, reason = "" }) {
  const allowed = new Set(["Open", "Investigating", "Mitigated", "Resolved", "False Positive"]);
  if (!allowed.has(status)) throw Object.assign(new Error("invalid incident status"), { code: "INVALID_STATUS" });
  return transaction(async (client) => {
    const updated = await client.query(
      "UPDATE security_incidents SET status=$2,updated_at=now() WHERE id=$1 RETURNING *",
      [incidentId, status]
    );
    if (!updated.rows[0]) throw Object.assign(new Error("incident not found"), { code: "NOT_FOUND" });
    await appendIncidentEvent(client, incidentId, status === "Resolved" ? "resolved" : "admin_action", {
      status, reason: cleanText(reason, 300)
    }, { type: "admin", id: adminId });
    return updated.rows[0];
  });
}

export async function recordInspectorFinding({ runId, check }) {
  if (check.status === "passed" || check.severity === "INFO") return { findingId: null, incidentId: null };
  const evidence = redactSecurityValue(check.evidence || {});
  const dedupeKey = `inspector:${cleanText(check.checkId, 120)}`;
  return transaction(async (client) => {
    const existingFinding = await client.query("SELECT * FROM security_findings WHERE dedupe_key=$1 FOR UPDATE", [dedupeKey]);
    let incidentId = existingFinding.rows[0]?.incident_id || null;
    if (["MEDIUM", "HIGH", "CRITICAL"].includes(check.severity)) {
      if (incidentId) {
        const open = await client.query(
          `UPDATE security_incidents SET severity=CASE WHEN GREATEST(risk_score,$2)>=80 THEN 'CRITICAL'
                                                       WHEN GREATEST(risk_score,$2)>=50 THEN 'HIGH' ELSE 'MEDIUM' END,
                  risk_score=GREATEST(risk_score,$2),
                  occurrence_count=occurrence_count+1,last_seen=now(),updated_at=now()
            WHERE id=$1 AND status IN ('Open','Investigating','Mitigated') RETURNING *`,
          [incidentId, check.severity === "CRITICAL" ? 90 : check.severity === "HIGH" ? 65 : 35]
        );
        if (!open.rows[0]) incidentId = null;
        else {
          await appendIncidentEvent(client, incidentId, "repeated_detection", { checkId: check.checkId, runId });
          await syncIncidentNotifications(client, open.rows[0]);
        }
      }
      if (!incidentId) {
        const incident = await client.query(
          `INSERT INTO security_incidents
            (incident_type,category,title,description,severity,risk_score,affected_service,recommended_action)
           VALUES ('PERIODIC_INSPECTOR_FINDING',$1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [check.category, check.title, check.description, check.severity,
            check.severity === "CRITICAL" ? 90 : check.severity === "HIGH" ? 65 : 35, check.affectedService, check.recommendedAction]
        );
        incidentId = incident.rows[0].id;
        await appendIncidentEvent(client, incidentId, "first_detection", { checkId: check.checkId, runId, evidence });
        await syncIncidentNotifications(client, incident.rows[0]);
      }
    }
    const finding = await client.query(
      `INSERT INTO security_findings
        (run_id,incident_id,check_id,category,title,description,severity,risk_score,affected_service,evidence,recommended_action,dedupe_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
       ON CONFLICT (dedupe_key) DO UPDATE SET run_id=EXCLUDED.run_id,incident_id=COALESCE(EXCLUDED.incident_id,security_findings.incident_id),
         description=EXCLUDED.description,severity=EXCLUDED.severity,risk_score=EXCLUDED.risk_score,
         evidence=EXCLUDED.evidence,recommended_action=EXCLUDED.recommended_action,last_seen=now(),
         occurrence_count=security_findings.occurrence_count+1 RETURNING id`,
      [runId, incidentId, cleanText(check.checkId, 120), cleanText(check.category, 80), cleanText(check.title, 200),
        cleanText(check.description, 1000), check.severity, check.severity === "CRITICAL" ? 90 : check.severity === "HIGH" ? 65 : 35,
        cleanText(check.affectedService, 120), JSON.stringify(evidence), cleanText(check.recommendedAction, 1000), dedupeKey]
    );
    await appendLedger(client, {
      eventType: "INSPECTOR_FINDING_RECORDED", aggregateType: "security_finding", aggregateId: finding.rows[0].id,
      payload: { runId, incidentId, checkId: check.checkId, severity: check.severity }
    });
    return { findingId: finding.rows[0].id, incidentId };
  });
}

export async function expireSecurityData() {
  const [events, mitigations] = await Promise.all([
    query("DELETE FROM security_source_events WHERE expires_at<now() AND incident_id IS NULL RETURNING id"),
    query("UPDATE security_mitigations SET status='expired' WHERE status='active' AND expires_at<=now() RETURNING id")
  ]);
  const edgeCandidates = await query(
    `SELECT id,edge_rule_id FROM security_blocks WHERE revoked_at IS NULL AND expires_at<=now()
      AND edge_provider='cloudflare' AND edge_rule_id IS NOT NULL LIMIT 100`
  );
  let expiredEdgeBlocks = 0;
  for (const block of edgeCandidates.rows) {
    try {
      await deleteCloudflareIpRule(block.edge_rule_id);
      const expired = await query(
        "UPDATE security_blocks SET revoked_at=now(),revoke_reason='expired' WHERE id=$1 AND revoked_at IS NULL RETURNING id",
        [block.id]
      );
      expiredEdgeBlocks += expired.rowCount;
    } catch (error) {
      console.error("security edge block expiry failed", safeErrorMessage(error));
    }
  }
  return { expiredEvents: events.rowCount, expiredMitigations: mitigations.rowCount, expiredEdgeBlocks };
}
