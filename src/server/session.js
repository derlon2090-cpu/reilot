import { query } from "./db.js";
import { randomToken, sha256 } from "./security.js";

export const SESSION_COOKIE = "renewpilot_session";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 14;

function cookieValue(req, name) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}
export function sessionCookie(token, maxAge = SESSION_AGE_SECONDS) {
  const publicUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const secure = publicUrl.startsWith("https://") ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie() {
  return sessionCookie("", 0);
}

export async function createSession(client, { userId, ipAddress, userAgent }) {
  const rawToken = randomToken(32);
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_AGE_SECONDS * 1000);
  await client.query(
    `INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, ipAddress || null, userAgent || null]
  );
  return { token: rawToken, expiresAt };
}

export async function getSession(req) {
  const rawToken = cookieValue(req, SESSION_COOKIE);
  if (!rawToken) return null;
  const result = await query(
    `SELECT s.id, s.user_id AS "userId", u.tenant_id AS "tenantId", u.email, u.name,
            COALESCE(tm.role, u.role) AS role, s.expires_at AS "expiresAt"
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN tenant_members tm ON tm.user_id = u.id AND tm.tenant_id = u.tenant_id
      WHERE s.token = $1 AND s.expires_at > now()
      LIMIT 1`,
    [sha256(rawToken)]
  );
  return result.rows[0] || null;
}

export async function requireSession(req) {
  const session = await getSession(req);
  return session
    ? { ok: true, session }
    : { ok: false, response: Response.json({ ok: false, message: "Authentication required" }, { status: 401 }) };
}

export async function destroySession(req) {
  const rawToken = cookieValue(req, SESSION_COOKIE);
  if (rawToken) await query("DELETE FROM sessions WHERE token = $1", [sha256(rawToken)]);
}
