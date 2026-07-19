import { describe, expect, it } from "vitest";
import {
  calculateSmartDelaySeconds,
  isWithinSendingWindow,
  nextSendingWindow,
  riskDisposition,
  scheduleDelivery
} from "../../src/lib/deliveryScheduling.js";

describe("delivery scheduling", () => {
  it.each(["email", "sms"])("does not apply WhatsApp throttling to %s", (channelType) => {
    const result = calculateSmartDelaySeconds({
      channelType,
      sourceMode: "automatic",
      messageType: "renewal_reminder",
      riskScore: 99,
      healthScore: 0,
      random: () => 0
    });
    expect(result).toEqual({ delaySeconds: 0, delayReason: "channel_not_throttled" });
  });

  it("uses a five-minute base plus jitter for automatic WhatsApp", () => {
    const result = calculateSmartDelaySeconds({
      channelType: "whatsapp",
      sourceMode: "automatic",
      messageType: "renewal_reminder",
      riskScore: 0,
      healthScore: 100,
      random: () => 0
    });
    expect(result.delaySeconds).toBe(320);
    expect(result.delayReason).toBe("automatic_whatsapp_spacing");
  });

  it("keeps manual WhatsApp spacing between two and three minutes", () => {
    const result = calculateSmartDelaySeconds({
      channelType: "whatsapp",
      sourceMode: "manual",
      messageType: "manual_order_link",
      riskScore: 0,
      healthScore: 100,
      random: () => 0
    });
    expect(result.delaySeconds).toBe(140);
    expect(result.delayReason).toBe("manual_whatsapp_spacing");

    const maximum = calculateSmartDelaySeconds({
      channelType: "whatsapp",
      sourceMode: "manual",
      messageType: "manual_order_link",
      riskScore: 0,
      healthScore: 100,
      random: () => 1
    });
    expect(maximum.delaySeconds).toBe(180);
  });

  it("holds critical-risk WhatsApp traffic", () => {
    expect(riskDisposition(85)).toMatchObject({ action: "hold", reason: "critical_risk" });
    expect(riskDisposition(70)).toMatchObject({ action: "pause", reason: "high_risk" });
  });

  it("keeps non-WhatsApp delivery independent from the WhatsApp window", () => {
    const friday = new Date("2026-07-17T09:00:00.000Z");
    expect(scheduleDelivery({ now: friday, channelType: "email", delaySeconds: 0 })).toEqual(friday);
    expect(isWithinSendingWindow(friday)).toBe(false);
    expect(nextSendingWindow(friday).getTime()).toBeGreaterThan(friday.getTime());
  });
});
