import { describe, expect, it } from "vitest";
import { buildWeeklySecurityTrend, calculateWeightedScore, classifyPasswordStrength, decayedWeight, riskLabel, securityLabel } from "../../src/server/security-score.js";

describe("dynamic security score helpers", () => {
  it("uses the documented score labels without calling an unchecked state complete", () => {
    expect(securityLabel(0)).toBe("ضعيفة جدًا");
    expect(securityLabel(48)).toBe("ضعيفة");
    expect(securityLabel(68)).toBe("تحتاج تحسين");
    expect(securityLabel(82)).toBe("جيدة");
    expect(securityLabel(92)).toBe("قوية");
    expect(securityLabel(100)).toBe("ممتازة");
    expect(securityLabel(null)).toBe("غير مهيأ");
  });

  it("stores only a strength classification and rejects identity-based passwords", () => {
    expect(classifyPasswordStrength("short1", "owner@renvix.app")).toBe("weak");
    expect(classifyPasswordStrength("owner-2026-password", "owner@renvix.app")).not.toMatch(/strong/);
    expect(classifyPasswordStrength("Vz!4kP9#uL2@xQ7m", "owner@renvix.app")).toBe("very_strong");
  });

  it("keeps protection and risk labels separate", () => {
    expect(riskLabel(0)).toBe("منخفض");
    expect(riskLabel(41)).toBe("متوسط");
    expect(riskLabel(85)).toBe("حرج");
  });

  it("decays security risk over time", () => {
    expect(decayedWeight(20, 0, 6)).toBe(20);
    expect(decayedWeight(20, 6, 6)).toBeCloseTo(10);
    expect(decayedWeight(20, 12, 6)).toBeCloseTo(5);
  });

  it("ignores unavailable metrics and reports real coverage", () => {
    expect(calculateWeightedScore([{ score: 80, weight: 30 }, { score: null, weight: 20 }])).toEqual({ score: 80, coverage: 60 });
    expect(calculateWeightedScore([{ score: null, weight: 100 }])).toEqual({ score: null, coverage: 0 });
  });

  it("builds the weekly chart only from stored score snapshots and the current calculation", () => {
    expect(buildWeeklySecurityTrend([
      { day: "2026-07-28T00:00:00.000Z", score: 81 },
      { day: "2026-07-29T00:00:00.000Z", score: 86 }
    ], 92, "2026-07-31T10:00:00.000Z")).toEqual([
      { date: "2026-07-28", score: 81 },
      { date: "2026-07-29", score: 86 },
      { date: "2026-07-31", score: 92 }
    ]);
  });

  it("keeps at most seven real daily score points", () => {
    const rows = Array.from({ length: 9 }, (_, index) => ({ day: `2026-07-${String(index + 20).padStart(2, "0")}T00:00:00.000Z`, score: 70 + index }));
    expect(buildWeeklySecurityTrend(rows, null)).toHaveLength(7);
    expect(buildWeeklySecurityTrend(rows, null)[0]).toEqual({ date: "2026-07-22", score: 72 });
  });
});
