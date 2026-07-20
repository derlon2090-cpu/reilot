import { query } from "../../../src/server/db.js";
import { requireSession } from "../../../src/server/session.js";
import { getTenantStorage } from "../../../src/server/tenant-storage.js";
import { getCurrentMessageUsage } from "../../../src/lib/billing/message-quota.js";

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const [current, plans, storage, usage] = await Promise.all([
    query(
      `SELECT ps.status, ps.billing_cycle AS "billingCycle", ps.current_period_start AS "currentPeriodStart",
              ps.current_period_end AS "currentPeriodEnd", pp.name AS "planName", pp.slug AS "planSlug",
              pp.storage_limit_mb AS "storageLimitMb"
         FROM platform_subscriptions ps
         JOIN platform_plans pp ON pp.id = ps.plan_id
        WHERE ps.tenant_id = $1 AND ps.status IN ('active', 'trial', 'past_due')
          AND ps.current_period_end > now()
        ORDER BY CASE ps.status WHEN 'active' THEN 0 WHEN 'trial' THEN 1 ELSE 2 END,
                 ps.created_at DESC LIMIT 1`,
      [auth.session.tenantId]
    ),
    query(
      `SELECT name, slug, monthly_price_sar AS "monthlyPriceSar", yearly_price_sar AS "yearlyPriceSar",
              monthly_message_limit AS "messageLimit", whatsapp_channels_limit AS "whatsappChannelsLimit",
              customers_limit AS "customersLimit", users_limit AS "usersLimit",
              storage_limit_mb AS "storageLimitMb", features
         FROM platform_plans WHERE is_active = true ORDER BY monthly_price_sar`,
      []
    ),
    getTenantStorage(auth.session.tenantId),
    getCurrentMessageUsage(auth.session.tenantId)
  ]);
  const normalizedPlans = plans.rows.map((plan) => ({
    ...plan,
    monthlyPriceSar: numeric(plan.monthlyPriceSar),
    yearlyPriceSar: numeric(plan.yearlyPriceSar),
    messageLimit: numeric(plan.messageLimit),
    whatsappChannelsLimit: numeric(plan.whatsappChannelsLimit),
    customersLimit: numeric(plan.customersLimit),
    usersLimit: numeric(plan.usersLimit),
    storageLimitMb: numeric(plan.storageLimitMb)
  }));
  let currentPlan = current.rows[0] || null;
  if (!currentPlan && usage.platformSubscriptionId) {
    const createdCurrent = await query(
      `SELECT ps.status, ps.billing_cycle AS "billingCycle", ps.current_period_start AS "currentPeriodStart",
              ps.current_period_end AS "currentPeriodEnd", pp.name AS "planName", pp.slug AS "planSlug",
              pp.storage_limit_mb AS "storageLimitMb"
         FROM platform_subscriptions ps
         JOIN platform_plans pp ON pp.id = ps.plan_id
        WHERE ps.id = $1 AND ps.tenant_id = $2 LIMIT 1`,
      [usage.platformSubscriptionId, auth.session.tenantId]
    );
    currentPlan = createdCurrent.rows[0] || null;
  }
  return Response.json({
    ok: true,
    current: currentPlan,
    plans: normalizedPlans,
    usage,
    walletBalance: 0,
    invoices: [],
    storage
  });
}
