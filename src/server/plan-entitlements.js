import { query } from "./db.js";

export class PlanEntitlementError extends Error {
  constructor(reason, message, details = {}) {
    super(message);
    this.name = "PlanEntitlementError";
    this.reason = reason;
    this.details = details;
  }
}

async function loadPlan(runner, tenantId) {
  const active = await runner.query(
    `SELECT pp.slug, pp.name,
            pp.whatsapp_channels_limit AS "whatsappChannelsLimit",
            pp.customers_limit AS "customersLimit",
            pp.users_limit AS "usersLimit",
            pp.order_links_limit AS "orderLinksLimit",
            pp.campaigns_enabled AS "campaignsEnabled",
            pp.automation_enabled AS "automationEnabled",
            pp.custom_api_enabled AS "customApiEnabled",
            pp.salla_enabled AS "sallaEnabled",
            ps.current_period_start AS "periodStart"
       FROM platform_subscriptions ps
       JOIN platform_plans pp ON pp.id = ps.plan_id
      WHERE ps.tenant_id=$1 AND ps.status IN ('active','trial','past_due')
        AND ps.current_period_end > now()
      ORDER BY CASE ps.status WHEN 'active' THEN 0 WHEN 'trial' THEN 1 ELSE 2 END,
               ps.created_at DESC LIMIT 1`,
    [tenantId]
  );
  if (active.rows[0]) return active.rows[0];
  const fallback = await runner.query(
    `SELECT slug,name,whatsapp_channels_limit AS "whatsappChannelsLimit",
            customers_limit AS "customersLimit",users_limit AS "usersLimit",
            order_links_limit AS "orderLinksLimit",campaigns_enabled AS "campaignsEnabled",
            automation_enabled AS "automationEnabled",custom_api_enabled AS "customApiEnabled",
            salla_enabled AS "sallaEnabled",now() AS "periodStart"
       FROM platform_plans WHERE slug IN ('free','trial')
      ORDER BY CASE slug WHEN 'free' THEN 0 ELSE 1 END LIMIT 1`
  );
  return fallback.rows[0];
}

export async function assertPlanFeature(tenantId, feature, runner = { query }) {
  const plan = await loadPlan(runner, tenantId);
  if (!plan || !plan[feature]) {
    throw new PlanEntitlementError("plan_feature_unavailable", "هذه الميزة غير متاحة في باقتك الحالية.", { feature, plan: plan?.slug || "free" });
  }
  return plan;
}

const capacities = {
  customers: { limit: "customersLimit", table: "customers", extra: "" },
  users: { limit: "usersLimit", table: "tenant_members", extra: "AND status = 'active'" },
  whatsappChannels: { limit: "whatsappChannelsLimit", table: "whatsapp_channels", extra: "" },
  orderLinks: { limit: "orderLinksLimit", table: "order_info_links", extra: "AND created_at >= $2" }
};

export async function assertPlanCapacity(tenantId, resource, runner = { query }) {
  const config = capacities[resource];
  if (!config) throw new TypeError(`Unknown plan capacity: ${resource}`);
  const plan = await loadPlan(runner, tenantId);
  const limit = Number(plan?.[config.limit] ?? 0);
  if (limit < 0) return { plan, limit, used: 0 };
  const values = config.extra ? [tenantId, plan.periodStart] : [tenantId];
  const count = await runner.query(`SELECT count(*)::int AS count FROM ${config.table} WHERE tenant_id=$1 ${config.extra}`, values);
  const used = Number(count.rows[0]?.count || 0);
  if (used >= limit) {
    throw new PlanEntitlementError("plan_limit_reached", "وصلت إلى الحد المسموح في باقتك الحالية.", { resource, limit, used, plan: plan?.slug || "free" });
  }
  return { plan, limit, used };
}

export function planEntitlementResponse(error) {
  if (!(error instanceof PlanEntitlementError)) return null;
  return Response.json({ ok: false, reason: error.reason, message: error.message, ...error.details }, { status: 403 });
}
