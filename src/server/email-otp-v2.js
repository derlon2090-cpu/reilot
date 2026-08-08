import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { createSession } from "./session.js";
import { sendLoginEmailOtp } from "./email/resend.service.js";
import { ensureDefaultTemplates } from "./default-templates.js";
import { sha256 } from "./security.js";
import {
  TRUSTED_BROWSER_COOKIE,
  TRUSTED_BROWSER_DEV_COOKIE,
  hashBrowserToken,
  trustBrowserForUser,
  trustedBrowserAgeSeconds,
  trustedBrowserEnabled,
  validateTrustedBrowser,
  revokeAllUserBrowsers
} from "./trusted-browser.js";

export const EMAIL_OTP_CHALLENGE_COOKIE = "renvix_email_otp_challenge";
export const EMAIL_OTP_TTL_SECONDS = 5 * 60;
export const EMAIL_OTP_RESEND_SECONDS = 60;
export const TRUSTED_DEVICE_COOKIE = TRUSTED_BROWSER_COOKIE;
export const TRUSTED_DEVICE_AGE_SECONDS = 48 * 60 * 60;

function otpPepper() {
  const value = process.env.EMAIL_OTP_PEPPER?.trim() || "";
  if (value.length < 24) throw Object.assign(new Error("EMAIL_OTP_PEPPER is missing or too short"), { code: "AUTH_CONFIGURATION_ERROR" });
  return value;
}

function secureCookieEnabled() {
  const publicUrl = process.env.APP_URL || process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  return process.env.COOKIE_SECURE !== "false"
    && (process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production" || publicUrl.startsWith("https://"));
}

function cookie(name, value, maxAge, { forceSecure = false } = {}) {
  const secure = forceSecure || secureCookieEnabled() ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=${Math.max(0, Number(maxAge) || 0)}; HttpOnly${secure}`;
}

export function challengeCookie(value) {
  return cookie(EMAIL_OTP_CHALLENGE_COOKIE, value, 10 * 60);
}

export function clearChallengeCookie() {
  return cookie(EMAIL_OTP_CHALLENGE_COOKIE, "", 0);
}

export function trustedDeviceCookie(value) {
  const productionCookie = secureCookieEnabled();
  return cookie(productionCookie ? TRUSTED_BROWSER_COOKIE : TRUSTED_BROWSER_DEV_COOKIE, value, trustedBrowserAgeSeconds(), { forceSecure: productionCookie });
}

export const trustedBrowserCookie = trustedDeviceCookie;

export function clearTrustedDeviceCookie() {
  const productionCookie = secureCookieEnabled();
  return cookie(productionCookie ? TRUSTED_BROWSER_COOKIE : TRUSTED_BROWSER_DEV_COOKIE, "", 0, { forceSecure: productionCookie });
}

export const clearTrustedBrowserCookie = clearTrustedDeviceCookie;

export function readCookie(req, name) {
  const header = req.headers.get("cookie") || "";
  const entry = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}

export function readTrustedBrowserCookie(req) {
  return readCookie(req, TRUSTED_BROWSER_COOKIE) || readCookie(req, TRUSTED_BROWSER_DEV_COOKIE);
}

export function normalizeOtpDigits(value) {
  return String(value || "")
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.codePointAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.codePointAt(0) - 0x06F0))
    .replace(/\D/g, "")
    .slice(0, 6);
}

export function generateEmailOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function digestOtp(code, challengeId) {
  return crypto.createHmac("sha256", otpPepper()).update(`${normalizeOtpDigits(code)}:${challengeId}`).digest("hex");
}

function signChallengeId(challengeId, kind = "login") {
  const payload = `${kind}:${challengeId}`;
  const signature = crypto.createHmac("sha256", otpPepper()).update(`challenge:${payload}`).digest("base64url");
  return `${kind}.${challengeId}.${signature}`;
}

function parseChallengeCookie(raw) {
  const parts = String(raw || "").split(".");
  const legacy = parts.length === 2;
  const kind = legacy ? "login" : parts[0];
  const challengeId = legacy ? parts[0] : parts[1];
  const signature = legacy ? parts[1] : parts[2];
  if (!['login', 'signup', 'admin_login'].includes(kind) || !/^[0-9a-f-]{36}$/i.test(challengeId || "") || !signature) return null;
  const signedValue = legacy ? `challenge:${challengeId}` : `challenge:${kind}:${challengeId}`;
  const expected = crypto.createHmac("sha256", otpPepper()).update(signedValue).digest();
  let supplied;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  return { id: challengeId, kind };
}

function maskEmail(email) {
  const [local = "", domain = ""] = String(email || "").split("@");
  if (!domain) return "";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function slugify(value) {
  const base = String(value || "store").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "store"}-${crypto.randomBytes(3).toString("hex")}`;
}

async function audit(client, { tenantId, userId, type, title, metadata = {} }) {
  if (!tenantId || !userId) return;
  await client.query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [tenantId, userId, type, title, JSON.stringify(metadata)]
  );
}

