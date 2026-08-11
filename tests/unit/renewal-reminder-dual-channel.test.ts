import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ whatsappConnected: true }));
const enqueueMessage = vi.hoisted(() => vi.fn());
const query = vi.hoisted(() => vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.includes("SELECT reminder_delivery_mode")) return { rows: [{ reminder_delivery_mode: "both" }] };
  if (sql.includes("JOIN subscription_customers sc")) return { rows: [{
    id: "subscription-1",
    tenant_id: "tenant-1",
    status: "active",
    reminder_enabled: true,
    preferred_channel: "whatsapp",
    fallback_channel: "email",
    customer_name: "عميل",
    email: "customer@example.com",
    phone_e164: "+966501234567",
    email_eligible: true,
    whatsapp_eligible: true,
    plan_name: "الخطة",
    store_name: "المتجر",
    order_number: "1001",
    expires_at: "2026-09-01T00:00:00.000Z",
    salla_product_url: null,
    whatsapp_channel_id: runtime.whatsappConnected ? "channel-1" : null,
    whatsapp_status: runtime.whatsappConnected ? "connected" : null,
    whatsapp_risk: 0
  }] };
  if (sql.includes("FROM renewal_message_templates")) {
    const channel = params[1];
    return { rows: [{
      id: `template-${channel}`,
      name: `قالب ${channel}`,
      subject: channel === "email" ? "تذكير {{customer_name}}" : null,
      body: "مرحبًا {{customer_name}}",
      storeName: "المتجر",
      contentJson: {}
    }] };
  }
  if (sql.includes("JOIN LATERAL")) return { rows: [] };
  return { rows: [], rowCount: 0 };
}));

vi.mock("../../src/server/db.js", () => ({ query, transaction: vi.fn() }));
vi.mock("../../src/server/message-queue.js", () => ({ enqueueMessage }));
vi.mock("../../src/server/product-renewal-options.js", () => ({ createRenewalRedirect: vi.fn() }));

const { queueSubscriptionReminder } = await import("../../src/server/renewal-reminders.js");

describe("dual-channel renewal reminders", () => {
  beforeEach(() => {
    runtime.whatsappConnected = true;
    query.mockClear();
    enqueueMessage.mockReset();
    enqueueMessage.mockImplementation(async (input) => ({
      ok: true,
      queueId: `queue-${input.channelType}`,
      scheduledFor: input.channelType === "email" ? "2026-08-12T01:00:00.000Z" : "2026-08-12T01:01:00.000Z"
    }));
  });

  it("queues WhatsApp and email independently when both are available", async () => {
    const result = await queueSubscriptionReminder({ tenantId: "tenant-1", subscriptionId: "subscription-1" });
    expect(result).toMatchObject({
      ok: true,
      partial: false,
      channels: ["whatsapp", "email"],
      queueIds: ["queue-whatsapp", "queue-email"]
    });
    expect(enqueueMessage).toHaveBeenCalledTimes(2);
    expect(enqueueMessage.mock.calls.map(([input]) => input.channelType)).toEqual(["whatsapp", "email"]);
  });

  it("uses email alone when WhatsApp is unavailable", async () => {
    runtime.whatsappConnected = false;
    const result = await queueSubscriptionReminder({ tenantId: "tenant-1", subscriptionId: "subscription-1" });
    expect(result).toMatchObject({
      ok: true,
      partial: true,
      channels: ["email"],
      skippedChannels: ["whatsapp"]
    });
    expect(enqueueMessage).toHaveBeenCalledTimes(1);
    expect(enqueueMessage.mock.calls[0][0].channelType).toBe("email");
  });
});
