import { describe, expect, it, vi } from "vitest";
import { createWhatsappChannel, getWhatsappQr } from "../../src/lib/whatsapp.js";

function repository() {
  const channels = new Map<string, any>();
  return {
    saveChannel: vi.fn(async (channel) => {
      const saved = { id: "channel-1", channelId: channel.channelId, ...channel };
      channels.set(saved.id, saved);
      return saved;
    }),
    getChannel: vi.fn(async (id) => channels.get(id))
  };
}

describe("WhatsApp channel integration", () => {
  it("creates a channel through mocked Whapi and never returns the channel token", async () => {
    const repo = repository();
    const whapi = { createChannel: vi.fn(async () => ({ channel_id: "whapi-1", channel_token: "plain-token" })) };

    const response = await createWhatsappChannel({
      tenantId: "tenant-a",
      env: { ENCRYPTION_KEY: "enc-key", WHAPI_PARTNER_API_KEY: "partner-key" },
      whapi,
      repository: repo
    });

    expect(whapi.createChannel).toHaveBeenCalledWith({ apiKey: "partner-key", tenantId: "tenant-a" });
    expect(response).not.toHaveProperty("channel_token");
    expect(repo.saveChannel.mock.calls[0][0].channelTokenEncrypted).not.toContain("plain-token");
  });

  it("returns QR only to the owning tenant", async () => {
    const repo = repository();
    await createWhatsappChannel({
      tenantId: "tenant-a",
      env: { ENCRYPTION_KEY: "enc-key", WHAPI_PARTNER_API_KEY: "partner-key" },
      whapi: { createChannel: vi.fn(async () => ({ channel_id: "whapi-1", channel_token: "plain-token" })) },
      repository: repo
    });

    const qr = await getWhatsappQr({
      tenantId: "tenant-a",
      channelId: "channel-1",
      env: { ENCRYPTION_KEY: "enc-key" },
      whapi: { getQr: vi.fn(async () => ({ qrBase64: "base64-qr", expiresAt: "2026-07-10T12:00:00.000Z" })) },
      repository: repo
    });

    expect(qr).toMatchObject({ ok: true, qrBase64: "base64-qr" });
    await expect(getWhatsappQr({
      tenantId: "tenant-b",
      channelId: "channel-1",
      env: { ENCRYPTION_KEY: "enc-key" },
      whapi: { getQr: vi.fn() },
      repository: repo
    })).resolves.toMatchObject({ ok: false, status: 403 });
  });
});
