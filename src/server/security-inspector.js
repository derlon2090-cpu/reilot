import crypto from "node:crypto";
import { databaseHealth, query } from "./db.js";
import { ingestHoneypotEvent, processSecurityAlerts, recordInspectorFinding, redactSecurityValue } from "./security-center.js";
import { safeErrorMessage } from "./security.js";

export const INSPECTOR_INTERVAL_HOURS = 10;
export const INSPECTOR_MAX_DURATION_MS = 8 * 60_000;
const CHECK_TIMEOUT_MS = 8_000;

function result(overrides) {
  return {
    status: "passed", severity: "INFO", description: "No known critical issues detected.",
    evidence: {}, recommendedAction: "لا يلزم إجراء.", ...overrides
  };
}

function configuredOrigin(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (!value) continue;
    try { return new URL(value); } catch { return null; }
  }
  return null;
}

async function checkDatabase() {
  const health = await databaseHealth();
  return result({
    status: health.latencyMs > 1000 ? "warning" : "passed",
    severity: health.latencyMs > 1000 ? "MEDIUM" : "INFO",
    description: health.latencyMs > 1000 ? "زمن استجابة قاعدة البيانات مرتفع." : "اتصال قاعدة البيانات سليم.",
    evidence: { latencyMs: health.latencyMs },
    recommendedAction: health.latencyMs > 1000 ? "راجع connection pool والاستعلامات البطيئة." : "استمر بالمراقبة."
  });
}

async function checkCanonicalDomains() {
  const expected = {
    site: [configuredOrigin("NEXT_PUBLIC_SITE_URL", "SITE_URL"), "renvix.app"],
    auth: [configuredOrigin("NEXT_PUBLIC_AUTH_URL", "AUTH_URL"), "accounts.renvix.app"],
    app: [configuredOrigin("NEXT_PUBLIC_APP_URL", "APP_URL"), "dash.renvix.app"],
    admin: [configuredOrigin("NEXT_PUBLIC_ADMIN_URL", "ADMIN_URL"), "wa-admin.renvix.app"],
    api: [configuredOrigin("NEXT_PUBLIC_API_BASE_URL", "API_URL"), "api.renvix.app"]
  };
  const invalid = Object.entries(expected).filter(([, [url, hostname]]) => !url || url.hostname !== hostname || url.hostname.endsWith(".vercel.app"));
  return result({
    status: invalid.length ? "failed" : "passed", severity: invalid.length ? "HIGH" : "INFO",
    description: invalid.length ? "إعداد واحد أو أكثر لا يستخدم النطاق الرسمي المعتمد." : "النطاقات الرسمية مضبوطة دون canonical من Vercel.",
    evidence: { invalidKeys: invalid.map(([key]) => key), configuredKeys: Object.keys(expected).filter((key) => expected[key][0]) },
    recommendedAction: invalid.length ? "صحح متغيرات النطاقات قبل النشر ولا تعرض قيمها في السجلات." : "لا يلزم إجراء."
  });
}

async function checkAdminIsolation() {
  const admin = configuredOrigin("NEXT_PUBLIC_ADMIN_URL", "ADMIN_URL");
  const honeypot = configuredOrigin("HONEYPOT_PUBLIC_URL");
  const ok = admin?.hostname === "wa-admin.renvix.app" && honeypot?.hostname === "admin.renvix.app" && admin.hostname !== honeypot.hostname;
  return result({
    status: ok ? "passed" : "failed", severity: ok ? "INFO" : "HIGH",
    description: ok ? "نطاق الإدارة الحقيقي معزول عن نطاق الفخ." : "عزل نطاق الإدارة والفخ غير مكتمل في الإعدادات.",
    evidence: { adminConfigured: Boolean(admin), honeypotConfigured: Boolean(honeypot), hostsSeparated: Boolean(admin && honeypot && admin.hostname !== honeypot.hostname) },
    recommendedAction: ok ? "أبقِ Zero Trust على نطاق الإدارة الحقيقي فقط." : "اضبط ADMIN_URL على نطاق الإدارة الحقيقي وHONEYPOT_PUBLIC_URL على النطاق العام."
  });
}

