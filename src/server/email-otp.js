import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { createSession } from "./session.js";
import { sendLoginEmailOtp } from "./email/resend.service.js";
import { sha256 } from "./security.js";

export const EMAIL_OTP_CHALLENGE_COOKIE = "renvix_email_otp_challenge";
export const TRUSTED_DEVICE_COOKIE = "renvix_trusted_device";
export const EMAIL_OTP_TTL_SECONDS = 5 * 60;
export const EMAIL_OTP_RESEND_SECONDS = 60;
export const TRUSTED_DEVICE_AGE_SECONDS = 30 * 24 * 60 * 60;

function otpPepper() {
  const value = process.env.EMAIL_OTP_PEPPER;
  if (!value || value.length < 24) throw new Error("EMAIL_OTP_PEPPER is missing or too short");
  return value;
}

function secureCookieEnabled() {
  const publicUrl = process.env.APP_URL || process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  return process.env.COOKIE_SECURE !== "false"
    && (process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production" || publicUrl.startsWith("https://"));
}

function cookie(name, value, maxAge, httpOnly = true) {
  const secure = secureCookieEnabled() ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=${Math.max(0, Number(maxAge) || 0)}${httpOnly ? "; HttpOnly" : ""}${secure}`;
}

export function challengeCookie(value) {
  return cookie(EMAIL_OTP_CHALLENGE_COOKIE, value, 10 * 60);
}

export function clearChallengeCookie() {
  return cookie(EMAIL_OTP_CHALLENGE_COOKIE, "", 0);
}

export function trustedDeviceCookie(value) {
  return cookie(TRUSTED_DEVICE_COOKIE, value, TRUSTED_DEVICE_AGE_SECONDS);
}

export function clearTrustedDeviceCookie() {
  return cookie(TRUSTED_DEVICE_COOKIE, "", 0);
}

export function readCookie(req, name) {
  const header = req.headers.get("cookie") || "";
  const entry = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
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

function signChallengeId(challengeId) {
  const signature = crypto.createHmac("sha256", otpPepper()).update(`challenge:${challengeId}`).digest("base64url");
  return `${challengeId}.${signature}`;
}

function parseChallengeCookie(raw) {
  const [challengeId, signature] = String(raw || "").split(".");
  if (!/^[0-9a-f-]{36}$/i.test(challengeId || "") || !signature) return null;
  const expected = crypto.createHmac("sha256", otpPepper()).update(`challenge:${challengeId}`).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  return challengeId;
}

function maskEmail(email) {
  const [local = "", domain = ""] = String(email || "").split("@");
  if (!domain) return "";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

async function audit(client, { tenantId, userId, type, title, metadata = {} }) {
  await client.query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [tenantId, userId, type, title, JSON.stringify(metadata)]
  );
}

export async function isTrustedDevice({ userId, rawToken }) {
  if (!rawToken) return false;
  const result = await query(
    `UPDATE auth_trusted_devices
        SET last_used_at = now()
      WHERE user_id = $1 AND token_digest = $2
        AND revoked_at IS NULL AND expires_at > now()
      RETURNING id`,
    [userId, sha256(rawToken)]
  );
  return Boolean(result.rows[0]);
}

export async function createLoginEmailOtpChallenge({
  user,
  ipAddress,
  userAgent,
  locale = "ar",
  purpose = "login"
}) {
  let code = "";
  const challenge = await transaction(async (client) => {
    // A browser can submit the login form twice (double click, password manager,
    // or a retried request). Serialize creation per user and reuse the very
    // recent challenge so that the first email is never invalidated by the
    // second request.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`email-otp:${user.id}:${purpose}`]);
    const existing = await client.query(
      `SELECT id, expires_at AS "expiresAt", last_sent_at AS "lastSentAt"
         FROM auth_email_otp_challenges
        WHERE user_id = $1 AND purpose = $2
          AND consumed_at IS NULL AND invalidated_at IS NULL
          AND expires_at > now() AND created_at >= now() - interval '15 seconds'
        ORDER BY created_at DESC LIMIT 1`,
      [user.id, purpose]
    );
    if (existing.rows[0]) return { ...existing.rows[0], reused: true };

    code = generateEmailOtp();
    await client.query(
      `UPDATE auth_email_otp_challenges
          SET invalidated_at = now(), updated_at = now()
        WHERE user_id = $1 AND purpose = $2
          AND consumed_at IS NULL AND invalidated_at IS NULL`,
      [user.id, purpose]
    );
    const inserted = await client.query(
      `INSERT INTO auth_email_otp_challenges
         (user_id, tenant_id, purpose, code_digest, expires_at, ip_hash, user_agent_hash)
       VALUES ($1, $2, $3, '', now() + interval '5 minutes', $4, $5)
       RETURNING id, expires_at AS "expiresAt", last_sent_at AS "lastSentAt"`,
      [user.id, user.tenantId, purpose, ipAddress ? sha256(ipAddress) : null, userAgent ? sha256(userAgent) : null]
    );
    const row = inserted.rows[0];
    await client.query("UPDATE auth_email_otp_challenges SET code_digest = $2 WHERE id = $1", [row.id, digestOtp(code, row.id)]);
    await audit(client, {
      tenantId: user.tenantId,
      userId: user.id,
      type: "auth.email_otp.requested",
      title: "Email OTP requested",
      metadata: { purpose }
    });
    return { ...row, reused: false };
  });

  try {
    if (challenge.reused) {
      return {
        challengeCookie: signChallengeId(challenge.id),
        maskedEmail: maskEmail(user.email),
        expiresAt: challenge.expiresAt,
        resendAt: new Date(new Date(challenge.lastSentAt).getTime() + EMAIL_OTP_RESEND_SECONDS * 1000),
        reused: true
      };
    }
    await sendLoginEmailOtp({ to: user.email, code, expiresInMinutes: 5, locale, name: user.name });
    await query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
       VALUES ($1,$2,'auth.email_otp.sent','Email OTP sent',$3::jsonb)`,
      [user.tenantId, user.id, JSON.stringify({ purpose })]
    ).catch(() => null);
  } catch (error) {
    await query(
      "UPDATE auth_email_otp_challenges SET invalidated_at = now(), updated_at = now() WHERE id = $1",
      [challenge.id]
    ).catch(() => null);
    throw error;
  }

  return {
    challengeCookie: signChallengeId(challenge.id),
    maskedEmail: maskEmail(user.email),
    expiresAt: challenge.expiresAt,
    resendAt: new Date(new Date(challenge.lastSentAt).getTime() + EMAIL_OTP_RESEND_SECONDS * 1000),
    reused: false
  };
}

