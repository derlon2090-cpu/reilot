import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, normalizeCustomerEmail } from "../../src/server/provisioning.js";
import { isStrongPassword } from "../../src/server/security.js";

describe("Salla account provisioning security", () => {
  it("normalizes valid customer emails and rejects invalid addresses", () => {
    expect(normalizeCustomerEmail("  Customer@Example.COM ")).toBe("customer@example.com");
    expect(normalizeCustomerEmail("missing-at-sign")).toBeNull();
    expect(normalizeCustomerEmail("")).toBeNull();
  });

  it("creates strong temporary passwords without predictable reuse", () => {
    const first = generateTemporaryPassword();
    const second = generateTemporaryPassword();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(20);
    expect(isStrongPassword(first)).toBe(true);
  });
});
