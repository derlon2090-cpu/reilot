import { query, transaction } from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSession } from "./session.js";
import { isStrongPassword, normalizeEmail, sha256 } from "./security.js";
import { classifyPasswordStrength } from "./security-score.js";
import {
  createLoginEmailOtpChallenge,
  createRegistrationEmailOtpChallenge
} from "./email-otp-v2.js";
import { createMfaLoginChallenge } from "./login-mfa.js";
import { resolveSecondFactor } from "./second-factor-router.js";

function isEmailOtpSchemaUnavailable(error) {
  return error?.code === "42703" || error?.code === "42P01";
}

function emailOtpDeliveryConfigured() {
  const pepper = process.env.EMAIL_OTP_PEPPER?.trim() || "";
  return Boolean(process.env.RESEND_API_KEY?.trim()) && pepper.length >= 24;
}

async function findCredentialUser(normalizedEmail) {
  try {
    return await query(
      `SELECT u.id, u.tenant_id AS "tenantId", u.name, u.email, u.must_change_password AS "mustChangePassword",
              u.email_otp_enabled AS "emailOtpEnabled", u.mfa_enabled AS "mfaEnabled",
              u.mfa_secret_encrypted AS "mfaSecret",
              COALESCE(tm.role, u.role) AS role, a.password
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id AND t.status <> 'disabled'
         JOIN accounts a ON a.user_id = u.id AND a.provider_id = 'credential'
         LEFT JOIN tenant_members tm ON tm.user_id = u.id AND tm.tenant_id = u.tenant_id
        WHERE lower(u.email) = $1 LIMIT 1`,
      [normalizedEmail]
    );
  } catch (error) {
    // Keep credential login available during rolling deployments where the OTP
    // migration has not reached the database yet. OTP remains opt-in once the
    // schema is present.
    if (!isEmailOtpSchemaUnavailable(error)) throw error;
    return query(
      `SELECT u.id, u.tenant_id AS "tenantId", u.name, u.email, u.must_change_password AS "mustChangePassword",
              false AS "emailOtpEnabled", false AS "mfaEnabled", NULL::text AS "mfaSecret",
              COALESCE(tm.role, u.role) AS role, a.password
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id AND t.status <> 'disabled'
         JOIN accounts a ON a.user_id = u.id AND a.provider_id = 'credential'
         LEFT JOIN tenant_members tm ON tm.user_id = u.id AND tm.tenant_id = u.tenant_id
        WHERE lower(u.email) = $1 LIMIT 1`,
      [normalizedEmail]
    );
  }
}

export async function registerAccount({ name, companyName, email, password, ipAddress, userAgent }) {
  const normalized = normalizeEmail(email);
  if (!name || String(name).trim().length < 3) return { ok: false, status: 400, reason: "invalid_name" };
  if (!isStrongPassword(password)) return { ok: false, status: 400, reason: "weak_password" };
  const existing = await query("SELECT 1 FROM users WHERE lower(email) = $1", [normalized]);
  if (existing.rowCount) return { ok: false, status: 409, reason: "email_exists" };
  const passwordHash = await hashPassword(password);
  if (!emailOtpDeliveryConfigured()) return { ok: false, status: 503, reason: "email_otp_unavailable" };
  const challenge = await createRegistrationEmailOtpChallenge({
    name: String(name).trim(),
    companyName: String(companyName || "").trim(),
    email: normalized,
    passwordHash,
    passwordStrength: classifyPasswordStrength(password, normalized),
    ipAddress,
    userAgent
  });
  if (!challenge.ok) return challenge;
  return { ok: true, status: 202, requiresEmailOtp: true, challenge };
}

