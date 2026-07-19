import { auditAdmin, requireAdminPermission } from "../../../../src/server/admin-auth.js";
import { query } from "../../../../src/server/db.js";

function number(value) {
  return Number(value || 0);
}

export async function GET(request) {
  const auth = await requireAdminPermission(request, "overview", "read");
  if (!auth.ok) return auth.response;

  const [
    tenants,
    users,
    subscriptions,
    connectedChannels,
    queue,
    risks,
    notifications,
    audit
  ] = await Promise.all([
    query("SELECT count(*)::int AS count FROM tenants"),
    query("SELECT count(*)::int AS count FROM users"),
    query(
      `SELECT
         count(*) FILTER (WHERE status = 'active')::int AS active,
         count(*) FILTER (WHERE status = 'trial')::int AS trial,
         count(*)::int AS total
       FROM platform_subscriptions`
    ),
    query("SELECT count(*)::int AS count FROM whatsapp_channels WHERE status = 'connected'"),
    query(
      `SELECT
         count(*) FILTER (WHERE status = 'pending')::int AS pending,
         count(*) FILTER (WHERE status = 'sent')::int AS sent,
         count(*) FILTER (WHERE status = 'failed')::int AS failed,
         count(*)::int AS total
       FROM message_queue`
    ),
    query(
      `SELECT
         count(*) FILTER (WHERE risk_score >= 90)::int AS critical,
         count(*) FILTER (WHERE risk_score >= 70 AND risk_score < 90)::int AS high
       FROM whatsapp_risk_events`
    ),
    query("SELECT count(*)::int AS count FROM in_app_notifications WHERE is_read = false"),
    query(
      `SELECT aal.id, aal.action, aal.resource, aal.status, aal.created_at AS "createdAt",
              u.name, u.email
         FROM admin_audit_logs aal
         LEFT JOIN users u ON u.id = aal.user_id
        ORDER BY aal.created_at DESC
        LIMIT 8`
    )
  ]);

  const queueStats = queue.rows[0] || {};
  const sent = number(queueStats.sent);
  const failed = number(queueStats.failed);
  const deliveryDenominator = sent + failed;

  await auditAdmin(request, {
    admin: auth.admin,
    action: "admin.overview.read",
    resource: "admin_overview"
  });

  return Response.json({
    ok: true,
    stats: {
      tenants: number(tenants.rows[0]?.count),
      users: number(users.rows[0]?.count),
      platformSubscriptions: {
        total: number(subscriptions.rows[0]?.total),
        active: number(subscriptions.rows[0]?.active),
        trial: number(subscriptions.rows[0]?.trial)
      },
      connectedChannels: number(connectedChannels.rows[0]?.count),
      queue: {
        total: number(queueStats.total),
        pending: number(queueStats.pending),
        sent,
        failed
      },
      deliveryRate: deliveryDenominator > 0
        ? Number(((sent / deliveryDenominator) * 100).toFixed(1))
        : 0,
      risks: {
        high: number(risks.rows[0]?.high),
        critical: number(risks.rows[0]?.critical)
      },
      unreadNotifications: number(notifications.rows[0]?.count)
    },
    recentAudit: audit.rows
  });
}
