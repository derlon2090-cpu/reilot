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
  const platform = await query(
    `WITH changed AS (
       UPDATE platform_notification_recipients SET read_at=now()
        WHERE user_id=$1 AND read_at IS NULL RETURNING notification_id
     ), totals AS (
       SELECT notification_id,count(*)::int AS count FROM changed GROUP BY notification_id
     )
     UPDATE platform_notifications n SET read_count=n.read_count+totals.count
       FROM totals WHERE n.id=totals.notification_id RETURNING n.id`,
    [auth.session.userId]
  ).catch(() => ({ rowCount: 0 }));
  return Response.json({ ok: true, updated: result.rowCount + platform.rowCount });
}
