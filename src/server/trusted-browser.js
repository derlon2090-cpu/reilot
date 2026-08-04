import crypto from "node:crypto";
import { query } from "./db.js";

export const TRUSTED_BROWSER_COOKIE = "__Host-rvx_trusted_browser";
export const TRUSTED_BROWSER_DEV_COOKIE = "rvx_trusted_browser_dev";
export const TRUSTED_BROWSER_MAX_HOURS = 48;

function serverSecret() {
  const value = process.env.TRUSTED_BROWSER_PEPPER?.trim() || process.env.EMAIL_OTP_PEPPER?.trim() || "";
  if (value.length < 24) throw Object.assign(new Error("Trusted browser secret is missing or too short"), { code: "AUTH_CONFIGURATION_ERROR" });
  return value;
}

export function trustedBrowserEnabled() {
  return process.env.TRUSTED_BROWSER_ENABLED === "true"
    || process.env.EMAIL_OTP_TRUSTED_BROWSER_ENABLED === "true";
}

export function trustedBrowserHours() {
  const requested = Number.parseInt(process.env.TRUSTED_BROWSER_HOURS || process.env.EMAIL_OTP_TRUSTED_BROWSER_HOURS || "48", 10);
  if (!Number.isFinite(requested)) return TRUSTED_BROWSER_MAX_HOURS;
  return Math.max(1, Math.min(TRUSTED_BROWSER_MAX_HOURS, requested));
}

export function trustedBrowserAgeSeconds() {
  return trustedBrowserHours() * 60 * 60;
}

export function issueBrowserToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashBrowserToken(rawToken) {
  return crypto.createHmac("sha256", serverSecret()).update(`trusted-browser:${String(rawToken || "")}`).digest("hex");
}

export function isValidBrowserToken(rawToken) {
  return /^[A-Za-z0-9_-]{43}$/.test(String(rawToken || ""));
}

function agentLabel(userAgent) {
  const value = String(userAgent || "");
  const browser = value.includes("Edg/") ? "Edge" : value.includes("Firefox/") ? "Firefox" : value.includes("Chrome/") ? "Chrome" : value.includes("Safari/") ? "Safari" : "Browser";
  const os = value.includes("Windows") ? "Windows" : value.includes("Android") ? "Android" : /iPad|iPhone/.test(value) ? "iOS/iPadOS" : value.includes("Mac OS") ? "macOS" : "Unknown OS";
  return `${browser} · ${os}`;
}

function optionalHash(value) {
  return value ? crypto.createHash("sha256").update(String(value)).digest("hex") : null;
}

export async function validateTrustedBrowser({ userId, rawToken, riskDetected = false, client = null }) {
  if (!trustedBrowserEnabled()) return { trusted: false, reason: "disabled" };
  if (!rawToken) return { trusted: false, reason: "missing_cookie" };
  if (!isValidBrowserToken(rawToken)) return { trusted: false, reason: "invalid_token" };
  const runner = client || { query };
  const tokenDigest = hashBrowserToken(rawToken);
  if (riskDetected) {
    await runner.query(
      `UPDATE auth_trusted_devices
          SET revoked_at = now(), revoke_reason = 'risk_detected', updated_at = now()
        WHERE user_id = $1 AND token_digest = $2 AND revoked_at IS NULL`,
      [userId, tokenDigest]
    );
    return { trusted: false, reason: "risk_detected" };
  }
  const result = await runner.query(
    `SELECT id, expires_at AS "expiresAt", revoked_at AS "revokedAt"
       FROM auth_trusted_devices
      WHERE user_id = $1 AND token_digest = $2
      LIMIT 1`,
    [userId, tokenDigest]
  );
  const row = result.rows[0];
  if (!row) return { trusted: false, reason: "not_registered_for_user" };
  if (row.revokedAt) return { trusted: false, reason: "revoked" };
  if (new Date(row.expiresAt).getTime() <= Date.now()) return { trusted: false, reason: "expired" };
  await runner.query(
    `UPDATE auth_trusted_devices
        SET last_used_at = now(), updated_at = now()
      WHERE id = $1`,
    [row.id]
  );
  return { trusted: true, reason: "valid", id: row.id, expiresAt: row.expiresAt };
}

export async function trustBrowserForUser({ userId, tenantId, rawToken = "", ipAddress = "", userAgent = "", client = null }) {
  if (!trustedBrowserEnabled()) return { rawToken: null, expiresAt: null };
  const token = isValidBrowserToken(rawToken) ? rawToken : issueBrowserToken();
  const tokenHash = hashBrowserToken(token);
  const runner = client || { query };
  const seconds = trustedBrowserAgeSeconds();
  const result = await runner.query(
    `INSERT INTO auth_trusted_devices
       (user_id, tenant_id, token_digest, label, user_agent_hash, ip_hash, created_ip_hash, last_ip_hash,
        verified_at, expires_at, last_used_at, revoked_at, revoke_reason, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6, $6,
             now(), now() + ($7 * interval '1 second'), now(), NULL, NULL, now())
     ON CONFLICT (user_id, token_digest) DO UPDATE
       SET tenant_id = EXCLUDED.tenant_id, label = EXCLUDED.label,
           user_agent_hash = EXCLUDED.user_agent_hash, last_ip_hash = EXCLUDED.last_ip_hash,
           verified_at = now(), expires_at = now() + ($7 * interval '1 second'),
           last_used_at = now(), revoked_at = NULL, revoke_reason = NULL, updated_at = now()
     RETURNING expires_at AS "expiresAt"`,
    [userId, tenantId, tokenHash, agentLabel(userAgent), optionalHash(userAgent), optionalHash(ipAddress), seconds]
  );
  return { rawToken: token, expiresAt: result.rows[0]?.expiresAt || new Date(Date.now() + seconds * 1000) };
}

export async function revokeTrustedBrowser({ userId, browserId, reason = "user_revoked", client = null }) {
  const runner = client || { query };
  return runner.query(
    `UPDATE auth_trusted_devices
        SET revoked_at = now(), revoke_reason = $3, updated_at = now()
      WHERE user_id = $1 AND id = $2 AND revoked_at IS NULL`,
    [userId, browserId, reason]
  );
}

export async function revokeAllUserBrowsers(userId, reason = "security_event", client = null) {
  const runner = client || { query };
  return runner.query(
    `UPDATE auth_trusted_devices
        SET revoked_at = now(), revoke_reason = $2, updated_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, reason]
  );
}

export async function listTrustedBrowsers(userId) {
  const result = await query(
    `SELECT id, label, verified_at AS "verifiedAt", expires_at AS "expiresAt",
            last_used_at AS "lastUsedAt", revoked_at AS "revokedAt"
       FROM auth_trusted_devices
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY last_used_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function cleanupExpiredBrowsers() {
  return query("DELETE FROM auth_trusted_devices WHERE expires_at < now() - interval '30 days'");
}
