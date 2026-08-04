import { query } from "../../../../../../src/server/db.js";
import { createMfaSecret, encryptMfaSecret, mfaQrCode } from "../../../../../../src/server/mfa.js";
import { verifyPassword } from "../../../../../../src/server/password.js";
import { requireSession } from "../../../../../../src/server/session.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  if (!body.currentPassword) return Response.json({ ok: false, reason: "password_required", message: "أدخل كلمة المرور الحالية للمتابعة." }, { status: 400 });
  const credential = await query(
    `SELECT a.password FROM accounts a
      JOIN users u ON u.id = a.user_id
     WHERE u.id = $1 AND u.tenant_id = $2 AND a.provider_id = 'credential' LIMIT 1`,
    [auth.session.userId, auth.session.tenantId]
  );
  if (!credential.rows[0]?.password || !await verifyPassword(body.currentPassword, credential.rows[0].password)) {
    return Response.json({ ok: false, reason: "invalid_password", message: "تعذر التحقق من هويتك." }, { status: 400 });
  }
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
  await query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title)
     VALUES ($1, $2, 'mfa.setup_started', 'OTP setup started')`,
    [auth.session.tenantId, auth.session.userId]
  );
  return Response.json({ ok: true, secret, qrCode: await mfaQrCode({ email: auth.session.email, secret }) });
}

export async function DELETE(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  await query(
    `UPDATE users SET mfa_pending_secret_encrypted = NULL, updated_at = now()
      WHERE id = $1 AND tenant_id = $2 AND mfa_enabled = false`,
    [auth.session.userId, auth.session.tenantId]
  );
  return Response.json({ ok: true });
}
