import crypto from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createSallaState, normalizeSallaOrder, verifySallaState, verifySallaWebhook } from "../../src/lib/salla.js";

describe("Salla integration helpers", () => {
  beforeEach(() => {
    process.env.SALLA_OAUTH_STATE_SECRET = "test-state-secret-with-enough-entropy";
    process.env.SALLA_WEBHOOK_SECRET = "test-webhook-secret";
  });

  it("signs and validates OAuth state", () => {
    const state = createSallaState({ tenantId: "tenant-1", userId: "user-1" });
    expect(verifySallaState(state)).toMatchObject({ tenantId: "tenant-1", userId: "user-1" });
    expect(verifySallaState(`${state}x`)).toBeNull();
  });

  it("accepts only a matching webhook HMAC", () => {
    const body = JSON.stringify({ event: "order.created", merchant: 42 });
    const signature = crypto.createHmac("sha256", process.env.SALLA_WEBHOOK_SECRET).update(body).digest("hex");
    expect(verifySallaWebhook(body, signature)).toBe(true);
    expect(verifySallaWebhook(body, "bad-signature")).toBe(false);
  });

  it("normalizes a real order payload into a tenant subscription", () => {
    const order = normalizeSallaOrder({
      data: {
        id: 123,
        reference_id: "ORD-123",
        created_at: "2026-07-17T12:00:00Z",
        customer: { name: "Test Customer", mobile: "+966 55 111 2233", email: "buyer@example.com" },
        items: [{ name: "Professional Subscription", sku: "PRO" }],
        amounts: { total: { amount: 199 } }
      }
    }, 30);
    expect(order).toMatchObject({
      externalOrderId: "123",
      orderNumber: "ORD-123",
      phone: "966551112233",
      planName: "PRO",
      price: 199
    });
    expect(order.endDate).toBe("2026-08-16");
  });
});
