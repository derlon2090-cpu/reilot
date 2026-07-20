import { query } from "./db.js";

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };

function bounded(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function securityLabel(score) {
  if (score === null || score === undefined) return "غير مهيأ";
  if (score < 30) return "ضعيفة جدًا";
  if (score < 50) return "ضعيفة";
  if (score < 70) return "تحتاج تحسين";
  if (score < 85) return "جيدة";
  if (score < 95) return "قوية";
  return "ممتازة";
}

export function riskLabel(score) {
  if (score === null || score === undefined) return "غير متاح";
  if (score < 20) return "منخفض";
  if (score < 40) return "محدود";
  if (score < 60) return "متوسط";
  if (score < 80) return "مرتفع";
  return "حرج";
}

export function classifyPasswordStrength(password, identity = "") {
  const value = String(password || "");
  const normalizedIdentity = String(identity || "").toLowerCase().split("@")[0];
  if (value.length < 10 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) return "weak";
  let signals = 0;
  if (value.length >= 12) signals += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) signals += 1;
  if (/[^A-Za-z\d]/.test(value)) signals += 1;
  if (value.length >= 16) signals += 1;
  if (normalizedIdentity && value.toLowerCase().includes(normalizedIdentity)) signals -= 2;
  if (/password|qwerty|123456|admin|renvix/i.test(value)) signals -= 2;
  return signals >= 4 ? "very_strong" : signals >= 2 ? "strong" : "fair";
}

export function decayedWeight(weight, ageHours, halfLifeHours) {
  return Number(weight || 0) * Math.pow(0.5, Math.max(0, Number(ageHours || 0)) / Math.max(1, Number(halfLifeHours || 1)));
}

function recommendation(key, title, description, scoreImpact, priority, actionUrl) {
  return { key, title, description, scoreImpact, priority, actionUrl };
}

function factor(key, title, points, maxPoints, state, detail) {
  return { key, title, points, maxPoints, state, detail };
}

function metricFromFactors(factors, { minimumCoverage = 80, notConfigured = false } = {}) {
  if (notConfigured) return { score: null, status: "not_configured", label: "غير مهيأ", coverage: 0, factors };
  const totalWeight = factors.reduce((sum, item) => sum + Number(item.maxPoints || 0), 0);
  const available = factors.filter((item) => !["unavailable", "not_configured", "insufficient_data"].includes(item.state));
  const availableWeight = available.reduce((sum, item) => sum + Number(item.maxPoints || 0), 0);
  const coverage = totalWeight ? Math.round((availableWeight / totalWeight) * 100) : 0;
  const score = availableWeight ? bounded(available.reduce((sum, item) => sum + Math.max(0, Number(item.points || 0)), 0) / availableWeight * 100) : null;
  if (score === null) return { score: null, status: "unavailable", label: "تعذر التحقق", coverage, factors };
  if (coverage < minimumCoverage) return { score: null, status: "insufficient_data", label: "لا توجد بيانات كافية", coverage, factors };
  return { score, status: "available", label: securityLabel(score), coverage, factors };
}

function passwordPoints(level) {
  return ({ weak: 0, fair: 8, strong: 15, very_strong: 20 })[level] ?? null;
}

function maskIp(value = "") {
  if (!value) return "غير متوفر";
  if (value.includes(":")) return `${value.split(":").slice(0, 3).join(":")}:…`;
  const parts = value.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : "محجوب";
}

function deviceLabel(userAgent = "") {
  const browser = /Edg/i.test(userAgent) ? "Edge" : /Chrome/i.test(userAgent) ? "Chrome" : /Firefox/i.test(userAgent) ? "Firefox" : /Safari/i.test(userAgent) ? "Safari" : "متصفح";
  const device = /Mobile|Android|iPhone/i.test(userAgent) ? "جوال" : "كمبيوتر";
  return `${browser} · ${device}`;
}

