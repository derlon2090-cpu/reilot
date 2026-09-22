import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { query } from "../../src/server/db.js";
import { getBillingOverview } from "../../src/server/billing-overview.js";
import { getAIEntitlementSnapshot } from "../../src/server/ai/entitlements.js";
import { getPlanEntitlement } from "../../src/server/plan-entitlements.js";
import { getTenantStorageLimitState } from "../../src/server/tenant-storage.js";

vi.mock("../../src/server/admin-auth.js", () => ({
  requireAdminPermission: vi.fn(async () => ({ ok: true, admin: { adminId: crypto.randomUUID() } })),
  auditAdmin: vi.fn(async () => undefined)
}));

import { POST } from "../../app/api/admin/tenants/[tenantId]/actions/route.js";

const tenantId = crypto.randomUUID();
const userId = crypto.randomUUID();
let businessPlanId: string;

function grantBusiness() {
  return POST(new Request(`http://localhost/api/admin/tenants/${tenantId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "change_plan", planId: businessPlanId })
  }), { params: Promise.resolve({ tenantId }) });
}

describe.sequential("admin plan grant reaches every entitlement", () => {
  beforeAll(async () => {
    const plans = await query("SELECT id,slug FROM platform_plans WHERE slug IN ('business','trial')");
    const business = plans.rows.find((row) => row.slug === "business");
    if (!business) throw new Error("Business plan fixture is missing");
    businessPlanId = business.id;
    await query("INSERT INTO tenants(id,name,slug,status) VALUES($1,'Plan grant test',$2,'active')", [tenantId, `grant-${tenantId}`]);
    await query("INSERT INTO users(id,tenant_id,name,email,email_verified,role) VALUES($1,$2,'Plan Grant',$3,true,'owner')", [userId, tenantId, `grant-${userId}@example.test`]);
    await query(
      `INSERT INTO platform_subscriptions(tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end)
       VALUES($1,$2,'active','monthly',now()-interval '2 months',now()-interval '1 month')`,
      [tenantId, businessPlanId]
    );
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE id=$1", [userId]);
    await query("DELETE FROM tenant_storage_usage WHERE tenant_id=$1", [tenantId]);
    await query("DELETE FROM tenants WHERE id=$1", [tenantId]);
  });

  it("restarts an expired Business grant and immediately provisions AI and 5 GB storage", async () => {
    const before = await getBillingOverview(tenantId);
    expect(before.current).toMatchObject({ planSlug: "business", status: "expired" });
    expect(before.storage.limitMb).toBe(1);

    const response = await grantBusiness();
    const payload = await response.json();
    expect(response.status, JSON.stringify(payload)).toBe(200);
    expect(payload.aiProvisioned).toBe(true);

    const subscription = await query(
      `SELECT ps.status,ps.current_period_start AS "periodStart",ps.current_period_end AS "periodEnd",pp.slug
         FROM platform_subscriptions ps JOIN platform_plans pp ON pp.id=ps.plan_id
        WHERE ps.tenant_id=$1 AND ps.status='active'`, [tenantId]
    );
    expect(subscription.rows).toHaveLength(1);
    expect(subscription.rows[0].slug).toBe("business");
    expect(new Date(subscription.rows[0].periodStart).getTime()).toBeLessThanOrEqual(Date.now());
    expect(new Date(subscription.rows[0].periodEnd).getTime()).toBeGreaterThan(Date.now() + 27 * 86400000);

    const [ai, storage, campaigns, billing] = await Promise.all([
      getAIEntitlementSnapshot({ tenantId, userId }),
      getTenantStorageLimitState(tenantId),
      getPlanEntitlement(tenantId, "campaigns"),
      getBillingOverview(tenantId)
    ]);
    expect(ai).toMatchObject({ planSlug: "business", allowanceTokens: 5_000_000, entitlementState: "active" });
    expect(storage.limitMb).toBe(5120);
    expect(billing.current).toMatchObject({ planSlug: "business", status: "active" });
    expect(billing.storage.limitMb).toBe(5120);
    expect(campaigns.enabled).toBe(true);
  });

  it("retires a second active subscription when the administrator grants Business", async () => {
    const trial = await query("SELECT id FROM platform_plans WHERE slug='trial' LIMIT 1");
    await query(
      `INSERT INTO platform_subscriptions(tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end)
       VALUES($1,$2,'trial','monthly',now(),now()+interval '7 days')`,
      [tenantId, trial.rows[0].id]
    );
    const response = await grantBusiness();
    expect(response.status).toBe(200);
    const active = await query(
      `SELECT ps.status,pp.slug FROM platform_subscriptions ps JOIN platform_plans pp ON pp.id=ps.plan_id
        WHERE ps.tenant_id=$1 AND ps.status IN ('active','trial','past_due') AND ps.current_period_end>now()`,
      [tenantId]
    );
    expect(active.rows).toEqual([{ status: "active", slug: "business" }]);
  });
});