async function loadChallenge(rawCookie, forUpdate = false) {
  const challengeId = parseChallengeCookie(rawCookie);
  if (!challengeId) return null;
  const runner = forUpdate ? null : query;
  if (!runner) return challengeId;
  const result = await query(
    `SELECT c.*, u.email, u.name, COALESCE(tm.role, u.role) AS role
       FROM auth_email_otp_challenges c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN tenant_members tm ON tm.user_id = u.id AND tm.tenant_id = u.tenant_id
      WHERE c.id = $1 LIMIT 1`,
    [challengeId]
  );
  return result.rows[0] || null;
}

export async function getEmailOtpStatus(rawCookie) {
  const challenge = await loadChallenge(rawCookie);
  if (!challenge || challenge.consumed_at || challenge.invalidated_at) return { ok: false, reason: "challenge_invalid" };
  if (new Date(challenge.expires_at) <= new Date()) return { ok: false, reason: "challenge_expired" };
  return {
    ok: true,
    maskedEmail: maskEmail(challenge.email),
    expiresAt: challenge.expires_at,
    resendAt: new Date(new Date(challenge.last_sent_at).getTime() + EMAIL_OTP_RESEND_SECONDS * 1000),
    attemptsRemaining: Math.max(0, Number(challenge.max_attempts) - Number(challenge.attempts))
  };
}

export async function resendEmailOtp({ rawCookie, ipAddress, userAgent, locale = "ar" }) {
  const challengeId = parseChallengeCookie(rawCookie);
  if (!challengeId) return { ok: false, status: 401, reason: "challenge_invalid" };
  const code = generateEmailOtp();
  const result = await transaction(async (client) => {
    const locked = await client.query(
      `SELECT c.*, u.email, u.name
         FROM auth_email_otp_challenges c
         JOIN users u ON u.id = c.user_id
        WHERE c.id = $1 FOR UPDATE`,
      [challengeId]
    );
    const row = locked.rows[0];
    if (!row || row.consumed_at || row.invalidated_at) return { ok: false, status: 401, reason: "challenge_invalid" };
    if (new Date(row.last_sent_at).getTime() + EMAIL_OTP_RESEND_SECONDS * 1000 > Date.now()) {
      return { ok: false, status: 429, reason: "resend_cooldown" };
    }
    const windowExpired = new Date(row.resend_window_started_at).getTime() + 15 * 60 * 1000 <= Date.now();
    const resendCount = windowExpired ? 1 : Number(row.resend_count) + 1;
    if (!windowExpired && resendCount > 3) return { ok: false, status: 429, reason: "resend_limit" };
    const updated = await client.query(
      `UPDATE auth_email_otp_challenges
          SET code_digest = $2, expires_at = now() + interval '5 minutes',
              attempts = 0, resend_count = $3,
              resend_window_started_at = CASE WHEN $4 THEN now() ELSE resend_window_started_at END,
              last_sent_at = now(), ip_hash = $5, user_agent_hash = $6, updated_at = now()
        WHERE id = $1
        RETURNING last_sent_at AS "lastSentAt", expires_at AS "expiresAt"`,
      [challengeId, digestOtp(code, challengeId), resendCount, windowExpired,
        ipAddress ? sha256(ipAddress) : null, userAgent ? sha256(userAgent) : null]
    );
    await audit(client, {
      tenantId: row.tenant_id,
      userId: row.user_id,
      type: "auth.email_otp.resent",
      title: "Email OTP resent",
      metadata: { purpose: row.purpose }
    });
    return { ok: true, email: row.email, name: row.name, ...updated.rows[0] };
  });
  if (!result.ok) return result;
  try {
    await sendLoginEmailOtp({ to: result.email, code, expiresInMinutes: 5, locale, name: result.name });
  } catch (error) {
    await query(
      "UPDATE auth_email_otp_challenges SET invalidated_at=now(),updated_at=now() WHERE id=$1",
      [challengeId]
    ).catch(() => null);
    throw error;
  }
  return {
    ok: true,
    maskedEmail: maskEmail(result.email),
    expiresAt: result.expiresAt,
    resendAt: new Date(new Date(result.lastSentAt).getTime() + EMAIL_OTP_RESEND_SECONDS * 1000)
  };
}

