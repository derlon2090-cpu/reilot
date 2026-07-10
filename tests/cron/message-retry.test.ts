import { afterEach, describe, expect, it, vi } from "vitest";
import { processMessageRetry } from "../../src/lib/cronJobs.js";
import { GET } from "../../app/api/cron/message-retry/route.js";

describe("message retry cron", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("keeps protected route behind CRON_SECRET", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const response = await GET(new Request("https://renew.test/api/cron/message-retry", {
      headers: { authorization: "Bearer cron-secret" }
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ job: "message-retry" });
  });

  it("processes pending messages, respects safety checks, and fails after max attempts", async () => {
    const send = vi.fn(async (item) => item.id === "m1" ? { ok: true, providerMessageId: "p1" } : { ok: false, error: "provider failed" });
    const processed = await processMessageRetry({
      queue: [
        { id: "m1", tenantId: "tenant-a", status: "pending", attempts: 0, maxAttempts: 3 },
        { id: "m2", tenantId: "tenant-a", status: "pending", attempts: 2, maxAttempts: 3 },
        { id: "m3", tenantId: "tenant-b", status: "sent", attempts: 0, maxAttempts: 3 },
        { id: "m4", tenantId: "tenant-c", status: "pending", attempts: 0, maxAttempts: 3 }
      ],
      safetyByTenant: {
        "tenant-a": { hourlySent: 0, dailySent: 0 },
        "tenant-c": { hourlySent: 2, hourlyLimit: 2 }
      },
      send,
      now: new Date("2026-07-10T12:00:00")
    });

    expect(processed.find((item) => item.id === "m1")).toMatchObject({ status: "sent" });
    expect(processed.find((item) => item.id === "m2")).toMatchObject({ status: "failed", attempts: 3 });
    expect(processed.find((item) => item.id === "m4")).toMatchObject({ status: "pending", skippedReason: "hourly_limit" });
  });
});