export async function isTrustedDevice({ userId, rawToken, riskDetected = false }) {
  const result = await validateTrustedBrowser({ userId, rawToken, riskDetected });
  return result.trusted;
}

export async function createLoginEmailOtpChallenge({ user, ipAddress, userAgent, locale = "ar", purpose = "login", loginAttemptId = null }) {
  let code = "";
  const challenge = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`email-otp:${user.id}:${purpose}`]);
    await client.query(
      `UPDATE auth_mfa_login_challenges SET invalidated_at=now(),updated_at=now()
        WHERE user_id=$1 AND consumed_at IS NULL AND invalidated_at IS NULL`,
      [user.id]
    );
    const existing = await client.query(
      `SELECT id, expires_at AS "expiresAt", last_sent_at AS "lastSentAt"
         FROM auth_email_otp_challenges
        WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL AND invalidated_at IS NULL
          AND expires_at > now() AND created_at >= now() - interval '15 seconds'
        ORDER BY created_at DESC LIMIT 1`,
      [user.id, purpose]
    );
    if (existing.rows[0]) {
      const reused = loginAttemptId
        ? await client.query(
          `UPDATE auth_email_otp_challenges
              SET login_attempt_id=$2,updated_at=now()
            WHERE id=$1
            RETURNING id,expires_at AS "expiresAt",last_sent_at AS "lastSentAt"`,
          [existing.rows[0].id, loginAttemptId]
        )
        : existing;
      return { ...reused.rows[0], reused: true };
    }
    code = generateEmailOtp();
    await client.query(
      `UPDATE auth_email_otp_challenges SET invalidated_at = now(), updated_at = now()
        WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL AND invalidated_at IS NULL`,
      [user.id, purpose]
    );
    const inserted = await client.query(
      `INSERT INTO auth_email_otp_challenges
         (user_id, tenant_id, purpose, code_digest, expires_at, ip_hash, user_agent_hash, login_attempt_id)
       VALUES ($1, $2, $3, '', now() + interval '5 minutes', $4, $5, $6)
       RETURNING id, expires_at AS "expiresAt", last_sent_at AS "lastSentAt"`,
      [user.id, user.tenantId, purpose, ipAddress ? sha256(ipAddress) : null, userAgent ? sha256(userAgent) : null, loginAttemptId]
    );
    const row = inserted.rows[0];
    await client.query("UPDATE auth_email_otp_challenges SET code_digest = $2 WHERE id = $1", [row.id, digestOtp(code, row.id)]);
    return { ...row, reused: false };
  });
  if (!challenge.reused) {
    // Keep the challenge durable even if a legacy/non-critical audit write is
    // temporarily unavailable. Verification itself remains mandatory.
    await audit({ query }, {
      tenantId: user.tenantId,
      userId: user.id,
      type: "auth.email_otp.requested",
      title: "Email OTP requested",
      metadata: { purpose }
    }).catch((error) => {
      console.error("Email OTP challenge audit unavailable", { code: String(error?.code || "AUDIT_ERROR") });
    });
  }
  if (!challenge.reused) {
    try {
      await sendLoginEmailOtp({ to: user.email, code, expiresInMinutes: 5, locale, name: user.name });
    } catch (error) {
      await query("UPDATE auth_email_otp_challenges SET invalidated_at=now(),updated_at=now() WHERE id=$1", [challenge.id]).catch(() => null);
      throw error;
    }
  }
  return {
    challengeCookie: signChallengeId(challenge.id, purpose === "admin_login" ? "admin_login" : "login"),
    maskedEmail: maskEmail(user.email),
    expiresAt: challenge.expiresAt,
    resendAt: new Date(new Date(challenge.lastSentAt).getTime() + EMAIL_OTP_RESEND_SECONDS * 1000),
    reused: challenge.reused
  };
}