export async function verifyEmailOtp({
  rawCookie,
  code,
  rememberDevice,
  ipAddress,
  userAgent
}) {
  const challengeId = parseChallengeCookie(rawCookie);
  const normalizedCode = normalizeOtpDigits(code);
  if (!challengeId || normalizedCode.length !== 6) return { ok: false, status: 400, reason: "invalid_code" };

  return transaction(async (client) => {
    const locked = await client.query(
      `SELECT c.*, u.email, u.name, u.must_change_password AS "mustChangePassword",
              COALESCE(tm.role, u.role) AS role
         FROM auth_email_otp_challenges c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN tenant_members tm ON tm.user_id = u.id AND tm.tenant_id = u.tenant_id
        WHERE c.id = $1 FOR UPDATE`,
      [challengeId]
    );
    const row = locked.rows[0];
    if (!row || row.consumed_at || row.invalidated_at) return { ok: false, status: 401, reason: "challenge_invalid" };
    if (new Date(row.expires_at) <= new Date()) {
      await client.query("UPDATE auth_email_otp_challenges SET invalidated_at = now(), updated_at = now() WHERE id = $1", [challengeId]);
      return { ok: false, status: 410, reason: "challenge_expired" };
    }
    if (Number(row.attempts) >= Number(row.max_attempts)) {
      await client.query("UPDATE auth_email_otp_challenges SET invalidated_at = now(), updated_at = now() WHERE id = $1", [challengeId]);
      return { ok: false, status: 429, reason: "attempts_exceeded" };
    }
    const supplied = Buffer.from(digestOtp(normalizedCode, challengeId), "hex");
    const expected = Buffer.from(row.code_digest, "hex");
    const valid = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
    if (!valid) {
      const nextAttempts = Number(row.attempts) + 1;
      await client.query(
        `UPDATE auth_email_otp_challenges
            SET attempts = $2, invalidated_at = CASE WHEN $2 >= max_attempts THEN now() ELSE invalidated_at END,
                updated_at = now()
          WHERE id = $1`,
        [challengeId, nextAttempts]
      );
      await audit(client, {
        tenantId: row.tenant_id,
        userId: row.user_id,
        type: "auth.email_otp.failed",
        title: "Email OTP verification failed",
        metadata: { attempts: nextAttempts }
      });
      return {
        ok: false,
        status: nextAttempts >= Number(row.max_attempts) ? 429 : 401,
        reason: nextAttempts >= Number(row.max_attempts) ? "attempts_exceeded" : "invalid_code",
        attemptsRemaining: Math.max(0, Number(row.max_attempts) - nextAttempts)
      };
    }

    await client.query(
      "UPDATE auth_email_otp_challenges SET consumed_at = now(), updated_at = now() WHERE id = $1",
      [challengeId]
    );
    const session = await createSession(client, { userId: row.user_id, ipAddress, userAgent });
    let trustedToken = null;
    if (rememberDevice) {
      trustedToken = crypto.randomBytes(32).toString("base64url");
      await client.query(
        `INSERT INTO auth_trusted_devices
           (user_id, tenant_id, token_digest, label, user_agent_hash, ip_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, now() + interval '30 days')`,
        [row.user_id, row.tenant_id, sha256(trustedToken), String(userAgent || "Trusted device").slice(0, 120),
          userAgent ? sha256(userAgent) : null, ipAddress ? sha256(ipAddress) : null]
      );
    }
    await audit(client, {
      tenantId: row.tenant_id,
      userId: row.user_id,
      type: "auth.email_otp.verified",
      title: "Email OTP verified",
      metadata: { rememberDevice: Boolean(rememberDevice), purpose: row.purpose }
    });
    return {
      ok: true,
      status: 200,
      user: {
        id: row.user_id,
        tenantId: row.tenant_id,
        email: row.email,
        name: row.name,
        role: row.role,
        mustChangePassword: row.mustChangePassword
      },
      session,
      trustedToken
    };
  });
}

export async function revokeTrustedDevicesForUser(userId) {
  await query(
    `UPDATE auth_trusted_devices SET revoked_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  await query(
    `UPDATE auth_email_otp_challenges SET invalidated_at = now(), updated_at = now()
      WHERE user_id = $1 AND consumed_at IS NULL AND invalidated_at IS NULL`,
    [userId]
  );
}
