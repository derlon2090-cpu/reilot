import { expect, test } from "@playwright/test";
import { buildAIEntitlementCycles, remainingAITokens, resolveAIEntitlementCycle } from "../../src/server/ai/entitlement-policy.js";

test("Professional lifecycle has four refills, no fifth cycle, and renewal restarts at one", async () => {
  const oldPeriod = { planSlug: "professional", periodStart: "2026-08-13T16:30:00.000Z", periodEnd: "2026-09-13T16:30:00.000Z" };
  const cycles = buildAIEntitlementCycles(oldPeriod);
  expect(cycles).toHaveLength(4);
  expect(remainingAITokens({ allowanceTokens: 3_000_000, usedTokens: 1_000_000 })).toBe(2_000_000);
  expect(resolveAIEntitlementCycle({ ...oldPeriod, now: cycles[1].cycleStart }).cycle?.cycleNumber).toBe(2);
  expect(resolveAIEntitlementCycle({ ...oldPeriod, now: cycles[2].cycleStart }).cycle?.cycleNumber).toBe(3);
  expect(resolveAIEntitlementCycle({ ...oldPeriod, now: cycles[3].cycleStart }).cycle?.cycleNumber).toBe(4);
  const afterDay28 = resolveAIEntitlementCycle({ ...oldPeriod, now: "2026-09-11T00:00:00.000Z" });
  expect(afterDay28.state).toBe("awaiting_subscription_renewal");
  expect(afterDay28.cycle?.cycleNumber).toBe(4);
  const renewal = resolveAIEntitlementCycle({
    planSlug: "professional", periodStart: "2026-09-13T16:30:00.000Z",
    periodEnd: "2026-10-13T16:30:00.000Z", now: "2026-09-13T16:30:00.000Z"
  });
  expect(renewal.cycle).toMatchObject({ cycleNumber: 1, allowanceTokens: 3_000_000, usedTokens: 0, remainingTokens: 3_000_000 });
});
