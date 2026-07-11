import { describe, expect, it } from "vitest";
import { evaluateMessageQuality, warmupDailyLimit, whatsappHealthScore } from "../../src/lib/messageSafety.js";
import { renewedEndDate } from "../../src/lib/renewal.js";
import { parseSpreadsheetText, previewSubscriptionImport } from "../../src/lib/subscriptionImport.js";

describe("product safety features", () => {
  it("applies the requested WhatsApp warm-up limits", () => {
    expect([1, 2, 3, 4, 5, 7, 14].map(warmupDailyLimit)).toEqual([10, 15, 20, 25, 35, 60, 200]);
  });

  it("flags unsafe marketing copy and missing opt-out text", () => {
    const result = evaluateMessageQuality("عرض مجاني عاجل https://a.test https://b.test https://c.test");
    expect(result.score).toBe("risk");
    expect(result.risk).toBeGreaterThanOrEqual(50);
    expect(result.warnings).toContain("Unsubscribe option is missing");
  });

  it("raises health risk when the channel is disconnected", () => {
    expect(whatsappHealthScore({ disconnected: true, failureRate: 15, unsubscribeCount: 2 }).status).not.toBe("excellent");
  });
});

describe("subscription productivity features", () => {
  it("previews Arabic tab-separated Excel rows and reports duplicates", () => {
    const text = [
      "رقم الطلب\tاسم العميل\tرقم الجوال\tالخدمة\tتاريخ البداية\tتاريخ الانتهاء\tرابط التجديد",
      "A-1\tأحمد\t966501234567\tPro\t2026-01-01\t2026-12-31\thttps://renew.test/a-1",
      "A-1\tسارة\t966501234567\tBusiness\t2026-02-01\t2026-01-01\tbad-url"
    ].join("\n");
    const result = previewSubscriptionImport(parseSpreadsheetText(text));
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.invalidRows[0].errors).toEqual(expect.arrayContaining(["duplicate_order_number", "duplicate_phone", "end_before_start", "invalid_renewal_url"]));
  });

  it("clamps quick renewals to the last valid day of the target month", () => {
    expect(renewedEndDate("2025-01-31", "month")).toBe("2025-02-28");
    expect(renewedEndDate("2024-01-31", "month")).toBe("2024-02-29");
    expect(renewedEndDate("2025-05-31", "six_months")).toBe("2025-11-30");
    expect(renewedEndDate("2025-05-15", "custom", "2027-02-10")).toBe("2027-02-10");
  });
});
