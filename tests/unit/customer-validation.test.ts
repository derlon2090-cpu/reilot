import { describe, expect, it } from "vitest";
import {
  OPTIONAL_EMAIL_ERROR,
  hasCustomerIdentity,
  normalizeOptionalEmail,
  validateOptionalEmail
} from "../../src/lib/customerValidation.js";

describe("customer validation", () => {
  it.each([undefined, null, "", "   "])("accepts an empty optional email", (value) => {
    expect(validateOptionalEmail(value)).toMatchObject({ ok: true, email: null, value: null });
    expect(normalizeOptionalEmail(value)).toBeNull();
  });

  it("normalizes and accepts a valid email", () => {
    expect(validateOptionalEmail("  Buyer@Example.COM ")).toMatchObject({
      ok: true,
      email: "buyer@example.com",
      value: "buyer@example.com"
    });
  });

  it("rejects only a non-empty invalid email", () => {
    expect(validateOptionalEmail("buyer-at-example")).toEqual({
      ok: false,
      email: null,
      value: null,
      reason: "invalid_email",
      message: OPTIONAL_EMAIL_ERROR
    });
  });

  it("allows a customer identity by name or phone", () => {
    expect(hasCustomerIdentity({ name: "أحمد", phone: "" })).toBe(true);
    expect(hasCustomerIdentity({ name: "", phone: "966551234567" })).toBe(true);
    expect(hasCustomerIdentity({ name: "", phone: "" })).toBe(false);
  });
});
