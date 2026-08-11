import { query, transaction } from "./db.js";

export class PlanEntitlementError extends Error {
  constructor(reason, message, details = {}) {
    super(message);
    this.name = "PlanEntitlementError";
    this.reason = reason;
    this.details = details;
  }
}

const featureColumns = {
  campaignsEnabled: "campaigns",
  automationEnabled: "automation",
  customApiEnabled: "api_access",
  sallaEnabled: "order_status"
};

const capacities = {
  customers: { legacyLimit: "customersLimit", featureKey: "renewal_customers", table: "customers", extra: "" },
  users: { legacyLimit: "usersLimit", featureKey: "team_members", table: "tenant_members", extra: "AND status = 'active'" },
  whatsappChannels: { legacyLimit: "whatsappChannelsLimit", featureKey: "official_whatsapp_devices", table: "whatsapp_channels", extra: "" },
  orderLinks: { legacyLimit: "orderLinksLimit", featureKey: "invoice_links_monthly", table: "order_info_links", extra: "AND created_at >= $2" }
};

async function loadPlan(runner, tenantId) {
  const active = await runner.query(
    `SELECT pp.id,pp.slug,pp.name,
            pp.whatsapp_channels_limit AS "whatsappChannelsLimit",
            pp.customers_limit AS "customersLimit",
            pp.users_limit AS "usersLimit",
            pp.order_links_limit AS "orderLinksLimit",
            pp.campaigns_enabled AS "campaignsEnabled",
            pp.automation_enabled AS "automationEnabled",
            pp.custom_api_enabled AS "customApiEnabled",
            pp.salla_enabled AS "sallaEnabled",
            ps.id AS "subscriptionId",
            ps.current_period_start AS "periodStart",
            ps.current_period_end AS "periodEnd"
       FROM platform_subscriptions ps
       JOIN platform_plans pp ON pp.id = ps.plan_id
      WHERE ps.tenant_id=$1 AND ps.status IN ('active','trial','past_due')
        AND ps.current_period_end > now()
      ORDER BY CASE ps.status WHEN 'active' THEN 0 WHEN 'trial' THEN 1 ELSE 2 END,
               ps.created_at DESC LIMIT 1`,
    [tenantId]
  );
  if (active.rows[0]) return active.rows[0];
  const previous = await runner.query(
    `SELECT 1 FROM platform_subscriptions WHERE tenant_id=$1 LIMIT 1`,
    [tenantId]
  );
  if (previous.rows[0]) return null;
  const fallback = await runner.query(
    `SELECT id,slug,name,whatsapp_channels_limit AS "whatsappChannelsLimit",
            customers_limit AS "customersLimit",users_limit AS "usersLimit",
            order_links_limit AS "orderLinksLimit",campaigns_enabled AS "campaignsEnabled",
            automation_enabled AS "automationEnabled",custom_api_enabled AS "customApiEnabled",
            salla_enabled AS "sallaEnabled",NULL::uuid AS "subscriptionId",
            date_trunc('month',now()) AS "periodStart",
            date_trunc('month',now()) + interval '1 month' AS "periodEnd"
       FROM platform_plans WHERE slug='trial' LIMIT 1`
  );
  return fallback.rows[0];
}

export async function getPlanEntitlement(tenantId, featureKey, runner = { query }) {
  const plan = await loadPlan(runner, tenantId);
  if (!plan) return { plan: null, enabled: false, limitValue: 0, limitUnit: null, subscriptionRequired: true };
  const entitlement = await runner.query(
    `SELECT enabled,limit_value AS "limitValue",limit_unit AS "limitUnit",
            overage_allowed AS "overageAllowed",overage_price AS "overagePrice",
            metadata_json AS metadata
       FROM billing_plan_entitlements
      WHERE plan_id=$1 AND feature_key=$2 LIMIT 1`,
    [plan.id, featureKey]
  );
  return {
    plan: plan.slug,
    planName: plan.name,
    planId: plan.id,
    subscriptionId: plan.subscriptionId,
    periodStart: plan.periodStart,
    periodEnd: plan.periodEnd,
    enabled: Boolean(entitlement.rows[0]?.enabled),
    limitValue: entitlement.rows[0]?.limitValue == null ? null : Number(entitlement.rows[0].limitValue),
    limitUnit: entitlement.rows[0]?.limitUnit || null,
    overageAllowed: Boolean(entitlement.rows[0]?.overageAllowed),
    overagePrice: entitlement.rows[0]?.overagePrice || null,
    metadata: entitlement.rows[0]?.metadata || {}
  };
}

export async function requirePlanEntitlement(tenantId, featureKey, runner = { query }) {
  const entitlement = await getPlanEntitlement(tenantId, featureKey, runner);
  if (!entitlement.enabled) {
    throw new PlanEntitlementError(
      "plan_feature_unavailable",
      "هذه الميزة غير متاحة في باقتك الحالية.",
      { feature: featureKey, plan: entitlement.plan, upgrade_required: true }
    );
  }
  return entitlement;
}