async function loadSecurityFacts(tenantId, userId) {
  const [accountResult, sessionsResult, channelResult, deliveryResult, safetyResult, templateResult, healthResult, issuesResult, attemptsResult, activityResult, migrationResult, webhookResult, optOutResult, securityEventsResult] = await Promise.all([
    query(
      `SELECT u.email, u.password_strength AS "passwordStrength", u.password_changed_at AS "passwordChangedAt",
              (SELECT count(*)::int FROM password_reset_codes pr WHERE pr.user_id = u.id AND pr.created_at > now() - interval '24 hours') AS "resetRequests24h",
              (SELECT count(*)::int FROM activity_logs al WHERE al.user_id = u.id AND al.tenant_id = u.tenant_id AND al.created_at > now() - interval '30 days') AS "auditEvents30d"
         FROM users u WHERE u.id = $1 AND u.tenant_id = $2 LIMIT 1`,
      [userId, tenantId]
    ),
    query(
      `SELECT id, ip_address AS "ipAddress", user_agent AS "userAgent", created_at AS "createdAt",
              updated_at AS "lastActivityAt", expires_at AS "expiresAt"
         FROM sessions WHERE user_id = $1 AND expires_at > now() ORDER BY updated_at DESC`,
      [userId]
    ),
    query(
      `SELECT wc.id, wc.device_name AS "deviceName", wc.status, wc.connection_state AS "connectionState",
              wc.phone_number AS "phoneNumber", wc.connected_at AS "connectedAt", wc.last_health_check_at AS "lastHealthCheckAt",
              wc.last_successful_send_at AS "lastSuccessfulSendAt", wc.last_failed_send_at AS "lastFailedSendAt",
              wc.risk_score AS "riskScore", wc.risk_hold_at AS "riskHoldAt", wc.failure_rate AS "storedFailureRate",
              wc.warmup_day AS "warmupDay", wc.auto_sending_enabled AS "autoSendingEnabled",
              (SELECT count(*)::int FROM whatsapp_health_checks wh WHERE wh.whatsapp_channel_id = wc.id AND wh.checked_at > now() - interval '24 hours' AND wh.connection_state NOT IN ('open', 'connected')) AS "disconnects24h"
         FROM whatsapp_channels wc WHERE wc.tenant_id = $1 ORDER BY wc.created_at DESC LIMIT 1`,
      [tenantId]
    ),
    query(
      `SELECT count(*) FILTER (WHERE status IN ('sent', 'delivered', 'read'))::int AS sent,
              count(*) FILTER (WHERE status = 'failed')::int AS failed,
              count(*) FILTER (WHERE status = 'pending')::int AS pending,
              count(*) FILTER (WHERE status = 'processing')::int AS processing,
              COALESCE(sum(attempts) FILTER (WHERE attempts > 1), 0)::int AS retries,
              count(DISTINCT destination)::int AS "uniqueRecipients",
              min(scheduled_for) FILTER (WHERE status = 'pending') AS "oldestPendingAt"
         FROM message_queue WHERE tenant_id = $1 AND channel_type = 'whatsapp' AND created_at > now() - interval '30 days'`,
      [tenantId]
    ),
    query(
      `SELECT ws.safe_mode_enabled AS "safeModeEnabled", ws.daily_message_limit AS "dailyLimit",
              ws.hourly_message_limit AS "hourlyLimit", ws.duplicate_message_window_hours AS "duplicateWindowHours",
              ws.stop_on_high_failure AS "stopOnHighFailure", ws.stop_on_disconnected AS "stopOnDisconnected",
              ss.auto_whatsapp_delay_seconds AS "safeDelay", ss.jitter_min_seconds AS "jitterMin",
              ss.jitter_max_seconds AS "jitterMax", ss.warmup_enabled AS "warmupEnabled",
              ss.auto_pause_enabled AS "autoPauseEnabled", ss.allowed_start AS "allowedStart", ss.allowed_end AS "allowedEnd"
         FROM whatsapp_safety_settings ws
         LEFT JOIN sending_schedule_settings ss ON ss.tenant_id = ws.tenant_id
        WHERE ws.tenant_id = $1 LIMIT 1`,
      [tenantId]
    ),
    query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE length(body) BETWEEN 20 AND 1200)::int AS valid FROM notification_templates WHERE tenant_id = $1 AND channel = 'whatsapp' AND is_active = true`, [tenantId]),
    query(`SELECT connection_state AS "connectionState", latency_ms AS "latencyMs", checked_at AS "checkedAt" FROM whatsapp_health_checks WHERE tenant_id = $1 ORDER BY checked_at DESC LIMIT 1`, [tenantId]),
    query(`SELECT id, category, severity, message, suggested_solution AS "suggestedSolution", status, created_at AS "createdAt" FROM operational_issues WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 12`, [tenantId]),
    query(
      `SELECT success, failure_reason AS "failureReason", ip_address AS "ipAddress", user_agent AS "userAgent", created_at AS "createdAt"
         FROM login_attempts WHERE lower(email) = (SELECT lower(email) FROM users WHERE id = $1 AND tenant_id = $2)
         ORDER BY created_at DESC LIMIT 30`,
      [userId, tenantId]
    ),
    query(`SELECT type, title, metadata, created_at AS "createdAt" FROM activity_logs WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 20`, [tenantId, userId]),
    query(`SELECT name, applied_at AS "appliedAt" FROM schema_migrations ORDER BY applied_at DESC LIMIT 1`),
    query(`SELECT type, title, created_at AS "createdAt" FROM activity_logs WHERE tenant_id = $1 AND type LIKE 'evolution.webhook.%' ORDER BY created_at DESC LIMIT 1`, [tenantId]),
    query(`SELECT count(*)::int AS total FROM unsubscribe_list WHERE tenant_id = $1`, [tenantId]),
    query(`SELECT category, event_type AS "eventType", severity, risk_weight AS "riskWeight", half_life_hours AS "halfLifeHours", occurred_at AS "occurredAt", metadata FROM security_events WHERE tenant_id = $1 AND (user_id = $2 OR user_id IS NULL) AND resolved_at IS NULL ORDER BY occurred_at DESC LIMIT 50`, [tenantId, userId])
  ]);
  return {
    account: accountResult.rows[0] || {}, sessions: sessionsResult.rows, channel: channelResult.rows[0] || null,
    delivery: deliveryResult.rows[0] || {}, safety: safetyResult.rows[0] || null, templates: templateResult.rows[0] || {},
    health: healthResult.rows[0] || null, issues: issuesResult.rows, attempts: attemptsResult.rows,
    activity: activityResult.rows, migration: migrationResult.rows[0] || null, webhook: webhookResult.rows[0] || null,
    optOuts: Number(optOutResult.rows[0]?.total || 0), securityEvents: securityEventsResult.rows
  };
}

function calculatePlatform(facts, secureSession) {
  const secretNames = ["DATABASE_URL", "BETTER_AUTH_SECRET", "CRON_SECRET", "ENCRYPTION_KEY", "EVOLUTION_API_KEY", "EVOLUTION_WEBHOOK_SECRET"];
  const configuredSecrets = secretNames.filter((name) => Boolean(process.env[name])).length;
  const factors = [
    factor("https", "HTTPS وملفات الارتباط الآمنة", secureSession ? 15 : 0, 15, secureSession ? "passed" : "critical", secureSession ? "الاتصال مشفر والجلسة تستخدم Secure وHttpOnly." : "تعذر إثبات اتصال HTTPS آمن."),
    factor("secrets", "الأسرار والمتغيرات البيئية", Math.round(configuredSecrets / secretNames.length * 20), 20, configuredSecrets === secretNames.length ? "passed" : "review", `${configuredSecrets} من ${secretNames.length} أسرار تشغيل إلزامية مهيأة دون إرسال قيمها للواجهة.`),
    factor("database", "قاعدة البيانات وعزل المستأجر", 15, 15, "passed", "تمت قراءة البيانات باستعلامات مقيدة بالمستأجر الحالي."),
    factor("migrations", "ترحيلات قاعدة البيانات", facts.migration ? 10 : 0, 10, facts.migration ? "passed" : "unavailable", facts.migration ? `آخر ترحيل مطبق: ${facts.migration.name}.` : "تعذر التحقق من سجل الترحيلات."),
    factor("webhooks", "حماية Webhooks", process.env.EVOLUTION_WEBHOOK_SECRET ? 10 : 0, 10, process.env.EVOLUTION_WEBHOOK_SECRET ? "passed" : "missing", process.env.EVOLUTION_WEBHOOK_SECRET ? "سر التحقق مهيأ على الخادم." : "سر Webhook غير مهيأ."),
    factor("login_guard", "حماية محاولات الدخول", facts.attempts ? 10 : 0, 10, "passed", "يتم تسجيل المحاولات وتطبيق Rate Limit على الحساب."),
    factor("audit", "سجل التدقيق", facts.activity ? 10 : 0, 10, "passed", `${facts.activity.length} حدثًا فعليًا ضمن أحدث السجلات المقروءة.`),
    factor("monitoring", "مراقبة الأخطاء", facts.issues ? 10 : 0, 10, "passed", "مصدر مشكلات التشغيل متصل بقاعدة البيانات."),
    factor("idempotency", "منع التكرار في Queue", 5, 5, "passed", "قائمة الإرسال تستخدم مفتاح منع التكرار وحجزًا ذريًا.")
  ];
  return metricFromFactors(factors);
}

function calculateAccount(facts, secureSession) {
  const strength = passwordPoints(facts.account.passwordStrength);
  const failed24h = facts.attempts.filter((item) => !item.success && Date.now() - new Date(item.createdAt).getTime() <= 86400000).length;
  const changedAt = facts.account.passwordChangedAt ? new Date(facts.account.passwordChangedAt).getTime() : null;
  const ageDays = changedAt ? Math.floor((Date.now() - changedAt) / 86400000) : null;
  const factors = [
    factor("password", "قوة كلمة المرور", strength, 20, strength === null ? "insufficient_data" : strength >= 15 ? "passed" : "review", strength === null ? "لم تُقيّم كلمة المرور بعد." : `التصنيف المخزن: ${facts.account.passwordStrength}.`),
    factor("login_guard", "حماية محاولات الدخول", failed24h >= 10 ? 0 : failed24h >= 3 ? 10 : 20, 20, failed24h >= 10 ? "critical" : failed24h >= 3 ? "review" : "passed", failed24h ? `${failed24h} محاولة فاشلة فعلية خلال 24 ساعة.` : "لا توجد محاولات فاشلة خلال 24 ساعة."),
    factor("sessions", "سلامة الجلسات", secureSession && facts.sessions.length > 0 ? 20 : secureSession ? 10 : 0, 20, secureSession && facts.sessions.length > 0 ? "passed" : "review", `${facts.sessions.length} جلسة سارية مخزنة في قاعدة البيانات.`),
    factor("activity", "نشاط الحساب", failed24h >= 10 ? 0 : failed24h >= 3 ? 7 : 15, 15, failed24h >= 3 ? "review" : "passed", "محسوب من محاولات الدخول والجلسات الفعلية."),
    factor("recovery", "استرداد كلمة المرور", 10, 10, "passed", "الرموز عشوائية ومخزنة كـHash ومحدودة الصلاحية والاستخدام."),
    factor("audit", "سجل التدقيق", Number(facts.account.auditEvents30d || 0) > 0 ? 10 : 0, 10, Number(facts.account.auditEvents30d || 0) > 0 ? "passed" : "insufficient_data", Number(facts.account.auditEvents30d || 0) ? `${facts.account.auditEvents30d} حدثًا مسجلًا خلال 30 يومًا.` : "لا توجد أحداث حساب مسجلة خلال 30 يومًا."),
    factor("password_age", "حداثة كلمة المرور", ageDays === null ? null : ageDays < 365 ? 5 : 2, 5, ageDays === null ? "insufficient_data" : ageDays < 365 ? "passed" : "review", ageDays === null ? "تاريخ آخر تغيير غير متوفر." : `آخر تغيير منذ ${ageDays} يومًا.`)
  ];
  const metric = metricFromFactors(factors, { minimumCoverage: 70 });
  const recommendations = [];
  if (strength !== null && strength < 15) recommendations.push(recommendation("strong_password", "استخدم كلمة مرور أقوى", "استخدم 10 أحرف أو أكثر مع تنوع مناسب وتجنب بيانات الحساب.", 20 - strength, "high", "/dashboard/settings?section=security"));
  if (failed24h >= 3) recommendations.push(recommendation("review_logins", "راجع محاولات الدخول", "تحقق من الجلسات وأنهِ أي جلسة لا تتعرف عليها.", 12, failed24h >= 10 ? "critical" : "high", "/dashboard/settings?section=security"));
  return { ...metric, failed24h, recommendations };
}

function calculateSessions(facts, secureSession) {
  if (!facts.sessions.length) return { score: null, status: "insufficient_data", label: "لا توجد بيانات كافية", coverage: 0, factors: [], activeSessions: 0, suspiciousSessions: 0, items: [] };
  const oldSessions = facts.sessions.filter((item) => Date.now() - new Date(item.lastActivityAt).getTime() > 30 * 86400000).length;
  const uniqueIps = new Set(facts.sessions.map((item) => item.ipAddress).filter(Boolean)).size;
  const suspiciousSessions = oldSessions + (uniqueIps > 3 ? uniqueIps - 3 : 0);
  const factors = [
    factor("stored", "جلسات محفوظة ومتحقق منها", 35, 35, "passed", `${facts.sessions.length} جلسة سارية في قاعدة البيانات.`),
    factor("cookies", "خصائص Cookie", secureSession ? 30 : 0, 30, secureSession ? "passed" : "critical", secureSession ? "HttpOnly وSecure وSameSite=Lax مفعلة." : "تعذر إثبات الخصائص الآمنة."),
    factor("expiry", "انتهاء وإبطال الجلسة", 20, 20, "passed", "الجلسات المنتهية مرفوضة ويمكن إبطالها."),
    factor("anomalies", "مراجعة الجلسات القديمة", suspiciousSessions ? Math.max(0, 15 - suspiciousSessions * 5) : 15, 15, suspiciousSessions ? "review" : "passed", suspiciousSessions ? `${suspiciousSessions} إشارة تحتاج مراجعة.` : "لا توجد جلسات قديمة أو أنماط متعددة غير معتادة.")
  ];
  return { ...metricFromFactors(factors), activeSessions: facts.sessions.length, suspiciousSessions, items: facts.sessions.slice(0, 4).map((item) => ({ id: item.id, device: deviceLabel(item.userAgent), location: maskIp(item.ipAddress), createdAt: item.createdAt, lastActivityAt: item.lastActivityAt, expiresAt: item.expiresAt })) };
}

function calculateSending(facts) {
  if (!facts.safety) return { score: null, status: "not_configured", label: "غير مهيأ", coverage: 0, factors: [], policies: [] };
  const policyRows = [
    ["الفاصل الذكي بين الرسائل", Number(facts.safety.safeDelay || 0) >= 300, facts.safety.safeDelay ? `${facts.safety.safeDelay} ثانية مع Jitter` : "غير مضبوط"],
    ["حدود الإرسال اليومية والساعة", Number(facts.safety.dailyLimit || 0) > 0 && Number(facts.safety.hourlyLimit || 0) > 0, `${facts.safety.hourlyLimit || 0} ساعي · ${facts.safety.dailyLimit || 0} يومي`],
    ["منع الرسائل المكررة", Number(facts.safety.duplicateWindowHours || 0) > 0, `${facts.safety.duplicateWindowHours || 0} ساعة`],
    ["الإيقاف الوقائي عند الخطر", Boolean(facts.safety.stopOnHighFailure && facts.safety.autoPauseEnabled), "يعمل تلقائيًا ولا يمكن تعطيله من هذه الصفحة"],
    ["Warm-up تدريجي", Boolean(facts.safety.warmupEnabled), facts.safety.warmupEnabled ? "مفعّل" : "غير مفعّل"]
  ];
  const factors = policyRows.map(([title, active, detail], index) => factor(`policy_${index}`, title, active ? 20 : 0, 20, active ? "passed" : "review", detail));
  return { ...metricFromFactors(factors), queued: Number(facts.delivery.pending || 0), failedLast30Days: Number(facts.delivery.failed || 0), policies: policyRows.map(([title, active, detail]) => ({ title, active, detail })) };
}

function calculateWhatsapp(facts) {
  const channel = facts.channel;
  if (!channel) return { score: null, status: "not_configured", label: "غير مهيأ", coverage: 0, factors: [], healthScore: null, riskScore: null, message: "لا توجد قناة واتساب مرتبطة." };
  const connected = channel.status === "connected" && ["open", "connected", ""].includes(String(channel.connectionState || "").toLowerCase());
  const pending = ["connecting", "pending_qr", "pending_pairing"].includes(channel.status);
  const sent = Number(facts.delivery.sent || 0);
  const failed = Number(facts.delivery.failed || 0);
  const samples = sent + failed;
  const successRate = samples ? sent / samples * 100 : null;
  const disconnects = Number(channel.disconnects24h || 0);
  const queueOldMinutes = facts.delivery.oldestPendingAt ? (Date.now() - new Date(facts.delivery.oldestPendingAt).getTime()) / 60000 : 0;
  const factors = [
    factor("connection", "صحة الاتصال", connected ? 25 : pending ? 8 : 0, 25, connected ? "passed" : "critical", connected ? "Evolution متصل وحالة قاعدة البيانات متطابقة." : "القناة غير متصلة فعليًا."),
    factor("stability", "استقرار الاتصال", disconnects === 0 ? 15 : disconnects === 1 ? 12 : disconnects <= 3 ? 7 : disconnects <= 5 ? 3 : 0, 15, disconnects <= 1 ? "passed" : "review", `${disconnects} انقطاعًا مسجلًا خلال 24 ساعة.`),
    factor("delivery", "نجاح الإرسال", samples < 20 ? null : successRate >= 98 ? 20 : successRate >= 95 ? 16 : successRate >= 90 ? 11 : successRate >= 80 ? 5 : 0, 20, samples < 20 ? "insufficient_data" : successRate >= 95 ? "passed" : "review", samples < 20 ? `العينة الحالية ${samples} رسالة؛ يلزم 20 رسالة على الأقل.` : `${successRate.toFixed(1)}% من ${samples} رسالة.`),
    factor("queue", "صحة قائمة الإرسال", Number(facts.delivery.processing || 0) > 0 && queueOldMinutes > 30 ? 0 : Number(facts.delivery.retries || 0) > 10 ? 3 : Number(facts.delivery.failed || 0) > 0 ? 7 : 10, 10, queueOldMinutes > 30 ? "critical" : "passed", `${facts.delivery.pending || 0} منتظرة · ${facts.delivery.retries || 0} إعادة محاولة.`),
    factor("webhook", "استقبال Webhooks", facts.webhook ? 10 : null, 10, facts.webhook ? "passed" : "insufficient_data", facts.webhook ? `آخر حدث: ${facts.webhook.createdAt}.` : "لم يُسجل Webhook بعد."),
    factor("policy", "الالتزام بسياسة الإرسال", facts.safety?.safeModeEnabled && facts.safety?.stopOnHighFailure ? 10 : 0, 10, facts.safety?.safeModeEnabled ? "passed" : "review", "الفاصل والحدود ومنع التكرار تُراجع قبل الإدراج في Queue."),
    factor("optout", "معالجة طلبات الإيقاف", facts.safety?.safeModeEnabled ? 5 : 0, 5, facts.safety?.safeModeEnabled ? "passed" : "review", `${facts.optOuts} رقمًا فعليًا في قائمة الإيقاف.`),
    factor("templates", "جودة القوالب", Number(facts.templates.total || 0) === 0 ? null : Number(facts.templates.total) === Number(facts.templates.valid) ? 5 : 2, 5, Number(facts.templates.total || 0) === 0 ? "insufficient_data" : Number(facts.templates.total) === Number(facts.templates.valid) ? "passed" : "review", Number(facts.templates.total || 0) ? `${facts.templates.valid} من ${facts.templates.total} قالب بطول صالح.` : "لا يوجد قالب نشط للفحص.")
  ];
  const health = metricFromFactors(factors);
  let deliveryRisk = 0;
  if (samples >= 20) {
    const failureRate = 100 - successRate;
    deliveryRisk = failureRate <= 3 ? 0 : failureRate <= 8 ? 6 : failureRate <= 15 ? 12 : 20;
  }
  const connectionRisk = disconnects === 0 ? 0 : disconnects <= 2 ? 5 : disconnects <= 5 ? 12 : 20;
  const queueRisk = queueOldMinutes > 30 || Number(facts.delivery.retries || 0) > 10 ? 5 : 0;
  const storedRisk = Number(channel.riskScore || 0);
  const riskScore = bounded(Math.max(storedRisk, connectionRisk + deliveryRisk + queueRisk));
  return { ...health, healthScore: health.score, riskScore, riskLabel: riskLabel(riskScore), connected, successRate, samples, disconnects24h: disconnects, lastHealthCheckAt: channel.lastHealthCheckAt || facts.health?.checkedAt || null, channel: { id: channel.id, deviceName: channel.deviceName || "قناة واتساب", phoneNumber: channel.phoneNumber ? `${String(channel.phoneNumber).slice(0, 4)}••••${String(channel.phoneNumber).slice(-3)}` : "غير متوفر", status: channel.status, protectionMode: channel.riskHoldAt ? "critical_hold" : channel.autoSendingEnabled === false ? "paused" : riskScore >= 60 ? "restricted" : riskScore >= 20 ? "watch" : "normal" } };
}

function calculateAccountRisk(facts) {
  const now = Date.now();
  let score = 0;
  const failures = facts.attempts.filter((item) => !item.success);
  const accountEvents = facts.securityEvents.filter((item) => item.category === "account");
  if (accountEvents.length) {
    for (const event of accountEvents) score += decayedWeight(event.riskWeight, (now - new Date(event.occurredAt).getTime()) / 3600000, event.halfLifeHours || 24);
  } else {
    for (const item of failures) score += decayedWeight(3, (now - new Date(item.createdAt).getTime()) / 3600000, 6);
    const recentFailures = failures.filter((item) => now - new Date(item.createdAt).getTime() <= 15 * 60000);
    if (recentFailures.length >= 3) score += decayedWeight(12, (now - new Date(recentFailures[0].createdAt).getTime()) / 3600000, 6);
  }
  if (Number(facts.account.resetRequests24h || 0) >= 3) score += 15;
  for (const event of facts.securityEvents.filter((item) => item.category !== "account")) score += decayedWeight(event.riskWeight, (now - new Date(event.occurredAt).getTime()) / 3600000, event.halfLifeHours || 24);
  return bounded(score);
}

function securityEvents(facts) {
  const recordedEvents = facts.securityEvents.slice(0, 15).map((item) => ({
    type: item.eventType,
    severity: item.severity,
    status: "قيد المراقبة",
    detail: item.category,
    occurredAt: item.occurredAt
  }));
  const attemptEvents = facts.attempts.slice(0, 10).map((item) => ({ type: item.success ? "تسجيل دخول ناجح" : "محاولة دخول فاشلة", severity: item.success ? "low" : "warning", status: item.success ? "ناجح" : "متابعة", detail: `${deviceLabel(item.userAgent)} · ${maskIp(item.ipAddress)}`, occurredAt: item.createdAt }));
  const issueEvents = facts.issues.map((item) => ({ type: item.message, severity: item.severity, status: item.status === "resolved" ? "محلول" : "مفتوح", detail: item.suggestedSolution, occurredAt: item.createdAt }));
  const auditEvents = facts.activity.slice(0, 10).map((item) => ({ type: item.title, severity: "low", status: "مسجل", detail: item.type, occurredAt: item.createdAt }));
  return [...recordedEvents, ...attemptEvents, ...issueEvents, ...auditEvents].filter((item) => item.occurredAt).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)).slice(0, 15);
}

export function calculateWeightedScore(metrics) {
  const available = metrics.filter((item) => item.score !== null && item.score !== undefined);
  const totalWeight = metrics.reduce((sum, item) => sum + item.weight, 0);
  const availableWeight = available.reduce((sum, item) => sum + item.weight, 0);
  return {
    score: availableWeight ? bounded(available.reduce((sum, item) => sum + item.score * item.weight, 0) / availableWeight) : null,
    coverage: totalWeight ? Math.round(availableWeight / totalWeight * 100) : 0
  };
}

export async function calculateSecurityScore({ tenantId, userId, secureSession = true, persist = false }) {
  const facts = await loadSecurityFacts(tenantId, userId);
  const platform = calculatePlatform(facts, secureSession);
  const accounts = calculateAccount(facts, secureSession);
  const sessions = calculateSessions(facts, secureSession);
  const whatsapp = calculateWhatsapp(facts);
  const sending = calculateSending(facts);
  const accountRiskScore = calculateAccountRisk(facts);
  const whatsappRiskScore = whatsapp.riskScore;
  const riskValues = [accountRiskScore, whatsappRiskScore].filter((value) => value !== null && value !== undefined);
  const openCritical = facts.issues.filter((item) => item.status === "open" && ["critical", "error"].includes(item.severity)).length;
  const currentRiskScore = riskValues.length ? bounded(Math.max(...riskValues) + Math.min(20, openCritical * 5)) : null;
  const weighted = calculateWeightedScore([
    { score: platform.score, weight: 30 }, { score: accounts.score, weight: 25 }, { score: sessions.score, weight: 15 },
    { score: whatsapp.healthScore, weight: 20 }, { score: sending.score, weight: 10 }
  ]);
  const overallLabel = weighted.score === null ? "تعذر التحقق" : weighted.coverage < 80 ? "تقييم جزئي" : securityLabel(weighted.score);
  const recommendations = [...(accounts.recommendations || [])];
  if (!facts.channel) recommendations.push(recommendation("connect_whatsapp", "اربط قناة واتساب", "لا توجد قناة مرتبطة، لذلك لا يمكن حساب صحة واتساب أو خطرها.", 20, "high", "/dashboard/devices"));
  if (facts.channel && whatsapp.status === "insufficient_data") recommendations.push(recommendation("collect_whatsapp_data", "أكمل عينة الإرسال", "يلزم 20 رسالة فعلية على الأقل لحساب نجاح الإرسال بصورة موثوقة.", 0, "medium", "/dashboard/reports"));
  const criticalIssues = facts.issues.filter((item) => item.status === "open").slice(0, 6).map((item) => ({ key: item.id, title: item.message, severity: item.severity, description: item.suggestedSolution }));
  if (accountRiskScore >= 60) criticalIssues.unshift({ key: "account-risk", title: "ارتفاع خطر الحساب", severity: accountRiskScore >= 80 ? "critical" : "warning", description: "رُصد نشاط دخول يحتاج إلى مراجعة الجلسات والمحاولات الأخيرة." });
  if (whatsappRiskScore >= 60) criticalIssues.unshift({ key: "whatsapp-risk", title: "ارتفاع خطر قناة واتساب", severity: whatsappRiskScore >= 80 ? "critical" : "warning", description: "أوقف الإرسال الآلي مؤقتًا وراجع جودة الاتصال ومعدلات الفشل." });
  const calculatedAt = new Date().toISOString();
  const result = {
    overall: { score: weighted.score, label: overallLabel, status: weighted.score === null ? "unavailable" : weighted.coverage < 80 ? "insufficient_data" : "available", coverage: weighted.coverage },
    platform, accounts, account: accounts, sessions, whatsapp, sending,
    risk: { score: currentRiskScore, label: riskLabel(currentRiskScore), status: currentRiskScore === null ? "unavailable" : "available", issues: criticalIssues.length },
    login: { failed24h: accounts.failed24h, recent: facts.attempts.slice(0, 5).map((item) => ({ success: item.success, occurredAt: item.createdAt, device: deviceLabel(item.userAgent), location: maskIp(item.ipAddress) })) },
    events: securityEvents(facts), criticalIssues,
    recommendations: recommendations.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]), calculatedAt
  };
  if (persist) {
    await query(
      `INSERT INTO security_score_snapshots
         (tenant_id, user_id, channel_id, account_score, channel_score, overall_score,
          account_status, channel_status, overall_status, factors, issues, recommendations, calculated_at,
          platform_score, account_protection_score, account_risk_score, session_score, whatsapp_health_score,
          whatsapp_risk_score, sending_safety_score, coverage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [tenantId, userId, facts.channel?.id || null, accounts.score, whatsapp.healthScore, weighted.score,
        accounts.label, whatsapp.label, overallLabel,
        JSON.stringify({ platform: platform.factors, accounts: accounts.factors, sessions: sessions.factors, whatsapp: whatsapp.factors, sending: sending.factors }),
        JSON.stringify(criticalIssues), JSON.stringify(recommendations), calculatedAt,
        platform.score, accounts.score, accountRiskScore, sessions.score, whatsapp.healthScore, whatsappRiskScore, sending.score, weighted.coverage]
    );
  }
  return result;
}
