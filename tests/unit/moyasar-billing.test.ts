import { describe, expect, it } from "vitest";
import {
  normalizeMoyasarWebhook,
  secureWebhookTokenMatches,
  WHATSAPP_TOPUP_AMOUNTS
} from "../../src/server/moyasar-billing.js";

describe("Moyasar WhatsApp top-ups", () => {
  it("only exposes the approved wallet amounts", () => {
    expect(WHATSAPP_TOPUP_AMOUNTS).toEqual([50, 100, 250, 500, 1000]);
  });

  it("normalizes a paid payment event without trusting extra fields", () => {
    expect(normalizeMoyasarWebhook({
      type: "payment_paid",
      secret_token: "secret",
      data: { id: "pay_1", invoice_id: "inv_1", status: "paid", amount: 999999 }
    })).toEqual({
      type: "payment_paid",
      secretToken: "secret",
      paymentId: "pay_1",
      invoiceId: "inv_1",
      status: "paid"
    });
  });

  it("rejects missing, short, or different webhook tokens", () => {
    expect(secureWebhookTokenMatches("", "secret")).toBe(false);
    expect(secureWebhookTokenMatches("secret", "")).toBe(false);
    expect(secureWebhookTokenMatches("secret-2", "secret")).toBe(false);
    expect(secureWebhookTokenMatches("secret", "secret")).toBe(true);
  });
});
