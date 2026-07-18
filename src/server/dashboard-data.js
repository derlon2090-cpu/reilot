import { query } from "./db.js";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadBaseStats(tenantId) {
  const result = await query(
    `SELECT
       (SELECT count(*) FROM subscriptions WHERE tenant_id = $1)::int AS "totalSubscriptions",
       (SELECT count(*) FROM subscriptions WHERE tenant_id = $1 AND end_date BETWEEN current_date AND current_date + 7)::int AS "upcomingRenewals",
       (SELECT count(*) FROM subscriptions WHERE tenant_id = $1 AND end_date < current_date AND status NOT IN ('renewed', 'cancelled'))::int AS "expiredSubscriptions",
       (SELECT count(*) FROM customers WHERE tenant_id = $1)::int AS "totalCustomers",
       (SELECT count(*) FROM customers WHERE tenant_id = $1 AND status = 'active')::int AS "activeCustomers",
       (SELECT count(*) FROM customers WHERE tenant_id = $1 AND created_at::date = current_date)::int AS "activeToday",
       (SELECT count(*) FROM whatsapp_channels WHERE tenant_id = $1 AND status = 'connected')::int AS "connectedDevices",
       (SELECT count(*) FROM whatsapp_channels WHERE tenant_id = $1 AND status IN ('pending_qr', 'pending_pairing', 'connecting'))::int AS "pendingDevices",
       (SELECT max(last_health_check_at) FROM whatsapp_channels WHERE tenant_id = $1) AS "lastDeviceCheck",
       (SELECT COALESCE(sum(price), 0) FROM subscriptions WHERE tenant_id = $1 AND status IN ('active', 'expiring_soon', 'renewed'))::numeric AS "monthlyRevenue",
       (SELECT count(*) FROM notification_logs WHERE tenant_id = $1)::int AS "totalMessages",
       (SELECT count(*) FROM notification_logs WHERE tenant_id = $1 AND status IN ('sent', 'delivered', 'read'))::int AS "sentMessages",
       (SELECT count(*) FROM notification_logs WHERE tenant_id = $1 AND status IN ('delivered', 'read'))::int AS "deliveredMessages",
       (SELECT count(*) FROM unsubscribe_list WHERE tenant_id = $1)::int AS "blockedNumbers",
       (SELECT count(*) FROM automation_rules WHERE tenant_id = $1 AND is_active = true)::int AS "safeRules",
       (SELECT count(DISTINCT customer_id) FROM activity_logs WHERE tenant_id = $1 AND type = 'subscription.renewed')::int AS "renewedCustomers"`,
    [tenantId]
  );
  const row = result.rows[0] || {};
  const totalMessages = number(row.totalMessages);
  const deliveredMessages = number(row.deliveredMessages);
  const sentMessages = number(row.sentMessages);
  return {
    totalSubscriptions: number(row.totalSubscriptions),
    upcomingRenewals: number(row.upcomingRenewals),
    expiredSubscriptions: number(row.expiredSubscriptions),
    totalCustomers: number(row.totalCustomers),
    activeCustomers: number(row.activeCustomers),
    activeToday: number(row.activeToday),
    connectedDevices: number(row.connectedDevices),
    pendingDevices: number(row.pendingDevices),
    lastDeviceCheck: row.lastDeviceCheck || null,
    monthlyRevenue: number(row.monthlyRevenue),
    totalMessages,
    sentMessages,
    deliveredMessages,
    deliveryRate: totalMessages > 0 ? Math.round((deliveredMessages / totalMessages) * 1000) / 10 : 0,
    successRate: totalMessages > 0 ? Math.round((sentMessages / totalMessages) * 1000) / 10 : 0,
    blockedNumbers: number(row.blockedNumbers),
    safeRules: number(row.safeRules),
    renewedCustomers: number(row.renewedCustomers)
  };
}

export async function getDashboardStats(tenantId) {
  const stats = await loadBaseStats(tenantId);
  return {
    totalSubscriptions: stats.totalSubscriptions,
    upcomingRenewals: stats.upcomingRenewals,
    activeCustomers: stats.activeCustomers,
    connectedDevices: stats.connectedDevices,
    whatsappStatus: stats.connectedDevices > 0 ? "connected" : "not_connected",
    deliveryRate: stats.deliveryRate
  };
}

