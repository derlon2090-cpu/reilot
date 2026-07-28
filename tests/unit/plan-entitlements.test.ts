import { describe, expect, it, vi } from "vitest";
import { assertPlanCapacity, assertPlanFeature, assertUsageAvailable, getPlanEntitlement } from "../../src/server/plan-entitlements.js";

function runnerWith(...rows: Array<Record<string, unknown>>) {
  return {
    query: vi.fn().mockImplementation(async () => ({ rows: [rows.shift()] }))
  };
}

describe("plan entitlements", () => {
  it("blocks a feature that the active plan does not include", async () => {
    const runner = runnerWith({ slug: "free", campaignsEnabled: false });
    await expect(assertPlanFeature("tenant-a", "campaignsEnabled", runner))
      .rejects.toMatchObject({ reason: "plan_feature_unavailable", details: { plan: "free" } });
  });

  it("blocks a resource when its plan capacity is reached", async () => {
    const runner = runnerWith(
      { slug: "starter", customersLimit: 20 },
      { count: 20 }
    );
    await expect(assertPlanCapacity("tenant-a", "customers", runner))
      .rejects.toMatchObject({ reason: "plan_limit_reached", details: { resource: "customers", limit: 20, used: 20 } });
  });

  it("does not count resources for an unlimited capacity", async () => {
    const runner = runnerWith({ slug: "pro", orderLinksLimit: -1 });
    await expect(assertPlanCapacity("tenant-a", "orderLinks", runner))
      .resolves.toMatchObject({ limit: -1, used: 0 });
    expect(runner.query).toHaveBeenCalledTimes(1);
  });

  it("reads centralized feature limits from the active plan", async () => {
    const runner = runnerWith(
      { id: "plan-pro", slug: "business", name: "Professional", subscriptionId: "sub-1", periodStart: "2026-07-01", periodEnd: "2026-08-01" },
      { enabled: true, limitValue: 100000, limitUnit: "request/month" }
    );
    await expect(getPlanEntitlement("tenant-a", "api_requests_monthly", runner))
      .resolves.toMatchObject({ enabled: true, limitValue: 100000, plan: "business" });
  });

  it("blocks usage when used and reserved values reach the plan limit", async () => {
    const runner = runnerWith(
      { id: "plan-starter", slug: "starter", subscriptionId: "sub-1", periodStart: "2026-07-01", periodEnd: "2026-08-01" },
      { enabled: true, limitValue: 10, limitUnit: "request/month" },
      { used: 8, reserved: 2 }
    );
    await expect(assertUsageAvailable({ tenantId: "tenant-a", featureKey: "api_requests_monthly", amount: 1, runner }))
      .rejects.toMatchObject({ reason: "plan_limit_reached", details: { limit: 10, used: 8, reserved: 2 } });
  });
});
