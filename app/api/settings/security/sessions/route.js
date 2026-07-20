import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

function sessionLabel(userAgent = "") {
  const browser = /Edg/i.test(userAgent) ? "Edge" : /Chrome/i.test(userAgent) ? "Chrome" : /Firefox/i.test(userAgent) ? "Firefox" : /Safari/i.test(userAgent) ? "Safari" : "متصفح";
  const device = /Mobile|Android|iPhone/i.test(userAgent) ? "جوال" : "كمبيوتر";
  return `${browser} · ${device}`;
}

function maskIp(value = "") {
  if (!value) return "غير متوفر";
  if (value.includes(":")) return `${value.split(":").slice(0, 3).join(":")}:…`;
  const parts = value.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : "محجوب";
}

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT id, ip_address AS "ipAddress", user_agent AS "userAgent",
            created_at AS "createdAt", updated_at AS "lastActivityAt", expires_at AS "expiresAt"
       FROM sessions WHERE user_id = $1 AND expires_at > now()
       ORDER BY updated_at DESC`,
    [auth.session.userId]
  );
  return Response.json({ ok: true, sessions: result.rows.map((item) => ({
    id: item.id,
    device: sessionLabel(item.userAgent),
    location: maskIp(item.ipAddress),
    createdAt: item.createdAt,
    lastActivityAt: item.lastActivityAt,
    expiresAt: item.expiresAt,
    current: item.id === auth.session.id
  })) });
}