export async function createRegistrationEmailOtpChallenge({ name, companyName, email, passwordHash, passwordStrength, ipAddress, userAgent, locale = "ar" }) {
  const ipHash = ipAddress ? sha256(ipAddress) : null;
  const recent = await query(
    `SELECT count(*)::int AS count FROM auth_pending_registrations
      WHERE created_at > now() - interval '15 minutes' AND (email = $1 OR ($2::text IS NOT NULL AND ip_hash = $2))`,
    [email, ipHash]
  );
  if (Number(recent.rows[0]?.count || 0) >= 5) return { ok: false, status: 429, reason: "rate_limited" };
  let code = "";
  const challenge = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`signup-email-otp:${email}`]);
    const user = await client.query("SELECT 1 FROM users WHERE lower(email)=$1", [email]);
    if (user.rowCount) return { error: "email_exists" };
    const existing = await client.query(
      `SELECT id,expires_at AS "expiresAt",last_sent_at AS "lastSentAt"
         FROM auth_pending_registrations
        WHERE email=$1 AND consumed_at IS NULL AND invalidated_at IS NULL
          AND expires_at > now() AND created_at >= now() - interval '15 seconds'
        LIMIT 1`,
      [email]
    );
    if (existing.rows[0]) return { ...existing.rows[0], reused: true };
    await client.query("UPDATE auth_pending_registrations SET invalidated_at=now(),updated_at=now() WHERE email=$1 AND consumed_at IS NULL AND invalidated_at IS NULL", [email]);
    code = generateEmailOtp();
    const inserted = await client.query(
      `INSERT INTO auth_pending_registrations
         (email,name,company_name,password_hash,password_strength,code_digest,expires_at,ip_hash,user_agent_hash)
       VALUES ($1,$2,$3,$4,$5,'',now() + interval '5 minutes',$6,$7)
       RETURNING id,expires_at AS "expiresAt",last_sent_at AS "lastSentAt"`,
      [email, String(name).trim(), String(companyName || "").trim() || null, passwordHash, passwordStrength, ipHash, userAgent ? sha256(userAgent) : null]
    );
    const row = inserted.rows[0];
    await client.query("UPDATE auth_pending_registrations SET code_digest=$2 WHERE id=$1", [row.id, digestOtp(code, row.id)]);
    return { ...row, reused: false };
  });
  if (challenge.error) return { ok: false, status: 409, reason: challenge.error };
  if (!challenge.reused) {
    try {
      await sendLoginEmailOtp({ to: email, code, expiresInMinutes: 5, locale, name });
    } catch (error) {
      await query("UPDATE auth_pending_registrations SET invalidated_at=now(),updated_at=now() WHERE id=$1", [challenge.id]).catch(() => null);
      throw error;
    }
  }
  return {
    ok: true,
    challengeCookie: signChallengeId(challenge.id, "signup"),
    maskedEmail: maskEmail(email),
    expiresAt: challenge.expiresAt,
    resendAt: new Date(new Date(challenge.lastSentAt).getTime() + EMAIL_OTP_RESEND_SECONDS * 1000)
  };
}

