import { query } from "../../../../../../src/server/db.js";
import { createRecoveryCodes, decryptMfaSecret, verifyTotp } from "../../../../../../src/server/mfa.js";
import { requireSession } from "../../../../../../src/server/session.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const result = await query(
    "SELECT mfa_pending_secret_encrypted AS secret FROM users WHERE id = $1 AND tenant_id = $2",
    [auth.session.userId, auth.session.tenantId]
  );
  if (!result.rows[0]?.secret) return Response.json({ ok: false, reason: "setup_required" }, { status: 400 });
  const secret = decryptMfaSecret(result.rows[0].secret);
  if (!verifyTotp(secret, body.code)) return Response.json({ ok: false, reason: "invalid_code", message: "رمز التحقق غير صحيح." }, { status: 400 });
  const recovery = createRecoveryCodes();
  await query(
    `UPDATE users SET mfa_enabled = true, mfa_secret_encrypted = mfa_pending_secret_encrypted,
       mfa_pending_secret_encrypted = NULL, mfa_recovery_hashes = $1::jsonb, updated_at = now()
     WHERE id = $2 AND tenant_id = $3`,
    [JSON.stringify(recovery.hashes), auth.session.userId, auth.session.tenantId]
  );
  await query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title)
     VALUES ($1, $2, 'mfa.enabled', 'Multi-factor authentication enabled')`,
    [auth.session.tenantId, auth.session.userId]
  );
  return Response.json({ ok: true, recoveryCodes: recovery.codes });
}
