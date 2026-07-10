import { describe, expect, it, vi } from "vitest";
import { createWhatsAppProvider, normalizeWhatsAppPhone } from "../../src/lib/whatsappProvider.js";

describe("WhatsApp provider adapter", () => {
  it("normalizes international WhatsApp numbers and rejects invalid input", () => {
    expect(normalizeWhatsAppPhone("+966 50-123-4567")).toEqual({ ok: true, phoneNumber: "966501234567" });
    expect(normalizeWhatsAppPhone("0501234567")).toMatchObject({ ok: false, error: "INVALID_WHATSAPP_PHONE" });
  });

  it("routes calls through the configured Evolution adapter", async () => {
    const provider = createWhatsAppProvider({
      provider: "evolution",
      client: {
        createInstance: vi.fn(async () => ({ instanceId: "evo-1", instanceToken: "plain-token" }))
      }
    });
    const repository = {
      saveInstance: vi.fn(async (instance) => ({ id: "instance-1", ...instance }))
    };

    const response = await provider.createInstance({
      tenantId: "tenant-a",
      env: { ENCRYPTION_KEY: "enc", WHATSAPP_PROVIDER: "evolution", EVOLUTION_API_URL: "https://evolution.test", EVOLUTION_API_KEY: "key" },
      repository
    });

    expect(response).toMatchObject({ id: "instance-1", status: "pending_qr" });
    expect(response).not.toHaveProperty("instanceToken");
  });

  it("queues test messages through the adapter before provider delivery", async () => {
    const provider = createWhatsAppProvider({ provider: "evolution", client: {} });
    const repository = {
      getInstance: vi.fn(async () => ({ id: "instance-1", tenantId: "tenant-a", status: "connected" })),
      enqueueMessage: vi.fn(async (message) => ({ id: "queue-1", ...message }))
    };

    const response = await provider.enqueueTestMessage({
      tenantId: "tenant-a",
      instanceId: "instance-1",
      to: "966501234567",
      message: "test",
      repository
    });

    expect(response).toEqual({ ok: true, queuedMessageId: "queue-1", status: "pending" });
    expect(repository.enqueueMessage).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a",
      channel: "whatsapp",
      status: "pending"
    }));
  });
});
