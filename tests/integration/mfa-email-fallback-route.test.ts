import { beforeEach, describe, expect, it, vi } from "vitest";

const { getContext, createEmailChallenge } = vi.hoisted(() => ({
  getContext: vi.fn(),
  createEmailChallenge: vi.fn()
}));

vi.mock("../../src/server/login-mfa.js", () => ({
  getMfaEmailFallbackContext: getContext,
  readMfaChallengeCookie: () => "signed-mfa",
  clearMfaChallengeCookie: () => "renvix_mfa_login_challenge=; Max-Age=0; HttpOnly"
}));
vi.mock("../../src/server/email-otp-v2.js", () => ({
  createLoginEmailOtpChallenge: createEmailChallenge,
  challengeCookie: (value: string) => `renvix_email_otp_challenge=${value}; HttpOnly`,
  adminChallengeCookie: (value: string) => `renvix_admin_email_otp_challenge=${value}; HttpOnly`
}));

import { POST } from "../../app/api/auth/mfa/email-fallback/route.js";

describe("POST /api/auth/mfa/email-fallback", () => {
  beforeEach(() => {
    getContext.mockReset().mockResolvedValue({
      ok: true,
      challengeId: "challenge-1",
      targetPath: "/dashboard",
      loginAttemptId: "attempt-1",
      user: { id: "user-1", tenantId: "tenant-1", email: "owner@example.com", name: "Owner" }
    });
    createEmailChallenge.mockReset().mockResolvedValue({
      challengeCookie: "signed-email",
      maskedEmail: "ow•••@example.com",
      expiresAt: new Date(Date.now() + 300_000),
      resendAt: new Date(Date.now() + 60_000)
    });
  });

  it("atomically converts the active MFA challenge to an email challenge", async () => {
    const response = await POST(new Request("http://localhost/api/auth/mfa/email-fallback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "ar" })
    }));
    const body = await response.json();
    const cookies = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(202);
    expect(body).toMatchObject({ ok: true, requiresEmailOtp: true, purpose: "login" });
    expect(cookies).toContain("renvix_email_otp_challenge=signed-email");
    expect(cookies).toContain("renvix_mfa_login_challenge=");
    expect(createEmailChallenge).toHaveBeenCalledWith(expect.objectContaining({
      sourceMfaChallengeId: "challenge-1",
      loginAttemptId: "attempt-1"
    }));
  });

  it("does not create an email challenge after the MFA challenge expires", async () => {
    getContext.mockResolvedValue({ ok: false, status: 410, reason: "challenge_expired" });
    const response = await POST(new Request("http://localhost/api/auth/mfa/email-fallback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }));

    expect(response.status).toBe(410);
    expect(createEmailChallenge).not.toHaveBeenCalled();
  });
});
