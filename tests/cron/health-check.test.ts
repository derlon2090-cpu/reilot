import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "../../src/lib/encryption.js";
import { updateWhatsappHealth } from "../../src/lib/whatsapp.js";
import { GET } from "../../app/api/cron/whatsapp-health-check/route.js";

describe("WhatsApp health-check cron", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("exposes a protected route", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const response = await GET(new Request("https://renew.test/api/cron/whatsapp-health-check", {
      headers: { authorization: "Bearer cron-secret" }
    }));

    expect(response.status).toBe(200);
  });

  it("updates channel status and last health check timestamp through mocks", async () => {
    const repository = { updateChannel: vi.fn(async (_id, patch) => patch) };
    const patch = await updateWhatsappHealth({
      channel: { id: "channel-1", channelTokenEncrypted: encryptSecret("token", "enc-key") },
      env: { ENCRYPTION_KEY: "enc-key" },
      whapi: { health: vi.fn(async () => ({ status: "disconnected", error: "phone offline" })) },
      repository
    });

    expect(patch.status).toBe("disconnected");
    expect(patch.lastError).toBe("phone offline");
    expect(patch.lastHealthCheckAt).toBeTruthy();
  });
});
