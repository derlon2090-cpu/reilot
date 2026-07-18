import crypto from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createSallaState, normalizeSallaOrder, normalizeSallaSubscriptionRules, resolveSallaSubscriptionRule, verifySallaState, verifySallaWebhook } from "../../src/lib/salla.js";

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

  it("matches saved product types to their own subscription durations", () => {
    const payload = { data: { items: [{ name: "اشتراك Gemini Advanced", sku: "GEMINI-12M" }] } };
    const matched = resolveSallaSubscriptionRule(payload, [
      { id: "grok", name: "Grok", durationDays: 30 },
      { id: "gemini", name: "Gemini", durationDays: 365 }
    ], 14);
    expect(matched.rule?.name).toBe("Gemini");
    expect(matched.durationDays).toBe(365);
  });

  it("uses the fallback duration when no product rule matches", () => {
    const matched = resolveSallaSubscriptionRule({ data: { items: [{ name: "منتج آخر" }] } }, [
      { id: "grok", name: "Grok", durationDays: 90 }
    ], 21);
    expect(matched.rule).toBeNull();
    expect(matched.durationDays).toBe(21);
  });

  it("rejects duplicate or invalid subscription rules", () => {
    expect(() => normalizeSallaSubscriptionRules([
      { name: "Grok", durationDays: 30 },
      { name: "grok", durationDays: 90 }
    ])).toThrow();
    expect(() => normalizeSallaSubscriptionRules([{ name: "Gemini", durationDays: 0 }])).toThrow();
  });
});
