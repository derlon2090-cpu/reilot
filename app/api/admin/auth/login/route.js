import crypto from "node:crypto";
import { z } from "zod";
import { auditAdmin, requestIp } from "../../../../../src/server/admin-auth.js";
import { databaseFailureReason, query } from "../../../../../src/server/db.js";
import { verifyPassword } from "../../../../../src/server/password.js";
import { isValidEmail, normalizeEmail, safeErrorMessage, sha256 } from "../../../../../src/server/security.js";
import { destroySession } from "../../../../../src/server/session.js";
import { createLoginEmailOtpChallenge, challengeCookie } from "../../../../../src/server/email-otp-v2.js";

const loginSchema = z.object({
  email: z.string().trim().min(1, "يرجى إدخال البريد الإلكتروني أو اسم المستخدم.").refine(
    (value) => isValidEmail(value) || /^[a-zA-Z][a-zA-Z0-9._-]{5,63}$/.test(value),
    "يرجى إدخال بريد إلكتروني أو اسم مستخدم صحيح."
  ),
  password: z.string().min(1, "يرجى إدخال كلمة المرور.")
});

function adminEmailOtpConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim())
    && (process.env.EMAIL_OTP_PEPPER?.trim().length || 0) >= 24;
}

export function classifyAdminAuthFailure(error) {
  const code = String(error?.code || "");
  const stage = String(error?.authStage || "unknown");
  const databaseReason = databaseFailureReason(error);
  if (["database_unavailable", "database_schema_missing"].includes(databaseReason)) {
    return { reason: databaseReason, status: 503, stage, code };
  }
  if (["EMAIL_DELIVERY_UNAVAILABLE", "EMAIL_PROVIDER_ERROR", "EMAIL_CONFIGURATION_ERROR"].includes(code)) {
    return { reason: "email_otp_unavailable", status: 503, stage, code };
  }
  if (code === "AUTH_CONFIGURATION_ERROR") {
    return { reason: "auth_configuration_error", status: 503, stage, code };
  }
  if (stage === "session_creation") {
    return { reason: "auth_session_error", status: 503, stage, code };
  }
  if (["second_factor_routing", "mfa_challenge", "email_otp_challenge", "email_otp_fallback_challenge"].includes(stage)) {
    return { reason: "auth_challenge_error", status: 503, stage, code };
  }
  return { reason: "admin_auth_service_unavailable", status: 503, stage, code };
}

