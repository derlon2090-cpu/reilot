import { describe, expect, it } from "vitest";
import { matchingTotpCounter, normalizeTotpCode, verifyTotp } from "../../src/server/mfa.js";

const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP verification", () => {
  it("matches the RFC 6238 SHA-1 vector", () => {
    expect(verifyTotp(RFC_SECRET, "287082", 59_000)).toBe(true);
  });

  it("accepts Arabic and Persian digits without changing the secret", () => {
    expect(normalizeTotpCode("٢٨٧٠٨٢")).toBe("287082");
    expect(normalizeTotpCode("۲۸۷۰۸۲")).toBe("287082");
    expect(verifyTotp(RFC_SECRET, "٢٨٧٠٨٢", 59_000)).toBe(true);
  });

  it("tolerates up to two 30-second clock steps", () => {
    expect(matchingTotpCounter(RFC_SECRET, "287082", 119_000)).toBe(1);
    expect(matchingTotpCounter(RFC_SECRET, "287082", 149_000)).toBeNull();
  });
});