async function loadChallenge(rawCookie) {
  const parsed = parseChallengeCookie(rawCookie);
  if (!parsed) return null;
  if (parsed.kind === "signup") {
    const result = await query("SELECT *,email,name FROM auth_pending_registrations WHERE id=$1 LIMIT 1", [parsed.id]);
    return result.rows[0] ? { ...result.rows[0], challengeKind: "signup" } : null;
  }
  const result = await query(
    `SELECT c.*,u.email,u.name FROM auth_email_otp_challenges c JOIN users u ON u.id=c.user_id WHERE c.id=$1 LIMIT 1`,
    [parsed.id]
  );
  return result.rows[0] ? { ...result.rows[0], challengeKind: parsed.kind } : null;
}

export async function getEmailOtpStatus(rawCookie) {
  const challenge = await loadChallenge(rawCookie);
  if (!challenge || challenge.consumed_at || challenge.invalidated_at) return { ok: false, reason: "challenge_invalid" };
  if (new Date(challenge.expires_at) <= new Date()) return { ok: false, reason: "challenge_expired" };
  return {
    ok: true,
    purpose: challenge.challengeKind,
    maskedEmail: maskEmail(challenge.email),
    expiresAt: challenge.expires_at,
    resendAt: new Date(new Date(challenge.last_sent_at).getTime() + EMAIL_OTP_RESEND_SECONDS * 1000),
    attemptsRemaining: Math.max(0, Number(challenge.max_attempts) - Number(challenge.attempts)),
    trustedBrowserHours: 48
  };
}

export async function resendEmailOtp({ rawCookie, ipAddress, userAgent, locale = "ar" }) {
  const parsed = parseChallengeCookie(rawCookie);
  if (!parsed) return { ok: false, status: 401, reason: "challenge_invalid" };
  const table = parsed.kind === "signup" ? "auth_pending_registrations" : "auth_email_otp_challenges";
  const code = generateEmailOtp();
  const result = await transaction(async (client) => {
    const join = parsed.kind === "signup" ? "" : "JOIN users u ON u.id=c.user_id";
    const emailField = parsed.kind === "signup" ? "c.email,c.name" : "u.email,u.name";
    const locked = await client.query(`SELECT c.*,${emailField} FROM ${table} c ${join} WHERE c.id=$1 FOR UPDATE OF c`, [parsed.id]);
    const row = locked.rows[0];
    if (!row || row.consumed_at || row.invalidated_at) return { ok: false, status: 401, reason: "challenge_invalid" };
    if (new Date(row.last_sent_at).getTime() + EMAIL_OTP_RESEND_SECONDS * 1000 > Date.now()) return { ok: false, status: 429, reason: "resend_cooldown" };
    const windowExpired = new Date(row.resend_window_started_at).getTime() + 15 * 60 * 1000 <= Date.now();
    const resendCount = windowExpired ? 1 : Number(row.resend_count) + 1;
    if (!windowExpired && resendCount > 3) return { ok: false, status: 429, reason: "resend_limit" };
    const updated = await client.query(
      `UPDATE ${table} SET code_digest=$2,expires_at=now() + interval '5 minutes',attempts=0,resend_count=$3,
         resend_window_started_at=CASE WHEN $4 THEN now() ELSE resend_window_started_at END,last_sent_at=now(),
         ip_hash=$5,user_agent_hash=$6,updated_at=now() WHERE id=$1
       RETURNING last_sent_at AS "lastSentAt",expires_at AS "expiresAt"`,
      [parsed.id, digestOtp(code, parsed.id), resendCount, windowExpired, ipAddress ? sha256(ipAddress) : null, userAgent ? sha256(userAgent) : null]
    );
    return { ok: true, email: row.email, name: row.name, ...updated.rows[0] };
  });
  if (!result.ok) return result;
  try {
    await sendLoginEmailOtp({ to: result.email, code, expiresInMinutes: 5, locale, name: result.name });
  } catch (error) {
    await query(`UPDATE ${table} SET invalidated_at=now(),updated_at=now() WHERE id=$1`, [parsed.id]).catch(() => null);
    throw error;
  }
  return { ok: true, maskedEmail: maskEmail(result.email), expiresAt: result.expiresAt, resendAt: new Date(new Date(result.lastSentAt).getTime() + EMAIL_OTP_RESEND_SECONDS * 1000) };
}

