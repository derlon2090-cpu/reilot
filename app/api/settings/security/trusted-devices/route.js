import { requireSession } from "../../../../../src/server/session.js";
import { query, transaction } from "../../../../../src/server/db.js";
import { TRUSTED_DEVICE_COOKIE, clearTrustedDeviceCookie, readCookie } from "../../../../../src/server/email-otp.js";
import { sha256 } from "../../../../../src/server/security.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const currentDigest = readCookie(req, TRUSTED_DEVICE_COOKIE)
    ? sha256(readCookie(req, TRUSTED_DEVICE_COOKIE))
    : null;
  const result = await query(
    `SELECT id,label,last_used_at AS "lastUsedAt",expires_at AS "expiresAt",
            created_at AS "createdAt",(token_digest=$3) AS "isCurrent"
       FROM auth_trusted_devices
      WHERE user_id=$1 AND tenant_id=$2 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY last_used_at DESC`,
    [auth.session.userId, auth.session.tenantId, currentDigest]
  );
  return Response.json({ ok: true, items: result.rows });
}

export async function DELETE(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const deviceId = body.deviceId ? String(body.deviceId) : null;
  const result = await transaction(async (client) => {
    const updated = await client.query(
      `UPDATE auth_trusted_devices SET revoked_at=now()
        WHERE user_id=$1 AND tenant_id=$2 AND revoked_at IS NULL
          AND ($3::uuid IS NULL OR id=$3::uuid)
        RETURNING id,token_digest AS "tokenDigest"`,
      [auth.session.userId, auth.session.tenantId, deviceId]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
       VALUES ($1,$2,'auth.trusted_devices.revoked','Trusted devices revoked',$3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ deviceId, count: updated.rowCount })]
    );
    return updated.rows;
  });
  const current = readCookie(req, TRUSTED_DEVICE_COOKIE);
  const revokedCurrent = current && result.some((item) => item.tokenDigest === sha256(current));
  return Response.json({ ok: true, revoked: result.length }, {
    headers: revokedCurrent || !deviceId ? { "Set-Cookie": clearTrustedDeviceCookie() } : undefined
  });
}
