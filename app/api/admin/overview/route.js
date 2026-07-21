import { adminCan, auditAdmin, requireAdminPermission } from "../../../../src/server/admin-auth.js";
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
    audit,
    activeSessions,
    monthlyRevenue,
    recentTenants,
    recentSubscriptions,
    recentChannels,
    adminUsers
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
        LIMIT 30`
    ),
    query("SELECT count(*)::int AS count FROM sessions WHERE expires_at > now()"),
    query(
      `SELECT COALESCE(sum(CASE WHEN ps.billing_cycle = 'yearly' THEN pp.yearly_price_sar / 12.0 ELSE pp.monthly_price_sar END), 0)::numeric AS amount
         FROM platform_subscriptions ps
         JOIN platform_plans pp ON pp.id = ps.plan_id
        WHERE ps.status IN ('active','trial')`
    ),
    query(
      `SELECT t.id,t.name,t.slug,t.status,t.created_at AS "createdAt",
              owner.name AS "ownerName",owner.email,
              COALESCE(members.count,0)::int AS "memberCount",
              COALESCE(subscriptions.count,0)::int AS "subscriptionCount"
         FROM tenants t
         LEFT JOIN LATERAL (
           SELECT u.name,u.email FROM users u WHERE u.tenant_id=t.id ORDER BY u.created_at LIMIT 1
         ) owner ON true
         LEFT JOIN LATERAL (
           SELECT count(*) AS count FROM tenant_members tm WHERE tm.tenant_id=t.id AND tm.status='active'
         ) members ON true
         LEFT JOIN LATERAL (
           SELECT count(*) AS count FROM platform_subscriptions ps WHERE ps.tenant_id=t.id
         ) subscriptions ON true
        ORDER BY t.created_at DESC LIMIT 20`
    ),
    query(
      `SELECT ps.id,t.name AS "tenantName",pp.name AS "planName",ps.status,ps.billing_cycle AS "billingCycle",
              ps.current_period_start AS "startsAt",ps.current_period_end AS "expiresAt",ps.payment_provider AS "paymentProvider"
         FROM platform_subscriptions ps
         JOIN tenants t ON t.id=ps.tenant_id
         JOIN platform_plans pp ON pp.id=ps.plan_id
        ORDER BY ps.created_at DESC LIMIT 20`
    ),
    query(
      `SELECT wc.id,t.name AS "tenantName",wc.display_name AS "displayName",wc.phone_number AS "phoneNumber",
              wc.status,wc.health_score AS "healthScore",wc.last_health_check_at AS "lastCheckAt"
         FROM whatsapp_channels wc
         JOIN tenants t ON t.id=wc.tenant_id
        ORDER BY wc.updated_at DESC LIMIT 20`
    ),
    query(
      `SELECT au.id,u.name,u.email,au.role,au.status,au.mfa_enabled AS "mfaEnabled",
              au.last_login_at AS "lastLoginAt",au.created_at AS "createdAt"
         FROM admin_users au JOIN users u ON u.id=au.user_id
        ORDER BY au.created_at DESC LIMIT 30`
    )
  ]);

  const queueStats = queue.rows[0] || {};
  let provisioningJobs = { rows: [] };
  try {
    provisioningJobs = await query(
      `SELECT apj.id,apj.external_order_id AS "orderId",apj.customer_name AS "customerName",apj.customer_email AS email,
              apj.status,apj.credentials_email_status AS "emailStatus",apj.attempts,apj.failure_code AS "failureCode",
              apj.created_at AS "createdAt",pp.name AS "planName"
         FROM account_provisioning_jobs apj
         LEFT JOIN platform_plans pp ON pp.id=apj.plan_id
        ORDER BY apj.created_at DESC LIMIT 30`
    );
  } catch {
    provisioningJobs = { rows: [] };
  }
  const sent = number(queueStats.sent);
  const failed = number(queueStats.failed);
  const deliveryDenominator = sent + failed;

  await auditAdmin(request, {
    admin: auth.admin,
    action: "admin.overview.read",
    resource: "admin_overview"
  });

  const canCustomers = adminCan(auth.admin, "customers", "read");
  const canSubscriptions = adminCan(auth.admin, "subscriptions", "read");
  const canDevices = adminCan(auth.admin, "devices", "read");
  const canAudit = adminCan(auth.admin, "audit", "read");

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
      activeSessions: number(activeSessions.rows[0]?.count),
      monthlyRevenue: number(monthlyRevenue.rows[0]?.amount),
      risks: {
        high: number(risks.rows[0]?.high),
        critical: number(risks.rows[0]?.critical)
      },
      unreadNotifications: number(notifications.rows[0]?.count)
    },
    recentAudit: canAudit ? audit.rows : [],
    tenants: canCustomers ? recentTenants.rows : [],
    subscriptions: canSubscriptions ? recentSubscriptions.rows : [],
    channels: canDevices ? recentChannels.rows : [],
    adminUsers: auth.admin.adminRole === "super_admin" ? adminUsers.rows : [],
    provisioningJobs: canCustomers ? provisioningJobs.rows : []
  });
}
