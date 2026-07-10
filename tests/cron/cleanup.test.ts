import { afterEach, describe, expect, it } from "vitest";
import { cleanupExpiredData } from "../../src/lib/cronJobs.js";
import { GET } from "../../app/api/cron/cleanup/route.js";

describe("cleanup cron", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("exposes a protected route", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const response = await GET(new Request("https://renew.test/api/cron/cleanup", {
      headers: { authorization: "Bearer cron-secret" }
    }));

    expect(response.status).toBe(200);
  });

  it("removes expired QR cache and old sent queue without touching important logs", () => {
    const cleaned = cleanupExpiredData({
      qrCache: [
        { id: "expired", expiresAt: "2026-07-09T00:00:00.000Z" },
        { id: "active", expiresAt: "2026-07-11T00:00:00.000Z" }
      ],
      queue: [
        { id: "old-sent", status: "sent", updatedAt: "2026-05-01T00:00:00.000Z" },
        { id: "failed-log", status: "failed", updatedAt: "2026-05-01T00:00:00.000Z" }
      ],
      now: new Date("2026-07-10T00:00:00.000Z")
    });

    expect(cleaned.qrCache.map((item) => item.id)).toEqual(["active"]);
    expect(cleaned.queue.map((item) => item.id)).toEqual(["failed-log"]);
  });
});
