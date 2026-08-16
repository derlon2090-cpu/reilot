import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/db.js", () => ({ databaseHealth: async () => ({ ok: true }) }));
vi.mock("../../src/server/auth-schema-readiness.js", () => ({ authSchemaHealth: async () => ({ ok: true, migrationApplied: true }) }));
vi.mock("../../src/server/platform-schema-readiness.js", () => ({ platformSchemaHealth: async () => ({ ok: true, migrationApplied: true }) }));
vi.mock("../../src/server/evolution-client.js", () => ({
  evolutionHealth: async () => ({ ok: true }),
  evolutionEndpointProfile: () => "test-profile"
}));
vi.mock("../../src/lib/email/resend.js", () => ({
  resendProviderHealth: async () => ({ ok: true, providerReachable: true })
}));
import { GET } from "../../app/api/health/route.js";

const keys = ["AUTH_SECOND_FACTOR_REQUIRED", "EMAIL_SIGNUP_OTP_REQUIRED", "EMAIL_OTP_FALLBACK_ENABLED", "TRUSTED_BROWSER_ENABLED", "TRUSTED_BROWSER_HOURS", "EMAIL_OTP_ENFORCE_ALL", "EMAIL_OTP_PEPPER", "RESEND_API_KEY", "DEEPSEEK_API_KEY", "EVOLUTION_API_URL", "EVOLUTION_API_KEY"];

describe("authentication readiness", () => {
  beforeEach(() => {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, {
      AUTH_SECOND_FACTOR_REQUIRED: "true", EMAIL_SIGNUP_OTP_REQUIRED: "true", EMAIL_OTP_FALLBACK_ENABLED: "true",
      TRUSTED_BROWSER_ENABLED: "true", TRUSTED_BROWSER_HOURS: "48", EMAIL_OTP_ENFORCE_ALL: "false",
      EMAIL_OTP_PEPPER: "test-email-otp-pepper-that-is-long-enough"
    });
  });
  afterEach(() => { for (const key of keys) delete process.env[key]; });

  it("fails readiness when signup/fallback email delivery is unavailable", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.checks.emailOtp).toMatchObject({ required: true, ok: false });
  });

  it("accepts the exact unified-factor policy when Resend and pepper are configured", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.checks.authPolicy).toMatchObject({ ok: true, trustedBrowserHours: 48, emailOtpEnforceAllDisabled: true });
    expect(body.checks.authSchema).toMatchObject({ ok: true, migrationApplied: true });
    expect(body.checks.emailOtp.ok).toBe(true);
    expect(body.checks.deepseek).toEqual({ configured: false, ok: false });
  });

  it("reports only the safe DeepSeek configuration status", async () => {
    process.env.DEEPSEEK_API_KEY = "server-only-test-secret";
    const response = await GET();
    const body = await response.json();
    expect(body.checks.deepseek).toEqual({ configured: true, ok: true });
    expect(JSON.stringify(body)).not.toContain("server-only-test-secret");
  });
});
