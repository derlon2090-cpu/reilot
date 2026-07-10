import { describe, expect, it } from "vitest";
import { canAddCustomer, canCreateWhatsappChannel, canSendPlanMessage, createMonthlyUsage, recordMessageUsage } from "../../src/lib/quota.js";

describe("plan quota", () => {
  it("enforces requested plan limits", () => {
    expect(canCreateWhatsappChannel("trial", 0)).toBe(true);
    expect(canCreateWhatsappChannel("trial", 1)).toBe(false);
    expect(canAddCustomer("business", 4999)).toBe(true);
    expect(canAddCustomer("business", 5000)).toBe(false);
    expect(canSendPlanMessage("starter", 499)).toBe(true);
    expect(canSendPlanMessage("starter", 500)).toBe(false);
  });

  it("increments usage only after successful sends and resets a new month", () => {
    expect(recordMessageUsage({ usedMessages: 10 }, { ok: false }).usedMessages).toBe(10);
    expect(recordMessageUsage({ usedMessages: 10 }, { ok: true }).usedMessages).toBe(11);
    expect(createMonthlyUsage("tenant-a", "trial", new Date("2026-07-10T00:00:00.000Z"))).toMatchObject({ month: 7, year: 2026, usedMessages: 0, messageLimit: 50 });
  });
});
