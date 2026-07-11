import { query } from "../../../src/server/db.js";
import { requireSession } from "../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT a.id, a.type, a.title, a.metadata, a.created_at AS "createdAt", u.name AS "userName"
       FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.tenant_id = $1 ORDER BY a.created_at DESC LIMIT 200`,
    [auth.session.tenantId]
  );
  return Response.json({ ok: true, items: result.rows });
}