async function checkQueueHealth() {
  const response = await query(
    `SELECT count(*) FILTER (WHERE status='failed')::int AS failed,
            count(*) FILTER (WHERE status='pending' AND scheduled_for<now()-interval '30 minutes')::int AS stale
       FROM message_queue`
  );
  const row = response.rows[0] || {};
  const affected = Number(row.stale || 0) > 20 || Number(row.failed || 0) > 100;
  return result({
    status: affected ? "warning" : "passed", severity: affected ? "MEDIUM" : "INFO",
    description: affected ? "توجد أعمال متأخرة أو فاشلة تحتاج مراجعة." : "لا يوجد تراكم غير طبيعي في طابور الرسائل.",
    evidence: { failed: Number(row.failed || 0), stale: Number(row.stale || 0) },
    recommendedAction: affected ? "راجع الوظائف المتأخرة وأعد المحاولة فقط عبر allowlist." : "لا يلزم إجراء."
  });
}

async function checkIntegrationHealth() {
  const response = await query(
    `SELECT provider,status,response_time_ms,error_count,last_checked_at
       FROM platform_integration_health ORDER BY provider LIMIT 50`
  );
  const unhealthy = response.rows.filter((row) => ["error", "degraded"].includes(row.status));
  return result({
    status: unhealthy.length ? "warning" : "passed", severity: unhealthy.length ? "MEDIUM" : "INFO",
    description: unhealthy.length ? "بعض التكاملات في حالة متدهورة." : "لا توجد حالات تكامل متدهورة مسجلة.",
    evidence: { checked: response.rowCount, unhealthy: unhealthy.map((row) => ({ provider: row.provider, status: row.status, errorCount: row.error_count })) },
    recommendedAction: unhealthy.length ? "راجع Health API لكل مزود دون إرسال عمليات حقيقية للعملاء." : "لا يلزم إجراء."
  });
}

async function checkHoneypot() {
  const honeypot = configuredOrigin("HONEYPOT_PUBLIC_URL");
  if (!honeypot) return result({
    status: "failed", severity: process.env.NODE_ENV === "production" ? "HIGH" : "LOW",
    description: "لم يُضبط عنوان الفخ الأمني.", evidence: { configured: false },
    recommendedAction: "اضبط HONEYPOT_PUBLIC_URL بعد نشر Worker المعزول."
  });
  const timestamp = Date.now().toString();
  const probePath = "/.well-known/renvix-security-probe";
  const probeSecret = String(process.env.HONEYPOT_INGESTION_SECRET || "");
  const probeSignature = probeSecret.length >= 24
    ? crypto.createHmac("sha256", probeSecret).update(`${timestamp}.GET.${probePath}`).digest("hex")
    : "";
  const response = await fetch(new URL(probePath, honeypot), {
    method: "GET", redirect: "manual", headers: {
      "user-agent": "Renvix-Inspector/1.0", "x-renvix-probe-timestamp": timestamp,
      "x-renvix-probe-signature": probeSignature
    }, signal: AbortSignal.timeout(5000)
  });
  const body = (await response.text()).slice(0, 32_000);
  const leaked = /wa-admin\.renvix\.app|\/_next\/|renvix_admin_session|advanced-pro-control/i.test(body)
    || response.headers.has("x-powered-by") || /text\/html/i.test(response.headers.get("content-type") || "");
  return result({
    status: leaked ? "failed" : "passed", severity: leaked ? "HIGH" : "INFO",
    description: leaked ? "استجابة الفخ قد تكشف أصلًا أو اسمًا خاصًا بلوحة الإدارة." : "الفخ متاح ولا يعرض أصول لوحة الإدارة أو نطاقها الحقيقي.",
    evidence: { reachable: true, statusCode: response.status, responseBytes: body.length, leakedAdminSurface: leaked },
    recommendedAction: leaked ? "أوقف التوجيه إلى Vercel وانشر Worker المحايد فقط." : "استمر بفحص التسرب كل عشر ساعات."
  });
}

