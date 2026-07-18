import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  await query(`UPDATE app_connections SET status = 'disconnected', access_token_encrypted = NULL,
    refresh_token_encrypted = NULL, token_expires_at = NULL, updated_at = now()
    WHERE tenant_id = $1 AND provider = 'salla'`, [auth.session.tenantId]);
  await query("INSERT INTO activity_logs (tenant_id, user_id, type, title) VALUES ($1, $2, 'salla.disconnected', 'تم فصل متجر سلة')", [auth.session.tenantId, auth.session.userId]);
  return Response.json({ ok: true });
}
