import { describe, expect, it } from "vitest";
import {
  AI_CYCLE_MS,
  AI_MAX_PAID_CYCLES,
  aiUsageWarningLevel,
  buildAIEntitlementCycles,
  refillAIToPlanCap,
  remainingAITokens,
  resolveAIEntitlementCycle
} from "../../src/server/ai/entitlement-policy.js";

const paidPlans = [
  ["starter", 1_000_000, 4_000_000],
  ["professional", 3_000_000, 12_000_000],
  ["business", 5_000_000, 20_000_000]
] as const;

describe("AI token entitlement policy", () => {
  it.each(paidPlans)("grants %s exactly four seven-day refill-to-cap cycles", (planSlug, weekly, cap) => {
    const cycles = buildAIEntitlementCycles({
      planSlug, periodStart: "2026-08-13T16:30:00.000Z", periodEnd: "2026-09-13T16:30:00.000Z"
    });
    expect(cycles).toHaveLength(4);
    expect(cycles.reduce((sum, cycle) => sum + cycle.allowanceTokens, 0)).toBe(cap);
    for (const cycle of cycles) {
      expect(cycle.cycleNumber).toBeGreaterThanOrEqual(1);
      expect(cycle.cycleNumber).toBeLessThanOrEqual(AI_MAX_PAID_CYCLES);
      expect(cycle.allowanceTokens).toBe(weekly);
      expect(cycle.cycleEnd.getTime() - cycle.cycleStart.getTime()).toBe(AI_CYCLE_MS);
      expect(cycle.remainingTokens).toBeLessThanOrEqual(cycle.allowanceTokens);
    }
  });

  it.each([
    ["starter", [0, 300_000, 999_999, 1_000_000], 1_000_000],
    ["professional", [0, 1_000_000, 2_900_000, 3_000_000], 3_000_000],
    ["business", [0, 2_000_000, 4_900_000, 5_000_000], 5_000_000]
  ] as const)("refills %s to the plan cap without adding the prior balance", (plan, priorBalances, expected) => {
    for (const prior of priorBalances) {
      expect(refillAIToPlanCap(plan, prior)).toEqual({
        allowanceTokens: expected, usedTokens: 0, reservedTokens: 0, remainingTokens: expected
      });
    }
  });

  it("uses cycleStart <= now < cycleEnd at the exact millisecond boundary", () => {
    const input = { planSlug: "starter", periodStart: "2026-08-13T16:30:00.000Z", periodEnd: "2026-09-13T16:30:00.000Z" };
    expect(resolveAIEntitlementCycle({ ...input, now: "2026-08-20T16:29:59.999Z" }).cycle?.cycleNumber).toBe(1);
    expect(resolveAIEntitlementCycle({ ...input, now: "2026-08-20T16:30:00.000Z" }).cycle?.cycleNumber).toBe(2);
  });

  it.each([
    ["2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z", "2026-09-30T00:00:00.000Z"],
    ["2026-08-01T00:00:00.000Z", "2026-09-01T00:00:00.000Z", "2026-08-31T00:00:00.000Z"],
    ["2028-02-01T00:00:00.000Z", "2028-03-01T00:00:00.000Z", "2028-02-29T00:00:00.000Z"]
  ])("never creates cycle five for monthly period %s", (periodStart, periodEnd, now) => {
    const result = resolveAIEntitlementCycle({ planSlug: "professional", periodStart, periodEnd, now });
    expect(result.state).toBe("awaiting_subscription_renewal");
    expect(result.cycle?.cycleNumber).toBe(4);
  });

  it("keeps remaining cycle-four balance usable after day 28 without refilling", () => {
    const resolution = resolveAIEntitlementCycle({
      planSlug: "professional", periodStart: "2026-08-13T16:30:00.000Z",
      periodEnd: "2026-09-13T16:30:00.000Z", now: "2026-09-11T00:00:00.000Z"
    });
    expect(resolution.cycle?.cycleNumber).toBe(4);
    expect(remainingAITokens({ allowanceTokens: 3_000_000, usedTokens: 2_200_000, reservedTokens: 0 })).toBe(800_000);
  });

  it("starts renewal at cycle one and grants nothing for an inactive period", () => {
    const renewed = resolveAIEntitlementCycle({
      planSlug: "professional", periodStart: "2026-09-13T16:30:00.000Z",
      periodEnd: "2026-10-13T16:30:00.000Z", now: "2026-09-13T16:30:00.000Z"
    });
    expect(renewed.cycle?.cycleNumber).toBe(1);
    expect(renewed.cycle?.allowanceTokens).toBe(3_000_000);
    expect(resolveAIEntitlementCycle({
      planSlug: "professional", periodStart: "2026-09-13T16:30:00.000Z",
      periodEnd: "2026-10-13T16:30:00.000Z", now: "2026-09-13T16:30:00.000Z", subscriptionActive: false
    })).toEqual({ state: "inactive", cycle: null });
  });

  it("gives Free 100K once with no weekly reset", () => {
    const cycles = buildAIEntitlementCycles({ planSlug: "trial", periodStart: "2026-08-01T00:00:00Z", periodEnd: "2026-08-31T00:00:00Z" });
    expect(cycles).toHaveLength(1);
    expect(cycles[0].allowanceTokens).toBe(100_000);
    expect(resolveAIEntitlementCycle({ planSlug: "trial", periodStart: "2026-08-01", periodEnd: "2026-08-31", now: "2026-08-20" }).cycle?.cycleNumber).toBe(1);
  });

  it.each([[69,"normal"],[70,"notice"],[84,"notice"],[85,"warning"],[94,"warning"],[95,"critical"],[99,"critical"],[100,"exhausted"]])(
    "maps %i percent to %s UX state", (percent, state) => expect(aiUsageWarningLevel(percent)).toBe(state)
  );

  it("keeps seven-day cycles as absolute 168-hour UTC durations across DST zones", () => {
    const cycles = buildAIEntitlementCycles({
      planSlug: "starter", periodStart: "2026-03-07T05:00:00.000Z", periodEnd: "2026-04-07T04:00:00.000Z"
    });
    expect(cycles.every((cycle) => cycle.cycleEnd.getTime() - cycle.cycleStart.getTime() === 168 * 60 * 60 * 1000)).toBe(true);
  });
});
