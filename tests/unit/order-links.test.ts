import { describe, expect, it } from "vitest";
import {
  normalizeAdditionalNotes,
  normalizeOrderLinkColor,
  normalizeOrderLinkStyle,
  normalizeVisibleFields,
  remainingSubscriptionDays,
  maskPublicPhone,
  validateOrderSlug
} from "../../src/lib/orderLinks.js";
import { publicOrderPayload } from "../../src/server/order-links.js";

describe("order information links", () => {
  it("accepts only unique-safe public slug syntax and blocks reserved routes", () => {
    expect(validateOrderSlug("mtjr-smart")).toEqual({ ok: true, slug: "mtjr-smart" });
    expect(validateOrderSlug("My Store 2026")).toEqual({ ok: true, slug: "my-store-2026" });
    expect(validateOrderSlug("dashboard")).toEqual({ ok: false, reason: "reserved_slug" });
    expect(validateOrderSlug("متجري")).toEqual({ ok: false, reason: "invalid_slug" });
  });

  it("normalizes template style, color, notes, and visible fields", () => {
    expect(normalizeOrderLinkStyle("premium")).toBe("premium");
    expect(normalizeOrderLinkStyle("unknown")).toBe("classic");
    expect(normalizeOrderLinkColor("#06b6d4")).toBe("#06B6D4");
    expect(normalizeOrderLinkColor("#ffffff")).toBe("#2563EB");
    expect(normalizeAdditionalNotes([" first ", "", "x".repeat(400)])).toEqual(["first", "x".repeat(300)]);
    expect(normalizeVisibleFields({ customerName: false, phoneNumber: true })).toMatchObject({
      customerName: false,
      phoneNumber: true,
      planName: true
    });
  });

  it("calculates remaining time without NaN and masks public phone numbers", () => {
    expect(remainingSubscriptionDays("2026-07-20", new Date("2026-07-16T10:00:00Z"))).toEqual({ days: 5, state: "remaining" });
    expect(remainingSubscriptionDays("2026-07-14", new Date("2026-07-16T10:00:00Z"))).toMatchObject({ state: "expired" });
    expect(maskPublicPhone("966551710581")).toBe("+966 55 *** 0581");
    expect(maskPublicPhone("123")).toBe("");
  });

  it("returns only the approved public order fields", () => {
    const payload = publicOrderPayload({
      storeName: "متجر التقنية",
      storeSlug: "tech-store",
      logoUrl: null,
      supportPhone: "966500000000",
      orderNumber: "54981",
      customerName: "محمد",
      maskedPhone: "+966 55 *** 0581",
      planName: "Pro",
      serviceName: "اشتراك",
      subscriptionStatus: "active",
      startDate: "2026-07-01",
      endDate: "2026-07-20",
      templateName: "الأساسي",
      templateStyle: "classic",
      themeColor: "#2563EB",
      headerText: "مرحبًا",
      footerText: "شكرًا",
      additionalNotes: ["احتفظ بالرابط"],
      visibleFields: { phoneNumber: false }
    });

    expect(payload.order.maskedPhone).toBeNull();
    expect(payload).not.toHaveProperty("tenantId");
    expect(payload).not.toHaveProperty("customerId");
    expect(payload).not.toHaveProperty("subscriptionId");
    expect(payload.order).not.toHaveProperty("email");
  });
});
