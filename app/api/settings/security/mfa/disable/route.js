import { query } from "../../../../../../src/server/db.js";
import { decryptMfaSecret, verifyTotp } from "../../../../../../src/server/mfa.js";
import { verifyPassword } from "../../../../../../src/server/password.js";
import { requireSession } from "../../../../../../src/server/session.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const result = await query(
    `SELECT u.mfa_secret_encrypted AS secret, a.password
       FROM users u JOIN accounts a ON a.user_id = u.id AND a.provider_id = 'credential'
      WHERE u.id = $1 AND u.tenant_id = $2`,
    [auth.session.userId, auth.session.tenantId]
  );
  const record = result.rows[0];
  const authorized = record && (
    (body.password && await verifyPassword(body.password, record.password))
    || (body.code && record.secret && verifyTotp(decryptMfaSecret(record.secret), body.code))
  );
  if (!authorized) return Response.json({ ok: false, reason: "verification_failed", message: "تعذر التحقق من هويتك." }, { status: 400 });
  await query(
    `UPDATE users SET mfa_enabled = false, mfa_secret_encrypted = NULL,
       mfa_pending_secret_encrypted = NULL, mfa_recovery_hashes = '[]'::jsonb, updated_at = now()
     WHERE id = $1 AND tenant_id = $2`,
    [auth.session.userId, auth.session.tenantId]
  );
  await query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title)
     VALUES ($1, $2, 'mfa.disabled', 'Multi-factor authentication disabled')`,
    [auth.session.tenantId, auth.session.userId]
  );
  return Response.json({ ok: true });
}
