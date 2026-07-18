import { query } from "../../../src/server/db.js";
import { requireSession } from "../../../src/server/session.js";
import { getTenantStorage } from "../../../src/server/tenant-storage.js";

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const [current, plans, usage, storage] = await Promise.all([
    query(
      `SELECT ps.status, ps.billing_cycle AS "billingCycle", ps.current_period_start AS "currentPeriodStart",
              ps.current_period_end AS "currentPeriodEnd", pp.name AS "planName", pp.slug AS "planSlug",
              pp.storage_limit_mb AS "storageLimitMb"
         FROM platform_subscriptions ps
         JOIN platform_plans pp ON pp.id = ps.plan_id
        WHERE ps.tenant_id = $1 ORDER BY ps.created_at DESC LIMIT 1`,
      [auth.session.tenantId]
    ),
    query(
      `SELECT name, slug, monthly_price_sar AS "monthlyPriceSar", yearly_price_sar AS "yearlyPriceSar",
              message_limit AS "messageLimit", whatsapp_channels_limit AS "whatsappChannelsLimit",
              customers_limit AS "customersLimit", users_limit AS "usersLimit",
              storage_limit_mb AS "storageLimitMb", features
         FROM platform_plans WHERE is_active = true ORDER BY monthly_price_sar`,
      []
    ),
    query(
      `SELECT used_messages AS "usedMessages", message_limit AS "messageLimit"
         FROM message_usage
        WHERE tenant_id = $1 AND month = EXTRACT(MONTH FROM current_date)::int
          AND year = EXTRACT(YEAR FROM current_date)::int LIMIT 1`,
      [auth.session.tenantId]
    ),
    getTenantStorage(auth.session.tenantId)
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
  return Response.json({
    ok: true,
    current: current.rows[0] || null,
    plans: normalizedPlans,
    usage: usage.rows[0] ? { usedMessages: numeric(usage.rows[0].usedMessages), messageLimit: numeric(usage.rows[0].messageLimit) } : { usedMessages: 0, messageLimit: 0 },
    walletBalance: 0,
    invoices: [],
    storage
  });
}
