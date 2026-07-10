import { describe, expect, it } from "vitest";
import { queueRenewalReminders } from "../../src/lib/cronJobs.js";

describe("subscription flow integration", () => {
  it("turns expiring subscriptions into deduplicated reminder queue entries", () => {
    const queued = queueRenewalReminders({
      tenants: [{ id: "tenant-a", status: "trial" }],
      subscriptions: [{ id: "sub-1", tenantId: "tenant-a", customerId: "customer-1", endDate: "2026-07-13" }],
      automationRules: [{ daysOffset: 3, isActive: true }],
      unsubscribeList: [],
      existingQueue: [],
      now: new Date("2026-07-10T00:00:00.000Z")
    });

    expect(queued).toHaveLength(1);
    expect(queued[0].triggerKey).toBe("tenant-a:sub-1:renewal:3");
  });
});
