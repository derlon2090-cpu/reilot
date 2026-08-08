import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(),
  clientQuery: vi.fn(),
  sendLoginEmailOtp: vi.fn()
}));

vi.mock("../../src/server/db.js", () => ({
  query: mocks.query,
  transaction: mocks.transaction
}));
vi.mock("../../src/server/email/resend.service.js", () => ({
  sendLoginEmailOtp: mocks.sendLoginEmailOtp
}));
vi.mock("../../src/server/default-templates.js", () => ({ ensureDefaultTemplates: vi.fn() }));
vi.mock("../../src/server/trusted-browser.js", () => ({
  TRUSTED_BROWSER_COOKIE: "__Host-rvx_trusted_browser",
  TRUSTED_BROWSER_DEV_COOKIE: "rvx_trusted_browser_dev",
  hashBrowserToken: vi.fn(),
  trustBrowserForUser: vi.fn(),
  trustedBrowserAgeSeconds: () => 48 * 60 * 60,
  trustedBrowserEnabled: () => true,
  validateTrustedBrowser: vi.fn(),
  revokeAllUserBrowsers: vi.fn()
}));

describe("admin email OTP compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EMAIL_OTP_PEPPER = "test-email-otp-pepper-that-is-long-enough";
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: "11111111-1111-4111-8111-111111111111",
          expiresAt: new Date(Date.now() + 300_000),
          lastSentAt: new Date()
        }]
      })
      .mockResolvedValueOnce({ rows: [] });
    mocks.transaction.mockImplementation(async (callback) => callback({ query: mocks.clientQuery }));
    mocks.query.mockResolvedValue({ rows: [] });
    mocks.sendLoginEmailOtp.mockResolvedValue({ id: "email-1" });
  });

  it("stores an admin challenge with the legacy-safe login purpose while signing it as admin_login", async () => {
    const { createLoginEmailOtpChallenge } = await import("../../src/server/email-otp-v2.js");
    const result = await createLoginEmailOtpChallenge({
      user: {
        id: "22222222-2222-4222-8222-222222222222",
        tenantId: null,
        email: "admin@example.com",
        name: "Admin"
      },
      ipAddress: "127.0.0.1",
      userAgent: "test",
      purpose: "admin_login",
      loginAttemptId: "44444444-4444-4444-8444-444444444444"
    });

    expect(result.challengeCookie).toMatch(/^admin_login\./);
    expect(mocks.sendLoginEmailOtp).toHaveBeenCalledTimes(1);
    const purposeValues = mocks.clientQuery.mock.calls
      .filter(([sql]) => String(sql).includes("auth_email_otp_challenges"))
      .flatMap(([, values]) => Array.isArray(values) ? values : []);
    expect(purposeValues).toContain("login");
    expect(purposeValues).not.toContain("admin_login");
    const insertCall = mocks.clientQuery.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO auth_email_otp_challenges"));
    expect(insertCall?.[1]).toContain(null);
    expect(String(insertCall?.[0])).toContain("code_digest");
    expect(mocks.clientQuery.mock.calls.some(([sql]) => String(sql).includes("SET code_digest"))).toBe(false);
  });
});
