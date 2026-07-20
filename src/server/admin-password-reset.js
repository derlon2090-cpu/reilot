import { auditAdmin } from "./admin-auth.js";
import { query } from "./db.js";
import { sendPasswordResetCodeEmail } from "./email/resend.service.js";
import { generateResetCode, resetPassword, verifyResetCode } from "./password-reset.js";
import { normalizeEmail, sha256 } from "./security.js";

const GENERIC_MESSAGE = "إذا كان البريد مسجلًا لدينا، ستصلك رسالة تحتوي على رمز إعادة تعيين كلمة المرور.";

async function findAdmin(email) {
  const result = await query(
    `SELECT au.id AS "adminId", au.role AS "adminRole", au.status,
            u.id AS "userId", u.tenant_id AS "tenantId", u.email, u.name
       FROM users u JOIN admin_users au ON au.user_id = u.id
      WHERE lower(u.email) = $1 LIMIT 1`,
    [normalizeEmail(email)]
  );
  return result.rows[0] || null;
}

export async function requestAdminPasswordReset(request, email) {
  const normalized = normalizeEmail(email);
  const admin = await findAdmin(normalized);
  if (!admin || admin.status !== "active") {
    await auditAdmin(request, { action: "admin.password_reset.requested", resource: "admin_portal", metadata: { delivered: false, actorEmail: normalized } });
    return { ok: true, message: GENERIC_MESSAGE };
  }
  const recent = await query(
    `SELECT count(*)::int AS count FROM password_reset_codes
      WHERE user_id = $1 AND created_at > now() - interval '15 minutes'`,
    [admin.userId]
  );
  if (recent.rows[0].count >= 5) return { ok: true, message: GENERIC_MESSAGE };
  const code = generateResetCode();
  await query(
    `INSERT INTO password_reset_codes (user_id, email, code_hash, expires_at, attempts)
     VALUES ($1, $2, $3, now() + interval '10 minutes', 0)`,
    [admin.userId, normalized, sha256(code)]
  );
  await sendPasswordResetCodeEmail({ to: normalized, code, expiresInMinutes: 10, locale: "ar" });
  await auditAdmin(request, { admin, action: "admin.password_reset.requested", resource: "admin_portal", metadata: { delivered: true } });
  return { ok: true, message: GENERIC_MESSAGE };
}

export async function completeAdminPasswordReset(request, { email, code, password }) {
  const normalized = normalizeEmail(email);
  const admin = await findAdmin(normalized);
  if (!admin || admin.status !== "active") return { ok: false, status: 400, reason: "invalid_or_expired_code" };
  const verified = await verifyResetCode({ email: normalized, code: String(code || "") });
  if (!verified.ok || verified.record.userId !== admin.userId) return { ok: false, status: 400, reason: "invalid_or_expired_code" };
  const result = await resetPassword({ email: normalized, code: String(code || ""), password });
  if (!result.ok) return result;
  await auditAdmin(request, { admin, action: "admin.password_reset.completed", resource: "admin_portal" });
  return { ok: true, status: 200 };
}

