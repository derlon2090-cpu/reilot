import { describe, expect, it } from "vitest";
import { canSendSafely, evaluateMessageQuality, isQuietHour } from "../../src/lib/messageSafety.js";

describe("WhatsApp safety", () => {
  it("applies quiet hours, hourly, daily, duplicate, unsubscribe, risk, and disconnected checks", () => {
    expect(isQuietHour(new Date("2026-07-10T22:00:00"))).toBe(true);
    expect(canSendSafely({ hourlySent: 2, hourlyLimit: 2 }).reason).toBe("hourly_limit");
    expect(canSendSafely({ dailySent: 5, dailyLimit: 5 }).reason).toBe("daily_limit");
    expect(canSendSafely({ unsubscribed: true }).reason).toBe("unsubscribed");
    expect(canSendSafely({ duplicateWithinWindow: true }).reason).toBe("duplicate_message");
    expect(canSendSafely({ riskScore: 71 }).reason).toBe("high_risk_score");
    expect(canSendSafely({ channelStatus: "disconnected" }).reason).toBe("channel_disconnected");
  });

  it("scores message quality and warns on risky copy", () => {
    const good = evaluateMessageQuality("مرحبًا أحمد، اشتراكك جاهز للتجديد. لإيقاف الرسائل أرسل إيقاف.");
    const risky = evaluateMessageQuality("FREE urgent discount https://a.test https://b.test https://c.test");

    expect(good.score).toBe("excellent");
    expect(risky.score).toBe("risk");
    expect(risky.warnings).toContain("Too many links");
  });
});
