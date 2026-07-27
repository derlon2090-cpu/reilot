import { describe, expect, it, vi } from "vitest";
import { assertPlanCapacity, assertPlanFeature } from "../../src/server/plan-entitlements.js";

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
});
