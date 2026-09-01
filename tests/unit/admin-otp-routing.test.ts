import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyEmailOtp: vi.fn(),
  adminSessionCookie: vi.fn((token: string) => `renvix_admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict`),
  customerSessionCookie: vi.fn((token: string) => `renewpilot_session=${token}; Path=/; HttpOnly`)
}));

vi.mock("../../src/server/session.js", () => ({
  adminSessionCookie: mocks.adminSessionCookie,
  sessionCookie: mocks.customerSessionCookie
}));
vi.mock("../../src/server/security.js", () => ({ safeErrorMessage: () => "safe" }));
vi.mock("../../src/server/email-otp-v2.js", () => ({
  clearAdminChallengeCookie: () => "renvix_admin_email_otp_challenge=; Max-Age=0; HttpOnly",
  clearChallengeCookie: () => "renvix_email_otp_challenge=; Max-Age=0; HttpOnly",
  readEmailOtpChallengeCookie: () => ({ value: "signed-admin-challenge", admin: true }),
  readTrustedBrowserCookie: () => "",
  trustedDeviceCookie: (value: string) => `trusted=${value}`,
  verifyEmailOtp: mocks.verifyEmailOtp
}));

import { POST } from "../../app/api/auth/email-otp/verify/route.js";

describe("admin OTP canonical routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes admin login OTP and MFA to canonical verification pages, never the legacy public route", () => {
    const form = readFileSync(resolve("src/components/admin-auth/AdminLoginForm.jsx"), "utf8");
    const spa = readFileSync(resolve("src/app/app.js"), "utf8");
    expect(form).toContain('window.location.replace("/verify-email")');
    expect(form).toContain('window.location.replace("/verify-mfa")');
    expect(form).not.toContain('window.location.replace("/auth/verify-email")');
    expect(form).not.toContain('window.location.replace("/auth/verify-mfa")');
    expect(spa).toContain('"/verify-email": emailOtpPage');
    expect(spa).toContain('"/verify-mfa": mfaLoginPage');
  });

  it("creates only an isolated admin session and redirects successful admin OTP to /admin", async () => {
    mocks.verifyEmailOtp.mockResolvedValue({
      ok: true,
      session: { token: "admin-session-token" },
      sessionCookieMaxAge: null,
      user: { id: "admin-user" },
      redirectUrl: "/admin",
      trustedToken: null,
      trustedUntil: null
    });
    const response = await POST(new Request("https://api.renvix.app/api/auth/email-otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: "renvix_admin_email_otp_challenge=signed-admin-challenge" },
      body: JSON.stringify({ code: "123456" })
    }));
    const cookie = response.headers.get("set-cookie") || "";
    await expect(response.json()).resolves.toMatchObject({ ok: true, redirectUrl: "/admin" });
    expect(cookie).toContain("renvix_admin_session=admin-session-token");
    expect(cookie).not.toContain("renewpilot_session=");
    expect(mocks.adminSessionCookie).toHaveBeenCalledOnce();
    expect(mocks.customerSessionCookie).not.toHaveBeenCalled();
  });
});