export async function getSubscriptionStats(tenantId) {
  const stats = await loadBaseStats(tenantId);
  return {
    totalSubscriptions: stats.totalSubscriptions,
    upcomingRenewals: stats.upcomingRenewals,
    expiredSubscriptions: stats.expiredSubscriptions,
    monthlyRevenue: stats.monthlyRevenue
  };
}

export async function getCustomerStats(tenantId) {
  const stats = await loadBaseStats(tenantId);
  return {
    totalCustomers: stats.totalCustomers,
    activeToday: stats.activeToday,
    vipCustomers: 0,
    responseRate: stats.deliveryRate
  };
}

export async function getDeviceStats(tenantId) {
  const stats = await loadBaseStats(tenantId);
  return {
    connectedDevices: stats.connectedDevices,
    pendingDevices: stats.pendingDevices,
    connectionQuality: stats.connectedDevices > 0 ? 100 : 0,
    lastDeviceCheck: stats.lastDeviceCheck
  };
}

export async function getSecurityStats(tenantId) {
  const stats = await loadBaseStats(tenantId);
  return {
    securityLevel: stats.safeRules > 0 ? 100 : 0,
    blockedNumbers: stats.blockedNumbers,
    safeRules: stats.safeRules,
    lastCheck: stats.lastDeviceCheck
  };
}

export async function getReportStats(tenantId) {
  const stats = await loadBaseStats(tenantId);
  return {
    monthlyRevenue: stats.monthlyRevenue,
    sentMessages: stats.sentMessages,
    successRate: stats.successRate,
    renewedCustomers: stats.renewedCustomers
  };
}

export async function getDashboardOverview(tenantId, userId) {
  const [stats, profile, activities, monthly, notifications] = await Promise.all([
    loadBaseStats(tenantId),
    query(
      `SELECT u.name, u.email, u.image, COALESCE(p.name, 'Free Trial') AS "planName",
              COALESCE(ps.status, 'trial') AS "planStatus", s.language, s.theme,
              COALESCE(s.notification_channels, '{}'::jsonb) AS "notificationChannels",
              COALESCE(s.security, '{}'::jsonb) AS security
         FROM users u
         LEFT JOIN settings s ON s.tenant_id = u.tenant_id
         LEFT JOIN LATERAL (
           SELECT plan_id, status FROM platform_subscriptions
            WHERE tenant_id = u.tenant_id ORDER BY created_at DESC LIMIT 1
         ) ps ON true
         LEFT JOIN platform_plans p ON p.id = ps.plan_id
        WHERE u.id = $1 AND u.tenant_id = $2 LIMIT 1`,
      [userId, tenantId]
    ),
    query(
      `SELECT id, type, title, metadata, created_at AS "createdAt"
         FROM activity_logs WHERE tenant_id = $1
        ORDER BY created_at DESC LIMIT 8`,
      [tenantId]
    ),
    query(
      `SELECT to_char(months.month, 'YYYY-MM') AS month,
              COALESCE(sum(s.price), 0)::numeric AS value
         FROM generate_series(
           date_trunc('month', current_date) - interval '5 months',
           date_trunc('month', current_date), interval '1 month'
         ) AS months(month)
         LEFT JOIN subscriptions s ON s.tenant_id = $1
          AND date_trunc('month', s.created_at) = months.month
        GROUP BY months.month ORDER BY months.month`,
      [tenantId]
    ),
    query(
      `SELECT nl.id, nl.channel, nl.status, nl.to_number AS "toNumber",
              nl.sent_at AS "sentAt", nl.created_at AS "createdAt", c.name AS "customerName"
         FROM notification_logs nl
         LEFT JOIN customers c ON c.id = nl.customer_id AND c.tenant_id = nl.tenant_id
        WHERE nl.tenant_id = $1 ORDER BY nl.created_at DESC LIMIT 6`,
      [tenantId]
    )
  ]);
  return {
    profile: profile.rows[0] || { name: "", email: "", planName: "Free Trial", planStatus: "trial", language: "ar", theme: "light", notificationChannels: {}, security: {} },
    stats,
    activities: activities.rows,
    recentNotifications: notifications.rows,
    monthlyPerformance: monthly.rows.map((row) => ({ month: row.month, value: number(row.value) }))
  };
}
