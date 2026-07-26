import { describe, expect, it } from "vitest";
import { isSallaPaymentCompleted } from "../../src/lib/salla-payment.js";

describe("Salla payment completion", () => {
  it("accepts explicit successful payment states", () => {
    expect(isSallaPaymentCompleted({ payment_status: "paid" })).toBe(true);
    expect(isSallaPaymentCompleted({ payment: { status: { slug: "completed" } } })).toBe(true);
    expect(isSallaPaymentCompleted({}, { event: "order.payment.completed" })).toBe(true);
  });

  it("rejects unpaid and ambiguous order states", () => {
    expect(isSallaPaymentCompleted({ payment_status: "pending", status: "processing" })).toBe(false);
    expect(isSallaPaymentCompleted({ status: { slug: "completed" } })).toBe(false);
    expect(isSallaPaymentCompleted({}, { event: "order.updated" })).toBe(false);
    expect(isSallaPaymentCompleted({}, { event: "payment.updated" })).toBe(false);
  });
});
