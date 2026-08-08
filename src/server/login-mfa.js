import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { createSession } from "./session.js";
import { decryptMfaSecret, matchingTotpCounter } from "./mfa.js";
import { sha256 } from "./security.js";
import { trustBrowserForUser } from "./trusted-browser.js";

export const MFA_LOGIN_CHALLENGE_COOKIE = "renvix_mfa_login_challenge";
const MFA_LOGIN_TTL_SECONDS = 5 * 60;

function challengeKey() {
  const value = process.env.MFA_CHALLENGE_KEY?.trim()
    || process.env.MFA_ENCRYPTION_KEY?.trim()
    || process.env.ENCRYPTION_KEY?.trim()
    || process.env.EMAIL_OTP_PEPPER?.trim()
    || "";
  if (value.length < 24) {
    throw Object.assign(new Error("MFA challenge signing key is missing or too short"), {
      code: "AUTH_CONFIGURATION_ERROR"
    });
  }
  return value;
}

export function mfaChallengeSigningConfigured() {
  return Boolean(
    process.env.MFA_CHALLENGE_KEY?.trim().length >= 24
    || process.env.MFA_ENCRYPTION_KEY?.trim().length >= 24
    || process.env.ENCRYPTION_KEY?.trim().length >= 24
    || process.env.EMAIL_OTP_PEPPER?.trim().length >= 24
  );
}

function secureCookieEnabled() {
  const publicUrl = process.env.APP_URL || process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  return process.env.COOKIE_SECURE !== "false"
    && (process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production" || publicUrl.startsWith("https://"));
}

function cookie(value, maxAge) {
  const secure = secureCookieEnabled() ? "; Secure" : "";
  return `${MFA_LOGIN_CHALLENGE_COOKIE}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=${Math.max(0, Number(maxAge) || 0)}; HttpOnly${secure}`;
}

function signChallengeId(id) {
  const signature = crypto.createHmac("sha256", challengeKey()).update(`mfa-login:${id}`).digest("base64url");
  return `${id}.${signature}`;
}

function parseChallengeId(rawValue) {
  const [id, signature] = String(rawValue || "").split(".");
  if (!/^[0-9a-f-]{36}$/i.test(id || "") || !signature) return null;
  const expected = crypto.createHmac("sha256", challengeKey()).update(`mfa-login:${id}`).digest();
  let supplied;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied) ? id : null;
}

export function mfaChallengeCookie(value) {
  return cookie(value, MFA_LOGIN_TTL_SECONDS);
}

export function clearMfaChallengeCookie() {
  return cookie("", 0);
}

export function readMfaChallengeCookie(request) {
  const header = request.headers.get("cookie") || "";
  const entry = header.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${MFA_LOGIN_CHALLENGE_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(MFA_LOGIN_CHALLENGE_COOKIE.length + 1)) : "";
}

