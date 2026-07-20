import { query } from "./db.js";

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };

function bounded(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function securityLabel(score) {
  if (score === null || score === undefined) return "غير مهيأة";
  if (score < 30) return "خطر";
  if (score < 50) return "ضعيف";
  if (score < 70) return "يحتاج تحسين";
  if (score < 85) return "جيد";
  if (score < 95) return "قوي";
  return "ممتاز";
}

function recommendation(key, title, description, scoreImpact, priority, actionUrl) {
  return { key, title, description, scoreImpact, priority, actionUrl };
}

function factor(key, title, points, maxPoints, state, detail) {
  return { key, title, points, maxPoints, state, detail };
}

function passwordPoints(level) {
  return ({ weak: 0, fair: 5, strong: 10, very_strong: 15 })[level] ?? 0;
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

async function loadSecurityFacts(tenantId, userId) {
  const [accountResult, channelResult, deliveryResult, safetyResult, templateResult] = await Promise.all([
    query(
      `SELECT u.email_verified AS "emailVerified", u.mfa_enabled AS "mfaEnabled",
              COALESCE(jsonb_array_length(u.mfa_recovery_hashes), 0)::int AS "recoveryCodes",
              u.password_strength AS "passwordStrength", u.password_changed_at AS "passwordChangedAt",
              (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now()) AS "activeSessions",
              (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now() AND s.updated_at < now() - interval '30 days') AS "oldSessions",
              (SELECT count(*)::int FROM login_attempts la WHERE lower(la.email) = lower(u.email) AND la.success = false AND la.created_at > now() - interval '30 days') AS "failedLogins",
              (SELECT count(*)::int FROM login_attempts la WHERE lower(la.email) = lower(u.email) AND la.success = false AND la.created_at > now() - interval '24 hours') AS "recentFailedLogins"
         FROM users u WHERE u.id = $1 AND u.tenant_id = $2 LIMIT 1`,
      [userId, tenantId]
    ),
    query(
      `SELECT wc.id, wc.status, wc.connection_state AS "connectionState", wc.phone_number AS "phoneNumber",
              wc.connected_at AS "connectedAt", wc.last_health_check_at AS "lastHealthCheckAt",
              wc.last_successful_send_at AS "lastSuccessfulSendAt", wc.last_failed_send_at AS "lastFailedSendAt",
              wc.risk_score AS "riskScore", wc.risk_hold_at AS "riskHoldAt",
              wc.failure_rate AS "storedFailureRate", wc.warmup_day AS "warmupDay",
              (SELECT count(*)::int FROM whatsapp_health_checks wh WHERE wh.whatsapp_channel_id = wc.id AND wh.checked_at > now() - interval '24 hours' AND wh.connection_state NOT IN ('open', 'connected')) AS "disconnects24h"
         FROM whatsapp_channels wc WHERE wc.tenant_id = $1 ORDER BY wc.created_at DESC LIMIT 1`,
      [tenantId]
    ),
    query(
      `SELECT count(*) FILTER (WHERE status IN ('sent', 'delivered', 'read'))::int AS sent,
              count(*) FILTER (WHERE status = 'failed')::int AS failed,
              count(*)::int AS total
         FROM message_queue WHERE tenant_id = $1 AND channel_type = 'whatsapp' AND created_at > now() - interval '30 days'`,
      [tenantId]
    ),
    query(
      `SELECT ws.safe_mode_enabled AS "safeModeEnabled", ws.daily_message_limit AS "dailyLimit",
              ws.hourly_message_limit AS "hourlyLimit", ws.stop_on_high_failure AS "stopOnHighFailure",
              ws.stop_on_disconnected AS "stopOnDisconnected",
              ss.auto_whatsapp_delay_seconds AS "safeDelay", ss.warmup_enabled AS "warmupEnabled",
              ss.auto_pause_enabled AS "autoPauseEnabled"
         FROM whatsapp_safety_settings ws
         LEFT JOIN sending_schedule_settings ss ON ss.tenant_id = ws.tenant_id
        WHERE ws.tenant_id = $1 LIMIT 1`,
      [tenantId]
    ),
    query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE length(body) BETWEEN 20 AND 1200 AND body !~* '(free money|guaranteed profit|اربح بسرعة)')::int AS safe
         FROM notification_templates WHERE tenant_id = $1 AND channel = 'whatsapp' AND is_active = true`,
      [tenantId]
    )
  ]);
  return {
    account: accountResult.rows[0] || {},
    channel: channelResult.rows[0] || null,
    delivery: deliveryResult.rows[0] || {},
    safety: safetyResult.rows[0] || {},
    templates: templateResult.rows[0] || {}
  };
}

function calculateAccount(facts, secureSession) {
  const factors = [];
  const recommendations = [];
  const issues = [];
  let score = 0;
  const emailPoints = facts.emailVerified ? 15 : 0;
  score += emailPoints;
  factors.push(factor("email_verified", "تأكيد البريد", emailPoints, 15, facts.emailVerified ? "passed" : "missing", facts.emailVerified ? "البريد مؤكد." : "البريد لم يُؤكد بعد."));
  if (!facts.emailVerified) recommendations.push(recommendation("verify_email", "أكد بريدك الإلكتروني", "استخدم رابط التحقق لتأمين الاسترداد والتنبيهات.", 15, "high", "/dashboard/settings"));

  const strengthPoints = passwordPoints(facts.passwordStrength);
  score += strengthPoints;
  factors.push(factor("password_strength", "قوة كلمة المرور", strengthPoints, 15, strengthPoints >= 10 ? "passed" : "missing", facts.passwordStrength ? "تم تقييم القوة دون تخزين كلمة المرور." : "لم تُقيّم كلمة المرور بعد."));
  if (strengthPoints < 10) recommendations.push(recommendation("strengthen_password", "استخدم كلمة مرور أقوى", "استخدم 10 أحرف على الأقل مع حروف وأرقام ورمز.", 15 - strengthPoints, "high", "/dashboard/settings?section=security"));

  const mfaPoints = facts.mfaEnabled ? 25 : 0;
  score += mfaPoints;
  factors.push(factor("mfa", "المصادقة الثنائية", mfaPoints, 25, facts.mfaEnabled ? "passed" : "missing", facts.mfaEnabled ? "مفعلة ومتحقق منها." : "غير مفعلة."));
  if (!facts.mfaEnabled) recommendations.push(recommendation("enable_mfa", "فعّل المصادقة الثنائية", "تحمي حسابك حتى عند تسرب كلمة المرور.", 25, "high", "/dashboard/settings?section=security"));

  const recoveryPoints = Number(facts.recoveryCodes || 0) > 0 ? 5 : 0;
  score += recoveryPoints;
  factors.push(factor("recovery_codes", "رموز الاسترداد", recoveryPoints, 5, recoveryPoints ? "passed" : "missing", recoveryPoints ? "تتوفر رموز استرداد مشفرة." : "لا توجد رموز استرداد صالحة."));
  if (!recoveryPoints) recommendations.push(recommendation("recovery_codes", "أنشئ رموز استرداد", "احتفظ برموز بديلة لاستعادة الوصول عند فقد جهاز المصادقة.", 5, "medium", "/dashboard/settings?section=security"));

  const activeSessions = Number(facts.activeSessions || 0);
  const sessionPoints = Number(facts.oldSessions || 0) > 0 || activeSessions > 5 ? 5 : activeSessions > 0 ? 10 : 0;
  score += sessionPoints;
  factors.push(factor("sessions", "الجلسات النشطة", sessionPoints, 10, sessionPoints === 10 ? "passed" : "review", activeSessions ? `${activeSessions} جلسة نشطة.` : "لا توجد جلسة نشطة قابلة للتقييم."));
  if (sessionPoints < 10) recommendations.push(recommendation("review_sessions", "راجع الجلسات النشطة", "أنه الجلسات القديمة أو التي لا تتعرف عليها.", 10 - sessionPoints, "medium", "/dashboard/settings?section=security"));

  const changedAt = facts.passwordChangedAt ? new Date(facts.passwordChangedAt).getTime() : 0;
  const ageDays = changedAt ? (Date.now() - changedAt) / 86400000 : Infinity;
  const agePoints = ageDays < 180 ? 10 : ageDays <= 365 ? 5 : 0;
  score += agePoints;
  factors.push(factor("password_age", "حداثة كلمة المرور", agePoints, 10, agePoints === 10 ? "passed" : "review", changedAt ? `آخر تغيير منذ ${Math.max(0, Math.floor(ageDays))} يومًا.` : "تاريخ التغيير غير متوفر."));
  if (agePoints < 10) recommendations.push(recommendation("refresh_password", "راجع كلمة مرورك", "اختر كلمة مرور حديثة وقوية إذا كانت قديمة أو غير مقيمة.", 10 - agePoints, "medium", "/dashboard/settings?section=security"));

  const recentFailures = Number(facts.recentFailedLogins || 0);
  const eventPoints = recentFailures >= 10 ? 0 : recentFailures >= 3 ? 5 : 10;
  score += eventPoints;
  factors.push(factor("security_events", "أحداث الدخول", eventPoints, 10, eventPoints === 10 ? "passed" : "review", recentFailures ? `${recentFailures} محاولة فاشلة خلال 24 ساعة.` : "لا توجد أحداث خطرة حديثة."));
  if (!eventPoints) issues.push({ key: "login_risk", title: "نشاط دخول يحتاج مراجعة", severity: "critical" });

  const recoveryDataPoints = facts.emailVerified ? 5 : 0;
  score += recoveryDataPoints;
  factors.push(factor("recovery_data", "بيانات الاسترداد", recoveryDataPoints, 5, recoveryDataPoints ? "passed" : "missing", recoveryDataPoints ? "يمكن الاسترداد عبر البريد المؤكد." : "بريد الاسترداد غير مؤكد."));

  const securePoints = secureSession ? 5 : 0;
  score += securePoints;
  factors.push(factor("secure_session", "الجلسة الآمنة", securePoints, 5, securePoints ? "passed" : "missing", securePoints ? "الجلسة تستخدم HttpOnly وSecure في بيئة HTTPS." : "تعذر إثبات خصائص الجلسة الآمنة."));

  score = bounded(score);
  if (!facts.mfaEnabled) score = Math.min(score, 89);
  if (!facts.emailVerified) score = Math.min(score, 75);
  return { score, label: securityLabel(score), status: "available", factors, issues, recommendations };
}

function calculateWhatsapp(channel, delivery, safety, templates) {
  if (!channel) {
    return {
      score: null,
      label: "غير مهيأة",
      status: "not_configured",
      factors: [],
      issues: [],
      recommendations: [recommendation("connect_whatsapp", "اربط رقم واتساب", "اربط قناة واتساب لبدء فحص صحة الإرسال.", 30, "high", "/dashboard/devices")]
    };
  }
  const factors = [];
  const issues = [];
  const recommendations = [];
  let score = 0;
  const connectionState = String(channel.connectionState || channel.status || "").toLowerCase();
  const connected = channel.status === "connected" && ["open", "connected", ""].includes(connectionState);
  const pending = ["connecting", "pending_qr", "pending_pairing"].includes(channel.status) || connectionState === "connecting";
  const connectionPoints = connected ? 20 : pending ? 5 : 0;
  score += connectionPoints;
  factors.push(factor("connection", "الاتصال الفعلي", connectionPoints, 20, connected ? "passed" : "critical", connected ? "القناة متصلة وفحص المزود مفتوح." : "القناة غير متصلة فعليًا."));
  if (!connected) {
    issues.push({ key: "channel_disconnected", title: "قناة واتساب غير متصلة", severity: "critical" });
    recommendations.push(recommendation("reconnect_whatsapp", "أعد ربط واتساب", "افتح صفحة الأجهزة وأكمل الربط ثم نفذ فحص الاتصال.", 20, "critical", "/dashboard/devices"));
  }

  const connectedDays = channel.connectedAt ? Math.max(0, (Date.now() - new Date(channel.connectedAt).getTime()) / 86400000) : 0;
  const stabilityPoints = !connected ? 0 : connectedDays > 14 ? 10 : connectedDays >= 8 ? 8 : connectedDays >= 3 ? 5 : 2;
  score += stabilityPoints;
  factors.push(factor("stability", "استقرار الاتصال", stabilityPoints, 10, stabilityPoints >= 8 ? "passed" : "review", connected ? `الاتصال مستمر منذ ${Math.floor(connectedDays)} يومًا.` : "لا يمكن قياس الاستقرار قبل الاتصال."));

  const lastSuccess = channel.lastSuccessfulSendAt ? new Date(channel.lastSuccessfulSendAt).getTime() : 0;
  const lastFailure = channel.lastFailedSendAt ? new Date(channel.lastFailedSendAt).getTime() : 0;
  const testPoints = lastSuccess > lastFailure ? 10 : lastSuccess ? 5 : 3;
  score += testPoints;
  factors.push(factor("send_test", "آخر اختبار إرسال", testPoints, 10, testPoints === 10 ? "passed" : "review", lastSuccess ? (lastSuccess > lastFailure ? "آخر إرسال مسجل ناجح." : "حدث فشل بعد آخر إرسال ناجح.") : "لم يتم اختبار الإرسال بعد."));

  const sent = Number(delivery.sent || 0);
  const failed = Number(delivery.failed || 0);
  const samples = sent + failed;
  const successRate = samples ? (sent / samples) * 100 : null;
  const deliveryPoints = samples < 5 ? 5 : successRate >= 98 ? 15 : successRate >= 95 ? 12 : successRate >= 90 ? 8 : successRate >= 80 ? 4 : 0;
  score += deliveryPoints;
  factors.push(factor("delivery_rate", "معدل نجاح الرسائل", deliveryPoints, 15, samples < 5 ? "insufficient_data" : deliveryPoints >= 12 ? "passed" : "review", samples < 5 ? "لا توجد بيانات كافية لتقييم موثوقية الإرسال." : `معدل النجاح ${successRate.toFixed(1)}% من ${samples} رسالة.`));
  if (samples >= 5 && successRate < 90) recommendations.push(recommendation("improve_delivery", "راجع الرسائل الفاشلة", "حل أخطاء الأرقام والقوالب قبل زيادة حجم الإرسال.", 15 - deliveryPoints, successRate < 70 ? "critical" : "high", "/dashboard/reports"));

  const delay = Number(safety.safeDelay || 0);
  const delayPoints = delay >= 300 ? 10 : delay >= 180 ? 7 : delay >= 60 ? 3 : 0;
  score += delayPoints;
  factors.push(factor("safe_delay", "الفاصل الآمن", delayPoints, 10, delayPoints === 10 ? "passed" : "review", delay ? `${delay} ثانية بين عمليات الإرسال التلقائي.` : "الفاصل الآمن غير مضبوط."));
  if (delayPoints < 10) recommendations.push(recommendation("safe_delay", "اضبط الفاصل الآمن", "استخدم فاصلًا تلقائيًا لا يقل عن 300 ثانية مع Jitter.", 10 - delayPoints, "high", "/dashboard/security"));

  const warmupPoints = safety.warmupEnabled ? 10 : connectedDays > 30 ? 8 : 0;
  score += warmupPoints;
  factors.push(factor("warmup", "التدرج Warm-up", warmupPoints, 10, warmupPoints >= 8 ? "passed" : "missing", safety.warmupEnabled ? `مفعّل، اليوم ${Number(channel.warmupDay || 1)}.` : "غير مفعّل لهذه القناة."));
  if (!warmupPoints) recommendations.push(recommendation("enable_warmup", "فعّل التدرج الآمن", "ارفع حجم الإرسال تدريجيًا للرقم الجديد.", 10, "high", "/dashboard/security"));

  const limitsPoints = Number(safety.dailyLimit || 0) > 0 && Number(safety.hourlyLimit || 0) > 0 ? 10 : Number(safety.dailyLimit || 0) > 0 || Number(safety.hourlyLimit || 0) > 0 ? 5 : 0;
  score += limitsPoints;
  factors.push(factor("limits", "حدود الإرسال", limitsPoints, 10, limitsPoints === 10 ? "passed" : "missing", limitsPoints === 10 ? `حد يومي ${safety.dailyLimit} وساعي ${safety.hourlyLimit}.` : "حدود الساعة واليوم غير مكتملة."));

  const optOutPoints = safety.safeModeEnabled ? 5 : 0;
  score += optOutPoints;
  factors.push(factor("opt_out", "قائمة الإيقاف", optOutPoints, 5, optOutPoints ? "passed" : "missing", optOutPoints ? "يتم فحص قائمة الإيقاف قبل الإرسال." : "حماية قائمة الإيقاف غير مفعلة."));

  const templatePoints = Number(templates.total || 0) === 0 ? 2 : Number(templates.safe || 0) === Number(templates.total || 0) ? 5 : 2;
  score += templatePoints;
  factors.push(factor("templates", "جودة القالب", templatePoints, 5, templatePoints === 5 ? "passed" : "review", Number(templates.total || 0) ? `${templates.safe} من ${templates.total} قالب اجتاز الفحص الأساسي.` : "لا يوجد قالب نشط كافٍ للفحص."));

  const riskEnginePoints = safety.safeModeEnabled && safety.stopOnHighFailure && safety.autoPauseEnabled ? 5 : safety.safeModeEnabled ? 2 : 0;
  score += riskEnginePoints;
  factors.push(factor("risk_engine", "محرك المخاطر", riskEnginePoints, 5, riskEnginePoints === 5 ? "passed" : "review", riskEnginePoints === 5 ? "المراقبة والإيقاف التلقائي مفعّلان." : "إيقاف المخاطر التلقائي غير مكتمل."));

  const risk = Number(channel.riskScore || 0);
  const failureRate = successRate === null ? Number(channel.storedFailureRate || 0) : 100 - successRate;
  let penalty = 0;
  if (risk >= 85) penalty += 50;
  else if (risk >= 70) penalty += 30;
  if (failureRate > 30) penalty += 25;
  if (Number(channel.disconnects24h || 0) >= 5) penalty += 20;
  if (channel.riskHoldAt || channel.status === "risk_hold") issues.push({ key: "risk_hold", title: "الإرسال متوقف بسبب المخاطر", severity: "critical" });
  score = bounded(score - penalty);
  if (!connected) score = Math.min(score, 20);
  if (channel.riskHoldAt || channel.status === "risk_hold") score = Math.min(score, 25);
  if (penalty) factors.push(factor("critical_penalties", "خصومات المخاطر", -penalty, 0, "critical", `تم تطبيق خصم ${penalty} نقطة حتى لا تخفي النقاط الإيجابية المخاطر الحرجة.`));
  return { score, label: securityLabel(score), status: samples < 5 ? "insufficient_data" : "available", factors, issues, recommendations, metrics: { successRate, samples, riskScore: risk, connectionState, lastHealthCheckAt: channel.lastHealthCheckAt } };
}

export async function calculateSecurityScore({ tenantId, userId, secureSession = true, persist = false }) {
  const facts = await loadSecurityFacts(tenantId, userId);
  const account = calculateAccount(facts.account, secureSession);
  const whatsapp = calculateWhatsapp(facts.channel, facts.delivery, facts.safety, facts.templates);
  let overallScore = whatsapp.score === null
    ? Math.min(70, Math.round(account.score * 0.7))
    : Math.round(account.score * 0.4 + whatsapp.score * 0.6);
  if (!facts.account.mfaEnabled) overallScore = Math.min(overallScore, 89);
  if (!facts.account.emailVerified) overallScore = Math.min(overallScore, 75);
  if (!facts.channel) overallScore = Math.min(overallScore, 70);
  if (facts.channel && facts.channel.status !== "connected") overallScore = Math.min(overallScore, 50);
  if (facts.channel?.riskHoldAt || facts.channel?.status === "risk_hold") overallScore = Math.min(overallScore, 25);
  overallScore = bounded(overallScore);
  const recommendations = [...account.recommendations, ...whatsapp.recommendations]
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.scoreImpact - a.scoreImpact);
  const criticalIssues = [...account.issues, ...whatsapp.issues];
  const calculatedAt = new Date().toISOString();
  const result = {
    overall: { score: overallScore, label: securityLabel(overallScore), status: "available" },
    account,
    whatsapp,
    criticalIssues,
    recommendations,
    calculatedAt
  };
  if (persist) {
    await query(
      `INSERT INTO security_score_snapshots
         (tenant_id, user_id, channel_id, account_score, channel_score, overall_score,
          account_status, channel_status, overall_status, factors, issues, recommendations, calculated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13)`,
      [tenantId, userId, facts.channel?.id || null, account.score, whatsapp.score, overallScore,
        account.label, whatsapp.label, result.overall.label,
        JSON.stringify({ account: account.factors, whatsapp: whatsapp.factors }),
        JSON.stringify(criticalIssues), JSON.stringify(recommendations), calculatedAt]
    );
  }
  return result;
}
