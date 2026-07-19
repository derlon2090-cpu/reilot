import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  if (!body.id) return Response.json({ ok: false, reason: "notification_id_required" }, { status: 400 });
  const result = await query(
    `UPDATE in_app_notifications
        SET is_read = true, read_at = COALESCE(read_at, now()), updated_at = now()
      WHERE id = $1 AND tenant_id = $2 AND (user_id IS NULL OR user_id = $3)
      RETURNING id`,
    [body.id, auth.session.tenantId, auth.session.userId]
  );
  return result.rows[0]
    ? Response.json({ ok: true })
    : Response.json({ ok: false, reason: "notification_not_found" }, { status: 404 });
}
