import { describe, expect, it } from "vitest";
import {
  cleanSupportText,
  normalizePublicSupportRequest,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  SUPPORT_TYPES
} from "../../src/server/support-tickets.js";

describe("support tickets domain", () => {
  it("contains the supported production statuses, priorities and ticket types", () => {
    expect(SUPPORT_TYPES).toEqual(expect.arrayContaining(["INQUIRY", "TECHNICAL_ISSUE", "COMPLAINT", "BILLING"]));
    expect(SUPPORT_STATUSES).toEqual(expect.arrayContaining(["NEW", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "REOPENED"]));
    expect(SUPPORT_PRIORITIES).toEqual(["LOW", "NORMAL", "HIGH", "URGENT"]);
  });

  it("removes HTML and normalizes line endings before persistence", () => {
    expect(cleanSupportText("  مرحبًا <script>alert(1)</script>\r\nفريق الدعم  ", {
      min: 5,
      max: 100,
      label: "النص"
    })).toBe("مرحبًا alert(1)\nفريق الدعم");
  });

  it("rejects values outside the accepted length", () => {
    expect(() => cleanSupportText("قصير", {
      min: 10,
      max: 20,
      label: "تفاصيل الرسالة"
    })).toThrow("تفاصيل الرسالة يجب أن يكون بين 10 و20 حرفًا.");
  });

  it("normalizes a valid public support request", () => {
    expect(normalizePublicSupportRequest({
      name: "  وليد علي ",
      email: " WALEED@EXAMPLE.COM ",
      type: "COMPLAINT",
      subject: " مشكلة في ربط القناة ",
      body: " أحتاج إلى مساعدة في إكمال عملية الربط. "
    })).toEqual({
      name: "وليد علي",
      email: "waleed@example.com",
      type: "COMPLAINT",
      subject: "مشكلة في ربط القناة",
      body: "أحتاج إلى مساعدة في إكمال عملية الربط."
    });
  });

  it("rejects invalid public email and unsafe short content", () => {
    expect(() => normalizePublicSupportRequest({
      name: "وليد علي",
      email: "invalid-email",
      type: "INQUIRY",
      subject: "طلب دعم واضح",
      body: "تفاصيل كافية للطلب المرسل."
    })).toThrow("صيغة البريد الإلكتروني غير صحيحة.");
    expect(() => normalizePublicSupportRequest({
      name: "وليد علي",
      email: "waleed@example.com",
      type: "INQUIRY",
      subject: "قصير",
      body: "قصير"
    })).toThrow();
  });
});
