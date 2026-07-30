import { describe, expect, it } from "vitest";
import {
  canScheduleSubscriptionReminder,
  isSubscriptionReminderEnabled
} from "../../src/lib/subscription-lifecycle.js";

describe("real reminder activation behavior", () => {
  it.each([
    ["defaults to enabled when the value is undefined", undefined, true],
    ["defaults to enabled for a null record", null, true],
    ["defaults to enabled for an existing legacy record", {}, true],
    ["accepts the database enabled flag", { reminder_enabled: true }, true],
    ["rejects the database disabled flag", { reminder_enabled: false }, false],
    ["accepts the API enabled flag", { reminderEnabled: true }, true],
    ["rejects the API disabled flag", { reminderEnabled: false }, false],
    ["accepts matching enabled flags", { reminder_enabled: true, reminderEnabled: true }, true],
    ["fails closed when the database flag is disabled", { reminder_enabled: false, reminderEnabled: true }, false],
    ["fails closed when the API flag is disabled", { reminder_enabled: true, reminderEnabled: false }, false]
  ])("%s", (_label, subscription, expected) => {
    expect(isSubscriptionReminderEnabled(subscription)).toBe(expected);
  });

  it.each([
    ["schedules an active automatic database record", { status: "active", reminder_mode: "automatic", reminder_enabled: true }, true, true],
    ["schedules an active automatic API record", { status: "active", reminderMode: "automatic", reminderEnabled: true }, true, true],
    ["does not schedule when the caller disables scheduling", { status: "active", reminder_mode: "automatic", reminder_enabled: true }, false, false],
    ["does not schedule a database-disabled reminder", { status: "active", reminder_mode: "automatic", reminder_enabled: false }, true, false],
    ["does not schedule an API-disabled reminder", { status: "active", reminderMode: "automatic", reminderEnabled: false }, true, false],
    ["does not schedule manual mode", { status: "active", reminder_mode: "manual", reminder_enabled: true }, true, false],
    ["does not schedule a paused subscription", { status: "paused", reminder_mode: "automatic", reminder_enabled: true }, true, false],
    ["does not schedule an expired subscription", { status: "expired", reminder_mode: "automatic", reminder_enabled: true }, true, false],
    ["does not schedule pending activation", { status: "pending_activation", reminder_mode: "automatic", reminder_enabled: true }, true, false],
    ["does not schedule a record without an active status", { reminder_mode: "automatic", reminder_enabled: true }, true, false]
  ])("%s", (_label, subscription, schedulingEnabled, expected) => {
    expect(canScheduleSubscriptionReminder(subscription, schedulingEnabled)).toBe(expected);
  });
});