export async function assertPlanFeature(tenantId, feature, runner = { query }) {
  const plan = await loadPlan(runner, tenantId);
  if (plan?.id && featureColumns[feature]) {
    return requirePlanEntitlement(tenantId, featureColumns[feature], runner);
  }
  if (plan && Object.prototype.hasOwnProperty.call(plan, feature)) {
    if (!plan[feature]) {
      throw new PlanEntitlementError(
        "plan_feature_unavailable",
        "هذه الميزة غير متاحة في باقتك الحالية.",
        { feature, plan: plan.slug || "free", upgrade_required: true }
      );
    }
    return plan;
  }
  return requirePlanEntitlement(tenantId, featureColumns[feature] || feature, runner);
}

export async function assertUsageAvailable({ tenantId, featureKey, amount = 1, runner = { query } }) {
  const entitlement = await requirePlanEntitlement(tenantId, featureKey, runner);
  if (entitlement.limitValue == null || entitlement.limitValue < 0) {
    return { ...entitlement, used: 0, reserved: 0, remaining: -1 };
  }
  const usage = await runner.query(
    `SELECT used_value AS used,reserved_value AS reserved
       FROM billing_usage_counters
      WHERE tenant_id=$1 AND feature_key=$2
        AND period_start=$3 AND period_end=$4 LIMIT 1`,
    [tenantId, featureKey, entitlement.periodStart, entitlement.periodEnd]
  );
  const used = Number(usage.rows[0]?.used || 0);
  const reserved = Number(usage.rows[0]?.reserved || 0);
  if (used + reserved + Number(amount) > entitlement.limitValue) {
    throw new PlanEntitlementError(
      "plan_limit_reached",
      "وصلت إلى الحد المسموح في باقتك الحالية.",
      { feature: featureKey, limit: entitlement.limitValue, used, reserved, plan: entitlement.plan, upgrade_required: true }
    );
  }
  return { ...entitlement, used, reserved, remaining: entitlement.limitValue - used - reserved };
}

export async function reserveUsage({ tenantId, featureKey, amount = 1 }) {
  return transaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`billing-usage:${tenantId}:${featureKey}`]
    );
    const availability = await assertUsageAvailable({ tenantId, featureKey, amount, runner: client });
    if (availability.limitValue == null || availability.limitValue < 0) return availability;
    await client.query(
      `INSERT INTO billing_usage_counters
         (tenant_id,subscription_id,feature_key,period_start,period_end,limit_value,reserved_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tenant_id,feature_key,period_start,period_end)
       DO UPDATE SET reserved_value=billing_usage_counters.reserved_value + EXCLUDED.reserved_value,
                     limit_value=EXCLUDED.limit_value,updated_at=now()`,
      [tenantId, availability.subscriptionId, featureKey, availability.periodStart, availability.periodEnd, availability.limitValue, amount]
    );
    return availability;
  });
}

export async function commitUsage({ tenantId, featureKey, amount = 1 }) {
  const entitlement = await getPlanEntitlement(tenantId, featureKey);
  if (!entitlement.enabled) return;
  await query(
    `INSERT INTO billing_usage_counters
       (tenant_id,subscription_id,feature_key,period_start,period_end,limit_value,used_value)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (tenant_id,feature_key,period_start,period_end)
     DO UPDATE SET reserved_value=GREATEST(0,billing_usage_counters.reserved_value-EXCLUDED.used_value),
                   used_value=billing_usage_counters.used_value+EXCLUDED.used_value,
                   limit_value=EXCLUDED.limit_value,updated_at=now()`,
    [tenantId, entitlement.subscriptionId, featureKey, entitlement.periodStart, entitlement.periodEnd, entitlement.limitValue, amount]
  );
}

export async function releaseUsage({ tenantId, featureKey, amount = 1 }) {
  await query(
    `UPDATE billing_usage_counters
        SET reserved_value=GREATEST(0,reserved_value-$3),updated_at=now()
      WHERE tenant_id=$1 AND feature_key=$2 AND period_start <= now() AND period_end > now()`,
    [tenantId, featureKey, amount]
  );
}

export async function assertPlanCapacity(tenantId, resource, runner = { query }) {
  const config = capacities[resource];
  if (!config) throw new TypeError(`Unknown plan capacity: ${resource}`);
  const plan = await loadPlan(runner, tenantId);
  let limit = Number(plan?.[config.legacyLimit] ?? 0);
  if (plan?.id) {
    const entitlement = await runner.query(
      `SELECT enabled,limit_value AS "limitValue"
         FROM billing_plan_entitlements WHERE plan_id=$1 AND feature_key=$2 LIMIT 1`,
      [plan.id, config.featureKey]
    );
    if (entitlement.rows[0]) limit = entitlement.rows[0].enabled ? Number(entitlement.rows[0].limitValue ?? 0) : 0;
  }
  if (limit < 0) return { plan, limit, used: 0 };
  const values = config.extra ? [tenantId, plan.periodStart] : [tenantId];
  const count = await runner.query(`SELECT count(*)::int AS count FROM ${config.table} WHERE tenant_id=$1 ${config.extra}`, values);
  const used = Number(count.rows[0]?.count || 0);
  if (used >= limit) {
    throw new PlanEntitlementError(
      "plan_limit_reached",
      "وصلت إلى الحد المسموح في باقتك الحالية.",
      { resource, limit, used, plan: plan?.slug || "free", upgrade_required: true }
    );
  }
  return { plan, limit, used };
}

export function planEntitlementResponse(error) {
  if (!(error instanceof PlanEntitlementError)) return null;
  return Response.json(
    { ok: false, reason: error.reason, message: error.message, ...error.details },
    { status: 403 }
  );
}
