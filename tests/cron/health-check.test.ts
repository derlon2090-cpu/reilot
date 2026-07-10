import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "../../src/lib/encryption.js";
import { updateEvolutionHealth } from "../../src/lib/evolution.js";
import { GET } from "../../app/api/cron/whatsapp-health-check/route.js";

describe("Evolution health-check cron", () => {
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

  it("updates instance status and last health check timestamp through mocks", async () => {
    const repository = { updateInstance: vi.fn(async (_id, patch) => patch) };
    const patch = await updateEvolutionHealth({
      instance: { id: "instance-1", instanceName: "tenant-main", instanceTokenEncrypted: encryptSecret("token", "enc-key") },
      env: { ENCRYPTION_KEY: "enc-key", WHATSAPP_PROVIDER: "evolution", EVOLUTION_API_URL: "https://evolution.test", EVOLUTION_API_KEY: "server-key" },
      evolution: { health: vi.fn(async () => ({ status: "disconnected", error: "phone offline" })) },
      repository
    });

    expect(patch.status).toBe("disconnected");
    expect(patch.lastError).toBe("phone offline");
    expect(patch.lastHealthCheckAt).toBeTruthy();
  });
});