export async function loginAccount({ email, password, ipAddress, userAgent, trustedDeviceToken = "", locale = "ar" }) {
  let authStage = "rate_limit";
  try {
  const normalized = normalizeEmail(email);
  const attempts = await query(
    `SELECT count(*)::int AS count FROM login_attempts
      WHERE email = $1 AND success = false AND created_at > now() - interval '15 minutes'`,
    [normalized]
  );
  if (attempts.rows[0].count >= 10) return { ok: false, status: 429, reason: "rate_limited" };

  authStage = "credential_lookup";
  const result = await findCredentialUser(normalized);
  const user = result.rows[0];
  authStage = "password_verification";
  const valid = user ? await verifyPassword(password, user.password) : false;
  authStage = "login_attempt_audit";
  const loginAttempt = await query(
    `INSERT INTO login_attempts (email, email_hash, ip_address, user_agent, success, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [normalized, sha256(normalized), ipAddress || null, userAgent || null, valid, valid ? null : "invalid_credentials"]
  );
  if (!valid) {
    if (user?.tenantId) {
      const failedCount = Number(attempts.rows[0]?.count || 0) + 1;
      await query(
        `INSERT INTO security_events
           (tenant_id, user_id, category, event_type, severity, risk_weight, half_life_hours, ip_hash, user_agent_summary, metadata)
         VALUES ($1, $2, 'account', $3, $4, $5, 6, $6, $7, $8::jsonb)`,
        [user.tenantId, user.id, failedCount >= 3 ? "REPEATED_FAILED_LOGIN" : "FAILED_LOGIN",
          failedCount >= 10 ? "critical" : "warning", failedCount >= 3 ? 12 : 3,
          ipAddress ? sha256(String(ipAddress)) : null, String(userAgent || "").slice(0, 180), JSON.stringify({ failedCount15m: failedCount })]
      ).catch(() => null);
    }
    return { ok: false, status: 401, reason: "invalid_credentials" };
  }

  authStage = "second_factor_routing";
  const factor = await resolveSecondFactor({
    user,
    rawBrowserToken: trustedDeviceToken,
    riskDetected: Number(attempts.rows[0]?.count || 0) >= 3
  });

  if (factor.method === "totp") {
    authStage = "mfa_challenge";
    try {
      const challenge = await createMfaLoginChallenge({
        user,
        ipAddress,
        userAgent,
        loginAttemptId: loginAttempt.rows[0]?.id
      });
      return {
        ok: true,
        status: 202,
        requiresMfa: true,
        challenge
      };
    } catch (mfaError) {
      if (!emailOtpDeliveryConfigured()) throw mfaError;
      authStage = "email_otp_fallback_challenge";
      const challenge = await createLoginEmailOtpChallenge({
        user,
        ipAddress,
        userAgent,
        locale,
        purpose: "login",
        loginAttemptId: loginAttempt.rows[0]?.id
      });
      return {
        ok: true,
        status: 202,
        requiresEmailOtp: true,
        fallbackFrom: "totp",
        challenge
      };
    }
  }

  if (factor.method === "email_otp") {
    if (!emailOtpDeliveryConfigured()) {
      return { ok: false, status: 503, reason: "email_otp_unavailable" };
    }
    authStage = "email_otp_challenge";
    const challenge = await createLoginEmailOtpChallenge({
      user,
      ipAddress,
      userAgent,
      locale,
      purpose: "login",
      loginAttemptId: loginAttempt.rows[0]?.id
    });
    await query(
      `INSERT INTO security_events
         (tenant_id, user_id, category, event_type, severity, risk_weight, half_life_hours, ip_hash, user_agent_summary)
       VALUES ($1, $2, 'account', 'EMAIL_OTP_REQUIRED', 'info', 0, 6, $3, $4)`,
      [user.tenantId, user.id, ipAddress ? sha256(String(ipAddress)) : null, String(userAgent || "").slice(0, 180)]
    ).catch(() => null);
    return {
      ok: true,
      status: 202,
      requiresEmailOtp: true,
      challenge
    };
  }

  if (factor.method === "unavailable") {
    return { ok: false, status: 503, reason: "second_factor_unavailable" };
  }

  authStage = "session_creation";
  return await transaction(async (client) => {
    const session = await createSession(client, { userId: user.id, ipAddress, userAgent });
    await client.query(
      "INSERT INTO activity_logs (tenant_id, user_id, type, title) VALUES ($1, $2, 'auth.login', 'User signed in')",
      [user.tenantId, user.id]
    );
    await client.query(
      `INSERT INTO security_events
         (tenant_id, user_id, category, event_type, severity, risk_weight, half_life_hours, ip_hash, user_agent_summary)
       VALUES ($1, $2, 'account', 'LOGIN_SUCCEEDED', 'info', 0, 6, $3, $4)`,
      [user.tenantId, user.id, ipAddress ? sha256(String(ipAddress)) : null, String(userAgent || "").slice(0, 180)]
    );
    const safeUser = { ...user };
    delete safeUser.password;
    delete safeUser.emailOtpEnabled;
    delete safeUser.mfaEnabled;
    delete safeUser.mfaSecret;
    return { ok: true, status: 200, user: safeUser, session };
  });
  } catch (error) {
    if (error && typeof error === "object" && !error.authStage) error.authStage = authStage;
    throw error;
  }
}
