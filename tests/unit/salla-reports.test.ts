import { describe, expect, it } from "vitest";
import { __sallaReportInternals } from "../../src/server/salla-reports.js";

describe("Salla reports attribution and real payload normalization", () => {
  it("extracts only values available in the Salla cart payload", () => {
    const snapshot = __sallaReportInternals.cartSnapshot({
      event: "abandoned.cart",
      created_at: "2026-08-11T12:00:00Z",
      data: {
        cart: {
          id: 42,
          total: { amount: 315, currency: "SAR" },
          customer: { name: "أحمد", email: "ahmed@example.com" },
          items: [{ name: "منتج فعلي", quantity: 2, price: { amount: 120 } }]
        }
      }
    });
    expect(snapshot).toMatchObject({ customerName: "أحمد", customerEmail: "ahmed@example.com", total: 315, currency: "SAR" });
    expect(snapshot.items).toEqual([{ name: "منتج فعلي", quantity: 2, price: 120, image: "" }]);
  });

  it("attributes recovery only when a matched order and a successful delivery exist", () => {
    expect(__sallaReportInternals.cartState({ status: "converted", convertedOrderId: "order-1" }, [{ status: "delivered" }])).toBe("recovered");
    expect(__sallaReportInternals.cartState({ status: "converted", convertedOrderId: "order-1" }, [])).toBe("purchased_later");
    expect(__sallaReportInternals.cartState({ status: "active", convertedOrderId: null }, [{ status: "queued" }])).toBe("recovering");
  });

  it("rejects an inverted custom range instead of returning fabricated data", () => {
    expect(() => __sallaReportInternals.dateBounds({ period: "custom", dateFrom: "2026-08-12", dateTo: "2026-08-11" })).toThrow("الفترة المحددة غير صالحة");
  });
});
