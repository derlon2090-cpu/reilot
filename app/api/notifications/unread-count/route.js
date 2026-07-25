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
  const platform = await query(
    `SELECT count(*)::int AS count
       FROM platform_notification_recipients r JOIN platform_notifications n ON n.id=r.notification_id
      WHERE r.user_id=$1 AND r.read_at IS NULL AND r.delivery_status='available'
        AND n.status IN ('published','partially_published')
        AND (n.expires_at IS NULL OR n.expires_at > now())`,
    [auth.session.userId]
  ).catch(() => ({ rows: [{ count: 0 }] }));
  return Response.json({ ok: true, count: Number(result.rows[0]?.count || 0) + Number(platform.rows[0]?.count || 0) });
}
