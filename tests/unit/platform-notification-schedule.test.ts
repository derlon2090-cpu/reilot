import { describe, expect, it } from "vitest";
import { platformNotificationScheduleDefaults } from "../../src/lib/platform-notification-schedule.js";

describe("platform notification schedule defaults", () => {
  it("starts from the local current day and selects the next five-minute slot", () => {
    const result = platformNotificationScheduleDefaults(new Date(2026, 9, 3, 13, 23, 42));
    expect(result).toEqual({
      minimum: "2026-10-03T13:23",
      scheduledAt: "2026-10-03T13:30"
    });
  });

  it("rolls safely into the following day near midnight", () => {
    const result = platformNotificationScheduleDefaults(new Date(2026, 9, 3, 23, 58, 0));
    expect(result.minimum).toBe("2026-10-03T23:58");
    expect(result.scheduledAt).toBe("2026-10-04T00:05");
  });

  it("rejects invalid clock values", () => {
    expect(() => platformNotificationScheduleDefaults(new Date(Number.NaN))).toThrow(TypeError);
  });
});
