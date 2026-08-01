import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateMessageUsage } from "../../src/lib/billing/message-quota.js";
import { metaTemplateDraftSchema } from "../../src/server/meta-template-service.js";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const billingSource = readFileSync(new URL("../../src/server/billing-overview.js", import.meta.url), "utf8");
const whatsappTopupRoute = readFileSync(new URL("../../app/api/billing/whatsapp/top-up/route.js", import.meta.url), "utf8");

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

  it("does not render temporary zero billing values before both server responses arrive", () => {
    expect(appSource).toContain("state.billingOverview === null || state.messageUsage === null");
    expect(appSource).toContain("جاري مزامنة بيانات الفوترة");
    expect(appSource).toContain("لم نعرض قيمًا افتراضية حتى لا تظهر أرقام غير صحيحة");
  });

  it("shows Meta-managed WhatsApp usage without a Renvix wallet or top-up", () => {
    expect(billingSource).toContain("provider IN ('meta','meta_cloud_api')");
    expect(billingSource).toContain('metaConnection: {');
    expect(billingSource).not.toContain("ensureWhatsappWalletWithClient");
    expect(appSource).toContain("المقبولة لدى Meta");
    expect(appSource).toContain("الفوترة تتم مباشرة من Meta");
    expect(appSource).not.toContain("رصيد محفظة واتساب");
    expect(appSource).not.toContain("شحن رصيد واتساب");
    expect(whatsappTopupRoute).toContain('code: "META_MANAGED_BILLING"');
    expect(whatsappTopupRoute).toContain("لا تبيع Renvix رصيد واتساب");
  });

  it("routes additional credit requests to email instead of WhatsApp", () => {
    expect(appSource).toContain("شحن رصيد رسائل البريد");
    expect(appSource).toContain("function emailCreditPanel(emailUsage = {})");
    expect(appSource).toContain('data-link="/dashboard/support"');
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