async function checkIngestionProbe() {
  const probe = await ingestHoneypotEvent({ internal_probe: true });
  return result({
    status: probe.ok && probe.probe ? "passed" : "failed", severity: probe.ok ? "INFO" : "HIGH",
    description: probe.ok ? "مسار ingestion يقبل الفحص الداخلي دون إنشاء حادث." : "فشل الفحص الداخلي لمسار ingestion.",
    evidence: { probeAccepted: Boolean(probe.ok), falseIncidentPrevented: probe.incident == null },
    recommendedAction: probe.ok ? "لا يلزم إجراء." : "راجع سر التوقيع واتصال قاعدة البيانات."
  });
}

async function checkContainmentBoundary() {
  const required = {
    blockPepper: String(process.env.SECURITY_BLOCK_PEPPER || "").length >= 32,
    boundarySecret: String(process.env.SECURITY_BLOCK_CHECK_SECRET || "").length >= 32,
    boundaryEndpoint: Boolean(process.env.SECURITY_BLOCK_CHECK_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_PUBLIC_URL)
  };
  const edgeEnabled = process.env.CLOUDFLARE_SECURITY_BLOCKS_ENABLED === "true";
  const edgeComplete = !edgeEnabled || (Boolean(process.env.CLOUDFLARE_ZONE_ID) && String(process.env.CLOUDFLARE_SECURITY_API_TOKEN || "").length >= 20);
  const ok = Object.values(required).every(Boolean) && edgeComplete;
  return result({
    status: ok ? "passed" : "failed",
    severity: ok ? "INFO" : (process.env.NODE_ENV === "production" ? "HIGH" : "LOW"),
    description: ok ? "حد فحص الحظر المركزي ومفاتيح التجزئة مهيأة." : "إعداد الاحتواء المركزي أو مزود الحافة غير مكتمل.",
    evidence: { ...required, edgeEnabled, edgeComplete },
    recommendedAction: ok ? "استمر باختبار 403 المحايد وفك الحظر دوريًا." : "اضبط مفاتيح الحظر المستقلة، وإن فعّلت Cloudflare فأكمل zone token محدود الصلاحيات."
  });
}

export const CHECK_REGISTRY = Object.freeze([
  { checkId: "database.connectivity", category: "Database", title: "اتصال قاعدة البيانات", affectedService: "postgresql", run: checkDatabase },
  { checkId: "domains.canonical", category: "Domain Configuration", title: "النطاقات الرسمية", affectedService: "domains", run: checkCanonicalDomains },
  { checkId: "admin.isolation", category: "Authentication", title: "عزل نطاق الإدارة", affectedService: "admin-control-plane", run: checkAdminIsolation },
  { checkId: "queues.backlog", category: "Queues", title: "سلامة طابور الرسائل", affectedService: "message-queue", run: checkQueueHealth },
  { checkId: "integrations.health", category: "Application Health", title: "صحة التكاملات", affectedService: "integrations", run: checkIntegrationHealth },
  { checkId: "honeypot.exposure", category: "Security", title: "عزل الفخ الأمني", affectedService: "admin-honeypot", run: checkHoneypot },
  { checkId: "honeypot.ingestion", category: "Security", title: "استقبال أحداث الفخ", affectedService: "security-ingestion", run: checkIngestionProbe },
  { checkId: "containment.boundary", category: "Security", title: "حد الاحتواء المركزي", affectedService: "request-boundary", run: checkContainmentBoundary }
]);

export function nextTenHourRun(previous) {
  let next = new Date(new Date(previous).getTime() + INSPECTOR_INTERVAL_HOURS * 60 * 60_000);
  while (next.getTime() <= Date.now()) next = new Date(next.getTime() + INSPECTOR_INTERVAL_HOURS * 60 * 60_000);
  return next;
}

