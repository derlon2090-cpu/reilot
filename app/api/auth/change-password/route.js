import { transaction } from "../../../../src/server/db.js";
import { hashPassword, verifyPassword } from "../../../../src/server/password.js";
import { isStrongPassword } from "../../../../src/server/security.js";
import { requireSession } from "../../../../src/server/session.js";

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  if (!isStrongPassword(body.newPassword)) return Response.json({ ok: false, reason: "weak_password" }, { status: 400 });
  const changed = await transaction(async (client) => {
    const account = await client.query("SELECT password FROM accounts WHERE user_id = $1 AND provider_id = 'credential' LIMIT 1", [auth.session.userId]);
    if (!account.rows[0] || !await verifyPassword(body.currentPassword, account.rows[0].password)) return false;
    await client.query("UPDATE accounts SET password = $1, updated_at = now() WHERE user_id = $2 AND provider_id = 'credential'", [await hashPassword(body.newPassword), auth.session.userId]);
    await client.query("DELETE FROM sessions WHERE user_id = $1 AND id <> $2", [auth.session.userId, auth.session.id]);
    await client.query("INSERT INTO activity_logs (tenant_id, user_id, type, title) VALUES ($1, $2, 'auth.password_changed', 'Password changed')", [auth.session.tenantId, auth.session.userId]);
    return true;
  });
  return changed ? Response.json({ ok: true }) : Response.json({ ok: false, reason: "invalid_current_password" }, { status: 400 });
}
