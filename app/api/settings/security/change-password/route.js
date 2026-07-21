import { transaction } from "../../../../../src/server/db.js";
import { hashPassword, verifyPassword } from "../../../../../src/server/password.js";
import { notifyPasswordChanged } from "../../../../../src/server/password-reset.js";
import { requireSession } from "../../../../../src/server/session.js";
import { changePasswordSchema, validationResponse } from "../../../../../src/server/settings-profile.js";
import { classifyPasswordStrength } from "../../../../../src/server/security-score.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const parsed = changePasswordSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationResponse(parsed);

  const changed = await transaction(async (client) => {
    const account = await client.query(
      "SELECT password FROM accounts WHERE user_id = $1 AND provider_id = 'credential' LIMIT 1",
      [auth.session.userId]
    );
    if (!account.rows[0] || !await verifyPassword(parsed.data.currentPassword, account.rows[0].password)) return null;
    const user = await client.query("SELECT id, tenant_id AS \"tenantId\", email FROM users WHERE id = $1", [auth.session.userId]);
    await client.query(
      "UPDATE accounts SET password = $1, updated_at = now() WHERE user_id = $2 AND provider_id = 'credential'",
      [await hashPassword(parsed.data.newPassword), auth.session.userId]
    );
    await client.query(
      "UPDATE users SET password_strength = $1, password_changed_at = now(), must_change_password = false, password_initialized_at = COALESCE(password_initialized_at, now()), updated_at = now() WHERE id = $2",
      [classifyPasswordStrength(parsed.data.newPassword, user.rows[0]?.email), auth.session.userId]
    );
    await client.query("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [auth.session.userId, auth.session.id]);
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, type, title)
       VALUES ($1, $2, 'password.changed', 'Password changed')`,
      [auth.session.tenantId, auth.session.userId]
    );
    return user.rows[0] || null;
  });
  if (!changed) return Response.json({ ok: false, reason: "invalid_current_password", message: "كلمة المرور الحالية غير صحيحة." }, { status: 400 });
  await notifyPasswordChanged(changed);
  return Response.json({ ok: true });
}
