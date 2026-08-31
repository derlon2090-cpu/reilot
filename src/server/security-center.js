import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { sendEmail } from "../lib/email/send-email.js";
import { adminPageUrl } from "./app-url.js";
import { safeErrorMessage, sha256 } from "./security.js";

export const SECURITY_SEVERITIES = Object.freeze(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const SECURITY_RETENTION_DAYS = 90;

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

  if (!["GET", "HEAD"].includes(String(method).toUpperCase())) score += 15;
  if (attempts >= 20) score += 35;
  else if (attempts >= 8) score += 25;
  else if (attempts >= 3) score += 10;
  if (distinctPaths >= 10) score += 20;
  else if (distinctPaths >= 4) score += 10;
  const types = new Set(correlatedEventTypes.map((item) => String(item).toUpperCase()));
  if (types.has("ADMIN_LOGIN_FAILED")) score += 20;
  if (types.has("ADMIN_MFA_FAILED")) score += 30;
  if (types.has("ADMIN_API_ABUSE")) score += 20;
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

async function queueIncidentAlerts(client, incident) {
  if (!['HIGH', 'CRITICAL'].includes(incident.severity)) return;
  const recipients = await client.query(
    `SELECT DISTINCT u.email FROM admin_users au JOIN users u ON u.id=au.user_id
      WHERE au.status='active' AND au.role IN ('super_admin','security_admin') AND u.email IS NOT NULL`
  );
  const configured = String(process.env.SECURITY_ALERT_RECIPIENTS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const emails = [...new Set([...recipients.rows.map((row) => row.email), ...configured])];
  const cooldown = new Date().toISOString().slice(0, 13);
  for (const email of emails) {
    const recipient = cleanText(email, 254);
    await client.query(
      `INSERT INTO security_alert_deliveries (incident_id,channel,recipient,severity,dedupe_key)
       VALUES ($1,'email',$2,$3,$4) ON CONFLICT (dedupe_key) DO NOTHING`,
      [incident.id, recipient, incident.severity, `${incident.id}:email:${sha256(recipient)}:${cooldown}`]
    );
  }
  if (incident.severity === 'CRITICAL' && process.env.SECURITY_CRITICAL_WEBHOOK_URL) {
    await client.query(
      `INSERT INTO security_alert_deliveries (incident_id,channel,recipient,severity,dedupe_key)
       VALUES ($1,'secondary_webhook','configured','CRITICAL',$2) ON CONFLICT (dedupe_key) DO NOTHING`,
      [incident.id, `${incident.id}:secondary:${cooldown}`]
    );
  }
}

export async function ingestHoneypotEvent(rawInput) {
  if (rawInput?.internal_probe === true) return { ok: true, probe: true, incident: null, riskScore: 0, severity: "INFO" };
  const input = normalizeHoneypotInput(rawInput);
  if (!input.sourceIp) throw Object.assign(new Error("trusted source IP is required"), { code: "INVALID_SOURCE" });
  const sourceKey = sourceKeyForIp(input.sourceIp);
  return transaction(async (client) => {
    const recent = await client.query(
      `SELECT count(*)::int AS attempts,count(DISTINCT requested_path)::int AS "distinctPaths",
              array_agg(DISTINCT event_type) AS "eventTypes"
         FROM security_source_events WHERE source_key=$1 AND last_seen > now()-interval '15 minutes'`,
      [sourceKey]
    );
    const facts = recent.rows[0] || {};
    const attempts = Number(facts.attempts || 0) + 1;
    const distinctPaths = Number(facts.distinctPaths || 0) + 1;
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
    } else if (riskScore >= 50) {
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
    if (incident) await queueIncidentAlerts(client, incident);
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
}

export async function recordSecuritySignal({ eventType, sourceIp, requestedPath = "", method = "POST", metadata = {} }) {
  try {
    const sourceKey = sourceKeyForIp(sourceIp);
    return await transaction(async (client) => {
      const recent = await client.query(
        `SELECT count(*)::int AS attempts,count(DISTINCT requested_path)::int AS "distinctPaths",
                array_agg(DISTINCT event_type) AS "eventTypes"
           FROM security_source_events WHERE source_key=$1 AND last_seen>now()-interval '15 minutes'`,
        [sourceKey]
      );
      const facts = recent.rows[0] || {};
      const eventTypes = [...new Set([...(facts.eventTypes || []), eventType])];
      const riskScore = calculateThreatScore({
        requestedPath, method, attempts: Number(facts.attempts || 0) + 1,
        distinctPaths: Number(facts.distinctPaths || 0), correlatedEventTypes: eventTypes,
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
      } else if (riskScore >= 50) {
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
          (event_id,event_type,source_key,source_ip,requested_path,method,risk_score,severity,incident_id,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [eventId, eventType, sourceKey, cleanText(sourceIp, 80) || null, normalizedPath(requestedPath || "/admin"),
          cleanText(method, 12), riskScore, severity, incident?.id || null, JSON.stringify(redactSecurityValue(metadata))]
      );
      if (incident) await queueIncidentAlerts(client, incident);
      await appendLedger(client, { eventType, aggregateType: "security_source_event", aggregateId: eventId, payload: { sourceKey, riskScore, severity } });
      return { ok: true, incidentId: incident?.id || null, riskScore, severity };
    });
  } catch (error) {
    console.error("security signal recording failed", safeErrorMessage(error));
    return { ok: false, reason: "recording_failed" };
  }
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
    `عدد المحاولات: ${incident.occurrence_count}`, `فتح الحادث: ${link}`
  ].join("\n");
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9"><h2>تنبيه أمني من Renvix</h2>${text.split("\n").map((line) => `<p>${line.replace(/[&<>"']/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))}</p>`).join("")}</div>`;
  return { text, html, link };
}

export async function processSecurityAlerts({ limit = 20 } = {}) {
  const rows = await transaction(async (client) => {
    const selected = await client.query(
      `SELECT sad.*,si.incident_number,si.title,si.risk_score,si.affected_service,si.first_seen,
              si.occurrence_count,se.source_ip,se.country,se.city_approx
         FROM security_alert_deliveries sad JOIN security_incidents si ON si.id=sad.incident_id
         LEFT JOIN LATERAL (SELECT source_ip,country,city_approx FROM security_source_events x
           WHERE x.incident_id=si.id ORDER BY x.last_seen DESC LIMIT 1) se ON true
        WHERE sad.status IN ('pending','failed') AND sad.available_at<=now() AND sad.attempts<3
        ORDER BY sad.created_at FOR UPDATE OF sad SKIP LOCKED LIMIT $1`,
      [clamp(limit, 1, 50)]
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
        const signature = crypto.createHmac("sha256", process.env.SECURITY_CRITICAL_WEBHOOK_SECRET || process.env.HONEYPOT_INGESTION_SECRET || "")
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
    if (["HIGH", "CRITICAL"].includes(check.severity)) {
      if (incidentId) {
        const open = await client.query(
          `UPDATE security_incidents SET severity=$2,risk_score=GREATEST(risk_score,$3),
                  occurrence_count=occurrence_count+1,last_seen=now(),updated_at=now()
            WHERE id=$1 AND status IN ('Open','Investigating','Mitigated') RETURNING *`,
          [incidentId, check.severity, check.severity === "CRITICAL" ? 90 : 65]
        );
        if (!open.rows[0]) incidentId = null;
        else await appendIncidentEvent(client, incidentId, "repeated_detection", { checkId: check.checkId, runId });
      }
      if (!incidentId) {
        const incident = await client.query(
          `INSERT INTO security_incidents
            (incident_type,category,title,description,severity,risk_score,affected_service,recommended_action)
           VALUES ('PERIODIC_INSPECTOR_FINDING',$1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [check.category, check.title, check.description, check.severity,
            check.severity === "CRITICAL" ? 90 : 65, check.affectedService, check.recommendedAction]
        );
        incidentId = incident.rows[0].id;
        await appendIncidentEvent(client, incidentId, "first_detection", { checkId: check.checkId, runId, evidence });
        await queueIncidentAlerts(client, incident.rows[0]);
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
  return { expiredEvents: events.rowCount, expiredMitigations: mitigations.rowCount };
}
