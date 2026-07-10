import { afterEach, describe, expect, it } from "vitest";
import { requireSession } from "../../src/lib/auth.js";
import { GET } from "../../app/api/cron/renewal-reminders/route.js";

describe("API auth security", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("requires a server session for dashboard APIs", () => {
    expect(requireSession(null)).toMatchObject({ ok: false, status: 401 });
    expect(requireSession({ userId: "u1", tenantId: "t1", role: "owner", expiresAt: "2026-07-11T00:00:00.000Z" }, new Date("2026-07-10T00:00:00.000Z"))).toMatchObject({ ok: true, tenantId: "t1" });
  });

  it("does not allow cron execution without CRON_SECRET authorization", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const response = await GET(new Request("https://renew.test/api/cron/renewal-reminders", {
      headers: { authorization: "Bearer wrong-secret" }
    }));

    expect(response.status).toBe(401);
  });
});
