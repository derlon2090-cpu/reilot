import { describe, expect, it, vi } from "vitest";
import { processMessageRetry } from "../../src/lib/cronJobs.js";

describe("Evolution send integration", () => {
  it("sends pending queue items with the mocked Evolution provider and records provider id", async () => {
    const processed = await processMessageRetry({
      queue: [{ id: "m1", tenantId: "tenant-a", status: "pending", attempts: 0, maxAttempts: 3 }],
      safetyByTenant: { "tenant-a": { now: new Date("2026-07-10T12:00:00"), hourlySent: 0, dailySent: 0 } },
      send: vi.fn(async () => ({ ok: true, providerMessageId: "provider-1" })),
      now: new Date("2026-07-10T12:00:00")
    });

    expect(processed[0]).toMatchObject({ status: "sent", providerMessageId: "provider-1" });
  });
});
