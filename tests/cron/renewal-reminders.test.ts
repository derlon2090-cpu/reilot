import { afterEach, describe, expect, it } from "vitest";
import { queueRenewalReminders } from "../../src/lib/cronJobs.js";
import { GET } from "../../app/api/cron/renewal-reminders/route.js";

describe("renewal reminders cron", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("rejects missing authorization and accepts the correct CRON_SECRET", async () => {
    process.env.CRON_SECRET = "cron-secret";

    const unauthorized = await GET(new Request("https://renew.test/api/cron/renewal-reminders"));
    const authorized = await GET(new Request("https://renew.test/api/cron/renewal-reminders", {
      headers: { authorization: "Bearer cron-secret" }
    }));

    expect(unauthorized.status).toBe(401);
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toMatchObject({ ok: true, job: "renewal-reminders" });
  });

  it("queues only eligible renewal windows without duplicates", () => {
    const queued = queueRenewalReminders({
      tenants: [{ id: "tenant-a", status: "active" }, { id: "tenant-b", status: "inactive" }],
      subscriptions: [
        { id: "sub-7", tenantId: "tenant-a", customerId: "customer-1", endDate: "2026-07-17" },
        { id: "sub-3", tenantId: "tenant-a", customerId: "customer-2", endDate: "2026-07-13" },
        { id: "sub-off", tenantId: "tenant-a", customerId: "customer-3", endDate: "2026-07-11" },
        { id: "sub-inactive", tenantId: "tenant-b", customerId: "customer-4", endDate: "2026-07-17" }
      ],
      automationRules: [{ daysOffset: 7, isActive: true }, { daysOffset: 3, isActive: true }, { daysOffset: 1, isActive: false }],
      unsubscribeList: [{ tenantId: "tenant-a", customerId: "customer-2" }],
      existingQueue: [{ triggerKey: "tenant-a:sub-7:renewal:7" }],
      now: new Date("2026-07-10T00:00:00.000Z")
    });

    expect(queued).toEqual([]);
  });
});
