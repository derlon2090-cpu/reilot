import { query } from "../../../src/server/db.js";
import { requireSession } from "../../../src/server/session.js";

const allowedTypes = new Set([
  "subscription_expiring",
  "subscription_expired",
  "message_scheduled",
  "message_sent",
  "message_failed",
  "whatsapp_connected",
  "whatsapp_disconnected",
  "security_warning",
  "system"
]);

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "";
  const status = url.searchParams.get("status") || "all";
  const search = (url.searchParams.get("search") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 30), 1), 100);
  const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
  const params = [auth.session.tenantId, auth.session.userId];
  const where = [
    "n.tenant_id = $1",
    "(n.user_id IS NULL OR n.user_id = $2)"
  ];

  if (allowedTypes.has(type)) {
    params.push(type);
    where.push(`n.type = $${params.length}`);
  }
  if (status === "unread") where.push("n.is_read = false");
  if (status === "read") where.push("n.is_read = true");
  if (search) {
    params.push(`%${search}%`);
    where.push(`(n.title ILIKE $${params.length} OR COALESCE(n.message, '') ILIKE $${params.length})`);
  }

  params.push(limit, offset);
  const result = await query(
    `SELECT n.id, n.type, n.title, n.message, n.entity_type AS "entityType",
            n.entity_id AS "entityId", n.priority, n.is_read AS "isRead",
            n.read_at AS "readAt", n.action_url AS "actionUrl",
            n.metadata, n.created_at AS "createdAt"
       FROM in_app_notifications n
      WHERE ${where.join(" AND ")}
      ORDER BY n.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const summary = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE is_read = false)::int AS unread,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh'))::int AS today,
            COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week
       FROM in_app_notifications
      WHERE tenant_id = $1 AND (user_id IS NULL OR user_id = $2)`,
    [auth.session.tenantId, auth.session.userId]
  );

  return Response.json({ ok: true, items: result.rows, summary: summary.rows[0] });
}