export async function POST(request) {
  const requestId = crypto.randomUUID();
  let authStage = "request_validation";
  try {
    const parsed = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "validation_error", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const identifier = normalizeEmail(parsed.data.email);
  const ip = requestIp(request);
  authStage = "rate_limit";
  const failures = await query(
    `SELECT count(*)::int AS count FROM login_attempts
      WHERE success = false AND created_at > now() - interval '15 minutes'
        AND (email = $1 OR ($2 <> '' AND ip_address = $2))`,
    [identifier, ip]
  );
  if (failures.rows[0].count >= 5) {
    return Response.json({ ok: false, reason: "rate_limited", message: "تم تجاوز عدد محاولات الدخول. حاول مرة أخرى لاحقًا." }, { status: 429 });
  }

  authStage = "credential_lookup";
  const result = await query(
    `SELECT u.id AS "userId", u.tenant_id AS "tenantId", u.name, u.email, a.password,
            au.id AS "adminId", au.role AS "adminRole", au.status,
            u.mfa_enabled AS "mfaEnabled", u.mfa_secret_encrypted AS "mfaSecret",
            au.expires_at AS "expiresAt"
       FROM users u
       JOIN accounts a ON a.user_id = u.id AND a.provider_id = 'credential'
       LEFT JOIN admin_users au ON au.user_id = u.id
      WHERE lower(u.email) = $1 OR lower(a.account_id) = $1
      ORDER BY CASE WHEN lower(u.email) = $1 THEN 0 ELSE 1 END
      LIMIT 1`,
    [identifier]
  );
  const admin = result.rows[0];
  authStage = "password_verification";
  const passwordValid = admin ? await verifyPassword(parsed.data.password, admin.password) : false;
  const allowedRole = ["super_admin", "admin", "support_admin", "billing_admin", "security_admin", "viewer"].includes(admin?.adminRole);
  const expired = Boolean(admin?.expiresAt && new Date(admin.expiresAt).getTime() <= Date.now());
  const valid = passwordValid && admin?.adminId && admin.status === "active" && !expired && allowedRole;

  authStage = "login_attempt_audit";
  const loginAttempt = await query(
    `INSERT INTO login_attempts (email, email_hash, ip_address, user_agent, success, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [identifier, sha256(identifier), ip || null, request.headers.get("user-agent")?.slice(0, 500) || null, Boolean(valid), valid ? null : "invalid_admin_credentials"]
  );

  if (!valid) {
    await auditAdmin(request, {
      userId: admin?.userId || null,
      action: "admin.login.failed",
      resource: "admin_portal",
      status: "failed",
      metadata: { reason: expired ? "expired" : passwordValid && admin?.status === "disabled" ? "disabled" : "invalid_credentials", actorEmail: admin?.email || identifier }
    });
    if (passwordValid && admin?.status === "disabled") {
      return Response.json({ ok: false, reason: "admin_disabled", message: "تم تعطيل حساب الأدمن. تواصل مع المسؤول الأعلى." }, { status: 403 });
    }
    if (passwordValid && expired) {
      return Response.json({ ok: false, reason: "admin_expired", message: "انتهت صلاحية حساب الأدمن المؤقت." }, { status: 403 });
    }
    return Response.json({ ok: false, reason: "invalid_credentials", message: "بيانات الدخول غير صحيحة أو لا تملك صلاحية الوصول إلى لوحة الأدمن." }, { status: 401 });
  }

  // Administrator access is deliberately stricter than the customer portal:
  // every credential sign-in must complete a fresh email OTP challenge. A
  // remembered browser, TOTP preference, or previous session may never bypass
  // this gate.
  if (!adminEmailOtpConfigured()) {
    return Response.json({ ok: false, reason: "email_otp_unavailable", requestId }, {
      status: 503,
      headers: { "X-Renvix-Request-Id": requestId }
    });
  }
  authStage = "session_invalidation";
  await destroySession(request);
  authStage = "email_otp_challenge";
  const challenge = await createLoginEmailOtpChallenge({
    user: { id: admin.userId, tenantId: admin.tenantId, email: admin.email, name: admin.name },
    ipAddress: ip,
    userAgent: request.headers.get("user-agent"),
    purpose: "admin_login",
    loginAttemptId: loginAttempt.rows[0]?.id
  });
  return Response.json({
    ok: true,
    requiresEmailOtp: true,
    maskedEmail: challenge.maskedEmail,
    expiresAt: challenge.expiresAt,
    resendAt: challenge.resendAt
  }, {
    status: 202,
    headers: { "Set-Cookie": challengeCookie(challenge.challengeCookie) }
  });
  } catch (error) {
    if (error && typeof error === "object" && !error.authStage) error.authStage = authStage;
    const failure = classifyAdminAuthFailure(error);
    const reason = failure.reason;
    console.error("admin login unavailable", {
      requestId,
      stage: failure.stage,
      code: failure.code || "unknown",
      providerCode: String(error?.providerCode || ""),
      message: safeErrorMessage(error)
    });
    return Response.json({
      ok: false,
      reason,
      requestId,
      diagnosticStage: failure.stage,
      message: reason === "database_unavailable"
        ? "تعذر الاتصال بقاعدة البيانات مؤقتًا. حاول مجددًا بعد لحظات."
        : reason === "database_schema_missing"
          ? "مخطط قاعدة بيانات لوحة الأدمن غير مكتمل."
          : "تعذر إكمال التحقق الآمن من حساب الأدمن."
    }, { status: failure.status, headers: { "X-Renvix-Request-Id": requestId } });
  }
}
