import { describe, expect, it } from "vitest";
import { calculateMessageUsage } from "../../src/lib/billing/message-quota.js";
import { walletHealth } from "../../src/lib/billing/whatsapp-wallet.js";
import { metaTemplateDraftSchema } from "../../src/server/meta-template-service.js";

describe("channel billing separation", () => {
  it("keeps email quota separate from usage-based WhatsApp", () => {
    const usage = calculateMessageUsage({
      id: "period-1",
      email_message_limit: 500,
      email_used: 125,
      email_reserved: 5,
      whatsapp_message_limit: -1,
      whatsapp_used: 5000,
      whatsapp_reserved: 0,
      sms_message_limit: 0,
      sms_used: 0,
      sms_reserved: 0,
      used_messages: 5125,
      reserved_messages: 5
    });
    expect(usage.limit).toBe(500);
    expect(usage.channels.email.remaining).toBe(370);
    expect(usage.channels.whatsapp.unlimited).toBe(true);
    expect(usage.channels.whatsapp.limit).toBe(-1);
    expect(usage.channels.whatsapp.used).toBe(5000);
  });

  it("reports wallet health without inventing a quota", () => {
    expect(walletHealth({ available_balance: 0, low_balance_threshold: 10 })).toBe("insufficient");
    expect(walletHealth({ available_balance: 4, low_balance_threshold: 10 })).toBe("critical");
    expect(walletHealth({ available_balance: 8, low_balance_threshold: 10 })).toBe("low");
    expect(walletHealth({ available_balance: 50, low_balance_threshold: 10 })).toBe("good");
  });
});

describe("Meta template drafts", () => {
  it("accepts a local draft with exactly one BODY component", () => {
    const parsed = metaTemplateDraftSchema.safeParse({
      name: "renewal_reminder_ar",
      language: "ar",
      category: "UTILITY",
      components: [{ type: "BODY", text: "مرحبًا {{1}}" }]
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unsafe names and drafts without a BODY", () => {
    expect(metaTemplateDraftSchema.safeParse({
      name: "Renewal Template",
      language: "ar",
      category: "UTILITY",
      components: [{ type: "FOOTER", text: "Renvix" }]
    }).success).toBe(false);
  });
});
