import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `UPDATE in_app_notifications
        SET is_read = true, read_at = COALESCE(read_at, now()), updated_at = now()
      WHERE tenant_id = $1 AND (user_id IS NULL OR user_id = $2) AND is_read = false`,
    [auth.session.tenantId, auth.session.userId]
  );
  return Response.json({ ok: true, updated: result.rowCount });
}
