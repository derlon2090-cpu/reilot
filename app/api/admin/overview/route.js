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
    adminUsers,
    storesCount,
    recentCustomers,
    recentStores,
    adminTemplates,
    integrationHealth,
    adminMessages,
    dailyMetrics
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
    ),
    query("SELECT count(*)::int AS count FROM stores"),
    query(
      `SELECT u.id,u.name,u.email,
              CASE WHEN u.phone IS NULL OR u.phone='' THEN NULL ELSE left(u.phone,4) || ' *** ' || right(u.phone,3) END AS phone,
              u.role,u.created_at AS "createdAt",t.name AS "tenantName",t.status,
              COALESCE(store_count.count,0)::int AS "storeCount",pp.name AS "planName"
         FROM users u
         LEFT JOIN tenants t ON t.id=u.tenant_id
         LEFT JOIN LATERAL (SELECT count(*) AS count FROM stores s WHERE s.tenant_id=u.tenant_id) store_count ON true
         LEFT JOIN LATERAL (
           SELECT plan.name FROM platform_subscriptions ps JOIN platform_plans plan ON plan.id=ps.plan_id
            WHERE ps.tenant_id=u.tenant_id ORDER BY ps.created_at DESC LIMIT 1
         ) pp ON true
        WHERE u.tenant_id IS NOT NULL
        ORDER BY u.created_at DESC LIMIT 30`
    ),
    query(
      `SELECT s.id,s.name,s.domain,s.created_at AS "createdAt",t.name AS "tenantName",t.status,
              owner.name AS "ownerName",owner.email AS "ownerEmail",
              ps.status AS "subscriptionStatus",pp.name AS "planName",
              ac.status AS "sallaStatus",wc.status AS "metaStatus",
              COALESCE(usage.used_messages,0)::int AS "messageVolume"
         FROM stores s JOIN tenants t ON t.id=s.tenant_id
         LEFT JOIN LATERAL (SELECT u.name,u.email FROM users u WHERE u.tenant_id=t.id ORDER BY u.created_at LIMIT 1) owner ON true
         LEFT JOIN LATERAL (SELECT * FROM platform_subscriptions x WHERE x.tenant_id=t.id ORDER BY x.created_at DESC LIMIT 1) ps ON true
         LEFT JOIN platform_plans pp ON pp.id=ps.plan_id
         LEFT JOIN app_connections ac ON ac.tenant_id=t.id AND ac.provider='salla'
         LEFT JOIN LATERAL (SELECT status FROM whatsapp_channels x WHERE x.tenant_id=t.id ORDER BY x.updated_at DESC LIMIT 1) wc ON true
         LEFT JOIN message_usage usage ON usage.tenant_id=t.id AND usage.month=extract(month from now())::int AND usage.year=extract(year from now())::int
        ORDER BY s.created_at DESC LIMIT 30`
    ),
    query(
      `SELECT id,template_key AS "templateKey",name,description,channel,is_active AS "isActive",version,
              updated_at AS "updatedAt" FROM admin_message_templates ORDER BY created_at`
    ),
    query(
      `SELECT provider,status,response_time_ms AS "responseTimeMs",last_checked_at AS "lastCheckedAt",
              last_webhook_at AS "lastWebhookAt",error_count AS "errorCount",last_error_safe AS "lastError"
         FROM platform_integration_health ORDER BY provider`
    ),
    query(
      `SELECT id,template_key AS "templateKey",event_type AS "eventType",provider,channel,status,
              credit_status AS "creditStatus",is_test_message AS "isTestMessage",created_at AS "createdAt"
         FROM admin_outbound_messages ORDER BY created_at DESC LIMIT 30`
    ),
    query(
      `SELECT metric_date AS date,stores_count AS stores,active_users_count AS "activeUsers",
              active_subscriptions_count AS "activeSubscriptions",messages_accepted AS accepted,
              messages_delivered AS delivered,messages_failed AS failed,revenue_amount AS revenue
         FROM platform_daily_metrics ORDER BY metric_date DESC LIMIT 30`
    )
  ]);

  const queueStats = queue.rows[0] || {};
  const [campaignSummary, recentCampaigns, contactSummary, recentCampaignContacts] = await Promise.all([
    query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE status IN ('scheduled','queueing','sending'))::int AS active,
                  COALESCE(sum(sent_count),0)::int AS sent,COALESCE(sum(delivered_count),0)::int AS delivered,
                  COALESCE(sum(failed_count),0)::int AS failed FROM campaigns`),
    query(`SELECT c.id,c.name,c.channel,c.status,c.total_recipients AS "totalRecipients",c.sent_count AS "sentCount",
                  c.delivered_count AS "deliveredCount",c.failed_count AS "failedCount",c.scheduled_for AS "scheduledFor",
                  c.created_at AS "createdAt",t.name AS "tenantName"
             FROM campaigns c JOIN tenants t ON t.id=c.tenant_id ORDER BY c.created_at DESC LIMIT 30`),
    query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE status='active')::int AS active,
                  count(*) FILTER(WHERE status='merge_review')::int AS "needsReview" FROM contacts`),
    query(`SELECT c.id,c.display_name AS "displayName",c.company_name AS "companyName",c.source,c.status,
                  c.created_at AS "createdAt",t.name AS "tenantName",
                  EXISTS(SELECT 1 FROM contact_points p WHERE p.contact_id=c.id AND p.channel='email' AND p.status='active') AS "hasEmail",
                  EXISTS(SELECT 1 FROM contact_points p WHERE p.contact_id=c.id AND p.channel='whatsapp' AND p.status='active') AS "hasWhatsapp"
             FROM contacts c JOIN tenants t ON t.id=c.tenant_id ORDER BY c.created_at DESC LIMIT 30`)
  ]);
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
      stores: number(storesCount.rows[0]?.count),
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
      unreadNotifications: number(notifications.rows[0]?.count),
      campaigns: campaignSummary.rows[0],
      contacts: contactSummary.rows[0]
    },
    recentAudit: canAudit ? audit.rows : [],
    tenants: canCustomers ? recentTenants.rows : [],
    customers: canCustomers ? recentCustomers.rows : [],
    stores: adminCan(auth.admin, "stores", "read") ? recentStores.rows : [],
    subscriptions: canSubscriptions ? recentSubscriptions.rows : [],
    channels: canDevices ? recentChannels.rows : [],
    adminUsers: auth.admin.adminRole === "super_admin" ? adminUsers.rows : [],
    provisioningJobs: canCustomers ? provisioningJobs.rows : [],
    adminTemplates: adminCan(auth.admin, "templates", "read") ? adminTemplates.rows : [],
    integrationHealth: adminCan(auth.admin, "integrations", "read") ? integrationHealth.rows : [],
    adminMessages: adminCan(auth.admin, "reports", "read") ? adminMessages.rows : [],
    campaigns: adminCan(auth.admin, "campaigns", "read") ? recentCampaigns.rows : [],
    campaignContacts: adminCan(auth.admin, "contacts", "read") ? recentCampaignContacts.rows : [],
    dailyMetrics: dailyMetrics.rows.reverse()
  });
}
