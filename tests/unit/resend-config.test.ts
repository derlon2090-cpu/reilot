import { afterEach, describe, expect, it } from "vitest";
import { extractAddress, getEmailConfig, isAllowedRenvixSender } from "../../src/lib/email/resend.js";

const ORIGINAL = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Resend sender configuration", () => {
  it("extracts the mailbox from a display-name address", () => {
    expect(extractAddress("Renvix <noreply@renvix.app>")).toBe("noreply@renvix.app");
  });

  it("allows only the Renvix root domain and its subdomains", () => {
    expect(isAllowedRenvixSender("Renvix <noreply@renvix.app>")).toBe(true);
    expect(isAllowedRenvixSender("Renvix <noreply@notify.renvix.app>")).toBe(true);
    expect(isAllowedRenvixSender("Renvix <noreply@example.com>")).toBe(false);
  });

  it("uses the server-configured Renvix sender identity", () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_only";
    process.env.RESEND_FROM_EMAIL = "Renvix Login <otp@renvix.app>";
    expect(getEmailConfig().from).toBe("Renvix Login <otp@renvix.app>");
  });

  it("rejects a configured sender outside the Renvix domain", () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_only";
    process.env.RESEND_FROM_EMAIL = "Attacker <noreply@example.com>";
    expect(() => getEmailConfig()).toThrow(/renvix\.app/i);
  });
});