async function withTimeout(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("check timed out"), { code: "CHECK_TIMEOUT" })), milliseconds); })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function runSecurityInspector({ triggerType = "scheduled", adminId = null, force = false } = {}) {
  const schedule = await query("SELECT * FROM inspector_schedule WHERE schedule_key='deep-periodic-scan'");
  const scheduleRow = schedule.rows[0];
  if (!force && triggerType === "scheduled" && scheduleRow && new Date(scheduleRow.next_run_at).getTime() > Date.now()) {
    return { ok: true, skipped: true, reason: "not_due", nextRunAt: scheduleRow.next_run_at };
  }
  await query("UPDATE inspector_runs SET status='timed_out',completed_at=now(),failure_code='stale_lock' WHERE status='running' AND started_at<now()-interval '15 minutes'");
  let run;
  try {
    run = (await query(
      `INSERT INTO inspector_runs (trigger_type,triggered_by_admin_user_id,previous_run_at,next_run_at)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [triggerType, adminId, scheduleRow?.last_run_at || null, scheduleRow?.next_run_at || null]
    )).rows[0];
  } catch (error) {
    if (String(error?.code) === "23505") return { ok: false, conflict: true, reason: "scan_already_running" };
    throw error;
  }

  const started = Date.now();
  const checks = [];
  try {
    for (const definition of CHECK_REGISTRY) {
      if (Date.now() - started >= INSPECTOR_MAX_DURATION_MS) {
        checks.push({ ...definition, status: "skipped", severity: "MEDIUM", description: "تجاوز الفحص المدة الإجمالية المسموحة.", evidence: {}, recommendedAction: "راجع الفحوص السابقة قبل إعادة التشغيل.", durationMs: 0 });
        continue;
      }
      const checkStarted = Date.now();
      let outcome;
      try {
        outcome = await withTimeout(definition.run(), CHECK_TIMEOUT_MS);
      } catch (error) {
        outcome = result({
          status: error?.code === "CHECK_TIMEOUT" ? "timed_out" : "failed",
          severity: "HIGH", description: "تعذر إكمال الفحص بأمان.",
          evidence: { failureCode: String(error?.code || "CHECK_FAILED") },
          recommendedAction: "راجع الخدمة المتأثرة ثم أعد الفحص يدويًا."
        });
      }
      const check = { ...definition, ...outcome, durationMs: Date.now() - checkStarted };
      delete check.run;
      check.evidence = redactSecurityValue(check.evidence);
      checks.push(check);
      await query(
        `INSERT INTO inspector_checks
          (run_id,check_id,category,title,status,severity,affected_service,duration_ms,evidence,recommended_action)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
        [run.id, check.checkId, check.category, check.title, check.status, check.severity, check.affectedService,
          check.durationMs, JSON.stringify(check.evidence), check.recommendedAction]
      );
      await recordInspectorFinding({ runId: run.id, check });
    }
    const counts = Object.fromEntries(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((severity) => [severity, checks.filter((check) => check.severity === severity).length]));
    const completedAt = new Date();
    const nextRunAt = nextTenHourRun(completedAt);
    await query(
      `UPDATE inspector_runs SET status='completed',completed_at=$2,duration_ms=$3,next_run_at=$4,summary=$5::jsonb WHERE id=$1`,
      [run.id, completedAt, Date.now() - started, nextRunAt, JSON.stringify({ checks: checks.length, counts })]
    );
    await query(
      `UPDATE inspector_schedule SET last_run_at=$1,next_run_at=$2,interval_hours=$3,updated_at=now()
        WHERE schedule_key='deep-periodic-scan'`,
      [completedAt, nextRunAt, INSPECTOR_INTERVAL_HOURS]
    );
    await processSecurityAlerts().catch((error) => {
      console.error("inspector security alert dispatch failed", safeErrorMessage(error));
    });
    return { ok: true, runId: run.id, status: "completed", durationMs: Date.now() - started, nextRunAt, counts, checks };
  } catch (error) {
    await query(
      `UPDATE inspector_runs SET status='failed',completed_at=now(),duration_ms=$2,failure_code=$3,summary=$4::jsonb WHERE id=$1`,
      [run.id, Date.now() - started, String(error?.code || "PERIODIC_INSPECTOR_FAILED"), JSON.stringify({ safeError: safeErrorMessage(error) })]
    );
    await recordInspectorFinding({ runId: run.id, check: {
      checkId: "PERIODIC_INSPECTOR_FAILED", category: "Application Health", title: "فشل الفاحص الدوري",
      description: "توقف الفحص قبل إكمال سجل الفحوص.", status: "failed", severity: "HIGH",
      affectedService: "security-inspector", evidence: { failureCode: String(error?.code || "PERIODIC_INSPECTOR_FAILED") },
      recommendedAction: "راجع سجل التشغيل وأعد الفحص بعد معالجة السبب."
    }});
    throw error;
  }
}
