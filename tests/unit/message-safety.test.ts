import { describe, expect, it } from "vitest";
import { canSendSafely, evaluateMessageQuality, isQuietHour } from "../../src/lib/messageSafety.js";

describe("WhatsApp safety", () => {
  it.each([
    ["quiet_hours", { now: new Date("2026-07-10T22:00:00"), quietHoursStart: "21:00", quietHoursEnd: "09:00" }],
    ["hourly_limit", { hourlySent: 2, hourlyLimit: 2, now: new Date("2026-07-10T12:00:00") }],
    ["daily_limit", { dailySent: 5, dailyLimit: 5, now: new Date("2026-07-10T12:00:00") }],
    ["duplicate_message", { duplicateWithinWindow: true, now: new Date("2026-07-10T12:00:00") }],
    ["unsubscribed", { unsubscribed: true, now: new Date("2026-07-10T12:00:00") }],
    ["channel_disconnected", { channelStatus: "disconnected", now: new Date("2026-07-10T12:00:00") }],
    ["high_risk_score", { riskScore: 71, now: new Date("2026-07-10T12:00:00") }]
  ])("blocks sending with reason %s", (reason, context) => {
    expect(canSendSafely(context)).toEqual({ ok: false, reason });
  });

  it("detects overnight quiet hours at both sides of midnight", () => {
    expect(isQuietHour(new Date("2026-07-10T22:00:00"))).toBe(true);
    expect(isQuietHour(new Date("2026-07-10T08:59:00"))).toBe(true);
    expect(isQuietHour(new Date("2026-07-10T12:00:00"))).toBe(false);
  });

  it("scores message quality and warns on risky copy", () => {
    const good = evaluateMessageQuality("مرحبًا أحمد، اشتراكك جاهز للتجديد. لإيقاف الرسائل أرسل إيقاف.");
    const risky = evaluateMessageQuality("FREE urgent discount https://a.test https://b.test https://c.test");

    expect(good.score).toBe("excellent");
    expect(risky.score).toBe("risk");
    expect(risky.warnings).toContain("Too many links");
  });
});
