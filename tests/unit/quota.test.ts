import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateMessageUsage } from "../../src/lib/billing/message-quota.js";

function period(overrides = {}) {
  return {
    id: "period-1",
    message_limit: 50,
    used_messages: 0,
    reserved_messages: 0,
    whatsapp_used: 0,
    email_used: 0,
    sms_used: 0,
    ...overrides
  };
}

describe("database-backed message quota", () => {
  it("shows a new plan period as 0 / 50 without fabricated usage", () => {
    expect(calculateMessageUsage(period())).toMatchObject({
      limit: 50,
      used: 0,
      reserved: 0,
      remaining: 50,
      percentage: 0,
      isLimitReached: false
    });
  });

  it("counts reservations and blocks the next message at 50 / 50", () => {
    expect(calculateMessageUsage(period({ used_messages: 49 }))).toMatchObject({ remaining: 1, isLimitReached: false });
    expect(calculateMessageUsage(period({ used_messages: 49, reserved_messages: 1 }))).toMatchObject({ remaining: 0, percentage: 100, isLimitReached: true });
  });

  it("keeps channel totals and supports a future unlimited plan", () => {
    expect(calculateMessageUsage(period({ used_messages: 12, reserved_messages: 3, whatsapp_used: 8, email_used: 4 }))).toMatchObject({
      consumed: 15,
      remaining: 35,
      percentage: 30,
      byChannel: { whatsapp: 8, email: 4, sms: 0 }
    });
    expect(calculateMessageUsage(period({ message_limit: -1, used_messages: 900 }))).toMatchObject({ unlimited: true, remaining: -1, percentage: null, isLimitReached: false });
  });

  it("serializes reservations and consumes or releases them through the secure queue", () => {
    const quotaSource = readFileSync("src/lib/billing/message-quota.js", "utf8");
    const queueSource = readFileSync("src/server/message-queue.js", "utf8");
    const workerSource = readFileSync("src/server/cron-runner.js", "utf8");
    expect(quotaSource).toContain("pg_advisory_xact_lock");
    expect(queueSource).toContain("reserveMessageQuotaWithClient");
    expect(workerSource).toContain("consumeReservedQuotaWithClient");
    expect(workerSource).toContain("releaseReservedQuotaWithClient");
  });
});
