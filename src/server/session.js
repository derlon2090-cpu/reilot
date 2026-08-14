import { query } from "./db.js";
import { randomToken, sha256 } from "./security.js";
import { getTenantStorageLimitState, requestNeedsStorageCapacity, storageLimitResponse } from "./tenant-storage.js";
import { secureCookieEnabled, sharedCookieDomainAttribute } from "./cookie-policy.js";

export const SESSION_COOKIE = "renewpilot_session";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 14;

function cookieValues(req, name) {
  const cookie = req.headers.get("cookie") || "";
  return [...new Set(cookie.split(";").map((item) => item.trim()).filter((item) => item.startsWith(`${name}=`)).map((item) => {
    try { return decodeURIComponent(item.slice(name.length + 1)); } catch { return ""; }
  }).filter(Boolean))];
}
export function sessionCookie(token, maxAge = SESSION_AGE_SECONDS) {
  const secure = secureCookieEnabled() ? "; Secure" : "";
  const domain = sharedCookieDomainAttribute();
  const lifetime = maxAge === null ? "" : `; Max-Age=${Math.max(0, Number(maxAge) || 0)}`;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${lifetime}${domain}${secure}`;
}

export function clearSessionCookie() {
  return sessionCookie("", 0);
}

export async function createSession(client, { userId, ipAddress, userAgent, maxAgeSeconds = SESSION_AGE_SECONDS }) {
  const rawToken = randomToken(32);
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + Math.max(300, Number(maxAgeSeconds) || SESSION_AGE_SECONDS) * 1000);
  await client.query(
    `INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, ipAddress || null, userAgent || null]
  );
  return { token: rawToken, expiresAt };
}

export async function getSessionWithToken(req, { allowInactiveTenant = false } = {}) {
  const rawTokens = cookieValues(req, SESSION_COOKIE);
  if (!rawTokens.length) return null;
  const tokenHashes = rawTokens.map((token) => sha256(token));
  const tenantJoin = allowInactiveTenant
    ? "LEFT JOIN tenants t ON t.id = u.tenant_id"
    : "JOIN tenants t ON t.id = u.tenant_id AND t.status <> 'disabled'";
  const result = await query(
    `SELECT s.id, s.token AS "_tokenHash", s.user_id AS "userId", u.tenant_id AS "tenantId", u.email, u.name, u.image, u.must_change_password AS "mustChangePassword",
            COALESCE(tm.role, u.role) AS role, s.expires_at AS "expiresAt"
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       ${tenantJoin}
       LEFT JOIN tenant_members tm ON tm.user_id = u.id AND tm.tenant_id = u.tenant_id
      WHERE s.token = ANY($1::text[]) AND s.expires_at > now()
      ORDER BY array_position($1::text[], s.token)
      LIMIT 1`,
    [tokenHashes]
  );
  const row = result.rows[0];
  if (!row) return null;
  const tokenIndex = tokenHashes.indexOf(row._tokenHash);
  const session = { ...row };
  delete session._tokenHash;
  return { session, token: tokenIndex >= 0 ? rawTokens[tokenIndex] : "" };
}

export async function getSession(req, options = {}) {
  const resolved = await getSessionWithToken(req, options);
  return resolved?.session || null;
}

export async function requireSession(req) {
  const session = await getSession(req);
  if (!session) {
    return { ok: false, response: Response.json({ ok: false, message: "Authentication required" }, { status: 401 }) };
  }
  if (requestNeedsStorageCapacity(req)) {
    const storage = await getTenantStorageLimitState(session.tenantId);
    if (storage.isLimitReached) return { ok: false, response: storageLimitResponse(storage) };
  }
  return { ok: true, session };
}

export async function destroySession(req) {
  const tokenHashes = cookieValues(req, SESSION_COOKIE).map((token) => sha256(token));
  if (tokenHashes.length) await query("DELETE FROM sessions WHERE token = ANY($1::text[])", [tokenHashes]);
}
