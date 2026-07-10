import { afterEach, describe, expect, it } from "vitest";
import { resetMonthlyUsage } from "../../src/lib/cronJobs.js";
import { GET } from "../../app/api/cron/usage-reset/route.js";

describe("usage reset cron", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("exposes a protected route", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const response = await GET(new Request("https://renew.test/api/cron/usage-reset", {
      headers: { authorization: "Bearer cron-secret" }
    }));

    expect(response.status).toBe(200);
  });

  it("creates usage rows for the new month without deleting old rows", () => {
    const rows = resetMonthlyUsage({
      tenants: [{ id: "tenant-a" }, { id: "tenant-b" }],
      planByTenant: {
        "tenant-a": { messages: 50 },
        "tenant-b": { messages: 3000 }
      },
      existingUsage: [{ tenantId: "tenant-a", month: 6, year: 2026, usedMessages: 40 }],
      now: new Date("2026-07-01T00:00:00.000Z")
    });

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.tenantId === "tenant-b")).toMatchObject({ month: 7, year: 2026, messageLimit: 3000 });
  });
});