async function verifyLockedChallenge(client, row, challengeId, table, code) {
  if (!row || row.consumed_at || row.invalidated_at) return { ok: false, status: 401, reason: "challenge_invalid" };
  if (new Date(row.expires_at) <= new Date()) {
    await client.query(`UPDATE ${table} SET invalidated_at=now(),updated_at=now() WHERE id=$1`, [challengeId]);
    return { ok: false, status: 410, reason: "challenge_expired" };
  }
  if (Number(row.attempts) >= Number(row.max_attempts)) return { ok: false, status: 429, reason: "attempts_exceeded" };
  const supplied = Buffer.from(digestOtp(code, challengeId), "hex");
  const expected = Buffer.from(row.code_digest, "hex");
  const valid = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  if (valid) return { ok: true };
  const attempts = Number(row.attempts) + 1;
  await client.query(`UPDATE ${table} SET attempts=$2,invalidated_at=CASE WHEN $2>=max_attempts THEN now() ELSE invalidated_at END,updated_at=now() WHERE id=$1`, [challengeId, attempts]);
  return { ok: false, status: attempts >= Number(row.max_attempts) ? 429 : 401, reason: attempts >= Number(row.max_attempts) ? "attempts_exceeded" : "invalid_code", attemptsRemaining: Math.max(0, Number(row.max_attempts) - attempts) };
}

async function provisionPendingRegistration(client, row, { ipAddress, userAgent, existingBrowserToken }) {
  const duplicate = await client.query("SELECT 1 FROM users WHERE lower(email)=$1", [row.email]);
  if (duplicate.rowCount) return { ok: false, status: 409, reason: "email_exists" };
  const workspaceName = String(row.company_name || "").trim() || `متجر ${String(row.name).trim()}`;
  const tenant = await client.query("INSERT INTO tenants (name,slug) VALUES ($1,$2) RETURNING id", [workspaceName, slugify(workspaceName)]);
  const tenantId = tenant.rows[0].id;
  const inserted = await client.query(
    `INSERT INTO users
       (tenant_id,name,email,email_verified,role,password_strength,password_changed_at,email_otp_enabled,email_verified_at)
     VALUES ($1,$2,$3,true,'owner',$4,now(),true,now()) RETURNING id,name,email`,
    [tenantId, row.name, row.email, row.password_strength]
  );
  const userId = inserted.rows[0].id;
  await client.query("INSERT INTO accounts (user_id,account_id,provider_id,password) VALUES ($1,$2,'credential',$3)", [userId, row.email, row.password_hash]);
  await client.query("INSERT INTO tenant_members (tenant_id,user_id,role) VALUES ($1,$2,'owner')", [tenantId, userId]);
  await client.query("INSERT INTO stores (tenant_id,name) VALUES ($1,$2)", [tenantId, workspaceName]);
  await client.query("INSERT INTO settings (tenant_id,language,theme) VALUES ($1,'ar','light')", [tenantId]);
  await client.query("INSERT INTO whatsapp_safety_settings (tenant_id) VALUES ($1)", [tenantId]);
  await ensureDefaultTemplates(client, tenantId, workspaceName);
  const plan = await client.query("SELECT id FROM platform_plans WHERE slug IN ('free','trial','starter') ORDER BY CASE slug WHEN 'free' THEN 0 WHEN 'trial' THEN 1 ELSE 2 END LIMIT 1");
  if (plan.rows[0]) await client.query("INSERT INTO platform_subscriptions (tenant_id,plan_id,status,current_period_start,current_period_end) VALUES ($1,$2,'active',now(),now() + interval '1 month')", [tenantId, plan.rows[0].id]);
  await client.query("UPDATE auth_pending_registrations SET consumed_at=now(),updated_at=now() WHERE id=$1", [row.id]);
  const browser = await trustBrowserForUser({ userId, tenantId, rawToken: existingBrowserToken, ipAddress, userAgent, client });
  const session = await createSession(client, { userId, ipAddress, userAgent });
  await audit(client, { tenantId, userId, type: "auth.registered", title: "Account created after email verification", metadata: { emailVerified: true } });
  return { ok: true, status: 201, user: { ...inserted.rows[0], tenantId, role: "owner" }, session, trustedToken: browser.rawToken, trustedUntil: browser.expiresAt };
}

