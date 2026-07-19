import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT COUNT(*)::int AS count
       FROM in_app_notifications
      WHERE tenant_id = $1
        AND (user_id IS NULL OR user_id = $2)
        AND is_read = false`,
    [auth.session.tenantId, auth.session.userId]
  );
  return Response.json({ ok: true, count: result.rows[0]?.count || 0 });
}
