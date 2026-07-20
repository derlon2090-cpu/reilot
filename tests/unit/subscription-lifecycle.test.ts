import { describe, expect, it } from "vitest";
import {
  addSubscriptionDuration, findProductPlanMapping, normalizeSallaSubscriptionOrder,
  normalizeSubscriptionEmail, normalizeSubscriptionPhone, orderMeetsStartTrigger,
  reminderIdempotencyKey, renderRenewalTemplate, renewalBaseDate,
  shouldShowSentBadge, subscriptionDisplayState, validateRenewalTemplate
} from "../../src/lib/subscription-lifecycle.js";

describe("subscription lifecycle", () => {
  it("adds calendar months and years without converting them to fixed days", () => {
    expect(addSubscriptionDuration("2026-01-31T00:00:00Z", 1, "month").toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addSubscriptionDuration("2024-02-29T00:00:00Z", 1, "year").toISOString().slice(0, 10)).toBe("2025-02-28");
  });
  it("normalizes Saudi numbers and rejects invalid phone values", () => {
    expect(normalizeSubscriptionPhone("050 123 4567")).toBe("+966501234567");
    expect(normalizeSubscriptionPhone("123")).toBeNull();
  });
  it("normalizes valid emails and rejects invalid values", () => {
    expect(normalizeSubscriptionEmail(" USER@Example.COM ")).toBe("user@example.com");
    expect(normalizeSubscriptionEmail("invalid")).toBeNull();
  });
  it("extracts contact and every Salla order item", () => {
    const order = normalizeSallaSubscriptionOrder({ data: { id: 9, reference_id: 22, payment: { status: "paid" }, customer: { id: 4, name: "محمد", mobile: "0501234567", email: "M@EXAMPLE.COM" }, items: [{ id: 1, product: { id: 11 }, variant_id: 33, sku: "A" }, { id: 2, product_id: 12, sku: "B" }] } });
    expect(order.customer).toMatchObject({ externalId: "4", phone: "+966501234567", email: "m@example.com" });
    expect(order.items).toHaveLength(2);
  });
  it("matches variant then product then SKU and never the name", () => {
    const mappings = [{ id: "sku", sallaProductSku: "X" }, { id: "product", sallaProductId: "10" }, { id: "variant", sallaVariantId: "20" }];
    expect(findProductPlanMapping({ variantId: "20", productId: "10", sku: "X", name: "ignored" }, mappings)?.id).toBe("variant");
    expect(findProductPlanMapping({ productId: "10", sku: "X" }, mappings)?.id).toBe("product");
    expect(findProductPlanMapping({ productId: "99", sku: "X" }, mappings)?.id).toBe("sku");
    expect(findProductPlanMapping({ name: "variant" }, mappings)).toBeNull();
  });
  it("does not activate unpaid orders", () => {
    expect(orderMeetsStartTrigger({ paymentStatus: "pending" }, { startTrigger: "payment_completed" })).toBe(false);
    expect(orderMeetsStartTrigger({ paymentStatus: "paid" }, { startTrigger: "payment_completed" })).toBe(true);
  });
  it("renews active subscriptions from the current expiry", () => {
    expect(renewalBaseDate({ expiresAt: "2026-08-30", activatedAt: "2026-08-20", now: "2026-07-20" }).toISOString().slice(0, 10)).toBe("2026-08-30");
    expect(renewalBaseDate({ expiresAt: "2026-07-01", activatedAt: "2026-07-20", now: "2026-07-20" }).toISOString().slice(0, 10)).toBe("2026-07-20");
  });
  it("validates and renders only supported template variables", () => {
    expect(validateRenewalTemplate("مرحبًا {{customer_name}} {{unknown}}")).toEqual({ ok: false, unknown: ["unknown"] });
    expect(renderRenewalTemplate("مرحبًا {{customer_name}}", { customer_name: "محمد" })).toBe("مرحبًا محمد");
  });
  it("creates stable reminder keys", () => {
    expect(reminderIdempotencyKey({ subscriptionId: "s1", type: "before_7_days", scheduledFor: "2026-08-20", channel: "whatsapp" })).toContain("subscription:s1:before_7_days:");
  });
  it("shows the sent badge only for 72 hours", () => {
    const now = new Date("2026-07-20T12:00:00Z");
    expect(shouldShowSentBadge("2026-07-17T12:00:01Z", now)).toBe(true);
    expect(shouldShowSentBadge("2026-07-17T12:00:00Z", now)).toBe(false);
  });
  it("derives expiring soon for display without mutating status", () => {
    expect(subscriptionDisplayState("active", "2026-07-25", "2026-07-20", 7)).toBe("expiring_soon");
    expect(subscriptionDisplayState("paused", "2026-07-25", "2026-07-20", 7)).toBe("paused");
  });
  it("keeps multiple order items independent and preserves quantity", () => {
    const order = normalizeSallaSubscriptionOrder({ data: { id: 1, items: [{ id: 10, product_id: 20, quantity: 3 }, { id: 11, product_id: 21, quantity: 1 }] } });
    expect(order.items.map((item) => [item.orderItemId, item.quantity])).toEqual([["10", 3], ["11", 1]]);
  });
  it("requires manual activation when the mapping says so", () => {
    expect(orderMeetsStartTrigger({ paymentStatus: "paid", orderStatus: "completed" }, { startTrigger: "manual_activation" })).toBe(false);
  });
  it("supports completed-order activation separately from payment", () => {
    expect(orderMeetsStartTrigger({ paymentStatus: "pending", orderStatus: "completed" }, { startTrigger: "order_completed" })).toBe(true);
  });
  it("supports an explicit provider order status", () => {
    expect(orderMeetsStartTrigger({ orderStatus: "ready" }, { startTrigger: "specific_order_status", specificOrderStatus: "ready" })).toBe(true);
    expect(orderMeetsStartTrigger({ orderStatus: "new" }, { startTrigger: "specific_order_status", specificOrderStatus: "ready" })).toBe(false);
  });
  it("can continue expired renewals from the old expiry when configured", () => {
    expect(renewalBaseDate({ expiresAt: "2026-07-01", activatedAt: "2026-07-20", now: "2026-07-20", expiredPolicy: "continue_from_old_expiry" }).toISOString().slice(0, 10)).toBe("2026-07-01");
  });
  it("rejects unsupported duration units", () => {
    expect(() => addSubscriptionDuration("2026-07-20", 1, "week")).toThrow("invalid_duration_unit");
  });
  it("never matches an inactive product mapping", () => {
    expect(findProductPlanMapping({ productId: "10" }, [{ id: "inactive", sallaProductId: "10", isActive: false }])).toBeNull();
  });
  it("keeps subscriptions contactless when both contact values are missing", () => {
    const order = normalizeSallaSubscriptionOrder({ data: { id: 1, customer: { name: "عميل" }, items: [] } });
    expect(order.customer).toMatchObject({ phone: null, email: null });
  });
  it("uses channel in the reminder idempotency key", () => {
    const args = { subscriptionId: "s1", type: "on_expiry", scheduledFor: "2026-08-20" };
    expect(reminderIdempotencyKey({ ...args, channel: "whatsapp" })).not.toBe(reminderIdempotencyKey({ ...args, channel: "email" }));
  });
});
