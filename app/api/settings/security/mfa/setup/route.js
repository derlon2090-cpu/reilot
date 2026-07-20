import { query } from "../../../../../../src/server/db.js";
import { createMfaSecret, encryptMfaSecret, mfaQrCode } from "../../../../../../src/server/mfa.js";
import { requireSession } from "../../../../../../src/server/session.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const recent = await query(
    `SELECT count(*)::int AS count FROM activity_logs
      WHERE user_id = $1 AND type LIKE 'mfa.%' AND created_at > now() - interval '15 minutes'`,
    [auth.session.userId]
  );
  if (recent.rows[0].count >= 10) return Response.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  const secret = createMfaSecret();
  await query(
    "UPDATE users SET mfa_pending_secret_encrypted = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3",
    [encryptMfaSecret(secret), auth.session.userId, auth.session.tenantId]
  );
  return Response.json({ ok: true, secret, qrCode: await mfaQrCode({ email: auth.session.email, secret }) });
}
