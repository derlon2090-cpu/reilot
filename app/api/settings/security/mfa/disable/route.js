import { query } from "../../../../../../src/server/db.js";
import { decryptMfaSecret, verifyTotp } from "../../../../../../src/server/mfa.js";
import { verifyPassword } from "../../../../../../src/server/password.js";
import { sha256 } from "../../../../../../src/server/security.js";
import { requireSession } from "../../../../../../src/server/session.js";
import { revokeAllUserBrowsers } from "../../../../../../src/server/trusted-browser.js";
import { sendQueuedEmail } from "../../../../../../src/server/email/resend.service.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const result = await query(
    `SELECT u.email,u.mfa_secret_encrypted AS secret,
            COALESCE(u.mfa_recovery_hashes, '[]'::jsonb) AS "recoveryHashes",
            a.password_hash AS "passwordHash"
       FROM users u JOIN accounts a ON a.user_id = u.id AND a.provider_id = 'credential'
      WHERE u.id = $1 AND u.tenant_id = $2`,
    [auth.session.userId, auth.session.tenantId]
  );
  const record = result.rows[0];
  const passwordValid = Boolean(record?.passwordHash && body.password && await verifyPassword(body.password, record.passwordHash));
  const normalizedCode = String(body.code || "").trim().toUpperCase().replace(/\s+/g, "");
  const recoveryHashes = Array.isArray(record?.recoveryHashes) ? record.recoveryHashes : [];
  const otpValid = Boolean(record?.secret && verifyTotp(decryptMfaSecret(record.secret), normalizedCode));
  const recoveryValid = Boolean(normalizedCode && recoveryHashes.includes(sha256(normalizedCode)));
  const authorized = passwordValid && (otpValid || recoveryValid);
  if (!authorized) return Response.json({ ok: false, reason: "verification_failed", message: "تعذر التحقق من هويتك." }, { status: 400 });
  await query(
    `UPDATE users SET mfa_enabled = false, mfa_secret_encrypted = NULL,
       mfa_pending_secret_encrypted = NULL, mfa_recovery_hashes = '[]'::jsonb,
       mfa_last_verified_step = NULL, updated_at = now()
     WHERE id = $1 AND tenant_id = $2`,
    [auth.session.userId, auth.session.tenantId]
  );
  await query(
    `UPDATE auth_mfa_login_challenges
        SET invalidated_at = now(), updated_at = now()
      WHERE user_id = $1 AND consumed_at IS NULL AND invalidated_at IS NULL`,
    [auth.session.userId]
  );
  await query(
    `DELETE FROM sessions WHERE user_id = $1 AND id <> $2`,
    [auth.session.userId, auth.session.id]
  );
  await revokeAllUserBrowsers(auth.session.userId, "totp_disabled");
  await query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title)
     VALUES ($1, $2, 'mfa.disabled', 'Multi-factor authentication disabled')`,
    [auth.session.tenantId, auth.session.userId]
  );
  if (record.email) {
    await sendQueuedEmail({
      to: record.email,
      subject: "تم تعطيل التحقق بخطوتين في حسابك",
      text: "تم تعطيل تطبيق المصادقة وإلغاء رموز الاسترداد والمتصفحات الموثوقة والجلسات الأخرى. إذا لم تنفذ هذا الإجراء، غيّر كلمة المرور وتواصل مع دعم Renvix فورًا.",
      tags: [{ name: "purpose", value: "totp_disabled_alert" }]
    }).catch(() => null);
  }
  return Response.json({ ok: true });
}
