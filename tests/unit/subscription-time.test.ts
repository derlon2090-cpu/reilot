import { describe, expect, it } from "vitest";
import { calculateRemainingTime, durationLabel, getRemainingDaysBadge } from "../../src/lib/subscription-time.js";
import { addSubscriptionDuration } from "../../src/lib/subscription-lifecycle.js";

describe("live subscription time", () => {
  it("calculates independent day/hour/minute components from server time", () => {
    expect(calculateRemainingTime({ startsAt: "2026-07-01T00:00:00Z", expiresAt: "2026-07-23T12:45:00Z", now: "2026-07-21T10:15:00Z" }))
      .toMatchObject({ status: "active", remainingDays: 2, remainingHours: 2, remainingMinutes: 30 });
  });

  it("marks future subscriptions pending without consuming progress", () => {
    expect(calculateRemainingTime({ startsAt: "2026-08-01T00:00:00Z", expiresAt: "2026-09-01T00:00:00Z", now: "2026-07-21T00:00:00Z" }))
      .toMatchObject({ status: "pending", progressPercentage: 0 });
  });

  it("never returns negative remaining values after expiry", () => {
    expect(calculateRemainingTime({ startsAt: "2026-01-01T00:00:00Z", expiresAt: "2026-02-01T00:00:00Z", now: "2026-07-21T00:00:00Z" }))
      .toEqual({ status: "expired", remainingMs: 0, remainingDays: 0, remainingHours: 0, remainingMinutes: 0, progressPercentage: 100 });
  });

  it("rejects an end date that is not after the start date", () => {
    expect(() => calculateRemainingTime({ startsAt: "2026-08-01", expiresAt: "2026-07-01" })).toThrow("INVALID_SUBSCRIPTION_DATES");
  });

  it("uses calendar months rather than fixed 30-day blocks", () => {
    expect(addSubscriptionDuration(new Date("2026-01-31T12:00:00Z"), 1, "month").toISOString()).toBe("2026-02-28T12:00:00.000Z");
  });

  it("supports leap-year calendar years", () => {
    expect(addSubscriptionDuration(new Date("2024-02-29T12:00:00Z"), 1, "year").toISOString()).toBe("2025-02-28T12:00:00.000Z");
  });

  it("calculates the day badge from the same server instant", () => {
    expect(getRemainingDaysBadge("2026-07-22T00:01:00Z", new Date("2026-07-21T00:02:00Z"))).toBe(1);
  });

  it("formats only configured duration units", () => {
    expect(durationLabel(1, "month")).toBe("شهر واحد");
    expect(durationLabel(12, "month")).toBe("12 أشهر");
    expect(durationLabel(0, "month")).toBeNull();
  });
});
