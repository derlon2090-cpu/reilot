import { describe, expect, it } from "vitest";
import { classifyPasswordStrength, securityLabel } from "../../src/server/security-score.js";

describe("dynamic security score helpers", () => {
  it("uses the documented score labels without calling an unchecked state complete", () => {
    expect(securityLabel(0)).toBe("خطر");
    expect(securityLabel(48)).toBe("ضعيف");
    expect(securityLabel(68)).toBe("يحتاج تحسين");
    expect(securityLabel(82)).toBe("جيد");
    expect(securityLabel(92)).toBe("قوي");
    expect(securityLabel(100)).toBe("ممتاز");
    expect(securityLabel(null)).toBe("غير مهيأة");
  });

  it("stores only a strength classification and rejects identity-based passwords", () => {
    expect(classifyPasswordStrength("short1", "owner@renvix.app")).toBe("weak");
    expect(classifyPasswordStrength("owner-2026-password", "owner@renvix.app")).not.toMatch(/strong/);
    expect(classifyPasswordStrength("Vz!4kP9#uL2@xQ7m", "owner@renvix.app")).toBe("very_strong");
  });
});
