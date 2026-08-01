import { query } from "./db.js";
import { getCurrentMessageUsage } from "../lib/billing/message-quota.js";
import { getTenantStorage } from "./tenant-storage.js";

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePlan(plan) {
  return {
    ...plan,
    monthlyPriceSar: numeric(plan.monthlyPriceSar),
    yearlyPriceSar: numeric(plan.yearlyPriceSar),
    emailMessageLimit: numeric(plan.emailMessageLimit),
    whatsappMessageLimit: -1,
    whatsappChannelsLimit: numeric(plan.whatsappChannelsLimit),
    customersLimit: numeric(plan.customersLimit),
    usersLimit: numeric(plan.usersLimit),
    storageLimitMb: numeric(plan.storageLimitMb),
    orderLinksLimit: numeric(plan.orderLinksLimit),
    campaignsEnabled: Boolean(plan.campaignsEnabled),
    automationEnabled: Boolean(plan.automationEnabled),
    customApiEnabled: Boolean(plan.customApiEnabled),
    sallaEnabled: Boolean(plan.sallaEnabled),
    customPricing: Boolean(plan.customPricing),
    features: Array.isArray(plan.features) ? plan.features : []
  };
}

export async function getWhatsappBillingUsage(tenantId) {
  const [summary, bySource, byStatus, metaConnection] = await Promise.all([
    query(
      `SELECT count(*)::int AS "requestedCount",
              count(*) FILTER (WHERE status IN ('accepted','sent','delivered','read'))::int AS "acceptedCount",
              count(*) FILTER (WHERE status = 'failed')::int AS "failedCount"
         FROM whatsapp_usage_records
        WHERE tenant_id = $1 AND created_at >= date_trunc('month', now())`,
      [tenantId]
    ),
    query(
      `SELECT usage_source AS source, count(*)::int AS count,
              count(*) FILTER (WHERE status IN ('accepted','sent','delivered','read'))::int AS successful,
              count(*) FILTER (WHERE status = 'failed')::int AS failed
         FROM whatsapp_usage_records
        WHERE tenant_id = $1 AND created_at >= date_trunc('month', now())
        GROUP BY usage_source ORDER BY count(*) DESC`,
      [tenantId]
    ),
    query(
      `SELECT status, count(*)::int AS count
         FROM whatsapp_usage_records
        WHERE tenant_id = $1 AND created_at >= date_trunc('month', now())
        GROUP BY status`,
      [tenantId]
    ),
    query(
      `SELECT count(*)::int AS "totalChannels",
              count(*) FILTER (WHERE status = 'connected')::int AS "connectedChannels",
              max(COALESCE(last_health_check_at, updated_at, connected_at)) AS "lastSyncedAt"
         FROM whatsapp_channels
        WHERE tenant_id = $1 AND provider IN ('meta','meta_cloud_api')`,
      [tenantId]
    )
  ]);
  const totals = summary.rows[0] || {};
  const meta = metaConnection.rows[0] || {};
  const connectedChannels = numeric(meta.connectedChannels);
  const totalChannels = numeric(meta.totalChannels);
  return {
    messagesThisMonth: numeric(totals.requestedCount),
    acceptedThisMonth: numeric(totals.acceptedCount),
    failedThisMonth: numeric(totals.failedCount),
    provider: "meta",
    metaConnection: {
      totalChannels,
      connectedChannels,
      status: connectedChannels > 0 ? "connected" : totalChannels > 0 ? "attention" : "not_connected",
      lastSyncedAt: meta.lastSyncedAt || null
    },
    bySource: bySource.rows.map((row) => ({
      source: row.source,
      count: numeric(row.count),
      successful: numeric(row.successful),
      failed: numeric(row.failed)
    })),
    byStatus: Object.fromEntries(byStatus.rows.map((row) => [row.status, numeric(row.count)]))
  };
}

export async function getBillingOverview(tenantId) {
  const [current, plans, storage, usage, whatsapp, invoices] = await Promise.all([
    query(
      `SELECT ps.status, ps.billing_cycle AS "billingCycle",
              ps.current_period_start AS "currentPeriodStart",
              ps.current_period_end AS "currentPeriodEnd",
              pp.name AS "planName", pp.slug AS "planSlug",
              pp.storage_limit_mb AS "storageLimitMb"
         FROM platform_subscriptions ps
         JOIN platform_plans pp ON pp.id = ps.plan_id
        WHERE ps.tenant_id = $1 AND ps.status IN ('active','trial','past_due')
          AND ps.current_period_end > now()
        ORDER BY CASE ps.status WHEN 'active' THEN 0 WHEN 'trial' THEN 1 ELSE 2 END,
                 ps.created_at DESC LIMIT 1`,
      [tenantId]
    ),
    query(
      `SELECT name, slug, monthly_price_sar AS "monthlyPriceSar",
              yearly_price_sar AS "yearlyPriceSar",
              COALESCE(email_message_limit, monthly_message_limit) AS "emailMessageLimit",
              whatsapp_message_limit AS "whatsappMessageLimit",
              whatsapp_channels_limit AS "whatsappChannelsLimit",
              customers_limit AS "customersLimit", users_limit AS "usersLimit",
              storage_limit_mb AS "storageLimitMb", order_links_limit AS "orderLinksLimit",
              campaigns_enabled AS "campaignsEnabled", automation_enabled AS "automationEnabled",
              custom_api_enabled AS "customApiEnabled", salla_enabled AS "sallaEnabled",
              custom_pricing AS "customPricing", features
         FROM platform_plans WHERE is_active = true AND slug <> 'trial'
        ORDER BY CASE slug WHEN 'free' THEN 0 WHEN 'starter' THEN 1
                          WHEN 'business' THEN 2 WHEN 'pro' THEN 3 ELSE 4 END`,
      []
    ),
    getTenantStorage(tenantId),
    getCurrentMessageUsage(tenantId),
    getWhatsappBillingUsage(tenantId),
    query(
      `SELECT invoice_number AS number,issued_at AS date,description,amount,currency,status
         FROM billing_invoices
        WHERE tenant_id=$1 ORDER BY issued_at DESC LIMIT 20`,
      [tenantId]
    )
  ]);
  let currentPlan = current.rows[0] || null;
  if (!currentPlan && usage.platformSubscriptionId) {
    const created = await query(
      `SELECT ps.status, ps.billing_cycle AS "billingCycle",
              ps.current_period_start AS "currentPeriodStart",
              ps.current_period_end AS "currentPeriodEnd",
              pp.name AS "planName", pp.slug AS "planSlug",
              pp.storage_limit_mb AS "storageLimitMb"
         FROM platform_subscriptions ps
         JOIN platform_plans pp ON pp.id = ps.plan_id
        WHERE ps.id = $1 AND ps.tenant_id = $2 LIMIT 1`,
      [usage.platformSubscriptionId, tenantId]
    );
    currentPlan = created.rows[0] || null;
  }
  return {
    current: currentPlan,
    plans: plans.rows.map(normalizePlan),
    usage,
    emailUsage: usage.channels.email,
    whatsappUsage: whatsapp,
    invoices: invoices.rows.map((invoice) => ({
      ...invoice,
      amount: numeric(invoice.amount),
      date: new Date(invoice.date).toLocaleDateString("ar-SA")
    })),
    storage
  };
}
