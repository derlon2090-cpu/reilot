import { query } from "./db.js";
import { getCurrentMessageUsage } from "../lib/billing/message-quota.js";
import { getTenantStorage } from "./tenant-storage.js";
import { getActivePlanCatalog } from "./plan-catalog.js";

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const [current, plans, storage, usage, whatsapp, invoices, commerceConnections] = await Promise.all([
    query(
      `SELECT ps.status, ps.billing_cycle AS "billingCycle",
              ps.current_period_start AS "currentPeriodStart",
              ps.current_period_end AS "currentPeriodEnd",
              ps.trial_started_at AS "trialStartedAt", ps.trial_ends_at AS "trialEndsAt",
              pp.name AS "planName", pp.slug AS "planSlug",
              pp.storage_limit_mb AS "storageLimitMb"
         FROM platform_subscriptions ps
         JOIN platform_plans pp ON pp.id = ps.plan_id
        WHERE ps.tenant_id = $1
        ORDER BY CASE
                   WHEN ps.status='active' AND ps.current_period_end>now() THEN 0
                   WHEN ps.status='trial' AND COALESCE(ps.trial_ends_at,ps.current_period_end)>now() THEN 1
                   WHEN ps.status='past_due' THEN 2 ELSE 3
                 END, ps.created_at DESC LIMIT 1`,
      [tenantId]
    ),
    getActivePlanCatalog(),
    getTenantStorage(tenantId),
    getCurrentMessageUsage(tenantId).catch(() => null),
    getWhatsappBillingUsage(tenantId),
    query(
      `SELECT invoice_number AS number,issued_at AS date,description,amount,currency,status
         FROM billing_invoices
        WHERE tenant_id=$1 ORDER BY issued_at DESC LIMIT 20`,
      [tenantId]
    ),
    query(
      `SELECT provider
         FROM app_connections
        WHERE tenant_id=$1 AND provider IN ('salla','zid')
          AND status IN ('connected','ready')`,
      [tenantId]
    )
  ]);
  let currentPlan = current.rows[0] || null;
  if (!currentPlan && usage?.platformSubscriptionId) {
    const created = await query(
      `SELECT ps.status, ps.billing_cycle AS "billingCycle",
              ps.current_period_start AS "currentPeriodStart",
              ps.current_period_end AS "currentPeriodEnd",
              ps.trial_started_at AS "trialStartedAt", ps.trial_ends_at AS "trialEndsAt",
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
    plans,
    usage,
    emailUsage: usage?.channels?.email || null,
    whatsappUsage: whatsapp,
    commerceConnection: {
      connected: commerceConnections.rows.length > 0,
      providers: commerceConnections.rows.map((connection) => connection.provider)
    },
    invoices: invoices.rows.map((invoice) => ({
      ...invoice,
      amount: numeric(invoice.amount),
      date: new Date(invoice.date).toLocaleDateString("ar-SA")
    })),
    storage: currentPlan ? {
      ...storage,
      limitMb: numeric(currentPlan.storageLimitMb),
      percent: numeric(currentPlan.storageLimitMb) > 0
        ? Math.round((numeric(storage.usedMb) / numeric(currentPlan.storageLimitMb)) * 1000) / 10
        : null
    } : { ...storage, limitMb: null, percent: null }
  };
}