export async function createMfaLoginChallenge({ user, ipAddress, userAgent, targetPath = "/dashboard", loginAttemptId = null }) {
  // Resolve the signing key before writing a challenge so a configuration
  // problem can never leave a pending row that has no usable cookie.
  challengeKey();
  const row = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`mfa-login:${user.id}`]);
    await client.query(
      `UPDATE auth_mfa_login_challenges SET invalidated_at=now(),updated_at=now()
        WHERE user_id=$1 AND consumed_at IS NULL AND invalidated_at IS NULL`,
      [user.id]
    );
    await client.query(
      `UPDATE auth_email_otp_challenges SET invalidated_at=now(),updated_at=now()
        WHERE user_id=$1 AND purpose IN ('login','admin_login')
          AND consumed_at IS NULL AND invalidated_at IS NULL`,
      [user.id]
    );
    const inserted = await client.query(
      `INSERT INTO auth_mfa_login_challenges
         (user_id,tenant_id,expires_at,ip_hash,user_agent_hash,target_path,login_attempt_id)
       VALUES ($1,$2,now() + interval '5 minutes',$3,$4,$5,$6)
       RETURNING id,expires_at AS "expiresAt"`,
      [user.id, user.tenantId, ipAddress ? sha256(ipAddress) : null, userAgent ? sha256(userAgent) : null, targetPath === "/admin" ? "/admin" : "/dashboard", loginAttemptId]
    );
    return inserted.rows[0];
  });
  // Auditing is useful, but it is not part of the security decision. A legacy
  // audit table must not roll back an otherwise valid MFA challenge.
  try {
    await query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title)
       VALUES ($1,$2,'auth.mfa.requested','Authenticator verification requested')`,
      [user.tenantId, user.id]
    );
  } catch (error) {
    console.error("MFA challenge audit unavailable", { code: String(error?.code || "AUDIT_ERROR") });
  }
  return { challengeCookie: signChallengeId(row.id), expiresAt: row.expiresAt };
}

export async function getMfaLoginStatus(rawCookie) {
  const id = parseChallengeId(rawCookie);
  if (!id) return { ok: false, reason: "challenge_invalid" };
  const result = await query(
    `SELECT expires_at AS "expiresAt",attempts,max_attempts AS "maxAttempts",consumed_at AS "consumedAt",
            invalidated_at AS "invalidatedAt"
       FROM auth_mfa_login_challenges WHERE id=$1 LIMIT 1`,
    [id]
  );
  const row = result.rows[0];
  if (!row || row.consumedAt || row.invalidatedAt) return { ok: false, reason: "challenge_invalid" };
  if (new Date(row.expiresAt) <= new Date()) return { ok: false, reason: "challenge_expired" };
  return {
    ok: true,
    expiresAt: row.expiresAt,
    attemptsRemaining: Math.max(0, Number(row.maxAttempts) - Number(row.attempts))
  };
}

function normalizeRecoveryCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

export async function verifyMfaLogin({ rawCookie, code, ipAddress, userAgent, existingBrowserToken = "" }) {
  const challengeId = parseChallengeId(rawCookie);
  const normalizedCode = String(code || "").trim();
  if (!challengeId || !normalizedCode) return { ok: false, status: 400, reason: "invalid_code" };

  return transaction(async (client) => {
    const result = await client.query(
      `SELECT c.*,u.email,u.name,u.must_change_password AS "mustChangePassword",
              u.mfa_enabled AS "mfaEnabled",u.mfa_secret_encrypted AS "mfaSecret",
              COALESCE(u.mfa_recovery_hashes,'[]'::jsonb) AS "recoveryHashes",
              u.mfa_last_verified_step AS "lastVerifiedStep",
              COALESCE(tm.role,u.role) AS role
         FROM auth_mfa_login_challenges c
         JOIN users u ON u.id=c.user_id
         LEFT JOIN tenant_members tm ON tm.user_id=u.id AND tm.tenant_id=u.tenant_id
        WHERE c.id=$1 FOR UPDATE OF c`,
      [challengeId]
    );
    const row = result.rows[0];
    if (!row || row.consumed_at || row.invalidated_at || !row.mfaEnabled || !row.mfaSecret) {
      return { ok: false, status: 401, reason: "challenge_invalid" };
    }
    if (new Date(row.expires_at) <= new Date()) {
      await client.query("UPDATE auth_mfa_login_challenges SET invalidated_at=now(),updated_at=now() WHERE id=$1", [challengeId]);
      return { ok: false, status: 410, reason: "challenge_expired" };
    }
    if (Number(row.attempts) >= Number(row.max_attempts)) {
      await client.query("UPDATE auth_mfa_login_challenges SET invalidated_at=now(),updated_at=now() WHERE id=$1", [challengeId]);
      return { ok: false, status: 429, reason: "attempts_exceeded" };
    }

    const secret = decryptMfaSecret(row.mfaSecret);
    const totpCounter = matchingTotpCounter(secret, normalizedCode);
    const totpValid = totpCounter !== null && (row.lastVerifiedStep == null || totpCounter > Number(row.lastVerifiedStep));
    const recoveryHash = sha256(normalizeRecoveryCode(normalizedCode));
    const recoveryHashes = Array.isArray(row.recoveryHashes) ? row.recoveryHashes : [];
    const recoveryIndex = recoveryHashes.indexOf(recoveryHash);
    const valid = totpValid || recoveryIndex >= 0;
    if (!valid) {
      const attempts = Number(row.attempts) + 1;
      await client.query(
        `UPDATE auth_mfa_login_challenges SET attempts=$2,
                invalidated_at=CASE WHEN $2>=max_attempts THEN now() ELSE invalidated_at END,updated_at=now()
          WHERE id=$1`,
        [challengeId, attempts]
      );
      return {
        ok: false,
        status: attempts >= Number(row.max_attempts) ? 429 : 401,
        reason: attempts >= Number(row.max_attempts) ? "attempts_exceeded" : "invalid_code",
        attemptsRemaining: Math.max(0, Number(row.max_attempts) - attempts)
      };
    }

    if (recoveryIndex >= 0) {
      recoveryHashes.splice(recoveryIndex, 1);
      await client.query("UPDATE users SET mfa_recovery_hashes=$2::jsonb,updated_at=now() WHERE id=$1", [row.user_id, JSON.stringify(recoveryHashes)]);
    }
    if (totpValid) {
      const updated = await client.query(
        `UPDATE users SET mfa_last_verified_step=$2,updated_at=now()
          WHERE id=$1 AND (mfa_last_verified_step IS NULL OR mfa_last_verified_step < $2)`,
        [row.user_id, totpCounter]
      );
      if (updated.rowCount !== 1) return { ok: false, status: 409, reason: "code_already_used" };
    }
    await client.query("UPDATE auth_mfa_login_challenges SET consumed_at=now(),updated_at=now() WHERE id=$1", [challengeId]);
    const browser = await trustBrowserForUser({
      userId: row.user_id,
      tenantId: row.tenant_id,
      rawToken: existingBrowserToken,
      ipAddress,
      userAgent,
      client
    });
    const session = await createSession(client, { userId: row.user_id, ipAddress, userAgent });
    await client.query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
       VALUES ($1,$2,'auth.mfa.verified','Authenticator verification completed',$3::jsonb)`,
      [row.tenant_id, row.user_id, JSON.stringify({ recoveryCodeUsed: recoveryIndex >= 0 })]
    );
    return {
      ok: true,
      status: 200,
      session,
      trustedToken: browser.rawToken,
      trustedUntil: browser.expiresAt,
      redirectUrl: row.target_path === "/admin" ? "/admin" : "/dashboard",
      user: {
        id: row.user_id,
        tenantId: row.tenant_id,
        email: row.email,
        name: row.name,
        role: row.role,
        mustChangePassword: row.mustChangePassword
      }
    };
  });
}
