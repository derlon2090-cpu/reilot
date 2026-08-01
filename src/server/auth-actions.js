import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSession } from "./session.js";
import { isStrongPassword, normalizeEmail, sha256 } from "./security.js";
import { classifyPasswordStrength } from "./security-score.js";
import { ensureDefaultTemplates } from "./default-templates.js";
import { createLoginEmailOtpChallenge, isTrustedDevice } from "./email-otp.js";
import { createMfaLoginChallenge } from "./login-mfa.js";

function isEmailOtpSchemaUnavailable(error) {
  return error?.code === "42703" || error?.code === "42P01";
}

function emailOtpDeliveryConfigured() {
  const pepper = process.env.EMAIL_OTP_PEPPER?.trim() || "";
  return Boolean(process.env.RESEND_API_KEY?.trim()) && pepper.length >= 24;
}

function emailOtpRequired(user) {
  // Email OTP is a platform security boundary. It is enforced by default and
  // can only be relaxed explicitly for a controlled recovery deployment.
  // The browser never decides whether the second factor is required.
  if (process.env.EMAIL_OTP_ENFORCE_ALL === "false") {
    return Boolean(user?.emailOtpEnabled);
  }
  return true;
}

async function findCredentialUser(normalizedEmail) {
  try {
    return await query(
      `SELECT u.id, u.tenant_id AS "tenantId", u.name, u.email, u.must_change_password AS "mustChangePassword",
              u.email_otp_enabled AS "emailOtpEnabled", u.mfa_enabled AS "mfaEnabled",
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
              false AS "emailOtpEnabled", false AS "mfaEnabled", COALESCE(tm.role, u.role) AS role, a.password
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id AND t.status <> 'disabled'
         JOIN accounts a ON a.user_id = u.id AND a.provider_id = 'credential'
         LEFT JOIN tenant_members tm ON tm.user_id = u.id AND tm.tenant_id = u.tenant_id
        WHERE lower(u.email) = $1 LIMIT 1`,
      [normalizedEmail]
    );
  }
}

function slugify(value) {
  const base = String(value || "store").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "store"}-${crypto.randomBytes(3).toString("hex")}`;
}
export async function registerAccount({ name, companyName, email, password, ipAddress, userAgent }) {
  const normalized = normalizeEmail(email);
  if (!name || String(name).trim().length < 3) return { ok: false, status: 400, reason: "invalid_name" };
  if (!isStrongPassword(password)) return { ok: false, status: 400, reason: "weak_password" };
  const existing = await query("SELECT 1 FROM users WHERE lower(email) = $1", [normalized]);
  if (existing.rowCount) return { ok: false, status: 409, reason: "email_exists" };
  const passwordHash = await hashPassword(password);
  const workspaceName = String(companyName || "").trim() || `متجر ${String(name).trim()}`;

  return transaction(async (client) => {
    const tenant = await client.query(
      "INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id",
      [workspaceName, slugify(workspaceName)]
    );
    const tenantId = tenant.rows[0].id;
    const user = await client.query(
      `INSERT INTO users (tenant_id, name, email, role, password_strength, password_changed_at, email_otp_enabled)
       VALUES ($1, $2, $3, 'owner', $4, now(), true) RETURNING id, name, email`,
      [tenantId, String(name).trim(), normalized, classifyPasswordStrength(password, normalized)]
    );
    const userId = user.rows[0].id;
    await client.query(
      `INSERT INTO accounts (user_id, account_id, provider_id, password)
       VALUES ($1, $2, 'credential', $3)`,
      [userId, normalized, passwordHash]
    );
    await client.query("INSERT INTO tenant_members (tenant_id, user_id, role) VALUES ($1, $2, 'owner')", [tenantId, userId]);
    await client.query("INSERT INTO stores (tenant_id, name) VALUES ($1, $2)", [tenantId, workspaceName]);
    await client.query("INSERT INTO settings (tenant_id, language, theme) VALUES ($1, 'ar', 'light')", [tenantId]);
    await client.query("INSERT INTO whatsapp_safety_settings (tenant_id) VALUES ($1)", [tenantId]);
    await ensureDefaultTemplates(client, tenantId, workspaceName);
    const plan = await client.query("SELECT id FROM platform_plans WHERE slug IN ('free', 'trial', 'starter') ORDER BY CASE slug WHEN 'free' THEN 0 WHEN 'trial' THEN 1 ELSE 2 END LIMIT 1");
    if (plan.rows[0]) {
      await client.query(
        `INSERT INTO platform_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
         VALUES ($1, $2, 'active', now(), now() + interval '1 month')`,
        [tenantId, plan.rows[0].id]
      );
    }
    await client.query(
      "INSERT INTO activity_logs (tenant_id, user_id, type, title) VALUES ($1, $2, 'auth.registered', 'Account created')",
      [tenantId, userId]
    );
    const session = await createSession(client, { userId, ipAddress, userAgent });
    return { ok: true, status: 201, user: { ...user.rows[0], tenantId, role: "owner" }, session };
  });
}

export async function loginAccount({ email, password, ipAddress, userAgent, trustedDeviceToken = "", locale = "ar" }) {
  const normalized = normalizeEmail(email);
  const attempts = await query(
    `SELECT count(*)::int AS count FROM login_attempts
      WHERE email = $1 AND success = false AND created_at > now() - interval '15 minutes'`,
    [normalized]
  );
  if (attempts.rows[0].count >= 10) return { ok: false, status: 429, reason: "rate_limited" };

  const result = await findCredentialUser(normalized);
  const user = result.rows[0];
  const valid = user ? await verifyPassword(password, user.password) : false;
  await query(
    `INSERT INTO login_attempts (email, email_hash, ip_address, user_agent, success, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
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

  if (user.mfaEnabled) {
    const challenge = await createMfaLoginChallenge({ user, ipAddress, userAgent });
    return {
      ok: true,
      status: 202,
      requiresMfa: true,
      challenge
    };
  }

  const requiresEmailOtp = emailOtpRequired(user);
  const trusted = requiresEmailOtp
    ? await isTrustedDevice({ userId: user.id, rawToken: trustedDeviceToken })
    : false;
  if (requiresEmailOtp && !trusted) {
    if (!emailOtpDeliveryConfigured()) {
      return { ok: false, status: 503, reason: "email_otp_unavailable" };
    }
    const challenge = await createLoginEmailOtpChallenge({
      user,
      ipAddress,
      userAgent,
      locale,
      purpose: "login"
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

  return transaction(async (client) => {
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
    return { ok: true, status: 200, user: safeUser, session };
  });
}
