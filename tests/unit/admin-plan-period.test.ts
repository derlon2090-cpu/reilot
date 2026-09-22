import { describe, expect, it } from "vitest";
import { defaultAdminPlanPeriod, parseAdminPlanPeriod, riyadhToday } from "../../src/shared/admin-plan-period.js";

describe("admin plan dates in Riyadh", () => {
  it("shows the local day and defaults to a one-month period", () => {
    const now = new Date("2026-09-21T22:30:00.000Z");
    expect(riyadhToday(now)).toBe("2026-09-22");
    expect(defaultAdminPlanPeriod(now)).toEqual({ startDate: "2026-09-22", endDate: "2026-10-21" });
    expect(defaultAdminPlanPeriod(now, "yearly")).toEqual({ startDate: "2026-09-22", endDate: "2027-09-21" });
  });

  it("keeps the selected ending day active until the next Riyadh midnight", () => {
    const result = parseAdminPlanPeriod("2026-09-22", "2026-10-22", new Date("2026-09-22T04:00:00.000Z"));
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("Expected a valid plan period");
    expect(result.periodStart.toISOString()).toBe("2026-09-21T21:00:00.000Z");
    expect(result.periodEnd.toISOString()).toBe("2026-10-22T21:00:00.000Z");
  });

  it("rejects impossible, future-start, and already-ended periods", () => {
    const now = new Date("2026-09-22T04:00:00.000Z");
    expect(parseAdminPlanPeriod("2026-02-30", "2026-10-01", now)).toMatchObject({ reason: "invalid_plan_period" });
    expect(parseAdminPlanPeriod("2026-09-23", "2026-10-01", now)).toMatchObject({ reason: "plan_period_start_future" });
    expect(parseAdminPlanPeriod("2026-09-01", "2026-09-21", now)).toMatchObject({ reason: "plan_period_not_active" });
  });
});
