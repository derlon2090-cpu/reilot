import { describe, expect, it, vi } from "vitest";
import {
  createEvolutionInstance,
  deleteEvolutionInstance,
  disconnectEvolutionInstance,
  getEvolutionQr,
  getEvolutionStatus,
  sendEvolutionMessage
} from "../../src/lib/evolution.js";

const env = {
  ENCRYPTION_KEY: "enc-key",
  WHATSAPP_PROVIDER: "evolution",
  EVOLUTION_API_URL: "https://evolution.test",
  EVOLUTION_API_KEY: "server-key"
};

function repository() {
  const instances = new Map<string, any>();
  return {
    saveInstance: vi.fn(async (instance) => {
      const saved = { id: "instance-1", ...instance };
      instances.set(saved.id, saved);
      return saved;
    }),
    getInstance: vi.fn(async (id) => instances.get(id)),
    updateInstance: vi.fn(async (id, patch) => ({ ...instances.get(id), ...patch })),
    deleteInstance: vi.fn(async (id) => instances.delete(id)),
    addActivity: vi.fn(async (activity) => activity)
  };
}

describe("Evolution instance integration", () => {
  it("creates one instance per tenant and never returns the instance token", async () => {
    const repo = repository();
    const evolution = {
      createInstance: vi.fn(async () => ({
        instanceId: "evo-1",
        instanceName: "tenant-a-main",
        instanceToken: "plain-instance-token"
      }))
    };

    const response = await createEvolutionInstance({ tenantId: "tenant-a", env, evolution, repository: repo });

    expect(evolution.createInstance).toHaveBeenCalledWith({
      baseUrl: "https://evolution.test",
      apiKey: "server-key",
      tenantId: "tenant-a",
      instanceName: "tenant-tenant-a-whatsapp"
    });
    expect(response).not.toHaveProperty("instanceToken");
    expect(repo.saveInstance.mock.calls[0][0].instanceTokenEncrypted).not.toContain("plain-instance-token");
  });

  it("returns QR and status only to the owning tenant", async () => {
    const repo = repository();
    await createEvolutionInstance({
      tenantId: "tenant-a",
      env,
      evolution: { createInstance: vi.fn(async () => ({ instanceId: "evo-1", instanceToken: "plain-token" })) },
      repository: repo
    });

    const qr = await getEvolutionQr({
      tenantId: "tenant-a",
      instanceId: "instance-1",
      env,
      evolution: { getQr: vi.fn(async () => ({ qrBase64: "base64-qr", pairingCode: "WP-1234", expiresAt: "2026-07-10T12:00:00.000Z" })) },
      repository: repo
    });

    expect(qr).toMatchObject({ ok: true, qrBase64: "base64-qr", pairingCode: "WP-1234" });
    await expect(getEvolutionStatus({
      tenantId: "tenant-b",
      instanceId: "instance-1",
      env,
      evolution: { status: vi.fn() },
      repository: repo
    })).resolves.toMatchObject({ ok: false, status: 403 });
  });

  it("sends, disconnects, and deletes a connected instance through mocks", async () => {
    const repo = repository();
    await createEvolutionInstance({
      tenantId: "tenant-a",
      env,
      evolution: { createInstance: vi.fn(async () => ({ instanceId: "evo-1", instanceToken: "plain-token" })) },
      repository: repo
    });
    await repo.updateInstance("instance-1", { status: "connected" });
    const saved = await repo.getInstance("instance-1");
    saved.status = "connected";

    const evolution = {
      sendMessage: vi.fn(async () => ({ messageId: "msg-1", status: "sent" })),
      logout: vi.fn(async () => ({ ok: true })),
      deleteInstance: vi.fn(async () => ({ ok: true }))
    };

    await expect(sendEvolutionMessage({
      tenantId: "tenant-a",
      instanceId: "instance-1",
      to: "+966500000000",
      message: "test",
      env,
      evolution,
      repository: repo
    })).resolves.toMatchObject({ ok: true, providerMessageId: "msg-1" });

    await expect(disconnectEvolutionInstance({ tenantId: "tenant-a", instanceId: "instance-1", env, evolution, repository: repo })).resolves.toEqual({ ok: true });
    await expect(deleteEvolutionInstance({ tenantId: "tenant-a", instanceId: "instance-1", env, evolution, repository: repo })).resolves.toEqual({ ok: true });
  });
});