export async function verifyEmailOtp({ rawCookie, code, ipAddress, userAgent, existingBrowserToken = "" }) {
  const parsed = parseChallengeCookie(rawCookie);
  const normalizedCode = normalizeOtpDigits(code);
  if (!parsed || normalizedCode.length !== 6) return { ok: false, status: 400, reason: "invalid_code" };
  if (parsed.kind === "signup") {
    return transaction(async (client) => {
      const locked = await client.query("SELECT * FROM auth_pending_registrations WHERE id=$1 FOR UPDATE", [parsed.id]);
      const row = locked.rows[0];
      const verified = await verifyLockedChallenge(client, row, parsed.id, "auth_pending_registrations", normalizedCode);
      if (!verified.ok) return verified;
      return provisionPendingRegistration(client, row, { ipAddress, userAgent, existingBrowserToken });
    });
  }
  return transaction(async (client) => {
    const locked = await client.query(
      `SELECT c.*,u.email,u.name,u.must_change_password AS "mustChangePassword",COALESCE(tm.role,u.role) AS role
         FROM auth_email_otp_challenges c JOIN users u ON u.id=c.user_id
         LEFT JOIN tenant_members tm ON tm.user_id=u.id AND tm.tenant_id=u.tenant_id
        WHERE c.id=$1 FOR UPDATE OF c`,
      [parsed.id]
    );
    const row = locked.rows[0];
    const verified = await verifyLockedChallenge(client, row, parsed.id, "auth_email_otp_challenges", normalizedCode);
    if (!verified.ok) return verified;
    await client.query("UPDATE auth_email_otp_challenges SET consumed_at=now(),updated_at=now() WHERE id=$1", [parsed.id]);
    const browser = await trustBrowserForUser({ userId: row.user_id, tenantId: row.tenant_id, rawToken: existingBrowserToken, ipAddress, userAgent, client });
    const session = await createSession(client, { userId: row.user_id, ipAddress, userAgent });
    await audit(client, { tenantId: row.tenant_id, userId: row.user_id, type: "auth.email_otp.verified", title: "Email OTP verified", metadata: { purpose: row.purpose, trustedBrowserHours: trustedBrowserEnabled() ? 48 : 0 } });
    return {
      ok: true,
      status: 200,
      user: { id: row.user_id, tenantId: row.tenant_id, email: row.email, name: row.name, role: row.role, mustChangePassword: row.mustChangePassword },
      session,
      trustedToken: browser.rawToken,
      trustedUntil: browser.expiresAt,
      redirectUrl: parsed.kind === "admin_login" ? "/admin" : "/dashboard"
    };
  });
}

export async function revokeTrustedDevicesForUser(userId, reason = "security_event") {
  await revokeAllUserBrowsers(userId, reason);
  await query("UPDATE auth_email_otp_challenges SET invalidated_at=now(),updated_at=now() WHERE user_id=$1 AND consumed_at IS NULL AND invalidated_at IS NULL", [userId]);
}

export { hashBrowserToken };
