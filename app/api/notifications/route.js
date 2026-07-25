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

  const platformParams = [auth.session.userId];
  const platformWhere = [
    "r.user_id = $1",
    "r.delivery_status = 'available'",
    "n.status IN ('published','partially_published')",
    "(n.expires_at IS NULL OR n.expires_at > now())"
  ];
  if (status === "unread") platformWhere.push("r.read_at IS NULL");
  if (status === "read") platformWhere.push("r.read_at IS NOT NULL");
  if (search) {
    platformParams.push(`%${search}%`);
    platformWhere.push(`(n.title ILIKE $${platformParams.length} OR n.body ILIKE $${platformParams.length})`);
  }
  platformParams.push(limit);
  const platformResult = await query(
    `SELECT r.id,n.notification_type AS type,n.title,n.body AS message,NULL::text AS "entityType",
            NULL::uuid AS "entityId",n.priority,(r.read_at IS NOT NULL) AS "isRead",r.read_at AS "readAt",
            n.action_url AS "actionUrl",
            jsonb_build_object('source','platform','surfaces',n.delivery_surfaces,'actionLabel',n.action_label,
              'requireAcknowledgement',n.require_acknowledgement,'pinned',n.pinned) AS metadata,
            n.created_at AS "createdAt"
       FROM platform_notification_recipients r
       JOIN platform_notifications n ON n.id=r.notification_id
      WHERE ${platformWhere.join(" AND ")}
      ORDER BY n.pinned DESC,n.created_at DESC LIMIT $${platformParams.length}`,
    platformParams
  ).catch(() => ({ rows: [] }));

  const summary = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE is_read = false)::int AS unread,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh'))::int AS today,
            COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS week
       FROM in_app_notifications
      WHERE tenant_id = $1 AND (user_id IS NULL OR user_id = $2)`,
    [auth.session.tenantId, auth.session.userId]
  );
  const platformSummary = await query(
    `SELECT count(*)::int AS total,count(*) FILTER(WHERE r.read_at IS NULL)::int AS unread,
            count(*) FILTER(WHERE n.created_at >= date_trunc('day',now() AT TIME ZONE 'Asia/Riyadh'))::int AS today,
            count(*) FILTER(WHERE n.created_at >= now()-interval '7 days')::int AS week
       FROM platform_notification_recipients r JOIN platform_notifications n ON n.id=r.notification_id
      WHERE r.user_id=$1 AND r.delivery_status='available' AND n.status IN ('published','partially_published')
        AND (n.expires_at IS NULL OR n.expires_at > now())`,
    [auth.session.userId]
  ).catch(() => ({ rows: [{ total: 0, unread: 0, today: 0, week: 0 }] }));
  const merged = [...result.rows, ...platformResult.rows]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
  const base = summary.rows[0] || {};
  const platform = platformSummary.rows[0] || {};
  return Response.json({
    ok: true,
    items: merged,
    summary: {
      total: Number(base.total || 0) + Number(platform.total || 0),
      unread: Number(base.unread || 0) + Number(platform.unread || 0),
      today: Number(base.today || 0) + Number(platform.today || 0),
      week: Number(base.week || 0) + Number(platform.week || 0)
    }
  });
}
