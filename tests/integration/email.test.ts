import { describe, expect, it, vi } from "vitest";
import { getEmailConfig } from "../../src/lib/email/resend.js";

describe("email integration", () => {
  it("uses a mocked Resend provider and keeps API keys server-side", async () => {
    const resend = { send: vi.fn(async () => ({ id: "email-1" })) };
    const result = await resend.send({ from: "support@renew.test", to: "customer@test.com", subject: "Renewal", html: "<p>Hi</p>" });

    expect(result.id).toBe("email-1");
    expect(resend.send.mock.calls[0][0]).not.toHaveProperty("RESEND_API_KEY");
  });

  it("keeps the approved Renvix sender and reply-to fixed on the server", () => {
    const previousKey = process.env.RESEND_API_KEY;
    const previousFrom = process.env.RESEND_FROM_EMAIL;
    process.env.RESEND_API_KEY = "test-server-key";
    process.env.RESEND_FROM_EMAIL = "Attacker <attacker@example.com>";
    try {
      const config = getEmailConfig();
      expect(config.from).toBe("Renvix <noreply@notify.renvix.app>");
      expect(config.supportEmail).toBe("support@renvix.app");
    } finally {
      if (previousKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = previousKey;
      if (previousFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
      else process.env.RESEND_FROM_EMAIL = previousFrom;
    }
  });
});
