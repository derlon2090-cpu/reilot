import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { hashPassword } from "./password.js";
import { isStrongPassword, normalizeEmail, safeErrorMessage, sha256 } from "./security.js";
import { sendPasswordChangedEmail, sendPasswordResetCodeEmail } from "./email/resend.service.js";
import { classifyPasswordStrength } from "./security-score.js";

export function generateResetCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function notifyPasswordChanged({ tenantId, userId, email, locale = "ar" }) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, reason: "email_missing" };

  try {
    const sent = await sendPasswordChangedEmail({ to: normalized, locale });
    await query(
      `INSERT INTO email_logs
         (tenant_id, user_id, email, to_email, type, provider, provider_message_id, status, subject, body, sent_at)
       VALUES ($1, $2, $3, $3, 'password_changed', 'resend', $4, 'sent', 'password_changed', '[redacted]', now())`,
      [tenantId, userId, normalized, sent?.id || null]
    );
    return { ok: true };
  } catch (error) {
    await query(
      `INSERT INTO email_logs
         (tenant_id, user_id, email, to_email, type, provider, status, subject, body, error_message)
       VALUES ($1, $2, $3, $3, 'password_changed', 'resend', 'failed', 'password_changed', '[redacted]', $4)`,
      [tenantId, userId, normalized, safeErrorMessage(error)]
    ).catch(() => null);
    return { ok: false, reason: "delivery_failed" };
  }
}

export async function requestPasswordReset({ email, locale = "ar", mailer = sendPasswordResetCodeEmail }) {
  const normalized = normalizeEmail(email);
  const userResult = await query("SELECT id, tenant_id AS \"tenantId\", email FROM users WHERE lower(email) = $1 LIMIT 1", [normalized]);
  const user = userResult.rows[0];
  if (!user) return { ok: true, status: 200, message: locale === "en" ? "If the email is registered, a reset code will arrive shortly." : "إذا كان البريد مسجلًا لدينا، فسيصلك رمز إعادة تعيين كلمة المرور." };

  const recent = await query(
    "SELECT count(*)::int AS count FROM password_reset_codes WHERE email = $1 AND created_at > now() - interval '15 minutes'",
    [normalized]
  );
  if (recent.rows[0].count >= 5) {
    return { ok: false, status: 429, message: locale === "en" ? "Too many attempts. Try again later." : "محاولات كثيرة، حاول مرة أخرى لاحقًا." };
  }

  const code = generateResetCode();
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const reset = await query(
    `INSERT INTO password_reset_codes (user_id, email, code_hash, expires_at, attempts)
     VALUES ($1, $2, $3, $4, 0) RETURNING id`,
    [user.id, normalized, codeHash, expiresAt]
  );

  try {
    const sent = await mailer({ to: normalized, code, expiresInMinutes: 10, locale });
    await query(
      `INSERT INTO email_logs (tenant_id, user_id, email, to_email, type, provider, provider_message_id, status, subject, body, sent_at)
       VALUES ($1, $2, $3, $3, 'password_reset', 'resend', $4, 'sent', 'password_reset', '[redacted]', now())`,
      [user.tenantId, user.id, normalized, sent?.id || null]
    );
  } catch (error) {
    await query("UPDATE password_reset_codes SET used_at = now() WHERE id = $1", [reset.rows[0].id]);
    await query(
      `INSERT INTO email_logs (tenant_id, user_id, email, to_email, type, provider, status, subject, body, error_message)
       VALUES ($1, $2, $3, $3, 'password_reset', 'resend', 'failed', 'password_reset', '[redacted]', $4)`,
      [user.tenantId, user.id, normalized, safeErrorMessage(error)]
    );
    throw error;
  }

  return { ok: true, status: 200, message: locale === "en" ? "A verification code has been sent to your email." : "تم إرسال كود التحقق إلى بريدك الإلكتروني." };
}

export async function verifyResetCode({ email, code }) {
  const normalized = normalizeEmail(email);
  const result = await query(
    `SELECT id, user_id AS "userId", attempts, expires_at AS "expiresAt"
       FROM password_reset_codes
      WHERE email = $1 AND used_at IS NULL
      ORDER BY created_at DESC LIMIT 1`,
    [normalized]
  );
  const record = result.rows[0];
  if (!record || new Date(record.expiresAt) <= new Date() || record.attempts >= 5) return { ok: false, reason: "expired" };
  const match = await query("SELECT code_hash = $2 AS valid FROM password_reset_codes WHERE id = $1", [record.id, sha256(code)]);
  if (!match.rows[0]?.valid) {
    await query("UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = $1", [record.id]);
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, record };
}

export async function resetPassword({ email, code, password }) {
  if (!isStrongPassword(password)) return { ok: false, status: 400, reason: "weak_password" };
  const verified = await verifyResetCode({ email, code });
  if (!verified.ok) return { ok: false, status: 400, reason: verified.reason };
  const passwordHash = await hashPassword(password);
  const account = await transaction(async (client) => {
    const userResult = await client.query(
      `SELECT id, tenant_id AS "tenantId", email
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [verified.record.userId]
    );
    await client.query("UPDATE accounts SET password = $1, updated_at = now() WHERE user_id = $2", [passwordHash, verified.record.userId]);
    await client.query(
      "UPDATE users SET password_strength = $1, password_changed_at = now(), updated_at = now() WHERE id = $2",
      [classifyPasswordStrength(password, userResult.rows[0]?.email), verified.record.userId]
    );
    await client.query("UPDATE password_reset_codes SET used_at = now() WHERE id = $1", [verified.record.id]);
    await client.query("DELETE FROM sessions WHERE user_id = $1", [verified.record.userId]);
    return userResult.rows[0] || null;
  });
  if (account?.email) {
    await notifyPasswordChanged({
      tenantId: account.tenantId,
      userId: account.id,
      email: account.email
    });
  }
  return { ok: true, status: 200 };
}
